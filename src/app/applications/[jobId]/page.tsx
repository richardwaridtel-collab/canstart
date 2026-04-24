'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { ArrowLeft, CheckCircle, XCircle, Clock, MapPin, Globe, Briefcase, Download, ExternalLink, Users } from 'lucide-react'

type Applicant = {
  id: string
  status: string
  cover_note?: string
  created_at: string
  seeker_id: string
  full_name: string
  city?: string
  country_of_origin?: string
  immigration_status?: string
  skills: string[]
  education?: string
  bio?: string
  linkedin_url?: string
  resume_path?: string
  work_preference?: string
}

type Job = { id: string; title: string; company_name?: string; type: string; city: string }

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  reviewed: 'bg-blue-100 text-blue-700 border-blue-200',
  accepted: 'bg-green-100 text-green-700 border-green-200',
  rejected: 'bg-red-100 text-red-600 border-red-200',
}

const STATUS_LABELS: Record<string, string> = { owp: 'Open Work Permit', pr: 'Permanent Resident', student: 'Student Visa', citizen: 'Citizen' }
const MODE_LABELS: Record<string, string> = { remote: 'Remote', hybrid: 'Hybrid', onsite: 'On-site', any: 'Any' }

export default function JobApplicationsPage() {
  const params = useParams()
  const router = useRouter()
  const jobId = params.jobId as string

  const [job, setJob] = useState<Job | null>(null)
  const [applicants, setApplicants] = useState<Applicant[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'pending' | 'accepted' | 'rejected'>('all')

  useEffect(() => { checkAuth() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth/signin'); return }
    const { data: profile } = await supabase.from('profiles').select('role').eq('user_id', user.id).single()
    if (profile?.role !== 'employer') { router.push('/dashboard'); return }
    await loadData(user.id)
    setLoading(false)
  }

  const loadData = async (employerId: string) => {
    // Load job details (verify ownership)
    const { data: jobData } = await supabase
      .from('opportunities')
      .select('id, title, type, city, employer_profiles(company_name)')
      .eq('id', jobId)
      .eq('employer_id', employerId)
      .single()

    if (!jobData) { router.push('/dashboard'); return }
    setJob({
      id: jobData.id,
      title: jobData.title,
      type: jobData.type,
      city: jobData.city,
      company_name: (jobData.employer_profiles as { company_name?: string } | null)?.company_name,
    })

    // Load applications with seeker profiles
    const { data: apps } = await supabase
      .from('applications')
      .select('id, status, cover_note, created_at, seeker_id')
      .eq('opportunity_id', jobId)
      .order('created_at', { ascending: false })

    if (!apps || apps.length === 0) { setApplicants([]); return }

    const seekerIds = apps.map((a: { seeker_id: string }) => a.seeker_id)
    const { data: profiles } = await supabase.from('profiles').select('user_id, full_name, city').in('user_id', seekerIds)
    const { data: spData } = await supabase.from('seeker_profiles').select('user_id, country_of_origin, immigration_status, skills, education, bio, linkedin_url, resume_path, work_preference').in('user_id', seekerIds)

    const pm = new Map((profiles || []).map((p: { user_id: string; full_name: string; city: string }) => [p.user_id, p]))
    const sm = new Map((spData || []).map((s: Record<string, unknown>) => [s.user_id as string, s]))

    setApplicants(apps.map((a: Record<string, unknown>) => {
      const p = pm.get(a.seeker_id as string)
      const s = sm.get(a.seeker_id as string)
      return {
        id: a.id as string,
        status: a.status as string,
        cover_note: a.cover_note as string | undefined,
        created_at: a.created_at as string,
        seeker_id: a.seeker_id as string,
        full_name: p?.full_name || 'Unknown',
        city: p?.city,
        country_of_origin: s?.country_of_origin as string | undefined,
        immigration_status: s?.immigration_status as string | undefined,
        skills: (s?.skills as string[]) || [],
        education: s?.education as string | undefined,
        bio: s?.bio as string | undefined,
        linkedin_url: s?.linkedin_url as string | undefined,
        resume_path: s?.resume_path as string | undefined,
        work_preference: s?.work_preference as string | undefined,
      }
    }))
  }

  const updateStatus = async (appId: string, newStatus: string) => {
    setUpdating(appId)
    await supabase.from('applications').update({ status: newStatus }).eq('id', appId)
    setApplicants((prev) => prev.map((a) => a.id === appId ? { ...a, status: newStatus } : a))
    setUpdating(null)
  }

  const downloadResume = async (path: string, name: string) => {
    setDownloadingId(name)
    const { data } = await supabase.storage.from('candidate-documents').createSignedUrl(path, 3600)
    setDownloadingId(null)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  const filtered = applicants.filter((a) => filter === 'all' || a.status === filter)
  const counts = { all: applicants.length, pending: applicants.filter(a => a.status === 'pending' || a.status === 'reviewed').length, accepted: applicants.filter(a => a.status === 'accepted').length, rejected: applicants.filter(a => a.status === 'rejected').length }

  if (loading) return (
    <div className="max-w-4xl mx-auto px-4 py-10 animate-pulse space-y-4">
      <div className="h-8 bg-gray-200 rounded w-1/3" />
      <div className="h-48 bg-gray-100 rounded-xl" />
    </div>
  )

  return (
    <div className="bg-gray-50 min-h-screen py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-gray-500 hover:text-red-600 text-sm mb-6 transition-colors">
          <ArrowLeft size={16} /> Back to Dashboard
        </Link>

        {/* Job header */}
        {job && (
          <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-6">
            <div className="flex items-start justify-between flex-wrap gap-3">
              <div>
                <h1 className="text-xl font-bold text-gray-900">{job.title}</h1>
                <p className="text-sm text-gray-500 mt-1 flex items-center gap-3">
                  <span className="flex items-center gap-1"><MapPin size={13} />{job.city}</span>
                  <span className="capitalize">{job.type}</span>
                </p>
              </div>
              <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-xl">
                <Users size={16} className="text-gray-400" />
                <span className="text-sm font-semibold text-gray-700">{applicants.length} applicant{applicants.length !== 1 ? 's' : ''}</span>
              </div>
            </div>
          </div>
        )}

        {/* Filter tabs */}
        <div className="flex gap-2 mb-5 flex-wrap">
          {(['all', 'pending', 'accepted', 'rejected'] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${filter === f ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-400'}`}>
              {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)} ({f === 'all' ? counts.all : f === 'pending' ? counts.pending : counts[f]})
            </button>
          ))}
        </div>

        {/* Applicants list */}
        {filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
            <Users size={40} className="mx-auto text-gray-300 mb-3" />
            <h3 className="font-semibold text-gray-700 mb-2">{applicants.length === 0 ? 'No applications yet' : 'No applicants match this filter'}</h3>
            <p className="text-sm text-gray-400">{applicants.length === 0 ? 'Applications will appear here as candidates apply.' : 'Try a different filter above.'}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((app) => (
              <div key={app.id} className="bg-white rounded-2xl border border-gray-200 p-5">
                {/* Header row */}
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-full bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                      {app.full_name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900">{app.full_name}</h3>
                      <div className="flex flex-wrap items-center gap-2 mt-0.5 text-xs text-gray-500">
                        {app.city && <span className="flex items-center gap-1"><MapPin size={11} />{app.city}</span>}
                        {app.country_of_origin && <span className="flex items-center gap-1"><Globe size={11} />From {app.country_of_origin}</span>}
                        {app.work_preference && <span className="flex items-center gap-1"><Briefcase size={11} />{MODE_LABELS[app.work_preference] || app.work_preference}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${STATUS_COLORS[app.status] || STATUS_COLORS.pending}`}>
                      {app.status === 'pending' ? 'Pending' : app.status === 'reviewed' ? 'Reviewed' : app.status === 'accepted' ? 'Accepted' : 'Not Selected'}
                    </span>
                    <span className="text-xs text-gray-400">{new Date(app.created_at).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}</span>
                  </div>
                </div>

                {/* Immigration status */}
                {app.immigration_status && (
                  <span className="inline-block text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full mb-3">
                    {STATUS_LABELS[app.immigration_status] || app.immigration_status}
                  </span>
                )}

                {/* Bio */}
                {app.bio && <p className="text-sm text-gray-600 mb-3 line-clamp-2">{app.bio}</p>}

                {/* Education */}
                {app.education && <p className="text-xs text-gray-500 mb-3">{app.education}</p>}

                {/* Skills */}
                {app.skills.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {app.skills.slice(0, 6).map((s) => (
                      <span key={s} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{s}</span>
                    ))}
                    {app.skills.length > 6 && <span className="text-xs text-gray-400">+{app.skills.length - 6} more</span>}
                  </div>
                )}

                {/* Cover note */}
                {app.cover_note && (
                  <div className="bg-gray-50 rounded-xl p-3 mb-3 border border-gray-100">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Cover Note</p>
                    <p className="text-sm text-gray-700 leading-relaxed">{app.cover_note}</p>
                  </div>
                )}

                {/* Action row */}
                <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-gray-100">
                  {/* Docs */}
                  {app.resume_path && (
                    <button onClick={() => downloadResume(app.resume_path!, app.seeker_id)} disabled={downloadingId === app.seeker_id}
                      className="flex items-center gap-1.5 text-xs bg-red-50 hover:bg-red-100 text-red-700 px-3 py-1.5 rounded-full font-medium transition-colors disabled:opacity-50">
                      {downloadingId === app.seeker_id ? <div className="w-3 h-3 border border-red-400 border-t-transparent rounded-full animate-spin" /> : <Download size={12} />}
                      Resume
                    </button>
                  )}
                  {app.linkedin_url && (
                    <a href={app.linkedin_url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-1.5 rounded-full font-medium transition-colors">
                      <ExternalLink size={12} /> LinkedIn
                    </a>
                  )}

                  {/* Status actions */}
                  <div className="ml-auto flex items-center gap-2">
                    {app.status !== 'accepted' && (
                      <button onClick={() => updateStatus(app.id, 'accepted')} disabled={updating === app.id}
                        className="flex items-center gap-1.5 text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-full font-medium transition-colors disabled:opacity-50">
                        {updating === app.id ? <div className="w-3 h-3 border border-white/50 border-t-white rounded-full animate-spin" /> : <CheckCircle size={12} />}
                        Accept
                      </button>
                    )}
                    {app.status !== 'rejected' && (
                      <button onClick={() => updateStatus(app.id, 'rejected')} disabled={updating === app.id}
                        className="flex items-center gap-1.5 text-xs bg-gray-100 hover:bg-red-50 text-gray-600 hover:text-red-600 px-3 py-1.5 rounded-full font-medium transition-colors disabled:opacity-50">
                        <XCircle size={12} /> Decline
                      </button>
                    )}
                    {app.status === 'pending' && (
                      <button onClick={() => updateStatus(app.id, 'reviewed')} disabled={updating === app.id}
                        className="flex items-center gap-1.5 text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-1.5 rounded-full font-medium transition-colors disabled:opacity-50">
                        <Clock size={12} /> Mark Reviewed
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
