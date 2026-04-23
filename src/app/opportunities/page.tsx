'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { Opportunity } from '@/lib/types'
import OpportunityCard from '@/components/OpportunityCard'
import { Search, MapPin, SlidersHorizontal, ExternalLink, RefreshCw, Briefcase, Star } from 'lucide-react'
import { track } from '@vercel/analytics'
import Link from 'next/link'

const CITIES = ['All Cities', 'Ottawa', 'Toronto', 'Calgary', 'Vancouver', 'Montreal', 'Edmonton', 'Winnipeg', 'Halifax']
const TYPES = ['All Types', 'volunteer', 'micro-internship', 'paid']
const MODES = ['All Modes', 'remote', 'hybrid', 'onsite']
const CATEGORIES = ['All Categories', 'Marketing', 'Project Management', 'Data & Analytics', 'Business Analysis', 'Human Resources', 'Finance & Accounting', 'Technology', 'Customer Service', 'Administration']

type ExternalJob = {
  id: string
  title: string
  company: string
  city: string
  description: string
  url: string
  category: string
  salary_min?: number
  salary_max?: number
  work_mode: string
  synced_at: string
}

const DEMO_OPPORTUNITIES: Opportunity[] = [
  { id: '1', employer_id: 'e1', employer_name: 'Tech Ottawa', company_name: 'Tech Ottawa', title: 'Digital Marketing Volunteer', description: 'Help our local tech organization grow its social media presence. Manage Instagram, LinkedIn, and Twitter accounts, create content calendars, and analyze engagement metrics.', type: 'volunteer', city: 'Ottawa', work_mode: 'hybrid', skills_required: ['Social Media', 'Content Creation', 'Canva', 'Analytics'], duration: '3 months', status: 'open', created_at: new Date().toISOString() },
  { id: '2', employer_id: 'e2', employer_name: 'Maple Leaf Accounting', company_name: 'Maple Leaf Accounting', title: 'Junior Bookkeeper – Micro Internship', description: 'Support our accounting team with bookkeeping tasks using QuickBooks. Ideal for finance professionals wanting to understand the Canadian accounting system.', type: 'micro-internship', city: 'Toronto', work_mode: 'remote', skills_required: ['QuickBooks', 'Excel', 'Bookkeeping'], duration: '6 weeks', compensation: '$18/hr', status: 'open', created_at: new Date().toISOString() },
  { id: '3', employer_id: 'e3', employer_name: 'Calgary Green Builds', company_name: 'Calgary Green Builds', title: 'Project Coordinator Assistant', description: 'Assist our project management team in coordinating sustainable construction projects. Responsibilities include scheduling, communication, and document management.', type: 'volunteer', city: 'Calgary', work_mode: 'onsite', skills_required: ['Project Management', 'MS Office', 'Communication'], duration: '2 months', status: 'open', created_at: new Date().toISOString() },
  { id: '4', employer_id: 'e4', employer_name: 'Vancouver Data Co', company_name: 'Vancouver Data Co', title: 'Data Analyst – Volunteer', description: 'Work with real business datasets to create dashboards and insights for our operations team. Ideal for data analysts with Python or SQL experience.', type: 'volunteer', city: 'Vancouver', work_mode: 'remote', skills_required: ['Python', 'SQL', 'Tableau'], duration: '8 weeks', status: 'open', created_at: new Date().toISOString() },
  { id: '5', employer_id: 'e5', employer_name: 'Montreal Café Group', company_name: 'Montreal Café Group', title: 'Operations Support – Part Time', description: 'Join our growing café chain to support daily operations, inventory management, and customer service. Bilingual (French/English) preferred.', type: 'paid', city: 'Montreal', work_mode: 'onsite', skills_required: ['Customer Service', 'Bilingual', 'Inventory'], duration: 'Ongoing', compensation: '$17/hr', status: 'open', created_at: new Date().toISOString() },
  { id: '6', employer_id: 'e6', employer_name: 'Ottawa HR Solutions', company_name: 'Ottawa HR Solutions', title: 'HR Generalist – Micro Internship', description: 'Support our HR department with recruitment coordination, onboarding, and employee relations. Learn Canadian HR practices and employment law.', type: 'micro-internship', city: 'Ottawa', work_mode: 'hybrid', skills_required: ['HR', 'Recruitment', 'HRIS'], duration: '10 weeks', compensation: '$20/hr', status: 'open', created_at: new Date().toISOString() },
]

export default function OpportunitiesPage() {
  const [canstartJobs, setCanstartJobs] = useState<Opportunity[]>(DEMO_OPPORTUNITIES)
  const [externalJobs, setExternalJobs] = useState<ExternalJob[]>([])
  const [filteredCanstart, setFilteredCanstart] = useState<Opportunity[]>(DEMO_OPPORTUNITIES)
  const [filteredExternal, setFilteredExternal] = useState<ExternalJob[]>([])
  const [search, setSearch] = useState('')
  const [city, setCity] = useState('All Cities')
  const [type, setType] = useState('All Types')
  const [mode, setMode] = useState('All Modes')
  const [category, setCategory] = useState('All Categories')
  const [activeTab, setActiveTab] = useState<'canstart' | 'external'>('canstart')
  const [loading, setLoading] = useState(false)
  const [externalLoading, setExternalLoading] = useState(false)
  const [lastSynced, setLastSynced] = useState<string | null>(null)

  useEffect(() => { loadCanstartJobs(); loadExternalJobs() }, [])

  useEffect(() => {
    let cs = [...canstartJobs]
    let ext = [...externalJobs]
    if (search) {
      const q = search.toLowerCase()
      cs = cs.filter((o) => o.title.toLowerCase().includes(q) || o.description.toLowerCase().includes(q) || o.company_name.toLowerCase().includes(q) || o.skills_required?.some((s) => s.toLowerCase().includes(q)))
      ext = ext.filter((o) => o.title.toLowerCase().includes(q) || o.description?.toLowerCase().includes(q) || o.company.toLowerCase().includes(q))
    }
    if (city !== 'All Cities') { cs = cs.filter((o) => o.city === city); ext = ext.filter((o) => o.city === city) }
    if (type !== 'All Types') cs = cs.filter((o) => o.type === type)
    if (mode !== 'All Modes') { cs = cs.filter((o) => o.work_mode === mode); ext = ext.filter((o) => o.work_mode === mode) }
    if (category !== 'All Categories') ext = ext.filter((o) => o.category === category)
    setFilteredCanstart(cs)
    setFilteredExternal(ext)
  }, [search, city, type, mode, category, canstartJobs, externalJobs])

  const loadCanstartJobs = async () => {
    setLoading(true)
    try {
      const { data } = await supabase.from('opportunities').select('*, employer_profiles(company_name)').eq('status', 'open').order('created_at', { ascending: false })
      if (data && data.length > 0) {
        setCanstartJobs(data.map((o: Record<string, unknown>) => ({ ...o, company_name: (o.employer_profiles as { company_name?: string } | null)?.company_name || 'Company', employer_name: (o.employer_profiles as { company_name?: string } | null)?.company_name || 'Company' })) as Opportunity[])
      }
    } catch { /* use demo */ } finally { setLoading(false) }
  }

  const loadExternalJobs = async () => {
    setExternalLoading(true)
    try {
      const { data } = await supabase.from('external_opportunities').select('*').order('synced_at', { ascending: false }).limit(100)
      if (data && data.length > 0) {
        setExternalJobs(data as ExternalJob[])
        setLastSynced(data[0]?.synced_at || null)
      }
    } catch { /* ignore */ } finally { setExternalLoading(false) }
  }

  const handleSearch = (val: string) => { setSearch(val); if (val.length > 2) track('opportunity_search', { query: val }) }

  const clearFilters = () => { setCity('All Cities'); setType('All Types'); setMode('All Modes'); setCategory('All Categories'); setSearch('') }

  const hasFilters = city !== 'All Cities' || type !== 'All Types' || mode !== 'All Modes' || category !== 'All Categories' || search

  const formatSalary = (min?: number, max?: number) => {
    if (!min && !max) return null
    if (min && max) return `$${Math.round(min / 1000)}K–$${Math.round(max / 1000)}K/yr`
    if (min) return `$${Math.round(min / 1000)}K+/yr`
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-br from-red-700 to-red-600 text-white py-14">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl sm:text-4xl font-bold mb-3">Browse Opportunities</h1>
          <p className="text-red-100 text-lg mb-8">CanStart verified listings + live Canadian jobs updated daily from Job Market</p>
          <div className="relative max-w-2xl">
            <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" value={search} onChange={(e) => handleSearch(e.target.value)} placeholder="Search by title, skill, or company..." className="w-full pl-12 pr-4 py-4 rounded-xl text-gray-900 text-base focus:outline-none focus:ring-2 focus:ring-yellow-300 shadow-lg" />
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('canstart')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all ${activeTab === 'canstart' ? 'bg-red-600 text-white shadow-sm' : 'bg-white text-gray-600 border border-gray-200 hover:border-red-300'}`}
          >
            <Star size={16} /> CanStart Verified
            <span className={`text-xs px-2 py-0.5 rounded-full ${activeTab === 'canstart' ? 'bg-white/20' : 'bg-gray-100'}`}>{filteredCanstart.length}</span>
          </button>
          <button
            onClick={() => setActiveTab('external')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all ${activeTab === 'external' ? 'bg-gray-800 text-white shadow-sm' : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-400'}`}
          >
            <Briefcase size={16} /> Canadian Job Market
            <span className={`text-xs px-2 py-0.5 rounded-full ${activeTab === 'external' ? 'bg-white/20' : 'bg-gray-100'}`}>{filteredExternal.length}</span>
          </button>
          {lastSynced && (
            <div className="ml-auto flex items-center gap-1.5 text-xs text-gray-400">
              <RefreshCw size={12} /> Updated {new Date(lastSynced).toLocaleDateString()}
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-8 items-center">
          <div className="flex items-center gap-2 text-gray-500 text-sm"><SlidersHorizontal size={16} /> Filter:</div>
          <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-lg px-2">
            <MapPin size={14} className="text-gray-400" />
            <select value={city} onChange={(e) => setCity(e.target.value)} className="py-2 text-sm text-gray-700 focus:outline-none bg-transparent">
              {CITIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          {activeTab === 'canstart' && (
            <>
              <select value={type} onChange={(e) => setType(e.target.value)} className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none">
                {TYPES.map((t) => <option key={t} value={t}>{t === 'All Types' ? t : t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
              </select>
              <select value={mode} onChange={(e) => setMode(e.target.value)} className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none">
                {MODES.map((m) => <option key={m} value={m}>{m === 'All Modes' ? m : m.charAt(0).toUpperCase() + m.slice(1)}</option>)}
              </select>
            </>
          )}
          {activeTab === 'external' && (
            <>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none">
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
              <select value={mode} onChange={(e) => setMode(e.target.value)} className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none">
                {MODES.map((m) => <option key={m} value={m}>{m === 'All Modes' ? m : m.charAt(0).toUpperCase() + m.slice(1)}</option>)}
              </select>
            </>
          )}
          {hasFilters && <button onClick={clearFilters} className="text-sm text-red-600 hover:text-red-700 font-medium">Clear filters</button>}
        </div>

        {/* CanStart Tab */}
        {activeTab === 'canstart' && (
          loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => <div key={i} className="bg-white rounded-xl p-5 animate-pulse h-48" />)}
            </div>
          ) : filteredCanstart.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-gray-500 mb-4">No CanStart opportunities found. Try adjusting your filters.</p>
              <button onClick={clearFilters} className="text-red-600 hover:underline text-sm">Clear filters</button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredCanstart.map((opp) => <OpportunityCard key={opp.id} opportunity={opp} />)}
            </div>
          )
        )}

        {/* External Jobs Tab */}
        {activeTab === 'external' && (
          <>
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-6 text-sm text-blue-700 flex items-start gap-2">
              <ExternalLink size={16} className="flex-shrink-0 mt-0.5" />
              <span>These jobs are sourced from the Canadian job market and updated daily. Focused on <strong>Marketing</strong> and <strong>Project Management</strong> roles newcomers excel at. Clicking a listing opens the employer&apos;s original posting.</span>
            </div>

            {externalLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(9)].map((_, i) => <div key={i} className="bg-white rounded-xl p-5 animate-pulse h-48" />)}
              </div>
            ) : filteredExternal.length === 0 ? (
              <div className="text-center py-16">
                <Briefcase size={40} className="mx-auto text-gray-300 mb-4" />
                <h3 className="text-lg font-semibold text-gray-700 mb-2">Jobs syncing soon</h3>
                <p className="text-gray-500 text-sm mb-4">
                  {externalJobs.length === 0
                    ? 'Add your Adzuna API key to start syncing live Canadian jobs automatically.'
                    : 'No jobs match your current filters. Try adjusting them.'}
                </p>
                {externalJobs.length === 0 && (
                  <Link href="https://developer.adzuna.com" target="_blank" className="text-red-600 hover:underline text-sm">Get free Adzuna API key →</Link>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredExternal.map((job) => (
                  <a key={job.id} href={job.url} target="_blank" rel="noopener noreferrer"
                    onClick={() => track('external_job_click', { category: job.category, city: job.city })}
                    className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md transition-shadow hover:border-blue-200 group block"
                  >
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div>
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          <span className="text-xs font-medium px-2 py-1 rounded-full bg-blue-100 text-blue-700">{job.category}</span>
                          <span className="text-xs font-medium px-2 py-1 rounded-full bg-gray-100 text-gray-600 capitalize">{job.work_mode}</span>
                        </div>
                        <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors leading-snug">{job.title}</h3>
                        <p className="text-sm text-blue-600 font-medium mt-1">{job.company}</p>
                      </div>
                      <ExternalLink size={16} className="text-gray-300 group-hover:text-blue-400 flex-shrink-0 mt-1 transition-colors" />
                    </div>
                    <p className="text-gray-500 text-sm line-clamp-2 mb-3">{job.description}</p>
                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      <span className="flex items-center gap-1"><MapPin size={12} />{job.city}</span>
                      {formatSalary(job.salary_min, job.salary_max) && (
                        <span className="text-green-600 font-medium">{formatSalary(job.salary_min, job.salary_max)}</span>
                      )}
                    </div>
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <span className="text-xs text-blue-600 font-medium group-hover:underline">View full job posting →</span>
                    </div>
                  </a>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
