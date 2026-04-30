'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import {
  TrendingUp, Users, Briefcase, CalendarCheck, BookmarkCheck,
  ArrowLeft, CheckCircle, Clock, XCircle, ChevronRight,
  BarChart2, Loader2, AlertCircle, Star,
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

interface OverviewStats {
  totalApplications: number
  activeJobs: number
  interviewsScheduled: number
  candidatesHired: number
  poolSize: number
  responseRate: number       // % of applications that have been reviewed
  avgAppsPerJob: number
}

interface PipelineStage {
  stage: string
  label: string
  count: number
  colour: string
}

interface WeeklyBar {
  week: string   // "Apr 14"
  count: number
}

interface JobRow {
  id: string
  title: string
  type: string
  status: string
  applications: number
  shortlisted: number
  interviews: number
  hired: number
  createdAt: string
}

interface SkillBar {
  skill: string
  count: number
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const PIPELINE_CONFIG: { stage: string; label: string; colour: string }[] = [
  { stage: 'applied',     label: 'Applied',     colour: 'bg-blue-500'   },
  { stage: 'shortlisted', label: 'Shortlisted', colour: 'bg-purple-500' },
  { stage: 'interview',   label: 'Interview',   colour: 'bg-amber-500'  },
  { stage: 'offer',       label: 'Offer',       colour: 'bg-orange-500' },
  { stage: 'hired',       label: 'Hired',       colour: 'bg-green-500'  },
  { stage: 'rejected',    label: 'Rejected',    colour: 'bg-red-400'    },
]

function weekLabel(date: Date): string {
  return date.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })
}

function startOfWeek(date: Date): Date {
  const d = new Date(date)
  d.setDate(d.getDate() - d.getDay())
  d.setHours(0, 0, 0, 0)
  return d
}

// ─── Stat card ───────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon, label, value, sub, colour,
}: {
  icon: React.ElementType
  label: string
  value: string | number
  sub?: string
  colour: string
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${colour}`}>
        <Icon size={20} className="text-white" />
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-sm font-medium text-gray-700 mt-0.5">{label}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState('')
  const [overview, setOverview]     = useState<OverviewStats | null>(null)
  const [pipeline, setPipeline]     = useState<PipelineStage[]>([])
  const [weekly, setWeekly]         = useState<WeeklyBar[]>([])
  const [jobs, setJobs]             = useState<JobRow[]>([])
  const [skills, setSkills]         = useState<SkillBar[]>([])

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/auth/signin'; return }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('user_id', user.id)
        .single()

      if (profile?.role !== 'employer') { window.location.href = '/dashboard'; return }

      try {
        await Promise.all([
          loadOverview(user.id),
          loadPipeline(user.id),
          loadWeekly(user.id),
          loadJobs(user.id),
          loadSkills(user.id),
        ])
      } catch (e) {
        console.error(e)
        setError('Could not load analytics data.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  // ── Overview stats ────────────────────────────────────────────────────────
  const loadOverview = async (empId: string) => {
    const [
      { count: totalApps },
      { data: oppData },
      { count: interviews },
      { count: hired },
      { count: poolSize },
    ] = await Promise.all([
      supabase.from('applications')
        .select('id', { count: 'exact', head: true })
        .in('opportunity_id', await getOppIds(empId)),
      supabase.from('opportunities')
        .select('id, status')
        .eq('employer_id', empId),
      supabase.from('interview_requests')
        .select('id', { count: 'exact', head: true })
        .eq('employer_id', empId)
        .in('status', ['pending', 'confirmed']),
      supabase.from('applications')
        .select('id', { count: 'exact', head: true })
        .in('opportunity_id', await getOppIds(empId))
        .eq('pipeline_stage', 'hired'),
      supabase.from('talent_pool')
        .select('id', { count: 'exact', head: true })
        .eq('employer_id', empId),
    ])

    const activeJobs = (oppData || []).filter(o => o.status === 'open' || o.status === 'active').length
    const totalJobs  = (oppData || []).length

    // Response rate: non-pending / total
    const { count: reviewed } = await supabase
      .from('applications')
      .select('id', { count: 'exact', head: true })
      .in('opportunity_id', await getOppIds(empId))
      .neq('status', 'pending')

    const responseRate = totalApps ? Math.round(((reviewed || 0) / totalApps) * 100) : 0
    const avgAppsPerJob = totalJobs ? Math.round((totalApps || 0) / totalJobs) : 0

    setOverview({
      totalApplications: totalApps || 0,
      activeJobs,
      interviewsScheduled: interviews || 0,
      candidatesHired: hired || 0,
      poolSize: poolSize || 0,
      responseRate,
      avgAppsPerJob,
    })
  }

  // ── Pipeline funnel ───────────────────────────────────────────────────────
  const loadPipeline = async (empId: string) => {
    const oppIds = await getOppIds(empId)
    if (!oppIds.length) { setPipeline(PIPELINE_CONFIG.map(c => ({ ...c, count: 0 }))); return }

    const { data } = await supabase
      .from('applications')
      .select('pipeline_stage')
      .in('opportunity_id', oppIds)

    const counts: Record<string, number> = {}
    ;(data || []).forEach(a => {
      const stage = a.pipeline_stage || 'applied'
      counts[stage] = (counts[stage] || 0) + 1
    })

    setPipeline(PIPELINE_CONFIG.map(c => ({ ...c, count: counts[c.stage] || 0 })))
  }

  // ── Weekly applications (last 8 weeks) ───────────────────────────────────
  const loadWeekly = async (empId: string) => {
    const oppIds = await getOppIds(empId)

    const eightWeeksAgo = new Date()
    eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56)

    const { data } = oppIds.length
      ? await supabase
          .from('applications')
          .select('created_at')
          .in('opportunity_id', oppIds)
          .gte('created_at', eightWeeksAgo.toISOString())
      : { data: [] }

    // Build 8 week buckets
    const buckets: { start: Date; label: string; count: number }[] = []
    for (let i = 7; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i * 7)
      buckets.push({ start: startOfWeek(d), label: weekLabel(startOfWeek(d)), count: 0 })
    }

    ;(data || []).forEach(a => {
      const appWeek = startOfWeek(new Date(a.created_at))
      const bucket = buckets.find(b => b.start.getTime() === appWeek.getTime())
      if (bucket) bucket.count++
    })

    setWeekly(buckets.map(b => ({ week: b.label, count: b.count })))
  }

  // ── Per-job performance ───────────────────────────────────────────────────
  const loadJobs = async (empId: string) => {
    const { data: opps } = await supabase
      .from('opportunities')
      .select('id, title, type, status, created_at')
      .eq('employer_id', empId)
      .order('created_at', { ascending: false })

    if (!opps?.length) { setJobs([]); return }

    const { data: apps } = await supabase
      .from('applications')
      .select('opportunity_id, pipeline_stage')
      .in('opportunity_id', opps.map(o => o.id))

    const appMap: Record<string, { total: number; shortlisted: number; interview: number; hired: number }> = {}
    ;(apps || []).forEach(a => {
      if (!appMap[a.opportunity_id]) appMap[a.opportunity_id] = { total: 0, shortlisted: 0, interview: 0, hired: 0 }
      appMap[a.opportunity_id].total++
      const stage = a.pipeline_stage || 'applied'
      if (stage === 'shortlisted') appMap[a.opportunity_id].shortlisted++
      if (stage === 'interview')   appMap[a.opportunity_id].interview++
      if (stage === 'hired')       appMap[a.opportunity_id].hired++
    })

    setJobs(opps.map(o => ({
      id: o.id,
      title: o.title,
      type: o.type,
      status: o.status,
      createdAt: o.created_at,
      applications: appMap[o.id]?.total       || 0,
      shortlisted:  appMap[o.id]?.shortlisted  || 0,
      interviews:   appMap[o.id]?.interview    || 0,
      hired:        appMap[o.id]?.hired        || 0,
    })))
  }

  // ── Top skills in applicant pool ──────────────────────────────────────────
  const loadSkills = async (empId: string) => {
    const oppIds = await getOppIds(empId)
    if (!oppIds.length) { setSkills([]); return }

    // Get seeker_ids of all applicants
    const { data: apps } = await supabase
      .from('applications')
      .select('seeker_id')
      .in('opportunity_id', oppIds)

    const seekerIds = [...new Set((apps || []).map(a => a.seeker_id as string))]
    if (!seekerIds.length) { setSkills([]); return }

    const { data: spData } = await supabase
      .from('seeker_profiles')
      .select('skills')
      .in('user_id', seekerIds)

    const skillCount: Record<string, number> = {}
    ;(spData || []).forEach(sp => {
      if (Array.isArray(sp.skills)) {
        sp.skills.forEach((s: string) => {
          skillCount[s] = (skillCount[s] || 0) + 1
        })
      }
    })

    const sorted = Object.entries(skillCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([skill, count]) => ({ skill, count }))

    setSkills(sorted)
  }

  // ── Utility: get employer's opportunity IDs ───────────────────────────────
  const getOppIds = async (empId: string): Promise<string[]> => {
    const { data } = await supabase
      .from('opportunities')
      .select('id')
      .eq('employer_id', empId)
    return (data || []).map(o => o.id as string)
  }

  // ─── Derived for charts ────────────────────────────────────────────────────
  const maxWeekly  = Math.max(...weekly.map(w => w.count), 1)
  const maxSkill   = Math.max(...skills.map(s => s.count), 1)
  const totalPipelineExcludingRejected = pipeline
    .filter(p => p.stage !== 'rejected')
    .reduce((s, p) => s + p.count, 0) || 1
  const pipelineTotal = pipeline.reduce((s, p) => s + p.count, 0)

  // ─── Loading / error states ────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-red-500 mr-3" />
        <span className="text-gray-500">Loading analytics…</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white border border-red-200 rounded-2xl p-8 text-center max-w-sm">
          <AlertCircle size={32} className="text-red-400 mx-auto mb-3" />
          <p className="text-gray-700 font-medium">{error}</p>
          <Link href="/dashboard" className="mt-4 inline-block text-sm text-red-600 hover:underline">Back to Dashboard</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Page header */}
      <div className="bg-white border-b border-gray-200 sticky top-16 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-gray-400 hover:text-gray-600 transition-colors">
              <ArrowLeft size={20} />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <BarChart2 size={20} className="text-red-600" /> Analytics
              </h1>
              <p className="text-sm text-gray-400">Your hiring performance at a glance</p>
            </div>
          </div>
          <Link
            href="/post-opportunity"
            className="hidden sm:flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
          >
            Post Opportunity
          </Link>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

        {/* ── Overview cards ────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <StatCard icon={Users}          label="Total Applications" value={overview?.totalApplications ?? 0} colour="bg-blue-500" />
          <StatCard icon={Briefcase}      label="Active Jobs"        value={overview?.activeJobs ?? 0}        colour="bg-indigo-500" />
          <StatCard icon={CalendarCheck}  label="Interviews"         value={overview?.interviewsScheduled ?? 0} sub="pending + confirmed" colour="bg-amber-500" />
          <StatCard icon={Star}           label="Hired"              value={overview?.candidatesHired ?? 0}   colour="bg-green-500" />
          <StatCard icon={BookmarkCheck}  label="Talent Pool"        value={overview?.poolSize ?? 0}          colour="bg-purple-500" />
          <StatCard
            icon={CheckCircle}
            label="Response Rate"
            value={`${overview?.responseRate ?? 0}%`}
            sub="applications reviewed"
            colour={
              (overview?.responseRate ?? 0) >= 80 ? 'bg-green-500'
              : (overview?.responseRate ?? 0) >= 50 ? 'bg-amber-500'
              : 'bg-red-400'
            }
          />
        </div>

        {/* ── Pipeline funnel + weekly chart ─────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Pipeline funnel */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6">
            <h2 className="text-base font-bold text-gray-900 mb-1">Hiring Pipeline</h2>
            <p className="text-xs text-gray-400 mb-5">{pipelineTotal} total application{pipelineTotal !== 1 ? 's' : ''} across all stages</p>

            <div className="space-y-3">
              {pipeline.filter(p => p.stage !== 'rejected').map((p, i) => {
                const pct = Math.round((p.count / totalPipelineExcludingRejected) * 100)
                const widths = ['w-full', 'w-5/6', 'w-4/6', 'w-3/6', 'w-2/6']
                return (
                  <div key={p.stage}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-gray-600">{p.label}</span>
                      <span className="text-xs font-bold text-gray-900">{p.count} <span className="text-gray-400 font-normal">({pct}%)</span></span>
                    </div>
                    <div className="h-7 bg-gray-100 rounded-lg overflow-hidden flex items-center">
                      <div
                        className={`h-full ${p.colour} rounded-lg transition-all duration-500 flex items-center justify-end pr-2 ${widths[i] ?? 'w-1/6'}`}
                        style={{ width: `${Math.max(p.count ? (p.count / totalPipelineExcludingRejected) * 100 : 0, p.count > 0 ? 4 : 0)}%` }}
                      >
                        {p.count > 0 && <span className="text-white text-xs font-bold">{p.count}</span>}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Rejected */}
            {(() => {
              const rej = pipeline.find(p => p.stage === 'rejected')
              return rej && rej.count > 0 ? (
                <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
                  <span className="flex items-center gap-1"><XCircle size={12} /> Rejected / Not a fit</span>
                  <span className="font-semibold text-gray-600">{rej.count}</span>
                </div>
              ) : null
            })()}
          </div>

          {/* Weekly applications bar chart */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6">
            <h2 className="text-base font-bold text-gray-900 mb-1">Applications Over Time</h2>
            <p className="text-xs text-gray-400 mb-5">Last 8 weeks</p>

            {weekly.every(w => w.count === 0) ? (
              <div className="flex items-center justify-center h-40 text-gray-300">
                <div className="text-center">
                  <TrendingUp size={32} className="mx-auto mb-2" />
                  <p className="text-sm">No applications yet</p>
                </div>
              </div>
            ) : (
              <div className="flex items-end gap-2 h-40">
                {weekly.map((w, i) => {
                  const heightPct = Math.round((w.count / maxWeekly) * 100)
                  const isLast = i === weekly.length - 1
                  return (
                    <div key={w.week} className="flex-1 flex flex-col items-center gap-1 group">
                      <span className={`text-xs font-bold transition-opacity ${w.count > 0 ? 'text-red-600' : 'text-transparent'} group-hover:text-red-600`}>
                        {w.count > 0 ? w.count : ''}
                      </span>
                      <div className="w-full flex flex-col justify-end" style={{ height: '100px' }}>
                        <div
                          className={`w-full rounded-t-md transition-all duration-500 ${isLast ? 'bg-red-500' : 'bg-red-200 group-hover:bg-red-400'}`}
                          style={{ height: `${Math.max(heightPct, w.count > 0 ? 4 : 0)}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-gray-400 text-center leading-tight">{w.week}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Top skills in applicants ───────────────────────────────────── */}
        {skills.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-2xl p-6">
            <h2 className="text-base font-bold text-gray-900 mb-1">Top Skills in Your Applicant Pool</h2>
            <p className="text-xs text-gray-400 mb-5">Most common skills among candidates who applied to your jobs</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {skills.map((s, i) => {
                const pct = Math.round((s.count / maxSkill) * 100)
                const colours = [
                  'bg-blue-500', 'bg-purple-500', 'bg-green-500', 'bg-amber-500',
                  'bg-pink-500', 'bg-indigo-500', 'bg-teal-500', 'bg-orange-500',
                  'bg-cyan-500',  'bg-rose-500',  'bg-lime-500', 'bg-violet-500',
                ]
                return (
                  <div key={s.skill} className="flex items-center gap-3">
                    <span className="text-xs text-gray-500 w-5 text-right flex-shrink-0">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-sm font-medium text-gray-700 truncate">{s.skill}</span>
                        <span className="text-xs text-gray-400 ml-2 flex-shrink-0">{s.count}</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${colours[i % colours.length]} transition-all duration-500`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Job performance table ──────────────────────────────────────── */}
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-100">
            <h2 className="text-base font-bold text-gray-900">Job Performance</h2>
            <p className="text-xs text-gray-400 mt-0.5">Application funnel breakdown per opportunity</p>
          </div>

          {jobs.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              <Briefcase size={32} className="mx-auto mb-2 text-gray-200" />
              <p className="text-sm">No opportunities posted yet</p>
              <Link href="/post-opportunity" className="mt-3 inline-block text-sm text-red-600 hover:underline font-medium">
                Post your first opportunity →
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Job Title</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Apps</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Shortlisted</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Interviews</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Hired</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Conv. %</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {jobs.map(j => {
                    const convRate = j.applications > 0
                      ? Math.round((j.hired / j.applications) * 100)
                      : 0
                    return (
                      <tr key={j.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <p className="font-medium text-gray-900 text-sm">{j.title}</p>
                          <p className="text-xs text-gray-400 capitalize">{j.type.replace('-', ' ')}</p>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full ${
                            j.status === 'open' || j.status === 'active'
                              ? 'bg-green-100 text-green-700'
                              : j.status === 'filled'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-gray-100 text-gray-500'
                          }`}>
                            {j.status === 'open' || j.status === 'active' ? '● Active' : j.status === 'filled' ? '✓ Filled' : '○ Closed'}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className="text-sm font-bold text-gray-900">{j.applications}</span>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className={`text-sm font-semibold ${j.shortlisted > 0 ? 'text-purple-600' : 'text-gray-300'}`}>
                            {j.shortlisted}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className={`text-sm font-semibold ${j.interviews > 0 ? 'text-amber-600' : 'text-gray-300'}`}>
                            {j.interviews}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className={`text-sm font-bold ${j.hired > 0 ? 'text-green-600' : 'text-gray-300'}`}>
                            {j.hired}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className={`text-xs font-semibold px-2 py-1 rounded-lg ${
                            convRate >= 10 ? 'bg-green-100 text-green-700'
                            : convRate > 0 ? 'bg-amber-100 text-amber-700'
                            : 'text-gray-300'
                          }`}>
                            {convRate > 0 ? `${convRate}%` : '—'}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <Link
                            href={`/applications/${j.id}`}
                            className="text-gray-300 hover:text-red-600 transition-colors"
                          >
                            <ChevronRight size={16} />
                          </Link>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Quick action footer ───────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pb-4">
          {[
            { href: '/candidates',    icon: Users,         label: 'Find Candidates',  sub: 'Search your talent pipeline'  },
            { href: '/talent-pool',   icon: BookmarkCheck, label: 'Talent Pool',      sub: 'Manage saved candidates'       },
            { href: '/interviews',    icon: CalendarCheck, label: 'Interviews',       sub: 'View scheduled sessions'       },
          ].map(item => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-4 bg-white border border-gray-200 rounded-2xl p-4 hover:border-red-300 hover:shadow-sm transition-all group"
            >
              <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-red-100 transition-colors">
                <item.icon size={18} className="text-red-600" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-gray-900 text-sm">{item.label}</p>
                <p className="text-xs text-gray-400">{item.sub}</p>
              </div>
              <ChevronRight size={16} className="text-gray-300 group-hover:text-red-400 ml-auto flex-shrink-0 transition-colors" />
            </Link>
          ))}
        </div>

      </div>
    </div>
  )
}
