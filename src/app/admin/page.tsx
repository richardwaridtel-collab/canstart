'use client'

import { useState, useEffect, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  Users, Briefcase, Search, RefreshCw, CheckCircle, TrendingUp,
  ExternalLink, FileText, MapPin, Globe, Star, BarChart2, Clock,
  UserCheck, Building2, AlertCircle,
} from 'lucide-react'

const ADMIN_EMAILS = ['richard.waridtel@gmail.com']

type SeekRow  = { user_id: string; full_name: string; city: string; created_at: string; immigration_status?: string; has_resume?: boolean }
type EmpRow   = { user_id: string; full_name: string; city: string; created_at: string; company_name?: string }
type JobRow   = { id: string; title: string; status: string; type: string; city: string; created_at: string; company_name?: string; app_count: number }
type AppRow   = { id: string; status: string; created_at: string; seeker_name?: string; job_title?: string; company?: string }
type ExtAppRow= { id: string; job_title: string; company: string; job_url: string; applied_at: string; seeker_id: string; seeker_name?: string; seeker_city?: string }

type Stats = {
  totalUsers: number
  seekers: number
  employers: number
  newThisWeek: number
  seekersWithResume: number
  seekersNoProfile: number
  totalJobs: number
  activeJobs: number
  totalCanstartApps: number
  pendingApps: number
  acceptedApps: number
  totalExtApps: number
  extAppsThisWeek: number
  externalJobsInDb: number
}

function StatCard({ value, label, icon, color = 'text-gray-900', sub }: { value: number | string; label: string; icon: ReactNode; color?: string; sub?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-start justify-between">
        <div>
          <div className={`text-2xl font-bold ${color}`}>{value}</div>
          <div className="text-sm text-gray-500 mt-0.5">{label}</div>
          {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
        </div>
        <div className="text-gray-300">{icon}</div>
      </div>
    </div>
  )
}

function SectionHeader({ title, count }: { title: string; count?: number }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="font-bold text-gray-900 text-base">{title}</h2>
      {count !== undefined && <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">{count} total</span>}
    </div>
  )
}

export default function AdminPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [authorized, setAuthorized] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  type TabId = 'overview' | 'seekers' | 'employers' | 'jobs' | 'applications' | 'external'
  const [activeTab, setActiveTab] = useState<TabId>('overview')
  const [search, setSearch] = useState('')

  const [stats, setStats]           = useState<Stats | null>(null)
  const [seekers, setSeekers]       = useState<SeekRow[]>([])
  const [employers, setEmployers]   = useState<EmpRow[]>([])
  const [jobs, setJobs]             = useState<JobRow[]>([])
  const [apps, setApps]             = useState<AppRow[]>([])
  const [extApps, setExtApps]       = useState<ExtAppRow[]>([])
  const [cityBreakdown, setCityBreakdown] = useState<{ city: string; count: number }[]>([])
  const [statusBreakdown, setStatusBreakdown] = useState<{ status: string; count: number }[]>([])

  useEffect(() => { checkAdmin() }, [])

  const checkAdmin = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth/signin'); return }
    const { data: profile } = await supabase.from('profiles').select('role').eq('user_id', user.id).single()
    const isAdmin = ADMIN_EMAILS.includes(user.email || '') || profile?.role === 'admin'
    if (!isAdmin) { router.push('/dashboard'); return }
    setAuthorized(true)
    await loadAll()
    setLoading(false)
  }

  const loadAll = async () => {
    setRefreshing(true)
    try {
      await Promise.all([loadSeekers(), loadEmployers(), loadJobs(), loadApps(), loadExtApps()])
    } finally { setRefreshing(false) }
  }

  const loadSeekers = async () => {
    const { data: profiles } = await supabase.from('profiles').select('user_id, full_name, city, created_at').eq('role', 'seeker').order('created_at', { ascending: false }).limit(200)
    const { data: sp } = await supabase.from('seeker_profiles').select('user_id, immigration_status, resume_path')

    const spMap = new Map((sp || []).map((s: { user_id: string; immigration_status?: string; resume_path?: string }) => [s.user_id, s]))

    const rows: SeekRow[] = (profiles || []).map((p: { user_id: string; full_name: string; city: string; created_at: string }) => {
      const spData = spMap.get(p.user_id)
      return {
        user_id: p.user_id,
        full_name: p.full_name,
        city: p.city,
        created_at: p.created_at,
        immigration_status: spData?.immigration_status,
        has_resume: !!spData?.resume_path,
      }
    })
    setSeekers(rows)

    // City breakdown
    const cityMap: Record<string, number> = {}
    rows.forEach((r) => { if (r.city) cityMap[r.city] = (cityMap[r.city] || 0) + 1 })
    setCityBreakdown(Object.entries(cityMap).sort((a, b) => b[1] - a[1]).map(([city, count]) => ({ city, count })))

    // Immigration status breakdown
    const statusMap: Record<string, number> = {}
    rows.forEach((r) => { if (r.immigration_status) statusMap[r.immigration_status] = (statusMap[r.immigration_status] || 0) + 1 })
    setStatusBreakdown(Object.entries(statusMap).sort((a, b) => b[1] - a[1]).map(([status, count]) => ({ status, count })))
  }

  const loadEmployers = async () => {
    const { data: profiles } = await supabase.from('profiles').select('user_id, full_name, city, created_at').eq('role', 'employer').order('created_at', { ascending: false }).limit(200)
    const { data: ep } = await supabase.from('employer_profiles').select('user_id, company_name')
    const epMap = new Map((ep || []).map((e: { user_id: string; company_name?: string }) => [e.user_id, e]))
    setEmployers((profiles || []).map((p: { user_id: string; full_name: string; city: string; created_at: string }) => ({
      ...p,
      company_name: epMap.get(p.user_id)?.company_name,
    })))
  }

  const loadJobs = async () => {
    const { data } = await supabase.from('opportunities').select('id, title, status, type, city, created_at, employer_profiles(company_name), applications(count)').order('created_at', { ascending: false }).limit(200)
    setJobs((data || []).map((j: Record<string, unknown>) => ({
      id: j.id as string,
      title: j.title as string,
      status: j.status as string,
      type: j.type as string,
      city: j.city as string,
      created_at: j.created_at as string,
      company_name: (j.employer_profiles as { company_name?: string } | null)?.company_name,
      app_count: Array.isArray(j.applications) ? j.applications.length : 0,
    })))
  }

  const loadApps = async () => {
    const { data } = await supabase
      .from('applications')
      .select('id, status, created_at, seeker_id, opportunity_id, opportunities(title, employer_profiles(company_name))')
      .order('created_at', { ascending: false })
      .limit(200)

    if (data && data.length > 0) {
      const seekerIds = [...new Set(data.map((a: Record<string, unknown>) => a.seeker_id as string))]
      const { data: profiles } = await supabase.from('profiles').select('user_id, full_name').in('user_id', seekerIds)
      const pm = new Map((profiles || []).map((p: { user_id: string; full_name: string }) => [p.user_id, p]))

      setApps(data.map((a: Record<string, unknown>) => ({
        id: a.id as string,
        status: a.status as string,
        created_at: a.created_at as string,
        seeker_name: pm.get(a.seeker_id as string)?.full_name,
        job_title: (a.opportunities as { title?: string } | null)?.title,
        company: ((a.opportunities as { employer_profiles?: { company_name?: string } } | null)?.employer_profiles)?.company_name,
      })))
    } else { setApps([]) }
  }

  const loadExtApps = async () => {
    const { data: eApps } = await supabase.from('external_applications').select('id, job_title, company, job_url, applied_at, seeker_id').order('applied_at', { ascending: false }).limit(500)
    if (eApps && eApps.length > 0) {
      const ids = [...new Set(eApps.map((a: Record<string, unknown>) => a.seeker_id as string))]
      const { data: profiles } = await supabase.from('profiles').select('user_id, full_name, city').in('user_id', ids)
      const pm = new Map((profiles || []).map((p: { user_id: string; full_name: string; city: string }) => [p.user_id, p]))
      setExtApps(eApps.map((row: Record<string, unknown>) => {
        const p = pm.get(row.seeker_id as string)
        return { id: row.id as string, job_title: row.job_title as string, company: row.company as string, job_url: row.job_url as string, applied_at: row.applied_at as string, seeker_id: row.seeker_id as string, seeker_name: p?.full_name, seeker_city: p?.city }
      }))
    } else { setExtApps([]) }
  }

  // Compute stats whenever data changes
  useEffect(() => {
    const now = Date.now()
    const week = 7 * 24 * 60 * 60 * 1000
    const newThisWeek = [...seekers, ...employers].filter((u) => now - new Date(u.created_at).getTime() < week).length
    setStats({
      totalUsers: seekers.length + employers.length,
      seekers: seekers.length,
      employers: employers.length,
      newThisWeek,
      seekersWithResume: seekers.filter((s) => s.has_resume).length,
      seekersNoProfile: seekers.filter((s) => !s.immigration_status).length,
      totalJobs: jobs.length,
      activeJobs: jobs.filter((j) => j.status === 'open').length,
      totalCanstartApps: apps.length,
      pendingApps: apps.filter((a) => a.status === 'pending' || a.status === 'reviewed').length,
      acceptedApps: apps.filter((a) => a.status === 'accepted').length,
      totalExtApps: extApps.length,
      extAppsThisWeek: extApps.filter((a) => now - new Date(a.applied_at).getTime() < week).length,
      externalJobsInDb: 0,
    })
  }, [seekers, employers, jobs, apps, extApps])

  const statusLabels: Record<string, string> = { owp: 'Open Work Permit', pr: 'Permanent Resident', student: 'Student Visa', citizen: 'Citizen' }

  const q = search.toLowerCase()
  const filteredSeekers  = seekers.filter((s)  => !q || s.full_name?.toLowerCase().includes(q) || s.city?.toLowerCase().includes(q))
  const filteredEmployers= employers.filter((e) => !q || e.full_name?.toLowerCase().includes(q) || (e.company_name || '').toLowerCase().includes(q))
  const filteredJobs     = jobs.filter((j)      => !q || j.title?.toLowerCase().includes(q) || (j.company_name || '').toLowerCase().includes(q))
  const filteredApps     = apps.filter((a)      => !q || (a.seeker_name || '').toLowerCase().includes(q) || (a.job_title || '').toLowerCase().includes(q))
  const filteredExtApps  = extApps.filter((a)   => !q || (a.seeker_name || '').toLowerCase().includes(q) || a.company?.toLowerCase().includes(q) || a.job_title?.toLowerCase().includes(q))

  const tabs: { id: TabId; label: string; icon: ReactNode }[] = [
    { id: 'overview',      label: 'Overview',                          icon: <BarChart2 size={15} /> },
    { id: 'seekers',       label: `Candidates (${seekers.length})`,    icon: <Users size={15} /> },
    { id: 'employers',     label: `Employers (${employers.length})`,   icon: <Building2 size={15} /> },
    { id: 'jobs',          label: `Jobs (${jobs.length})`,             icon: <Briefcase size={15} /> },
    { id: 'applications',  label: `Applications (${apps.length})`,     icon: <FileText size={15} /> },
    { id: 'external',      label: `Ext. Applied (${extApps.length})`,  icon: <ExternalLink size={15} /> },
  ]

  if (loading) return (
    <div className="max-w-6xl mx-auto px-4 py-10 animate-pulse space-y-4">
      <div className="h-8 bg-gray-200 rounded w-1/3" />
      <div className="grid grid-cols-4 gap-4">{[...Array(8)].map((_, i) => <div key={i} className="h-24 bg-gray-100 rounded-xl" />)}</div>
      <div className="h-64 bg-gray-100 rounded-xl" />
    </div>
  )

  if (!authorized) return null

  return (
    <div className="bg-gray-50 min-h-screen pb-12">
      {/* Header */}
      <div className="bg-gradient-to-r from-gray-800 to-gray-900 text-white py-8 px-4 mb-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between flex-wrap gap-4">
          <div>
            <p className="text-gray-400 text-xs uppercase tracking-widest mb-1">CanStart Admin</p>
            <h1 className="text-2xl font-bold">Platform Analytics</h1>
            <p className="text-gray-400 text-sm mt-1">Full visibility into registrations, jobs, and applications</p>
          </div>
          <button onClick={loadAll} disabled={refreshing} className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white text-sm px-4 py-2 rounded-xl transition-colors disabled:opacity-50">
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} /> Refresh Data
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mb-6 overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => { setActiveTab(t.id); setSearch('') }}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${activeTab === t.id ? 'bg-gray-900 text-white shadow' : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-400'}`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* ── OVERVIEW ── */}
        {activeTab === 'overview' && stats && (
          <div className="space-y-6">
            {/* Platform Health */}
            <div>
              <h2 className="font-bold text-gray-700 text-xs uppercase tracking-widest mb-3">Platform Health</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <StatCard value={stats.totalUsers} label="Total Registered" icon={<Users size={22} />} color="text-gray-900" sub={`+${stats.newThisWeek} this week`} />
                <StatCard value={stats.seekers} label="Job Seekers" icon={<UserCheck size={22} />} color="text-blue-600" sub={`${stats.seekersWithResume} with resume`} />
                <StatCard value={stats.employers} label="Employers" icon={<Building2 size={22} />} color="text-purple-600" />
                <StatCard value={stats.newThisWeek} label="New This Week" icon={<TrendingUp size={22} />} color="text-green-600" />
              </div>
            </div>

            {/* Incomplete Profiles Alert */}
            {stats.seekersNoProfile > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
                <AlertCircle size={18} className="text-amber-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-amber-800">{stats.seekersNoProfile} candidate{stats.seekersNoProfile > 1 ? 's' : ''} registered but haven&apos;t completed their profile</p>
                  <p className="text-xs text-amber-600 mt-0.5">These users signed up but have no immigration status or seeker profile filled in.</p>
                </div>
              </div>
            )}

            {/* Jobs & Applications */}
            <div>
              <h2 className="font-bold text-gray-700 text-xs uppercase tracking-widest mb-3">Jobs & Applications</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <StatCard value={stats.activeJobs} label="Active CanStart Jobs" icon={<Star size={22} />} color="text-red-600" sub={`${stats.totalJobs} total posted`} />
                <StatCard value={stats.totalCanstartApps} label="CanStart Applications" icon={<FileText size={22} />} color="text-gray-900" sub={`${stats.pendingApps} pending · ${stats.acceptedApps} accepted`} />
                <StatCard value={stats.totalExtApps} label="External Job Tracked" icon={<ExternalLink size={22} />} color="text-blue-600" sub={`+${stats.extAppsThisWeek} this week`} />
                <StatCard value={stats.seekersWithResume} label="Resumes Uploaded" icon={<FileText size={22} />} color="text-green-600" sub={`${stats.seekers - stats.seekersWithResume} without resume`} />
              </div>
            </div>

            {/* City + Immigration Breakdown */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2"><MapPin size={16} className="text-red-500" /> Candidates by City</h3>
                {cityBreakdown.length === 0 ? <p className="text-sm text-gray-400">No data yet.</p> : (
                  <div className="space-y-2">
                    {cityBreakdown.slice(0, 8).map(({ city, count }) => {
                      const pct = Math.round((count / seekers.length) * 100)
                      return (
                        <div key={city}>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-gray-700">{city}</span>
                            <span className="text-gray-500 font-medium">{count} <span className="text-gray-300">({pct}%)</span></span>
                          </div>
                          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-red-400 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2"><Globe size={16} className="text-blue-500" /> Immigration Status</h3>
                {statusBreakdown.length === 0 ? <p className="text-sm text-gray-400">No data yet.</p> : (
                  <div className="space-y-2">
                    {statusBreakdown.map(({ status, count }) => {
                      const pct = Math.round((count / seekers.length) * 100)
                      return (
                        <div key={status}>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-gray-700">{statusLabels[status] || status}</span>
                            <span className="text-gray-500 font-medium">{count} <span className="text-gray-300">({pct}%)</span></span>
                          </div>
                          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-400 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Recent signups */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2"><Clock size={16} className="text-gray-400" /> Recent Registrations</h3>
              <div className="space-y-2">
                {[...seekers.slice(0, 5).map(s => ({ ...s, role: 'Seeker' })), ...employers.slice(0, 3).map(e => ({ ...e, role: 'Employer' }))]
                  .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                  .slice(0, 8)
                  .map((u) => (
                    <div key={u.user_id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                      <div className="flex items-center gap-2">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold ${u.role === 'Seeker' ? 'bg-blue-500' : 'bg-purple-500'}`}>
                          {(u.full_name || '?').charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{u.full_name}</p>
                          <p className="text-xs text-gray-400">{u.city}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${u.role === 'Seeker' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>{u.role}</span>
                        <span className="text-xs text-gray-400">{new Date(u.created_at).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}</span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}

        {/* ── SEEKERS ── */}
        {activeTab === 'seekers' && (
          <div>
            <div className="flex flex-wrap gap-3 mb-4 items-center">
              <SectionHeader title="All Candidates" count={seekers.length} />
              <div className="relative flex-1 min-w-52 ml-auto">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or city…" className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none bg-white" />
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {['Name', 'City', 'Status', 'Resume', 'Joined'].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredSeekers.map((s) => (
                    <tr key={s.user_id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">{(s.full_name || '?').charAt(0)}</div>
                          <span className="font-medium text-gray-900">{s.full_name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-500">{s.city || '—'}</td>
                      <td className="px-4 py-3">
                        {s.immigration_status
                          ? <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">{statusLabels[s.immigration_status] || s.immigration_status}</span>
                          : <span className="text-xs text-amber-500 flex items-center gap-1"><AlertCircle size={11} /> Incomplete</span>}
                      </td>
                      <td className="px-4 py-3">
                        {s.has_resume
                          ? <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full flex items-center gap-1 w-fit"><CheckCircle size={11} /> Uploaded</span>
                          : <span className="text-xs text-gray-400">None</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">{new Date(s.created_at).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredSeekers.length === 0 && <div className="text-center py-10 text-gray-400 text-sm">No candidates found.</div>}
            </div>
          </div>
        )}

        {/* ── EMPLOYERS ── */}
        {activeTab === 'employers' && (
          <div>
            <div className="flex flex-wrap gap-3 mb-4 items-center">
              <SectionHeader title="All Employers" count={employers.length} />
              <div className="relative flex-1 min-w-52 ml-auto">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or company…" className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none bg-white" />
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>{['Name', 'Company', 'City', 'Joined'].map((h) => <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredEmployers.map((e) => (
                    <tr key={e.user_id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-purple-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">{(e.full_name || '?').charAt(0)}</div>
                          <span className="font-medium text-gray-900">{e.full_name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-blue-700 font-medium">{e.company_name || <span className="text-amber-500 flex items-center gap-1 text-xs"><AlertCircle size={11} /> No company</span>}</td>
                      <td className="px-4 py-3 text-gray-500">{e.city || '—'}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">{new Date(e.created_at).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredEmployers.length === 0 && <div className="text-center py-10 text-gray-400 text-sm">No employers found.</div>}
            </div>
          </div>
        )}

        {/* ── JOBS ── */}
        {activeTab === 'jobs' && (
          <div>
            <div className="flex flex-wrap gap-3 mb-4 items-center">
              <SectionHeader title="CanStart Job Listings" count={jobs.length} />
              <div className="relative flex-1 min-w-52 ml-auto">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search title or company…" className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none bg-white" />
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>{['Title', 'Company', 'Type', 'City', 'Apps', 'Status', 'Posted'].map((h) => <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredJobs.map((j) => (
                    <tr key={j.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900 max-w-48 truncate">{j.title}</td>
                      <td className="px-4 py-3 text-blue-600">{j.company_name || '—'}</td>
                      <td className="px-4 py-3"><span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full capitalize">{j.type}</span></td>
                      <td className="px-4 py-3 text-gray-500">{j.city}</td>
                      <td className="px-4 py-3 text-center font-semibold text-gray-700">{j.app_count}</td>
                      <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${j.status === 'open' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{j.status}</span></td>
                      <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">{new Date(j.created_at).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredJobs.length === 0 && <div className="text-center py-10 text-gray-400 text-sm">No jobs found.</div>}
            </div>
          </div>
        )}

        {/* ── CANSTART APPLICATIONS ── */}
        {activeTab === 'applications' && (
          <div>
            <div className="flex flex-wrap gap-3 mb-4 items-center">
              <SectionHeader title="CanStart Applications" count={apps.length} />
              <div className="relative flex-1 min-w-52 ml-auto">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search candidate or job…" className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none bg-white" />
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>{['Candidate', 'Job Title', 'Company', 'Status', 'Applied'].map((h) => <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredApps.map((a) => (
                    <tr key={a.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">{(a.seeker_name || '?').charAt(0)}</div>
                          <span className="font-medium text-gray-900">{a.seeker_name || 'Unknown'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-800 max-w-48 truncate">{a.job_title || '—'}</td>
                      <td className="px-4 py-3 text-blue-600">{a.company || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${a.status === 'accepted' ? 'bg-green-100 text-green-700' : a.status === 'rejected' ? 'bg-red-100 text-red-600' : 'bg-yellow-100 text-yellow-700'}`}>
                          {a.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">{new Date(a.created_at).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredApps.length === 0 && <div className="text-center py-10 text-gray-400 text-sm">No applications found.</div>}
            </div>
          </div>
        )}

        {/* ── EXTERNAL APPLICATIONS ── */}
        {activeTab === 'external' && (
          <div>
            <div className="flex flex-wrap gap-3 mb-4 items-center">
              <SectionHeader title="External Job Applications" count={extApps.length} />
              <div className="relative flex-1 min-w-52 ml-auto">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search candidate or company…" className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none bg-white" />
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>{['Candidate', 'Job Title', 'Company', 'City', 'Applied', ''].map((h) => <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredExtApps.map((a) => (
                    <tr key={a.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">{(a.seeker_name || '?').charAt(0)}</div>
                          <span className="font-medium text-gray-900">{a.seeker_name || 'Unknown'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-800 font-medium max-w-48 truncate">{a.job_title}</td>
                      <td className="px-4 py-3 text-blue-600 font-medium">{a.company}</td>
                      <td className="px-4 py-3 text-gray-500">{a.seeker_city || '—'}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">{new Date(a.applied_at).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                      <td className="px-4 py-3">
                        <a href={a.job_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 font-medium whitespace-nowrap">
                          <ExternalLink size={12} /> View
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredExtApps.length === 0 && <div className="text-center py-10 text-gray-400 text-sm">No external applications tracked yet.</div>}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
