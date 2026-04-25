'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Briefcase, Clock, CheckCircle, XCircle, PlusCircle, Users, ArrowRight, Eye, ExternalLink, Trash2, Sparkles, Target, MapPin } from 'lucide-react'

type Profile = { role: 'seeker' | 'employer'; full_name: string; city: string }
type Application = { id: string; status: string; created_at: string; opportunity?: { title: string; company_name?: string; type: string } }
type PostedJob = { id: string; title: string; status: string; created_at: string; type: string; applications_count?: number }
type ExternalApplication = { id: string; job_title: string; company: string; job_url: string; applied_at: string; external_opportunity_id?: string }
type PickedJob = {
  match_score: number
  job_id: string
  external_opportunities: {
    id: string; title: string; company: string; city: string; work_mode: string; category: string; posted_at?: string; synced_at: string
  } | null
}
type CandidateMatch = { match_score: number; seeker_id: string; opportunity_id: string; opportunity_title: string; seeker_name: string; seeker_city: string }

const statusIcon = (status: string) => {
  if (status === 'accepted') return <CheckCircle size={16} className="text-green-500" />
  if (status === 'rejected') return <XCircle size={16} className="text-red-400" />
  return <Clock size={16} className="text-yellow-500" />
}

const statusLabel: Record<string, string> = {
  pending: 'Under Review',
  reviewed: 'Reviewed',
  accepted: 'Accepted',
  rejected: 'Not Selected',
}

export default function DashboardPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [applications, setApplications] = useState<Application[]>([])
  const [externalApplications, setExternalApplications] = useState<ExternalApplication[]>([])
  const [postedJobs, setPostedJobs] = useState<PostedJob[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [pickedJobs, setPickedJobs] = useState<PickedJob[]>([])
  const [candidateMatches, setCandidateMatches] = useState<CandidateMatch[]>([])

  useEffect(() => {
    loadDashboard()
  }, [])

  const loadDashboard = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth/signin'); return }

    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (!profileData) { router.push('/profile/setup'); return }
    setProfile(profileData)

    if (profileData.role === 'seeker') {
      const { data: apps } = await supabase
        .from('applications')
        .select('*, opportunities(title, type, employer_profiles(company_name))')
        .eq('seeker_id', user.id)
        .order('created_at', { ascending: false })

      setApplications((apps || []).map((a: Record<string, unknown>) => ({
        id: a.id as string,
        status: a.status as string,
        created_at: a.created_at as string,
        opportunity: a.opportunities ? {
          title: (a.opportunities as Record<string, unknown>).title as string,
          type: (a.opportunities as Record<string, unknown>).type as string,
          company_name: ((a.opportunities as Record<string, unknown>).employer_profiles as { company_name?: string } | null)?.company_name,
        } : undefined,
      })))

      const { data: extApps } = await supabase
        .from('external_applications')
        .select('id, job_title, company, job_url, applied_at, external_opportunity_id')
        .eq('seeker_id', user.id)
        .order('applied_at', { ascending: false })
      setExternalApplications((extApps || []) as ExternalApplication[])

      // Load "Picked for You" pre-computed matches (≥70%)
      try {
        const { data: picks } = await supabase
          .from('job_matches')
          .select('match_score, job_id, external_opportunities(id, title, company, city, work_mode, category, posted_at, synced_at)')
          .eq('seeker_id', user.id)
          .gte('match_score', 70)
          .order('match_score', { ascending: false })
          .limit(10)
        if (picks) setPickedJobs(picks as unknown as PickedJob[])
      } catch { /* table not yet created — silently skip */ }
    } else {
      const { data: jobs } = await supabase
        .from('opportunities')
        .select('*, applications(count)')
        .eq('employer_id', user.id)
        .order('created_at', { ascending: false })

      setPostedJobs((jobs || []).map((j: Record<string, unknown>) => ({
        id: j.id as string,
        title: j.title as string,
        status: j.status as string,
        created_at: j.created_at as string,
        type: j.type as string,
        applications_count: Array.isArray(j.applications) ? j.applications.length : 0,
      })))

      // Load top candidate matches (≥75%) for employer's open jobs
      try {
        const { data: matches } = await supabase
          .from('candidate_matches')
          .select('match_score, seeker_id, opportunity_id, opportunities(title)')
          .eq('employer_id', user.id)
          .gte('match_score', 75)
          .order('match_score', { ascending: false })
          .limit(20)

        if (matches && matches.length > 0) {
          const seekerIds = [...new Set(matches.map((m: Record<string, unknown>) => m.seeker_id as string))]
          const { data: seekerProfs } = await supabase
            .from('profiles')
            .select('user_id, full_name, city')
            .in('user_id', seekerIds)
          const profMap = new Map((seekerProfs || []).map((p: Record<string, unknown>) => [p.user_id as string, p]))

          setCandidateMatches(matches.map((m: Record<string, unknown>) => ({
            match_score: m.match_score as number,
            seeker_id: m.seeker_id as string,
            opportunity_id: m.opportunity_id as string,
            opportunity_title: ((m.opportunities as Record<string, unknown> | null)?.title as string) || 'Opportunity',
            seeker_name: (profMap.get(m.seeker_id as string) as Record<string, unknown>)?.full_name as string || 'Candidate',
            seeker_city: (profMap.get(m.seeker_id as string) as Record<string, unknown>)?.city as string || '',
          })))
        }
      } catch { /* table not yet created — silently skip */ }
    }

    setLoading(false)
  }

  const deleteExternalApp = async (id: string) => {
    if (deletingId) return
    setDeletingId(id)
    await supabase.from('external_applications').delete().eq('id', id)
    setExternalApplications((prev) => prev.filter((a) => a.id !== id))
    setDeletingId(null)
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-10 animate-pulse space-y-4">
        <div className="h-8 bg-gray-200 rounded w-1/3" />
        <div className="h-32 bg-gray-100 rounded-xl" />
        <div className="h-48 bg-gray-100 rounded-xl" />
      </div>
    )
  }

  if (!profile) return null

  return (
    <div className="bg-gray-50 min-h-screen py-8">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="bg-gradient-to-r from-red-600 to-red-700 text-white rounded-2xl p-6 mb-6">
          <p className="text-red-200 text-sm mb-1">Welcome back</p>
          <h1 className="text-2xl font-bold">{profile.full_name}</h1>
          <p className="text-red-100 mt-1">{profile.city} · {profile.role === 'seeker' ? 'Job Seeker' : 'Employer'}</p>
          <div className="mt-4 flex flex-wrap gap-3">
            {profile.role === 'seeker' ? (
              <>
                <Link href="/opportunities" className="bg-white text-red-600 hover:bg-red-50 px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors">
                  <Briefcase size={16} /> Browse Opportunities
                </Link>
                <Link href="/profile/setup" className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors">
                  Edit Profile
                </Link>
              </>
            ) : (
              <>
                <Link href="/post-opportunity" className="bg-white text-red-600 hover:bg-red-50 px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors">
                  <PlusCircle size={16} /> Post Opportunity
                </Link>
                <Link href="/candidates" className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors">
                  <Users size={16} /> Browse Candidates
                </Link>
              </>
            )}
          </div>
        </div>

        {profile.role === 'seeker' ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
                <div className="text-2xl font-bold text-gray-900">{applications.length}</div>
                <div className="text-sm text-gray-500 mt-1">CanStart Applied</div>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
                <div className="text-2xl font-bold text-blue-600">{externalApplications.length}</div>
                <div className="text-sm text-gray-500 mt-1">External Applied</div>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
                <div className="text-2xl font-bold text-green-600">{applications.filter((a) => a.status === 'accepted').length}</div>
                <div className="text-sm text-gray-500 mt-1">Accepted</div>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
                <div className="text-2xl font-bold text-yellow-500">{applications.filter((a) => a.status === 'pending' || a.status === 'reviewed').length}</div>
                <div className="text-sm text-gray-500 mt-1">Pending</div>
              </div>
            </div>

            {/* ── Picked for You ─────────────────────────────────────── */}
            {pickedJobs.length > 0 && (
              <div className="bg-white rounded-2xl border border-purple-200 p-6 mb-6">
                <div className="flex items-center justify-between mb-1">
                  <h2 className="font-bold text-gray-900 text-lg flex items-center gap-2">
                    <Sparkles size={18} className="text-purple-500" /> Picked for You Only
                  </h2>
                  <Link href="/opportunities" className="text-sm text-purple-600 hover:text-purple-700 flex items-center gap-1">
                    Browse all <ArrowRight size={14} />
                  </Link>
                </div>
                <p className="text-xs text-gray-500 mb-4">
                  {pickedJobs.length} job{pickedJobs.length !== 1 ? 's' : ''} matching ≥70% of your resume profile · refreshed daily at 5:30 AM
                </p>
                <div className="space-y-2">
                  {pickedJobs.map((pick) => {
                    const job = pick.external_opportunities
                    if (!job) return null
                    return (
                      <Link
                        key={pick.job_id}
                        href={`/jobs/${job.id}`}
                        className="flex items-center justify-between p-3.5 bg-purple-50 hover:bg-purple-100 rounded-xl border border-purple-100 transition-colors group"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-900 text-sm truncate">{job.title}</p>
                          <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                            {job.company}
                            <span className="text-gray-300">·</span>
                            <MapPin size={10} className="inline" />{job.city}
                            <span className="text-gray-300">·</span>
                            <span className="capitalize">{job.work_mode}</span>
                          </p>
                        </div>
                        <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                          <span className={`text-sm font-bold ${pick.match_score >= 85 ? 'text-green-600' : 'text-purple-600'}`}>
                            {pick.match_score}%
                          </span>
                          <ArrowRight size={13} className="text-gray-400 group-hover:text-purple-600 transition-colors" />
                        </div>
                      </Link>
                    )
                  })}
                </div>
              </div>
            )}

            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-gray-900 text-lg">My Applications</h2>
                <Link href="/opportunities" className="text-sm text-red-600 hover:text-red-700 flex items-center gap-1">
                  Browse more <ArrowRight size={14} />
                </Link>
              </div>
              {applications.length === 0 ? (
                <div className="text-center py-10">
                  <Briefcase size={36} className="mx-auto text-gray-300 mb-3" />
                  <p className="text-gray-500 text-sm mb-4">You haven&apos;t applied to any opportunities yet.</p>
                  <Link href="/opportunities" className="bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-4 py-2 rounded-lg inline-flex items-center gap-2 transition-colors">
                    Browse Opportunities <ArrowRight size={14} />
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {applications.map((app) => (
                    <div key={app.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 text-sm truncate">{app.opportunity?.title || 'Opportunity'}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{app.opportunity?.company_name} · {new Date(app.created_at).toLocaleDateString()}</p>
                      </div>
                      <div className="flex items-center gap-2 ml-3">
                        {statusIcon(app.status)}
                        <span className="text-xs font-medium text-gray-600">{statusLabel[app.status] || app.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {/* External applications */}
            {externalApplications.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-200 p-6 mt-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-bold text-gray-900 text-lg flex items-center gap-2">
                    <ExternalLink size={18} className="text-blue-500" /> External Job Applications
                  </h2>
                  <Link href="/opportunities" className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1">
                    Find more <ArrowRight size={14} />
                  </Link>
                </div>
                <div className="space-y-3">
                  {externalApplications.map((app) => (
                    <div key={app.id} className="flex items-center justify-between p-4 bg-blue-50 rounded-xl border border-blue-100">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 text-sm truncate">{app.job_title}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{app.company} · {new Date(app.applied_at).toLocaleDateString()}</p>
                      </div>
                      <div className="flex items-center gap-2 ml-3">
                        {app.external_opportunity_id ? (
                          <Link href={`/jobs/${app.external_opportunity_id}`} className="text-xs flex items-center gap-1 text-blue-600 hover:text-blue-800 font-medium">
                            <Eye size={12} /> View
                          </Link>
                        ) : (
                          <a href={app.job_url} target="_blank" rel="noopener noreferrer" className="text-xs flex items-center gap-1 text-blue-600 hover:text-blue-800 font-medium">
                            <ExternalLink size={12} /> View
                          </a>
                        )}
                        <span className="text-xs font-medium bg-green-100 text-green-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <CheckCircle size={11} /> Tracked
                        </span>
                        <button
                          onClick={() => deleteExternalApp(app.id)}
                          disabled={deletingId === app.id}
                          className="text-gray-300 hover:text-red-500 transition-colors disabled:opacity-40 p-1 rounded"
                          title="Remove from tracker"
                        >
                          {deletingId === app.id
                            ? <div className="w-3 h-3 border border-red-400 border-t-transparent rounded-full animate-spin" />
                            : <Trash2 size={13} />}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
              <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
                <div className="text-2xl font-bold text-gray-900">{postedJobs.length}</div>
                <div className="text-sm text-gray-500 mt-1">Posted Jobs</div>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
                <div className="text-2xl font-bold text-green-600">{postedJobs.filter((j) => j.status === 'open').length}</div>
                <div className="text-sm text-gray-500 mt-1">Active Listings</div>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
                <div className="text-2xl font-bold text-blue-600">{postedJobs.reduce((s, j) => s + (j.applications_count || 0), 0)}</div>
                <div className="text-sm text-gray-500 mt-1">Total Applications</div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-gray-900 text-lg">Posted Opportunities</h2>
                <Link href="/post-opportunity" className="text-sm text-red-600 hover:text-red-700 flex items-center gap-1">
                  <PlusCircle size={14} /> Post New
                </Link>
              </div>
              {postedJobs.length === 0 ? (
                <div className="text-center py-10">
                  <PlusCircle size={36} className="mx-auto text-gray-300 mb-3" />
                  <p className="text-gray-500 text-sm mb-4">You haven&apos;t posted any opportunities yet.</p>
                  <Link href="/post-opportunity" className="bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-4 py-2 rounded-lg inline-flex items-center gap-2 transition-colors">
                    Post Your First Opportunity <ArrowRight size={14} />
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {postedJobs.map((job) => (
                    <div key={job.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 text-sm truncate">{job.title}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{job.type} · {new Date(job.created_at).toLocaleDateString()}</p>
                      </div>
                      <div className="flex items-center gap-3 ml-3">
                        <span className="text-xs text-blue-600 font-medium flex items-center gap-1">
                          <Users size={12} /> {job.applications_count || 0}
                        </span>
                        <span className={`text-xs font-medium px-2 py-1 rounded-full ${job.status === 'open' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {job.status}
                        </span>
                        <Link href={`/applications/${job.id}`} className="text-xs font-medium text-blue-600 hover:text-blue-800 flex items-center gap-1">
                          <Eye size={14} /> Applicants
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {/* ── Top Candidate Matches ───────────────────────────────── */}
            {candidateMatches.length > 0 && (
              <div className="bg-white rounded-2xl border border-green-200 p-6 mt-6">
                <div className="flex items-center justify-between mb-1">
                  <h2 className="font-bold text-gray-900 text-lg flex items-center gap-2">
                    <Target size={18} className="text-green-500" /> Top Candidate Matches
                  </h2>
                  <Link href="/candidates" className="text-sm text-green-600 hover:text-green-700 flex items-center gap-1">
                    Browse all <ArrowRight size={14} />
                  </Link>
                </div>
                <p className="text-xs text-gray-500 mb-4">
                  {candidateMatches.length} candidate{candidateMatches.length !== 1 ? 's' : ''} matching ≥75% of your job requirements · refreshed daily at 5:30 AM
                </p>
                <div className="space-y-2">
                  {candidateMatches.map((match, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3.5 bg-green-50 rounded-xl border border-green-100">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 text-sm">{match.seeker_name}</p>
                        <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                          {match.seeker_city && <><MapPin size={10} className="inline" />{match.seeker_city}<span className="text-gray-300">·</span></>}
                          For: <span className="font-medium text-gray-600">{match.opportunity_title}</span>
                        </p>
                      </div>
                      <div className="flex items-center gap-3 ml-3 flex-shrink-0">
                        <span className="text-sm font-bold text-green-600">{match.match_score}%</span>
                        <Link href="/candidates" className="text-xs font-semibold text-blue-600 hover:text-blue-800">
                          View Profile
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
