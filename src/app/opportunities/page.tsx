'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Opportunity } from '@/lib/types'
import OpportunityCard from '@/components/OpportunityCard'
import { Search, MapPin, SlidersHorizontal, ExternalLink, RefreshCw, Briefcase, Star, Lock } from 'lucide-react'
import { track } from '@vercel/analytics'
import Link from 'next/link'

const CITIES = ['All Cities', 'Ottawa', 'Toronto', 'Calgary', 'Vancouver', 'Montreal', 'Edmonton', 'Winnipeg', 'Halifax']
const TYPES = ['All Types', 'volunteer', 'micro-internship', 'paid']
const MODES = ['All Modes', 'remote', 'hybrid', 'onsite']
const EXPERIENCE_LEVELS = ['Any Level', 'Entry Level', 'Mid Level', 'Senior Level']
const CATEGORIES = [
  'All Categories',
  'Marketing & Communications',
  'Sales & Business Development',
  'Project Management',
  'Data & Analytics',
  'Technology & IT',
  'Finance & Accounting',
  'Human Resources',
  'Customer Service',
  'Administration & Office',
  'Business Analysis',
  'Operations & Logistics',
  'Design & Creative',
  'Education & Training',
  'Healthcare & Social Services',
  'Engineering',
  'Legal & Compliance',
]

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

type SeekerProfile = { skills: string[]; work_preference: string; city: string; resume_text?: string }

function detectExperienceFromTitle(title: string): string {
  const t = title.toLowerCase()
  if (t.includes('junior') || t.includes('entry') || t.includes('associate') || t.includes('assistant') || t.includes('coordinator')) return 'Entry Level'
  if (t.includes('senior') || t.includes(' sr ') || t.includes('sr.') || t.includes('lead') || t.includes('principal') || t.includes('director') || t.includes('vp ') || t.includes('manager')) return 'Senior Level'
  return 'Mid Level'
}

function skillsMatch(skills: string[], text: string): number {
  return skills.filter((s) => text.includes(s.toLowerCase())).length
}

function tieredSkillScore(matched: number, max = 65): number {
  if (matched >= 4) return max
  if (matched === 3) return Math.round(max * 0.85)
  if (matched === 2) return Math.round(max * 0.65)
  if (matched === 1) return Math.round(max * 0.40)
  return 0
}

function computeCanstartMatch(seeker: SeekerProfile | null, opp: Opportunity): number {
  if (!seeker) return 0
  const required = opp.skills_required || []
  const resumeText = seeker.resume_text?.toLowerCase() || ''
  const hasResume = resumeText.length > 50
  const source = hasResume ? resumeText : seeker.skills.join(' ').toLowerCase()

  let skillScore = 0
  if (required.length > 0) {
    const matched = required.filter((r) => source.includes(r.toLowerCase())).length
    skillScore = tieredSkillScore(matched)
  } else {
    skillScore = 45 // open to anyone
  }

  const modeScore = (seeker.work_preference === 'any' || seeker.work_preference === opp.work_mode || opp.work_mode === 'hybrid') ? 20 : 5
  const cityScore = seeker.city && opp.city && seeker.city.toLowerCase() === opp.city.toLowerCase() ? 15 : 0
  return Math.round(Math.min(100, skillScore + modeScore + cityScore))
}

function computeExternalMatch(seeker: SeekerProfile | null, job: ExternalJob): number {
  if (!seeker || seeker.skills.length === 0) return 0
  const jobText = (job.title + ' ' + (job.description || '')).toLowerCase()
  const resumeText = seeker.resume_text?.toLowerCase() || ''
  const hasResume = resumeText.length > 50

  let matchedCount = 0
  if (hasResume) {
    // Skills that appear in both resume AND job (high confidence)
    const inResume = skillsMatch(seeker.skills, resumeText)
    const inJob = skillsMatch(seeker.skills, jobText)
    const inBoth = seeker.skills.filter((s) => resumeText.includes(s.toLowerCase()) && jobText.includes(s.toLowerCase())).length
    // Weight: confirmed in both > just in job > just in resume
    matchedCount = inBoth * 2 + Math.max(0, inJob - inBoth)
    matchedCount = Math.min(seeker.skills.length, matchedCount)
    // Give partial credit even if only resume or only job matches
    if (matchedCount === 0 && (inResume > 0 || inJob > 0)) matchedCount = 0.5
  } else {
    matchedCount = skillsMatch(seeker.skills, jobText)
  }

  const skillScore = tieredSkillScore(matchedCount)
  const modeScore = (seeker.work_preference === 'any' || seeker.work_preference === job.work_mode || job.work_mode === 'hybrid') ? 20 : 5
  const cityScore = seeker.city && job.city && seeker.city.toLowerCase() === job.city.toLowerCase() ? 15 : 0
  return Math.round(Math.min(100, skillScore + modeScore + cityScore))
}

function MatchBar({ pct, fromResume }: { pct: number; fromResume: boolean }) {
  const color = pct >= 70 ? 'bg-green-500' : pct >= 40 ? 'bg-yellow-400' : 'bg-orange-400'
  const label = pct >= 70 ? 'Strong Match' : pct >= 40 ? 'Good Match' : 'Partial Match'
  const textColor = pct >= 70 ? 'text-green-600' : pct >= 40 ? 'text-yellow-600' : 'text-orange-500'
  return (
    <div className="mt-3 pt-3 border-t border-gray-100">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-gray-400 flex items-center gap-1">
          Your Match
          {fromResume && <span className="bg-green-100 text-green-700 text-[10px] px-1.5 py-0.5 rounded-full font-medium">resume</span>}
        </span>
        <span className={`text-xs font-semibold ${textColor}`}>{pct}% · {label}</span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export default function OpportunitiesPage() {
  const router = useRouter()
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [seekerProfile, setSeekerProfile] = useState<SeekerProfile | null>(null)
  const [canstartJobs, setCanstartJobs] = useState<Opportunity[]>([])
  const [externalJobs, setExternalJobs] = useState<ExternalJob[]>([])
  const [filteredCanstart, setFilteredCanstart] = useState<Opportunity[]>([])
  const [filteredExternal, setFilteredExternal] = useState<ExternalJob[]>([])
  const [search, setSearch] = useState('')
  const [city, setCity] = useState('All Cities')
  const [type, setType] = useState('All Types')
  const [mode, setMode] = useState('All Modes')
  const [category, setCategory] = useState('All Categories')
  const [experience, setExperience] = useState('Any Level')
  const [activeTab, setActiveTab] = useState<'canstart' | 'external'>('external')
  const [loading, setLoading] = useState(false)
  const [externalLoading, setExternalLoading] = useState(false)
  const [lastSynced, setLastSynced] = useState<string | null>(null)

  useEffect(() => {
    checkAuth()
    loadExternalJobs()
  }, [])

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
    if (category !== 'All Categories') {
      cs = cs.filter((o) => (o as unknown as { category?: string }).category?.toLowerCase().includes(category.split(' ')[0].toLowerCase()) ?? false)
      ext = ext.filter((o) => o.category.toLowerCase().includes(category.split(' ')[0].toLowerCase()))
    }
    if (experience !== 'Any Level') {
      cs = cs.filter((o) => {
        const lvl = (o as unknown as { experience_level?: string }).experience_level || 'any'
        if (experience === 'Entry Level') return lvl === 'entry' || lvl === 'any'
        if (experience === 'Mid Level') return lvl === 'mid' || lvl === 'any'
        if (experience === 'Senior Level') return lvl === 'senior'
        return true
      })
      ext = ext.filter((o) => detectExperienceFromTitle(o.title) === experience)
    }

    setFilteredCanstart(cs)
    setFilteredExternal(ext)
  }, [search, city, type, mode, category, experience, canstartJobs, externalJobs])

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      setIsLoggedIn(true)
      const { data: profile } = await supabase.from('profiles').select('role, city').eq('user_id', user.id).single()
      if (profile?.role === 'seeker') {
        const { data: sp } = await supabase.from('seeker_profiles').select('skills, work_preference, resume_text').eq('user_id', user.id).single()
        if (sp) setSeekerProfile({ skills: sp.skills || [], work_preference: sp.work_preference || 'any', city: profile.city || '', resume_text: sp.resume_text || '' })
      }
      loadCanstartJobs()
    }
  }

  const loadCanstartJobs = async () => {
    setLoading(true)
    try {
      const { data } = await supabase.from('opportunities').select('*, employer_profiles(company_name)').eq('status', 'open').order('created_at', { ascending: false })
      if (data) {
        setCanstartJobs(data.map((o: Record<string, unknown>) => ({ ...o, company_name: (o.employer_profiles as { company_name?: string } | null)?.company_name || 'Company', employer_name: (o.employer_profiles as { company_name?: string } | null)?.company_name || 'Company' })) as Opportunity[])
      }
    } catch { /* ignore */ } finally { setLoading(false) }
  }

  const loadExternalJobs = async () => {
    setExternalLoading(true)
    try {
      const { data } = await supabase.from('external_opportunities').select('*').order('synced_at', { ascending: false }).limit(200)
      if (data && data.length > 0) {
        setExternalJobs(data as ExternalJob[])
        setLastSynced(data[0]?.synced_at || null)
      }
    } catch { /* ignore */ } finally { setExternalLoading(false) }
  }

  const handleSearch = (val: string) => { setSearch(val); if (val.length > 2) track('opportunity_search', { query: val }) }
  const clearFilters = () => { setCity('All Cities'); setType('All Types'); setMode('All Modes'); setCategory('All Categories'); setExperience('Any Level'); setSearch('') }
  const hasFilters = city !== 'All Cities' || type !== 'All Types' || mode !== 'All Modes' || category !== 'All Categories' || experience !== 'Any Level' || search

  const formatSalary = (min?: number, max?: number) => {
    if (!min && !max) return null
    if (min && max) return `$${Math.round(min / 1000)}K–$${Math.round(max / 1000)}K/yr`
    if (min) return `$${Math.round(min / 1000)}K+/yr`
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-br from-red-700 to-red-600 text-white py-14">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl sm:text-4xl font-bold mb-3">Browse Opportunities</h1>
          <p className="text-red-100 text-lg mb-8">CanStart verified listings + live Canadian jobs updated daily</p>
          <div className="relative max-w-2xl">
            <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" value={search} onChange={(e) => handleSearch(e.target.value)} placeholder="Search by title, skill, or company..." className="w-full pl-12 pr-4 py-4 rounded-xl text-gray-900 text-base focus:outline-none focus:ring-2 focus:ring-yellow-300 shadow-lg" />
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mb-6 items-center">
          <button
            onClick={() => { if (!isLoggedIn) { router.push('/auth/signin?redirect=/opportunities') } else { setActiveTab('canstart') } }}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all ${activeTab === 'canstart' ? 'bg-red-600 text-white shadow-sm' : 'bg-white text-gray-600 border border-gray-200 hover:border-red-300'}`}
          >
            <Star size={16} /> CanStart Verified
            {isLoggedIn && <span className={`text-xs px-2 py-0.5 rounded-full ${activeTab === 'canstart' ? 'bg-white/20' : 'bg-gray-100'}`}>{filteredCanstart.length}</span>}
            {!isLoggedIn && <Lock size={13} className="opacity-60" />}
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
          <select value={experience} onChange={(e) => setExperience(e.target.value)} className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none">
            {EXPERIENCE_LEVELS.map((l) => <option key={l}>{l}</option>)}
          </select>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none">
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
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
            <select value={mode} onChange={(e) => setMode(e.target.value)} className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none">
              {MODES.map((m) => <option key={m} value={m}>{m === 'All Modes' ? m : m.charAt(0).toUpperCase() + m.slice(1)}</option>)}
            </select>
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
              <Star size={40} className="mx-auto text-gray-300 mb-4" />
              <h3 className="text-lg font-semibold text-gray-700 mb-2">
                {canstartJobs.length === 0 ? 'No verified listings yet' : 'No results match your filters'}
              </h3>
              <p className="text-gray-500 text-sm mb-4">
                {canstartJobs.length === 0 ? 'CanStart verified opportunities will appear here as employers post them.' : 'Try adjusting your search or filters.'}
              </p>
              {hasFilters && <button onClick={clearFilters} className="text-red-600 hover:underline text-sm">Clear filters</button>}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredCanstart.map((opp) => {
                const pct = computeCanstartMatch(seekerProfile, opp)
                return (
                  <div key={opp.id} className="flex flex-col">
                    <OpportunityCard opportunity={opp} />
                    {seekerProfile && <div className="bg-white border border-t-0 border-gray-200 rounded-b-xl px-5 pb-4"><MatchBar pct={pct} fromResume={!!seekerProfile.resume_text && seekerProfile.resume_text.length > 50} /></div>}
                  </div>
                )
              })}
            </div>
          )
        )}

        {/* External Jobs Tab */}
        {activeTab === 'external' && (
          <>
            {seekerProfile && (
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 mb-5 text-sm text-blue-700 flex items-center gap-2">
                <Star size={15} className="flex-shrink-0" />
                Match percentages are calculated based on your profile skills, work preference, and city.
              </div>
            )}
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-6 text-sm text-gray-600 flex items-start gap-2">
              <ExternalLink size={16} className="flex-shrink-0 mt-0.5" />
              <span>Live jobs from the Canadian market, updated daily. Clicking a listing opens the employer&apos;s original posting.</span>
            </div>

            {externalLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(9)].map((_, i) => <div key={i} className="bg-white rounded-xl p-5 animate-pulse h-48" />)}
              </div>
            ) : filteredExternal.length === 0 ? (
              <div className="text-center py-16">
                <Briefcase size={40} className="mx-auto text-gray-300 mb-4" />
                <h3 className="text-lg font-semibold text-gray-700 mb-2">No jobs match your filters</h3>
                <p className="text-gray-500 text-sm mb-4">Try adjusting your search or filters.</p>
                {hasFilters && <button onClick={clearFilters} className="text-red-600 hover:underline text-sm">Clear filters</button>}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredExternal.map((job) => {
                  const pct = computeExternalMatch(seekerProfile, job)
                  const expLevel = detectExperienceFromTitle(job.title)
                  return (
                    <a key={job.id} href={job.url} target="_blank" rel="noopener noreferrer"
                      onClick={() => track('external_job_click', { category: job.category, city: job.city })}
                      className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md transition-shadow hover:border-blue-200 group block"
                    >
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap gap-1.5 mb-2">
                            <span className="text-xs font-medium px-2 py-1 rounded-full bg-blue-100 text-blue-700">{job.category}</span>
                            <span className="text-xs font-medium px-2 py-1 rounded-full bg-gray-100 text-gray-600 capitalize">{job.work_mode}</span>
                            <span className="text-xs font-medium px-2 py-1 rounded-full bg-purple-50 text-purple-600">{expLevel}</span>
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
                      {seekerProfile && <MatchBar pct={pct} fromResume={!!seekerProfile.resume_text && seekerProfile.resume_text.length > 50} />}
                      {!seekerProfile && (
                        <div className="mt-3 pt-3 border-t border-gray-100">
                          <span className="text-xs text-blue-600 font-medium group-hover:underline">View full job posting →</span>
                        </div>
                      )}
                    </a>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
