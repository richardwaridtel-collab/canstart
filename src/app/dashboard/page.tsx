'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Briefcase, Clock, CheckCircle, XCircle, PlusCircle, Users, ArrowRight, Eye, ExternalLink, Trash2, Sparkles, Target, MapPin, Calendar, AlertCircle, MessageSquarePlus, Star } from 'lucide-react'
import { MatchBattery } from '@/components/MatchBattery'

type Profile = { role: 'seeker' | 'employer'; full_name: string; city: string }
type Application = { id: string; status: string; created_at: string; opportunity?: { title: string; company_name?: string; type: string } }
type PostedJob = { id: string; title: string; status: string; created_at: string; type: string; applications_count?: number }
type ExternalApplication = { id: string; job_title: string; company: string; job_url: string; applied_at: string; external_opportunity_id?: string }
type PickedJob = {
  match_score: number
  job_id: string
  matched_keywords: string[]
  missing_keywords: string[]
  match_reason?: string | null
  external_opportunities: {
    id: string; title: string; company: string; city: string; work_mode: string; category: string; posted_at?: string; synced_at: string; salary_min?: number; salary_max?: number; description?: string
  } | null
}
type CandidateMatch = { match_score: number; seeker_id: string; opportunity_id: string; opportunity_title: string; seeker_name: string; seeker_city: string }
type TestimonialStatus = 'none' | 'pending' | 'approved'


function extractSalary(salaryMin?: number, salaryMax?: number, description?: string): string | null {
  // 1. Structured DB fields first
  if (salaryMin && salaryMax) return `$${Math.round(salaryMin / 1000)}K–$${Math.round(salaryMax / 1000)}K/yr`
  if (salaryMin) return `$${Math.round(salaryMin / 1000)}K+/yr`

  if (!description) return null

  // Normalise: strip markdown escapes, bold markers, extra whitespace
  const text = description.slice(0, 3000)
    .replace(/\\-/g, '-')
    .replace(/\\\./g, '.')
    .replace(/\*\*/g, '')
    .replace(/\s+/g, ' ')

  const parseNum = (digits: string, kFlag: boolean): number => {
    const n = parseFloat(digits.replace(/,/g, ''))
    return kFlag ? n * 1000 : n
  }

  // ── Annual range ── $70,000 - $80,000 / $70K–$80K / 70,000 to 80,000 /yr
  const rangeRe = /\$\s*([\d,]+)\s*(k)?\s*[-–—\\]+\s*\$?\s*([\d,]+)\s*(k)?(?:\s*(?:\/\s*)?(?:year|yr|annually|per\s+year|per\s+annum))?/gi
  let m: RegExpExecArray | null
  while ((m = rangeRe.exec(text)) !== null) {
    const lo = parseNum(m[1], !!m[2])
    const hi = parseNum(m[3], !!m[4])
    if (lo >= 20000 && hi >= lo) return `$${Math.round(lo / 1000)}K–$${Math.round(hi / 1000)}K/yr`
  }

  // ── Salary context range (no $ on second number) ── Salary: 70,000 - 80,000
  const ctxRe = /(?:salary|compensation|pay|wage)[^\d$]{0,15}\$?\s*([\d,]+)\s*(k)?\s*[-–—to]+\s*\$?\s*([\d,]+)\s*(k)?/gi
  while ((m = ctxRe.exec(text)) !== null) {
    const lo = parseNum(m[1], !!m[2])
    const hi = parseNum(m[3], !!m[4])
    if (lo >= 20000 && hi >= lo) return `$${Math.round(lo / 1000)}K–$${Math.round(hi / 1000)}K/yr`
    if (lo >= 10 && hi >= lo && hi < 500) return `$${lo}–$${hi}/hr`
  }

  // ── Single annual ── $75,000/year / $75K annually
  const annRe = /\$\s*([\d,]+)\s*(k)?\s*(?:\/\s*)?(?:year|yr|annually|per\s+year|per\s+annum)/gi
  while ((m = annRe.exec(text)) !== null) {
    const v = parseNum(m[1], !!m[2])
    if (v >= 20000) return `$${Math.round(v / 1000)}K+/yr`
  }

  // ── Hourly range ── $22 - $28/hr / $22-28 per hour
  const hrRangeRe = /\$\s*([\d.]+)\s*[-–—]+\s*\$?\s*([\d.]+)\s*(?:\/\s*)?(?:hour|hr\b|per\s+hour)/gi
  while ((m = hrRangeRe.exec(text)) !== null) {
    const lo = parseFloat(m[1]), hi = parseFloat(m[2])
    if (lo >= 10 && hi >= lo && hi < 500) return `$${lo}–$${hi}/hr`
  }

  // ── Single hourly ── $25/hr / $25 per hour
  const hrSingleRe = /\$\s*([\d.]+)\s*(?:\/\s*)?(?:hour|hr\b|per\s+hour)/gi
  while ((m = hrSingleRe.exec(text)) !== null) {
    const v = parseFloat(m[1])
    if (v >= 10 && v < 500) return `$${v}/hr`
  }

  return null
}

function detectJobType(title: string): string | null {
  const t = title.toLowerCase()
  if (t.includes('part-time') || t.includes('part time'))  return 'Part-time'
  if (t.includes('full-time') || t.includes('full time'))  return 'Full-time'
  if (t.includes('contract') || t.includes('contractor'))  return 'Contract'
  if (t.includes('freelance'))                             return 'Freelance'
  if (t.includes('internship') || t.includes('intern'))    return 'Internship'
  if (t.includes('co-op') || t.includes('coop'))           return 'Co-op'
  if (t.includes('temporary') || t.includes(' temp '))     return 'Temporary'
  if (t.includes('summer student') || t.includes('summer position')) return 'Summer'
  return null
}

function formatPostedDate(dateStr?: string): string | null {
  if (!dateStr) return null
  const diffMs = Date.now() - new Date(dateStr).getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays <= 6) return `${diffDays}d ago`
  if (diffDays <= 13) return '1 week ago'
  if (diffDays <= 20) return '2 weeks ago'
  if (diffDays <= 27) return '3 weeks ago'
  return new Date(dateStr).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })
}

function extractDeadline(description?: string): string | null {
  if (!description) return null
  const text = description.slice(0, 2500)
  const patterns = [
    /application\s+deadline[:\s]+([A-Za-z]+\.?\s+\d{1,2}(?:,?\s+\d{4})?)/i,
    /(?:submit|send)\s+(?:your\s+)?application[s]?\s+by[:\s]+([A-Za-z]+\.?\s+\d{1,2}(?:,?\s+\d{4})?)/i,
    /closing\s+date[:\s]+([A-Za-z]+\.?\s+\d{1,2}(?:,?\s+\d{4})?)/i,
    /apply\s+by[:\s]+([A-Za-z]+\.?\s+\d{1,2}(?:,?\s+\d{4})?)/i,
    /applications?\s+(?:close|closing)[s\s]+(?:on\s+)?([A-Za-z]+\.?\s+\d{1,2}(?:,?\s+\d{4})?)/i,
    /position\s+closes?[:\s]+([A-Za-z]+\.?\s+\d{1,2}(?:,?\s+\d{4})?)/i,
    /deadline[:\s]+([A-Za-z]+\.?\s+\d{1,2}(?:,?\s+\d{4})?)/i,
  ]
  for (const re of patterns) {
    const m = text.match(re)
    if (m?.[1]) return m[1].trim()
  }
  return null
}

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
  const [preferredRoles, setPreferredRoles] = useState<string[]>([])
  const [candidateMatches, setCandidateMatches] = useState<CandidateMatch[]>([])
  const [testimonialStatus, setTestimonialStatus] = useState<TestimonialStatus>('none')
  const [testimonialForm, setTestimonialForm] = useState({ quote: '', name: '', role_title: '', city: '', country_of_origin: '' })
  const [testimonialLoading, setTestimonialLoading] = useState(false)
  const [testimonialError, setTestimonialError] = useState('')
  const [testimonialSuccess, setTestimonialSuccess] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

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
    setCurrentUserId(user.id)

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

      // Load preferred roles + "Picked for You" matches
      // Pre-fill testimonial form with profile data
      setTestimonialForm(prev => ({
        ...prev,
        name: profileData.full_name || '',
        city: profileData.city || '',
      }))

      // Check testimonial status
      try {
        const { data: existingTestimonial } = await supabase
          .from('testimonials')
          .select('id, approved')
          .eq('user_id', user.id)
          .single()
        if (existingTestimonial) {
          setTestimonialStatus(existingTestimonial.approved ? 'approved' : 'pending')
        }
      } catch { /* no testimonial yet */ }

      try {
        const [{ data: sp }, { data: picks }] = await Promise.all([
          supabase
            .from('seeker_profiles')
            .select('preferred_roles, country_of_origin, role_title')
            .eq('user_id', user.id)
            .single(),
          supabase
            .from('job_matches')
            .select('match_score, job_id, matched_keywords, missing_keywords, match_reason, external_opportunities(id, title, company, city, work_mode, category, salary_min, salary_max, description, posted_at, synced_at)')
            .eq('seeker_id', user.id)
            .gte('match_score', 40)
            .order('match_score', { ascending: false })
            .limit(50),
        ])

        const roles: string[] = (sp?.preferred_roles || []).map((r: string) => r.toLowerCase())
        setPreferredRoles(roles)
        // Update testimonial form with seeker profile data
        if (sp) {
          setTestimonialForm(prev => ({
            ...prev,
            country_of_origin: (sp as Record<string, unknown>).country_of_origin as string || prev.country_of_origin,
            role_title: (sp as Record<string, unknown>).role_title as string || prev.role_title,
          }))
        }

        if (picks) {
          const filtered = roles.length > 0
            ? (picks as unknown as PickedJob[]).filter((pick) => {
                const title = pick.external_opportunities?.title?.toLowerCase() ?? ''
                return roles.some((role) => title.includes(role))
              })
            : (picks as unknown as PickedJob[])
          setPickedJobs(filtered)
        }
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
          .gte('match_score', 50)
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

  const submitTestimonial = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentUserId) return
    setTestimonialLoading(true)
    setTestimonialError('')
    try {
      const res = await fetch('/api/testimonials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: currentUserId, ...testimonialForm }),
      })
      const data = await res.json()
      if (!res.ok) {
        setTestimonialError(data.error || 'Something went wrong.')
      } else {
        setTestimonialSuccess(true)
        setTestimonialStatus('pending')
      }
    } catch {
      setTestimonialError('Could not submit. Please try again.')
    }
    setTestimonialLoading(false)
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
            {(pickedJobs.length > 0 || preferredRoles.length > 0) && (
              <div className="bg-white rounded-2xl border border-purple-200 p-6 mb-6">
                <div className="flex items-center justify-between mb-1">
                  <h2 className="font-bold text-gray-900 text-lg flex items-center gap-2">
                    <Sparkles size={18} className="text-purple-500" /> Picked for You
                  </h2>
                  <Link href="/opportunities" className="text-sm text-purple-600 hover:text-purple-700 flex items-center gap-1">
                    Browse all <ArrowRight size={14} />
                  </Link>
                </div>
                <p className="text-xs text-gray-500 mb-4">
                  {pickedJobs.length > 0
                    ? `${pickedJobs.length} job${pickedJobs.length !== 1 ? 's' : ''} matching your preferred roles · refreshed daily`
                    : 'No matches found yet for your preferred roles — check back tomorrow or update your resume.'}
                </p>
                <div className="space-y-2">
                  {pickedJobs.map((pick) => {
                    const job = pick.external_opportunities
                    if (!job) return null
                    const salary = extractSalary(job.salary_min, job.salary_max, job.description)
                    const jobType = detectJobType(job.title)
                    const postedDate = formatPostedDate(job.posted_at || job.synced_at)
                    const deadline = extractDeadline(job.description)
                    return (
                      <Link
                        key={pick.job_id}
                        href={`/jobs/${job.id}`}
                        className="flex items-center justify-between px-3.5 py-3 bg-purple-50 hover:bg-purple-100 rounded-xl border border-purple-100 transition-colors group"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-900 text-sm truncate">{job.title}</p>
                          <p className="text-xs text-gray-500 mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                            <span className="font-medium text-gray-700">{job.company}</span>
                            <span className="text-gray-300">·</span>
                            <span className="flex items-center gap-0.5"><MapPin size={10} />{job.city}</span>
                            <span className="text-gray-300">·</span>
                            <span className="capitalize">{job.work_mode}</span>
                            {jobType && <><span className="text-gray-300">·</span><span>{jobType}</span></>}
                            {salary && <><span className="text-gray-300">·</span><span className="text-green-600 font-medium">{salary}</span></>}
                          </p>
                          <p className="text-xs mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                            {postedDate && (
                              <span className="flex items-center gap-0.5 text-gray-400">
                                <Calendar size={10} />{postedDate}
                              </span>
                            )}
                            {deadline && (
                              <span className="flex items-center gap-0.5 text-orange-500 font-medium">
                                <AlertCircle size={10} />Deadline: {deadline}
                              </span>
                            )}
                          </p>
                        </div>
                        <ArrowRight size={13} className="text-gray-400 group-hover:text-purple-600 transition-colors flex-shrink-0 ml-3" />
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
            {/* ── Share Your Story ─────────────────────────────────────── */}
            <div className="bg-white rounded-2xl border border-amber-200 p-6 mt-6">
              <div className="flex items-center gap-2 mb-1">
                <MessageSquarePlus size={18} className="text-amber-500" />
                <h2 className="font-bold text-gray-900 text-lg">Share Your Story</h2>
              </div>
              <p className="text-xs text-gray-500 mb-4">Help other job seekers by sharing your CanStart experience. Approved stories appear on our homepage.</p>

              {testimonialStatus === 'approved' ? (
                <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl p-4">
                  <Star size={20} className="text-yellow-400 flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-green-800 text-sm">Your story is live!</p>
                    <p className="text-xs text-green-600 mt-0.5">Thank you — your experience is inspiring others on the CanStart homepage.</p>
                  </div>
                </div>
              ) : testimonialStatus === 'pending' || testimonialSuccess ? (
                <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <CheckCircle size={20} className="text-amber-500 flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-amber-800 text-sm">Story submitted — thank you!</p>
                    <p className="text-xs text-amber-600 mt-0.5">We&apos;ll review it shortly and publish it on the homepage once approved.</p>
                  </div>
                </div>
              ) : (
                <form onSubmit={submitTestimonial} className="space-y-3">
                  {testimonialError && (
                    <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{testimonialError}</div>
                  )}
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Your Story <span className="text-red-500">*</span></label>
                    <textarea
                      required
                      value={testimonialForm.quote}
                      onChange={(e) => setTestimonialForm({ ...testimonialForm, quote: e.target.value })}
                      rows={3}
                      placeholder="How did CanStart help you? What experience did you gain? (min. 30 characters)"
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Display Name <span className="text-red-500">*</span></label>
                      <input
                        required
                        type="text"
                        value={testimonialForm.name}
                        onChange={(e) => setTestimonialForm({ ...testimonialForm, name: e.target.value })}
                        placeholder="e.g., Fariha J."
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Your Role / Title</label>
                      <input
                        type="text"
                        value={testimonialForm.role_title}
                        onChange={(e) => setTestimonialForm({ ...testimonialForm, role_title: e.target.value })}
                        placeholder="e.g., Marketing Specialist"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">City</label>
                      <input
                        type="text"
                        value={testimonialForm.city}
                        onChange={(e) => setTestimonialForm({ ...testimonialForm, city: e.target.value })}
                        placeholder="e.g., Ottawa"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Country of Origin</label>
                      <input
                        type="text"
                        value={testimonialForm.country_of_origin}
                        onChange={(e) => setTestimonialForm({ ...testimonialForm, country_of_origin: e.target.value })}
                        placeholder="e.g., India"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={testimonialLoading}
                    className="w-full bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-white font-semibold py-2.5 rounded-xl flex items-center justify-center gap-2 text-sm transition-colors"
                  >
                    {testimonialLoading
                      ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      : <><MessageSquarePlus size={15} /> Submit My Story</>}
                  </button>
                </form>
              )}
            </div>
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
                  {candidateMatches.length} candidate{candidateMatches.length !== 1 ? 's' : ''} selected based on your job requirements · refreshed daily at 5:30 AM
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
                        <MatchBattery score={match.match_score} />
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
