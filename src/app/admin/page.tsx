'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  Users, Briefcase, Search, RefreshCw, CheckCircle, TrendingUp,
  ExternalLink, FileText, MapPin, Globe, Star, BarChart2, Clock,
  UserCheck, Building2, AlertCircle, Database, Layers,
} from 'lucide-react'

const ADMIN_EMAILS = ['richard.waridtel@gmail.com']

type TabId = 'overview' | 'seekers' | 'employers' | 'jobs' | 'applications' | 'external' | 'jobboard'

type SeekRow = { user_id: string; full_name: string; city: string; created_at: string; immigration_status?: string; has_resume?: boolean }
type EmpRow = { user_id: string; full_name: string; city: string; created_at: string; company_name?: string }
type JobRow = { id: string; title: string; status: string; type: string; city: string; created_at: string; company_name?: string; app_count: number }
type AppRow = { id: string; status: string; created_at: string; seeker_name?: string; job_title?: string; company?: string }
type ExtAppRow = { id: string; job_title: string; company: string; job_url: string; applied_at: string; seeker_id: string; seeker_name?: string; seeker_city?: string }

type Stats = {
  totalUsers: number; seekers: number; employers: number; newThisWeek: number
  seekersWithResume: number; seekersNoProfile: number; totalJobs: number; activeJobs: number
  totalCanstartApps: number; pendingApps: number; acceptedApps: number
  totalExtApps: number; extAppsThisWeek: number
}

const STATUS_LABELS: Record<string, string> = { owp: 'Open Work Permit', pr: 'Permanent Resident', student: 'Student Visa', citizen: 'Citizen' }

const TABS: { id: TabId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'seekers', label: 'Candidates' },
  { id: 'employers', label: 'Employers' },
  { id: 'jobs', label: 'Jobs' },
  { id: 'applications', label: 'Applications' },
  { id: 'external', label: 'External Applied' },
  { id: 'jobboard', label: 'Job Board' },
]

export default function AdminPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [authorized, setAuthorized] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [activeTab, setActiveTab] = useState<TabId>('overview')
  const [search, setSearch] = useState('')
  const [stats, setStats] = useState<Stats | null>(null)
  const [seekers, setSeekers] = useState<SeekRow[]>([])
  const [employers, setEmployers] = useState<EmpRow[]>([])
  const [jobs, setJobs] = useState<JobRow[]>([])
  const [apps, setApps] = useState<AppRow[]>([])
  const [extApps, setExtApps] = useState<ExtAppRow[]>([])
  const [cityBreakdown, setCityBreakdown] = useState<{ city: string; count: number }[]>([])
  const [statusBreakdown, setStatusBreakdown] = useState<{ status: string; count: number }[]>([])
  const [jbTotal, setJbTotal] = useState(0)
  const [jbToday, setJbToday] = useState(0)
  const [jbLastSync, setJbLastSync] = useState<string | null>(null)
  const [jbByCategory, setJbByCategory] = useState<{ category: string; count: number }[]>([])
  const [jbByCity, setJbByCity] = useState<{ city: string; count: number }[]>([])
  const [jbDailyHistory, setJbDailyHistory] = useState<{ date: string; count: number }[]>([])

  useEffect(() => { checkAdmin() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const checkAdmin = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/admin/login'); return }
    const { data: profile } = await supabase.from('profiles').select('role').eq('user_id', user.id).single()
    const isAdmin = ADMIN_EMAILS.includes(user.email || '') || profile?.role === 'admin'
    if (!isAdmin) { router.push('/dashboard'); return }
    setAuthorized(true)
    await loadAll()
    setLoading(false)
  }

  const loadAll = async () => {
    setRefreshing(true)
    await Promise.all([loadSeekers(), loadEmployers(), loadJobs(), loadApps(), loadExtApps(), loadJobBoard()])
    setRefreshing(false)
  }

  const loadJobBoard = async () => {
    // Accurate total count directly from DB (no row limit)
    const { count: exactTotal } = await supabase
      .from('external_opportunities')
      .select('*', { count: 'exact', head: true })
    setJbTotal(exactTotal || 0)

    // Today's count
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
    const { count: todayCount } = await supabase
      .from('external_opportunities')
      .select('*', { count: 'exact', head: true })
      .gte('synced_at', todayStart.toISOString())
    setJbToday(todayCount || 0)

    // Last sync timestamp
    const { data: lastRow } = await supabase
      .from('external_opportunities')
      .select('synced_at')
      .order('synced_at', { ascending: false })
      .limit(1)
    setJbLastSync(lastRow?.[0]?.synced_at ?? null)

    // Load lightweight rows for breakdowns
    const { data } = await supabase
      .from('external_opportunities')
      .select('category, city, synced_at')
      .order('synced_at', { ascending: false })
      .limit(5000)

    if (!data || data.length === 0) return

    // By category
    const catMap: Record<string, number> = {}
    data.forEach((r: { category: string }) => {
      if (r.category) catMap[r.category] = (catMap[r.category] || 0) + 1
    })
    setJbByCategory(Object.entries(catMap).sort((a, b) => b[1] - a[1]).map(([category, count]) => ({ category, count })))

    // By city
    const cityMap: Record<string, number> = {}
    data.forEach((r: { city: string }) => {
      if (r.city) cityMap[r.city] = (cityMap[r.city] || 0) + 1
    })
    setJbByCity(Object.entries(cityMap).sort((a, b) => b[1] - a[1]).map(([city, count]) => ({ city, count })))

    // Daily history — last 14 days
    const dayMap: Record<string, number> = {}
    data.forEach((r: { synced_at: string }) => {
      const d = r.synced_at?.slice(0, 10)
      if (d) dayMap[d] = (dayMap[d] || 0) + 1
    })
    const sorted = Object.entries(dayMap).sort((a, b) => a[0].localeCompare(b[0])).slice(-14)
    setJbDailyHistory(sorted.map(([date, count]) => ({ date, count })))
  }

  const loadSeekers = async () => {
    const { data: pData } = await supabase.from('profiles').select('user_id, full_name, city, created_at').eq('role', 'seeker').order('created_at', { ascending: false }).limit(500)
    const { data: spData } = await supabase.from('seeker_profiles').select('user_id, immigration_status, resume_path')
    const spMap = new Map<string, { immigration_status?: string; resume_path?: string }>()
    ;(spData || []).forEach((s: { user_id: string; immigration_status?: string; resume_path?: string }) => spMap.set(s.user_id, s))
    const rows: SeekRow[] = (pData || []).map((p: { user_id: string; full_name: string; city: string; created_at: string }) => ({
      user_id: p.user_id, full_name: p.full_name, city: p.city, created_at: p.created_at,
      immigration_status: spMap.get(p.user_id)?.immigration_status,
      has_resume: !!spMap.get(p.user_id)?.resume_path,
    }))
    setSeekers(rows)
    const cityMap: Record<string, number> = {}
    rows.forEach((r) => { if (r.city) cityMap[r.city] = (cityMap[r.city] || 0) + 1 })
    setCityBreakdown(Object.entries(cityMap).sort((a, b) => b[1] - a[1]).map(([city, count]) => ({ city, count })))
    const statMap: Record<string, number> = {}
    rows.forEach((r) => { if (r.immigration_status) statMap[r.immigration_status] = (statMap[r.immigration_status] || 0) + 1 })
    setStatusBreakdown(Object.entries(statMap).sort((a, b) => b[1] - a[1]).map(([status, count]) => ({ status, count })))
  }

  const loadEmployers = async () => {
    const { data: pData } = await supabase.from('profiles').select('user_id, full_name, city, created_at').eq('role', 'employer').order('created_at', { ascending: false }).limit(200)
    const { data: epData } = await supabase.from('employer_profiles').select('user_id, company_name')
    const epMap = new Map<string, string>()
    ;(epData || []).forEach((e: { user_id: string; company_name?: string }) => { if (e.company_name) epMap.set(e.user_id, e.company_name) })
    setEmployers((pData || []).map((p: { user_id: string; full_name: string; city: string; created_at: string }) => ({
      user_id: p.user_id, full_name: p.full_name, city: p.city, created_at: p.created_at,
      company_name: epMap.get(p.user_id),
    })))
  }

  const loadJobs = async () => {
    const { data } = await supabase.from('opportunities').select('id, title, status, type, city, created_at, employer_profiles(company_name)').order('created_at', { ascending: false }).limit(200)
    const { data: appCounts } = await supabase.from('applications').select('opportunity_id')
    const countMap: Record<string, number> = {}
    ;(appCounts || []).forEach((a: { opportunity_id: string }) => { countMap[a.opportunity_id] = (countMap[a.opportunity_id] || 0) + 1 })
    setJobs((data || []).map((j: Record<string, unknown>) => ({
      id: j.id as string, title: j.title as string, status: j.status as string,
      type: j.type as string, city: j.city as string, created_at: j.created_at as string,
      company_name: (j.employer_profiles as { company_name?: string } | null)?.company_name,
      app_count: countMap[j.id as string] || 0,
    })))
  }

  const loadApps = async () => {
    const { data } = await supabase.from('applications').select('id, status, created_at, seeker_id, opportunity_id, opportunities(title, employer_profiles(company_name))').order('created_at', { ascending: false }).limit(200)
    if (!data || data.length === 0) { setApps([]); return }
    const ids = [...new Set(data.map((a: Record<string, unknown>) => a.seeker_id as string))]
    const { data: pData } = await supabase.from('profiles').select('user_id, full_name').in('user_id', ids)
    const pm = new Map<string, string>()
    ;(pData || []).forEach((p: { user_id: string; full_name: string }) => pm.set(p.user_id, p.full_name))
    setApps(data.map((a: Record<string, unknown>) => ({
      id: a.id as string, status: a.status as string, created_at: a.created_at as string,
      seeker_name: pm.get(a.seeker_id as string),
      job_title: (a.opportunities as { title?: string } | null)?.title,
      company: ((a.opportunities as { employer_profiles?: { company_name?: string } } | null)?.employer_profiles)?.company_name,
    })))
  }

  const loadExtApps = async () => {
    const { data: eData } = await supabase.from('external_applications').select('id, job_title, company, job_url, applied_at, seeker_id').order('applied_at', { ascending: false }).limit(500)
    if (!eData || eData.length === 0) { setExtApps([]); return }
    const ids = [...new Set(eData.map((a: Record<string, unknown>) => a.seeker_id as string))]
    const { data: pData } = await supabase.from('profiles').select('user_id, full_name, city').in('user_id', ids)
    const pm = new Map<string, { full_name: string; city: string }>()
    ;(pData || []).forEach((p: { user_id: string; full_name: string; city: string }) => pm.set(p.user_id, p))
    setExtApps(eData.map((r: Record<string, unknown>) => {
      const p = pm.get(r.seeker_id as string)
      return { id: r.id as string, job_title: r.job_title as string, company: r.company as string, job_url: r.job_url as string, applied_at: r.applied_at as string, seeker_id: r.seeker_id as string, seeker_name: p?.full_name, seeker_city: p?.city }
    }))
  }

  useEffect(() => {
    if (!seekers.length && !employers.length) return
    const now = Date.now(); const week = 7 * 24 * 60 * 60 * 1000
    const newThisWeek = [...seekers, ...employers].filter((u) => now - new Date(u.created_at).getTime() < week).length
    setStats({
      totalUsers: seekers.length + employers.length, seekers: seekers.length, employers: employers.length, newThisWeek,
      seekersWithResume: seekers.filter((s) => s.has_resume).length,
      seekersNoProfile: seekers.filter((s) => !s.immigration_status).length,
      totalJobs: jobs.length, activeJobs: jobs.filter((j) => j.status === 'open').length,
      totalCanstartApps: apps.length, pendingApps: apps.filter((a) => a.status === 'pending' || a.status === 'reviewed').length,
      acceptedApps: apps.filter((a) => a.status === 'accepted').length,
      totalExtApps: extApps.length, extAppsThisWeek: extApps.filter((a) => now - new Date(a.applied_at).getTime() < week).length,
    })
  }, [seekers, employers, jobs, apps, extApps])

  const q = search.toLowerCase()
  const fSeekers   = seekers.filter((s)  => !q || s.full_name?.toLowerCase().includes(q) || s.city?.toLowerCase().includes(q))
  const fEmployers = employers.filter((e) => !q || e.full_name?.toLowerCase().includes(q) || (e.company_name || '').toLowerCase().includes(q))
  const fJobs      = jobs.filter((j)      => !q || j.title?.toLowerCase().includes(q) || (j.company_name || '').toLowerCase().includes(q))
  const fApps      = apps.filter((a)      => !q || (a.seeker_name || '').toLowerCase().includes(q) || (a.job_title || '').toLowerCase().includes(q))
  const fExtApps   = extApps.filter((a)   => !q || (a.seeker_name || '').toLowerCase().includes(q) || a.company?.toLowerCase().includes(q) || a.job_title?.toLowerCase().includes(q))

  const tabCounts: Record<TabId, number> = { overview: 0, seekers: seekers.length, employers: employers.length, jobs: jobs.length, applications: apps.length, external: extApps.length, jobboard: jbTotal }

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
      <div className="bg-gradient-to-r from-gray-800 to-gray-900 text-white py-8 px-4 mb-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between flex-wrap gap-4">
          <div>
            <p className="text-gray-400 text-xs uppercase tracking-widest mb-1">CanStart Admin</p>
            <h1 className="text-2xl font-bold">Platform Analytics</h1>
            <p className="text-gray-400 text-sm mt-1">Registrations, jobs, and application tracking</p>
          </div>
          <button onClick={loadAll} disabled={refreshing} className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white text-sm px-4 py-2 rounded-xl transition-colors disabled:opacity-50">
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => { setActiveTab(t.id); setSearch('') }}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${activeTab === t.id ? 'bg-gray-900 text-white shadow' : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-400'}`}>
              {t.label}{t.id !== 'overview' ? ` (${tabCounts[t.id]})` : ''}
            </button>
          ))}
        </div>

        {/* Search bar (all tabs except overview) */}
        {activeTab !== 'overview' && (
          <div className="relative mb-4 max-w-md">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…" className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none bg-white" />
          </div>
        )}

        {/* ── OVERVIEW ── */}
        {activeTab === 'overview' && stats && (
          <div className="space-y-6">
            <div>
              <p className="text-xs uppercase tracking-widest text-gray-400 font-semibold mb-3">Platform Health</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { value: stats.totalUsers, label: 'Total Registered', sub: `+${stats.newThisWeek} this week`, icon: <Users size={22} />, color: 'text-gray-900' },
                  { value: stats.seekers, label: 'Job Seekers', sub: `${stats.seekersWithResume} with resume`, icon: <UserCheck size={22} />, color: 'text-blue-600' },
                  { value: stats.employers, label: 'Employers', sub: `${employers.filter(e => e.company_name).length} with company`, icon: <Building2 size={22} />, color: 'text-purple-600' },
                  { value: stats.newThisWeek, label: 'New This Week', sub: 'seekers + employers', icon: <TrendingUp size={22} />, color: 'text-green-600' },
                ].map((c) => (
                  <div key={c.label} className="bg-white rounded-xl border border-gray-200 p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className={`text-2xl font-bold ${c.color}`}>{c.value}</div>
                        <div className="text-sm text-gray-500 mt-0.5">{c.label}</div>
                        <div className="text-xs text-gray-400 mt-1">{c.sub}</div>
                      </div>
                      <div className="text-gray-200">{c.icon}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {stats.seekersNoProfile > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
                <AlertCircle size={18} className="text-amber-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-amber-800">{stats.seekersNoProfile} candidate{stats.seekersNoProfile > 1 ? 's' : ''} registered but profile incomplete</p>
                  <p className="text-xs text-amber-600 mt-0.5">Signed up but haven&apos;t filled in immigration status or seeker details.</p>
                </div>
              </div>
            )}

            <div>
              <p className="text-xs uppercase tracking-widest text-gray-400 font-semibold mb-3">Jobs &amp; Applications</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { value: stats.activeJobs, label: 'Active Jobs', sub: `${stats.totalJobs} total posted`, icon: <Star size={22} />, color: 'text-red-600' },
                  { value: stats.totalCanstartApps, label: 'CanStart Applications', sub: `${stats.pendingApps} pending · ${stats.acceptedApps} accepted`, icon: <FileText size={22} />, color: 'text-gray-900' },
                  { value: stats.totalExtApps, label: 'External Tracked', sub: `+${stats.extAppsThisWeek} this week`, icon: <ExternalLink size={22} />, color: 'text-blue-600' },
                  { value: stats.seekersWithResume, label: 'Resumes Uploaded', sub: `${stats.seekers - stats.seekersWithResume} still missing`, icon: <FileText size={22} />, color: 'text-green-600' },
                ].map((c) => (
                  <div key={c.label} className="bg-white rounded-xl border border-gray-200 p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className={`text-2xl font-bold ${c.color}`}>{c.value}</div>
                        <div className="text-sm text-gray-500 mt-0.5">{c.label}</div>
                        <div className="text-xs text-gray-400 mt-1">{c.sub}</div>
                      </div>
                      <div className="text-gray-200">{c.icon}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2"><MapPin size={15} className="text-red-500" /> Candidates by City</h3>
                {cityBreakdown.length === 0 ? <p className="text-sm text-gray-400">No data yet.</p> : cityBreakdown.slice(0, 8).map(({ city, count }) => {
                  const pct = seekers.length ? Math.round((count / seekers.length) * 100) : 0
                  return (
                    <div key={city} className="mb-2">
                      <div className="flex justify-between text-sm mb-1"><span className="text-gray-700">{city}</span><span className="text-gray-400">{count} ({pct}%)</span></div>
                      <div className="h-1.5 bg-gray-100 rounded-full"><div className="h-full bg-red-400 rounded-full" style={{ width: `${pct}%` }} /></div>
                    </div>
                  )
                })}
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2"><Globe size={15} className="text-blue-500" /> Immigration Status</h3>
                {statusBreakdown.length === 0 ? <p className="text-sm text-gray-400">No data yet.</p> : statusBreakdown.map(({ status, count }) => {
                  const pct = seekers.length ? Math.round((count / seekers.length) * 100) : 0
                  return (
                    <div key={status} className="mb-2">
                      <div className="flex justify-between text-sm mb-1"><span className="text-gray-700">{STATUS_LABELS[status] || status}</span><span className="text-gray-400">{count} ({pct}%)</span></div>
                      <div className="h-1.5 bg-gray-100 rounded-full"><div className="h-full bg-blue-400 rounded-full" style={{ width: `${pct}%` }} /></div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2"><Clock size={15} className="text-gray-400" /> Recent Registrations</h3>
              <div className="divide-y divide-gray-50">
                {[...seekers.slice(0, 5).map(s => ({ ...s, role: 'Seeker' as const })), ...employers.slice(0, 3).map(e => ({ ...e, role: 'Employer' as const }))]
                  .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 8)
                  .map((u) => (
                    <div key={u.user_id} className="flex items-center justify-between py-2.5">
                      <div className="flex items-center gap-2">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold ${u.role === 'Seeker' ? 'bg-blue-500' : 'bg-purple-500'}`}>{(u.full_name || '?').charAt(0)}</div>
                        <div><p className="text-sm font-medium text-gray-900">{u.full_name}</p><p className="text-xs text-gray-400">{u.city}</p></div>
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
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>{['Name', 'City', 'Status', 'Resume', 'Joined'].map(h => <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {fSeekers.map((s) => (
                  <tr key={s.user_id} className="hover:bg-gray-50">
                    <td className="px-4 py-3"><div className="flex items-center gap-2"><div className="w-7 h-7 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold">{(s.full_name || '?').charAt(0)}</div><span className="font-medium text-gray-900">{s.full_name}</span></div></td>
                    <td className="px-4 py-3 text-gray-500">{s.city || '—'}</td>
                    <td className="px-4 py-3">{s.immigration_status ? <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">{STATUS_LABELS[s.immigration_status] || s.immigration_status}</span> : <span className="text-xs text-amber-500 flex items-center gap-1"><AlertCircle size={11} /> Incomplete</span>}</td>
                    <td className="px-4 py-3">{s.has_resume ? <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full flex items-center gap-1 w-fit"><CheckCircle size={11} /> Yes</span> : <span className="text-xs text-gray-400">None</span>}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">{new Date(s.created_at).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {fSeekers.length === 0 && <div className="text-center py-10 text-gray-400 text-sm">No candidates found.</div>}
          </div>
        )}

        {/* ── EMPLOYERS ── */}
        {activeTab === 'employers' && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>{['Name', 'Company', 'City', 'Joined'].map(h => <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {fEmployers.map((e) => (
                  <tr key={e.user_id} className="hover:bg-gray-50">
                    <td className="px-4 py-3"><div className="flex items-center gap-2"><div className="w-7 h-7 rounded-full bg-purple-500 flex items-center justify-center text-white text-xs font-bold">{(e.full_name || '?').charAt(0)}</div><span className="font-medium text-gray-900">{e.full_name}</span></div></td>
                    <td className="px-4 py-3 text-blue-700 font-medium">{e.company_name || <span className="text-amber-500 text-xs flex items-center gap-1"><AlertCircle size={11} /> No company</span>}</td>
                    <td className="px-4 py-3 text-gray-500">{e.city || '—'}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">{new Date(e.created_at).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {fEmployers.length === 0 && <div className="text-center py-10 text-gray-400 text-sm">No employers found.</div>}
          </div>
        )}

        {/* ── JOBS ── */}
        {activeTab === 'jobs' && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>{['Title', 'Company', 'Type', 'City', 'Apps', 'Status', 'Posted'].map(h => <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {fJobs.map((j) => (
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
            {fJobs.length === 0 && <div className="text-center py-10 text-gray-400 text-sm">No jobs found.</div>}
          </div>
        )}

        {/* ── APPLICATIONS ── */}
        {activeTab === 'applications' && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>{['Candidate', 'Job Title', 'Company', 'Status', 'Applied'].map(h => <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {fApps.map((a) => (
                  <tr key={a.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3"><div className="flex items-center gap-2"><div className="w-7 h-7 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold">{(a.seeker_name || '?').charAt(0)}</div><span className="font-medium text-gray-900">{a.seeker_name || 'Unknown'}</span></div></td>
                    <td className="px-4 py-3 text-gray-800 max-w-48 truncate">{a.job_title || '—'}</td>
                    <td className="px-4 py-3 text-blue-600">{a.company || '—'}</td>
                    <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${a.status === 'accepted' ? 'bg-green-100 text-green-700' : a.status === 'rejected' ? 'bg-red-100 text-red-600' : 'bg-yellow-100 text-yellow-700'}`}>{a.status}</span></td>
                    <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">{new Date(a.created_at).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {fApps.length === 0 && <div className="text-center py-10 text-gray-400 text-sm">No applications found.</div>}
          </div>
        )}

        {/* ── JOB BOARD ── */}
        {activeTab === 'jobboard' && (
          <div className="space-y-6">

            {/* Summary cards */}
            <div>
              <p className="text-xs uppercase tracking-widest text-gray-400 font-semibold mb-3">External Job Board — Adzuna Sync</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { value: jbTotal, label: 'Total Jobs in DB', sub: 'across all categories', icon: <Database size={22} />, color: 'text-gray-900' },
                  { value: jbToday, label: 'Added Today', sub: new Date().toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' }), icon: <TrendingUp size={22} />, color: 'text-green-600' },
                  { value: jbByCategory.length, label: 'Categories', sub: 'job types tracked', icon: <Layers size={22} />, color: 'text-blue-600' },
                  { value: jbByCity.length, label: 'Cities', sub: 'locations represented', icon: <MapPin size={22} />, color: 'text-red-500' },
                ].map((c) => (
                  <div key={c.label} className="bg-white rounded-xl border border-gray-200 p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className={`text-2xl font-bold ${c.color}`}>{c.value}</div>
                        <div className="text-sm text-gray-500 mt-0.5">{c.label}</div>
                        <div className="text-xs text-gray-400 mt-1">{c.sub}</div>
                      </div>
                      <div className="text-gray-200">{c.icon}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Last sync + schedule notice */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Clock size={14} className="text-gray-400" />
                <span><span className="font-medium">Last sync:</span> {jbLastSync ? new Date(jbLastSync).toLocaleString('en-CA', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <CheckCircle size={14} className="text-green-500" />
                <span>Auto-sync scheduled daily at <span className="font-medium text-gray-700">5:00 AM EDT</span> (9 AM UTC)</span>
              </div>
            </div>

            {/* Daily history */}
            {jbDailyHistory.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2"><BarChart2 size={15} className="text-purple-500" /> Jobs Added per Day (last 14 days)</h3>
                {(() => {
                  const maxCount = Math.max(...jbDailyHistory.map(d => d.count), 1)
                  return jbDailyHistory.map(({ date, count }) => {
                    const pct = Math.round((count / maxCount) * 100)
                    const label = new Date(date + 'T12:00:00').toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })
                    return (
                      <div key={date} className="mb-2">
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-600 text-xs w-16 shrink-0">{label}</span>
                          <div className="flex-1 mx-3 flex items-center">
                            <div className="w-full h-2 bg-gray-100 rounded-full">
                              <div className="h-full bg-purple-400 rounded-full" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                          <span className="text-gray-500 text-xs w-12 text-right">{count.toLocaleString()}</span>
                        </div>
                      </div>
                    )
                  })
                })()}
              </div>
            )}

            {/* By category + by city */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2"><Layers size={15} className="text-blue-500" /> Jobs by Category</h3>
                {jbByCategory.length === 0 ? <p className="text-sm text-gray-400">No data yet.</p> : jbByCategory.map(({ category, count }) => {
                  const pct = jbTotal ? Math.round((count / jbTotal) * 100) : 0
                  return (
                    <div key={category} className="mb-2">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-700 text-xs truncate max-w-[65%]">{category}</span>
                        <span className="text-gray-400 text-xs">{count} ({pct}%)</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full"><div className="h-full bg-blue-400 rounded-full" style={{ width: `${pct}%` }} /></div>
                    </div>
                  )
                })}
              </div>

              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2"><MapPin size={15} className="text-red-500" /> Jobs by City</h3>
                {jbByCity.length === 0 ? <p className="text-sm text-gray-400">No data yet.</p> : jbByCity.slice(0, 10).map(({ city, count }) => {
                  const pct = jbTotal ? Math.round((count / jbTotal) * 100) : 0
                  return (
                    <div key={city} className="mb-2">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-700 text-xs">{city}</span>
                        <span className="text-gray-400 text-xs">{count} ({pct}%)</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full"><div className="h-full bg-red-400 rounded-full" style={{ width: `${pct}%` }} /></div>
                    </div>
                  )
                })}
              </div>
            </div>

          </div>
        )}

        {/* ── EXTERNAL ── */}
        {activeTab === 'external' && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>{['Candidate', 'Job Title', 'Company', 'City', 'Applied', ''].map(h => <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {fExtApps.map((a) => (
                  <tr key={a.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3"><div className="flex items-center gap-2"><div className="w-7 h-7 rounded-full bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center text-white text-xs font-bold">{(a.seeker_name || '?').charAt(0)}</div><span className="font-medium text-gray-900">{a.seeker_name || 'Unknown'}</span></div></td>
                    <td className="px-4 py-3 text-gray-800 font-medium max-w-48 truncate">{a.job_title}</td>
                    <td className="px-4 py-3 text-blue-600 font-medium">{a.company}</td>
                    <td className="px-4 py-3 text-gray-500">{a.seeker_city || '—'}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">{new Date(a.applied_at).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                    <td className="px-4 py-3"><a href={a.job_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 font-medium"><ExternalLink size={12} /> View</a></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {fExtApps.length === 0 && <div className="text-center py-10 text-gray-400 text-sm">No external applications tracked yet.</div>}
          </div>
        )}

      </div>
    </div>
  )
}
