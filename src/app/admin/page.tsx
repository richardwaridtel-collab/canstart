'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ExternalLink, Users, Briefcase, Search, RefreshCw, CheckCircle, TrendingUp } from 'lucide-react'

type ExternalAppRow = {
  id: string
  job_title: string
  company: string
  job_url: string
  applied_at: string
  seeker_id: string
  seeker_name?: string
  seeker_city?: string
}

const ADMIN_EMAILS = ['richard.waridtel@gmail.com']

export default function AdminPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [authorized, setAuthorized] = useState(false)
  const [externalApps, setExternalApps] = useState<ExternalAppRow[]>([])
  const [search, setSearch] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    checkAdmin()
  }, [])

  const checkAdmin = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth/signin'); return }

    // Check admin by email or role
    const { data: profile } = await supabase.from('profiles').select('role').eq('user_id', user.id).single()
    const isAdmin = ADMIN_EMAILS.includes(user.email || '') || profile?.role === 'admin'
    if (!isAdmin) { router.push('/dashboard'); return }

    setAuthorized(true)
    await loadData()
    setLoading(false)
  }

  const loadData = async () => {
    setRefreshing(true)
    try {
      // Load all external applications
      const { data: apps } = await supabase
        .from('external_applications')
        .select('id, job_title, company, job_url, applied_at, seeker_id')
        .order('applied_at', { ascending: false })
        .limit(500)

      if (apps && apps.length > 0) {
        // Load seeker profiles separately
        const seekerIds = [...new Set(apps.map((a: Record<string, unknown>) => a.seeker_id as string))]
        const { data: profiles } = await supabase.from('profiles').select('user_id, full_name, city').in('user_id', seekerIds)
        const profileMap = new Map((profiles || []).map((p: { user_id: string; full_name: string; city: string }) => [p.user_id, p]))

        setExternalApps(apps.map((row: Record<string, unknown>) => {
          const p = profileMap.get(row.seeker_id as string)
          return {
            id: row.id as string,
            job_title: row.job_title as string,
            company: row.company as string,
            job_url: row.job_url as string,
            applied_at: row.applied_at as string,
            seeker_id: row.seeker_id as string,
            seeker_name: p?.full_name,
            seeker_city: p?.city,
          }
        }))
      } else {
        setExternalApps([])
      }
    } catch { /* ignore */ } finally { setRefreshing(false) }
  }

  const filtered = externalApps.filter((a) => {
    if (!search) return true
    const q = search.toLowerCase()
    return a.job_title.toLowerCase().includes(q) || a.company.toLowerCase().includes(q) || (a.seeker_name || '').toLowerCase().includes(q) || (a.seeker_city || '').toLowerCase().includes(q)
  })

  // Stats
  const uniqueCandidates = new Set(externalApps.map((a) => a.seeker_id)).size
  const uniqueCompanies = new Set(externalApps.map((a) => a.company)).size
  const last7Days = externalApps.filter((a) => new Date(a.applied_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)).length

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-10 animate-pulse space-y-4">
        <div className="h-8 bg-gray-200 rounded w-1/3" />
        <div className="h-32 bg-gray-100 rounded-xl" />
        <div className="h-64 bg-gray-100 rounded-xl" />
      </div>
    )
  }

  if (!authorized) return null

  return (
    <div className="bg-gray-50 min-h-screen py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="bg-gradient-to-r from-gray-800 to-gray-900 text-white rounded-2xl p-6 mb-6">
          <p className="text-gray-400 text-sm mb-1">Admin Dashboard</p>
          <h1 className="text-2xl font-bold">External Application Tracker</h1>
          <p className="text-gray-300 mt-1 text-sm">Track all external job applications marked by candidates</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <div className="text-2xl font-bold text-gray-900">{externalApps.length}</div>
            <div className="text-sm text-gray-500 mt-1 flex items-center justify-center gap-1"><CheckCircle size={13} className="text-green-500" /> Total Tracked</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{uniqueCandidates}</div>
            <div className="text-sm text-gray-500 mt-1 flex items-center justify-center gap-1"><Users size={13} /> Active Candidates</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <div className="text-2xl font-bold text-purple-600">{uniqueCompanies}</div>
            <div className="text-sm text-gray-500 mt-1 flex items-center justify-center gap-1"><Briefcase size={13} /> Companies</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{last7Days}</div>
            <div className="text-sm text-gray-500 mt-1 flex items-center justify-center gap-1"><TrendingUp size={13} /> Last 7 Days</div>
          </div>
        </div>

        {/* Search + Refresh */}
        <div className="flex flex-wrap gap-3 mb-4 items-center">
          <div className="relative flex-1 min-w-64">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by candidate, company, or city..."
              className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 bg-white"
            />
          </div>
          <button
            onClick={loadData}
            disabled={refreshing}
            className="flex items-center gap-2 text-sm bg-white border border-gray-200 hover:border-gray-400 text-gray-600 px-4 py-2.5 rounded-xl transition-colors disabled:opacity-50"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} /> Refresh
          </button>
          <span className="text-sm text-gray-400 ml-auto">{filtered.length} applications</span>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          {filtered.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <CheckCircle size={40} className="mx-auto mb-3 opacity-30" />
              <p>{externalApps.length === 0 ? 'No external applications tracked yet.' : 'No results match your search.'}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Candidate</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Job Title</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Company</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">City</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Applied</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map((app) => (
                    <tr key={app.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                            {(app.seeker_name || '?').charAt(0)}
                          </div>
                          <span className="font-medium text-gray-900">{app.seeker_name || 'Unknown'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-800 font-medium max-w-48 truncate">{app.job_title}</td>
                      <td className="px-4 py-3 text-blue-600 font-medium">{app.company}</td>
                      <td className="px-4 py-3 text-gray-500">{app.seeker_city || '—'}</td>
                      <td className="px-4 py-3 text-gray-400 whitespace-nowrap">{new Date(app.applied_at).toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' })}</td>
                      <td className="px-4 py-3">
                        <a
                          href={app.job_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 font-medium whitespace-nowrap"
                        >
                          <ExternalLink size={12} /> View Job
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
