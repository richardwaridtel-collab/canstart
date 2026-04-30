'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import {
  Search, X, Bookmark, BookmarkCheck, ChevronDown, ExternalLink,
  FileText, Briefcase, MapPin, Globe, User, SlidersHorizontal,
  MessageSquare, CalendarPlus, Check, Loader2,
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Candidate {
  id: string
  fullName: string
  city: string | null
  countryOfOrigin: string | null
  immigrationStatus: string | null   // DB value: 'pr' | 'owp' | 'student' | 'citizen'
  skills: string[]
  education: string | null
  bio: string | null
  linkedinUrl: string | null
  resumePath: string | null
  additionalDocPath: string | null
  workPreference: string | null      // DB value: 'remote' | 'hybrid' | 'onsite' | 'any'
  inPool: boolean
  matchedSkills: string[]
}

interface Opportunity { id: string; title: string }

// ─── Work preference: DB value → display label ───────────────────────────────
const WORK_MODE_OPTIONS = [
  { value: 'any',    label: 'Any'     },
  { value: 'remote', label: 'Remote'  },
  { value: 'hybrid', label: 'Hybrid'  },
  { value: 'onsite', label: 'On-site' },
]

// ─── Immigration status: DB value → display label ────────────────────────────
const IMM_STATUS_OPTIONS = [
  { value: 'any',     label: 'Any Status'         },
  { value: 'pr',      label: 'Permanent Resident' },
  { value: 'citizen', label: 'Citizen'            },
  { value: 'owp',     label: 'Open Work Permit'   },
  { value: 'student', label: 'Study Permit'       },
]

const SORT_OPTIONS = [
  { key: 'match',  label: 'Best Match' },
  { key: 'name',   label: 'Name (A–Z)' },
  { key: 'newest', label: 'Newest'     },
]

const CHIP_COLOURS = [
  'bg-blue-50 text-blue-700 border-blue-200',
  'bg-purple-50 text-purple-700 border-purple-200',
  'bg-green-50 text-green-700 border-green-200',
  'bg-amber-50 text-amber-700 border-amber-200',
  'bg-pink-50 text-pink-700 border-pink-200',
]
const chipColour = (i: number) => CHIP_COLOURS[i % CHIP_COLOURS.length]

// ─── Main component ──────────────────────────────────────────────────────────

export default function CandidatesPage() {
  const [empId, setEmpId]             = useState<string | null>(null)
  const [opps, setOpps]               = useState<Opportunity[]>([])
  const [allCandidates, setAll]       = useState<Candidate[]>([])
  const [loading, setLoading]         = useState(true)
  const [loadError, setLoadError]     = useState('')

  // ── filters
  const [skillInput, setSkillInput]   = useState('')
  const [selectedSkills, setSelected] = useState<string[]>([])
  const [cityFilter, setCityFilter]   = useState('')
  const [workMode, setWorkMode]       = useState('any')
  const [immStatus, setImmStatus]     = useState('any')
  const [hasResume, setHasResume]     = useState(false)
  const [sortBy, setSortBy]           = useState('match')
  const [showFilters, setShowFilters] = useState(false)

  // ── skill autocomplete
  const [allSkills, setAllSkills]     = useState<string[]>([])
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [showSugg, setShowSugg]       = useState(false)
  const skillRef                      = useRef<HTMLDivElement>(null)

  // ── pool loading state per candidate
  const [poolLoading, setPoolLoading] = useState<Record<string, boolean>>({})

  // ─── Bootstrap ───────────────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/auth/signin'; return }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role, full_name')
        .eq('user_id', user.id)
        .single()

      if (profile?.role !== 'employer') { window.location.href = '/dashboard'; return }

      setEmpId(user.id)

      const { data: oppData } = await supabase
        .from('opportunities')
        .select('id, title')
        .eq('employer_id', user.id)
        .order('created_at', { ascending: false })
      setOpps(oppData || [])

      await loadCandidates(user.id)
    }
    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ─── Load candidates ─────────────────────────────────────────────────────
  const loadCandidates = useCallback(async (employerId: string) => {
    setLoading(true)
    setLoadError('')
    try {
      // Step 1: load all seeker profiles
      const { data: profiles, error: pErr } = await supabase
        .from('profiles')
        .select('user_id, full_name, city')
        .eq('role', 'seeker')
        .limit(200)

      if (pErr) {
        setLoadError(`Could not load profiles: ${pErr.message}`)
        setAll([])
        return
      }

      if (!profiles || profiles.length === 0) {
        setAll([])
        return
      }

      const seekerIds = profiles.map(p => p.user_id as string)

      // Step 2: seeker_profiles + talent_pool in parallel
      // Use select('*') to handle any extra columns added via migrations
      const [{ data: spData, error: spErr }, { data: poolData }] = await Promise.all([
        supabase
          .from('seeker_profiles')
          .select('*')
          .in('user_id', seekerIds),
        supabase
          .from('talent_pool')
          .select('seeker_id')
          .eq('employer_id', employerId),
      ])

      if (spErr) {
        console.error('seeker_profiles error:', spErr)
        // Don't bail — show candidates with empty skill data
      }

      const spMap = new Map((spData || []).map(s => [s.user_id as string, s]))
      const poolSet = new Set((poolData || []).map(p => p.seeker_id as string))

      const candidates: Candidate[] = profiles.map(p => {
        const sp = spMap.get(p.user_id as string)
        return {
          id:                p.user_id as string,
          fullName:          (p.full_name as string) || 'Anonymous',
          city:              (p.city as string) || null,
          countryOfOrigin:   sp?.country_of_origin || null,
          immigrationStatus: sp?.immigration_status || null,
          skills:            Array.isArray(sp?.skills) ? (sp.skills as string[]) : [],
          education:         sp?.education || null,
          bio:               sp?.bio || null,
          linkedinUrl:       sp?.linkedin_url || null,
          resumePath:        sp?.resume_path || null,
          additionalDocPath: sp?.additional_doc_path || null,
          workPreference:    sp?.work_preference || null,
          inPool:            poolSet.has(p.user_id as string),
          matchedSkills:     [],
        }
      })

      setAll(candidates)

      // Derive all unique skills for autocomplete
      const skillSet = new Set<string>()
      candidates.forEach(c => c.skills.forEach(s => skillSet.add(s)))
      setAllSkills([...skillSet].sort())
    } catch (err) {
      console.error('loadCandidates error:', err)
      setLoadError('Unexpected error loading candidates.')
    } finally {
      setLoading(false)
    }
  }, [])

  // ─── Skill autocomplete ───────────────────────────────────────────────────
  useEffect(() => {
    if (!skillInput.trim()) { setSuggestions([]); return }
    const q = skillInput.toLowerCase()
    setSuggestions(
      allSkills
        .filter(s => s.toLowerCase().includes(q) && !selectedSkills.includes(s))
        .slice(0, 8)
    )
  }, [skillInput, allSkills, selectedSkills])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (skillRef.current && !skillRef.current.contains(e.target as Node)) {
        setShowSugg(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const addSkill = (skill: string) => {
    if (!selectedSkills.includes(skill)) setSelected(prev => [...prev, skill])
    setSkillInput('')
    setShowSugg(false)
  }

  const removeSkill = (skill: string) => setSelected(prev => prev.filter(s => s !== skill))

  const handleSkillKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === 'Enter' || e.key === ',') && skillInput.trim()) {
      e.preventDefault()
      const exact = allSkills.find(s => s.toLowerCase() === skillInput.trim().toLowerCase())
      addSkill(exact || skillInput.trim())
    }
    if (e.key === 'Backspace' && !skillInput && selectedSkills.length) {
      removeSkill(selectedSkills[selectedSkills.length - 1])
    }
  }

  // ─── Filtering + sorting ─────────────────────────────────────────────────
  const filtered: Candidate[] = allCandidates
    .map(c => ({
      ...c,
      matchedSkills: selectedSkills.filter(s =>
        c.skills.some(cs => cs.toLowerCase() === s.toLowerCase())
      ),
    }))
    .filter(c => {
      if (selectedSkills.length > 0 && c.matchedSkills.length < selectedSkills.length) return false
      if (cityFilter.trim() && !c.city?.toLowerCase().includes(cityFilter.trim().toLowerCase())) return false
      // compare using DB value directly (both are already lowercase DB codes)
      if (workMode !== 'any' && c.workPreference !== workMode) return false
      if (immStatus !== 'any' && c.immigrationStatus !== immStatus) return false
      if (hasResume && !c.resumePath) return false
      return true
    })
    .sort((a, b) => {
      if (sortBy === 'match') {
        const diff = b.matchedSkills.length - a.matchedSkills.length
        return diff !== 0 ? diff : a.fullName.localeCompare(b.fullName)
      }
      if (sortBy === 'name') return a.fullName.localeCompare(b.fullName)
      return 0
    })

  const activeFilterCount =
    selectedSkills.length +
    (cityFilter.trim() ? 1 : 0) +
    (workMode !== 'any' ? 1 : 0) +
    (immStatus !== 'any' ? 1 : 0) +
    (hasResume ? 1 : 0)

  const clearAll = () => {
    setSelected([])
    setCityFilter('')
    setWorkMode('any')
    setImmStatus('any')
    setHasResume(false)
    setSkillInput('')
  }

  // ─── Pool toggle ─────────────────────────────────────────────────────────
  const togglePool = async (candidateId: string, currentlyIn: boolean) => {
    if (!empId) return
    setPoolLoading(prev => ({ ...prev, [candidateId]: true }))
    try {
      if (currentlyIn) {
        await supabase
          .from('talent_pool')
          .delete()
          .eq('employer_id', empId)
          .eq('seeker_id', candidateId)
      } else {
        await supabase
          .from('talent_pool')
          .upsert({ employer_id: empId, seeker_id: candidateId }, { onConflict: 'employer_id,seeker_id' })
      }
      setAll(prev => prev.map(c => c.id === candidateId ? { ...c, inPool: !currentlyIn } : c))
    } finally {
      setPoolLoading(prev => ({ ...prev, [candidateId]: false }))
    }
  }

  // ─── Start conversation ──────────────────────────────────────────────────
  const startConversation = async (candidateId: string) => {
    if (!empId) return
    const { data: existing } = await supabase
      .from('conversations')
      .select('id')
      .eq('employer_id', empId)
      .eq('seeker_id', candidateId)
      .is('opportunity_id', null)
      .maybeSingle()

    let convId = existing?.id
    if (!convId) {
      const { data: created } = await supabase
        .from('conversations')
        .insert({ employer_id: empId, seeker_id: candidateId, opportunity_id: null })
        .select('id')
        .single()
      convId = created?.id
    }
    if (convId) window.location.href = `/messages/${convId}`
  }

  // ─── Resume download ─────────────────────────────────────────────────────
  const getResumeUrl = async (path: string) => {
    const { data } = await supabase.storage.from('candidate-documents').createSignedUrl(path, 60)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  // helper: immigration status code → display label
  const immLabel = (code: string | null) =>
    IMM_STATUS_OPTIONS.find(o => o.value === code)?.label ?? code ?? '—'

  // helper: work preference code → display label
  const workLabel = (code: string | null) =>
    WORK_MODE_OPTIONS.find(o => o.value === code)?.label ?? code ?? '—'

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sticky sub-header */}
      <div className="bg-white border-b border-gray-200 sticky top-16 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold text-gray-900">Find Candidates</h1>
              <p className="text-sm text-gray-500">
                {loading
                  ? 'Loading…'
                  : `${filtered.length} candidate${filtered.length !== 1 ? 's' : ''} found`}
                {!loading && activeFilterCount > 0 && ` · ${activeFilterCount} filter${activeFilterCount > 1 ? 's' : ''} active`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/talent-pool"
                className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-red-600 border border-gray-200 px-3 py-2 rounded-lg hover:border-red-300 transition-colors"
              >
                <BookmarkCheck size={15} /> Talent Pool
              </Link>
              <button
                onClick={() => setShowFilters(v => !v)}
                className={`flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border transition-colors lg:hidden ${
                  showFilters || activeFilterCount > 0
                    ? 'bg-red-50 border-red-300 text-red-700'
                    : 'border-gray-200 text-gray-600'
                }`}
              >
                <SlidersHorizontal size={15} />
                Filters
                {activeFilterCount > 0 && (
                  <span className="ml-1 bg-red-600 text-white text-[10px] font-bold min-w-[17px] h-[17px] rounded-full flex items-center justify-center px-0.5">
                    {activeFilterCount}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col lg:flex-row gap-6">

          {/* ── Sidebar ─────────────────────────────────────────────────── */}
          <aside className={`lg:w-72 flex-shrink-0 ${showFilters ? 'block' : 'hidden lg:block'}`}>
            <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-5 sticky top-36">

              {/* Skills */}
              <div ref={skillRef}>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Skills <span className="text-gray-300 font-normal normal-case">(AND — must have all)</span>
                </label>
                {selectedSkills.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {selectedSkills.map((s, i) => (
                      <span key={s} className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium ${chipColour(i)}`}>
                        {s}
                        <button onClick={() => removeSkill(s)}><X size={10} /></button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="relative">
                  <div className="flex items-center gap-2 border border-gray-300 rounded-xl px-3 py-2 focus-within:ring-2 focus-within:ring-red-500 bg-white">
                    <Search size={14} className="text-gray-400 flex-shrink-0" />
                    <input
                      type="text"
                      value={skillInput}
                      onChange={e => { setSkillInput(e.target.value); setShowSugg(true) }}
                      onFocus={() => setShowSugg(true)}
                      onKeyDown={handleSkillKey}
                      placeholder="e.g. React, Excel…"
                      className="flex-1 text-sm text-gray-800 placeholder-gray-400 bg-transparent outline-none min-w-0"
                    />
                    {skillInput && (
                      <button onClick={() => setSkillInput('')} className="text-gray-300 hover:text-red-400">
                        <X size={13} />
                      </button>
                    )}
                  </div>
                  {showSugg && suggestions.length > 0 && (
                    <ul className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                      {suggestions.map(s => (
                        <li key={s}>
                          <button
                            type="button"
                            onMouseDown={() => addSkill(s)}
                            className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-red-50 hover:text-red-700"
                          >
                            {s}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-1.5">Type a skill and press Enter to add</p>
              </div>

              {/* City */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">City</label>
                <div className="flex items-center gap-2 border border-gray-300 rounded-xl px-3 py-2 focus-within:ring-2 focus-within:ring-red-500 bg-white">
                  <MapPin size={14} className="text-gray-400 flex-shrink-0" />
                  <input
                    type="text"
                    value={cityFilter}
                    onChange={e => setCityFilter(e.target.value)}
                    placeholder="Toronto, Vancouver…"
                    className="flex-1 text-sm text-gray-800 placeholder-gray-400 bg-transparent outline-none"
                  />
                  {cityFilter && (
                    <button onClick={() => setCityFilter('')} className="text-gray-300 hover:text-red-400">
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>

              {/* Work mode */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Work Mode</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {WORK_MODE_OPTIONS.map(m => (
                    <button
                      key={m.value}
                      onClick={() => setWorkMode(m.value)}
                      className={`text-xs py-1.5 rounded-lg border font-medium transition-colors ${
                        workMode === m.value
                          ? 'bg-red-600 text-white border-red-600'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Immigration status */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Immigration Status</label>
                <div className="relative">
                  <select
                    value={immStatus}
                    onChange={e => setImmStatus(e.target.value)}
                    className="w-full appearance-none border border-gray-300 rounded-xl px-3 py-2 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-red-500 pr-8"
                  >
                    {IMM_STATUS_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
              </div>

              {/* Has Resume toggle */}
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <button
                  type="button"
                  role="switch"
                  aria-checked={hasResume}
                  onClick={() => setHasResume(v => !v)}
                  className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${hasResume ? 'bg-red-600' : 'bg-gray-200'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${hasResume ? 'translate-x-4' : ''}`} />
                </button>
                <span className="text-sm text-gray-700">Has resume uploaded</span>
              </label>

              {/* Sort */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Sort by</label>
                <div className="space-y-1">
                  {SORT_OPTIONS.map(o => (
                    <button
                      key={o.key}
                      onClick={() => setSortBy(o.key)}
                      className={`w-full flex items-center justify-between text-sm px-3 py-1.5 rounded-lg transition-colors ${
                        sortBy === o.key ? 'bg-red-50 text-red-700 font-semibold' : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {o.label}
                      {sortBy === o.key && <Check size={14} />}
                    </button>
                  ))}
                </div>
              </div>

              {activeFilterCount > 0 && (
                <button
                  onClick={clearAll}
                  className="w-full text-sm text-red-600 hover:text-red-700 font-medium py-2 border border-red-200 rounded-xl hover:bg-red-50 transition-colors"
                >
                  Clear all filters
                </button>
              )}
            </div>
          </aside>

          {/* ── Candidate grid ───────────────────────────────────────────── */}
          <div className="flex-1 min-w-0">

            {/* Active filter pills */}
            {activeFilterCount > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {selectedSkills.map((s, i) => (
                  <span key={s} className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border font-medium ${chipColour(i)}`}>
                    {s} <button onClick={() => removeSkill(s)}><X size={10} /></button>
                  </span>
                ))}
                {cityFilter.trim() && (
                  <span className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-700 px-2.5 py-1 rounded-full border border-gray-200 font-medium">
                    📍 {cityFilter} <button onClick={() => setCityFilter('')}><X size={10} /></button>
                  </span>
                )}
                {workMode !== 'any' && (
                  <span className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-700 px-2.5 py-1 rounded-full border border-gray-200 font-medium">
                    💼 {workLabel(workMode)} <button onClick={() => setWorkMode('any')}><X size={10} /></button>
                  </span>
                )}
                {immStatus !== 'any' && (
                  <span className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-700 px-2.5 py-1 rounded-full border border-gray-200 font-medium">
                    🍁 {immLabel(immStatus)} <button onClick={() => setImmStatus('any')}><X size={10} /></button>
                  </span>
                )}
                {hasResume && (
                  <span className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-700 px-2.5 py-1 rounded-full border border-gray-200 font-medium">
                    📄 Has Resume <button onClick={() => setHasResume(false)}><X size={10} /></button>
                  </span>
                )}
              </div>
            )}

            {/* Error state */}
            {loadError && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4 text-red-700 text-sm">
                {loadError}
              </div>
            )}

            {/* Loading state */}
            {loading ? (
              <div className="flex items-center justify-center py-24 text-gray-400">
                <Loader2 size={28} className="animate-spin mr-3" />
                <span>Loading candidates…</span>
              </div>
            ) : filtered.length === 0 ? (
              <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center">
                <User size={40} className="text-gray-300 mx-auto mb-3" />
                {allCandidates.length === 0 ? (
                  <>
                    <p className="text-gray-700 font-medium">No candidates have signed up yet</p>
                    <p className="text-sm text-gray-400 mt-1">Candidates will appear here once job seekers create profiles</p>
                  </>
                ) : (
                  <>
                    <p className="text-gray-700 font-medium">No candidates match your filters</p>
                    <p className="text-sm text-gray-400 mt-1">Try broadening your search</p>
                    <button
                      onClick={clearAll}
                      className="mt-4 text-sm text-red-600 hover:text-red-700 font-medium underline"
                    >
                      Clear all filters
                    </button>
                  </>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {filtered.map(c => (
                  <CandidateCard
                    key={c.id}
                    candidate={c}
                    selectedSkills={selectedSkills}
                    empId={empId}
                    opps={opps}
                    poolLoading={!!poolLoading[c.id]}
                    onTogglePool={togglePool}
                    onMessage={startConversation}
                    onResume={getResumeUrl}
                    immLabel={immLabel}
                    workLabel={workLabel}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Candidate Card ───────────────────────────────────────────────────────────

interface CardProps {
  candidate:      Candidate
  selectedSkills: string[]
  empId:          string | null
  opps:           Opportunity[]
  poolLoading:    boolean
  onTogglePool:   (id: string, inPool: boolean) => void
  onMessage:      (id: string) => void
  onResume:       (path: string) => void
  immLabel:       (code: string | null) => string
  workLabel:      (code: string | null) => string
}

function CandidateCard({
  candidate: c, selectedSkills, empId, poolLoading,
  onTogglePool, onMessage, onResume, immLabel, workLabel,
}: CardProps) {
  const [expanded, setExpanded] = useState(false)

  const initials = c.fullName
    .split(' ')
    .map((w: string) => w[0] || '')
    .slice(0, 2)
    .join('')
    .toUpperCase() || '?'

  const matchCount    = c.matchedSkills.length
  const totalSelected = selectedSkills.length

  const scheduleUrl = empId
    ? `/interviews/new?seekerId=${encodeURIComponent(c.id)}&seekerName=${encodeURIComponent(c.fullName)}`
    : '#'

  return (
    <div className={`bg-white border rounded-2xl transition-shadow hover:shadow-md ${
      totalSelected > 0 && matchCount === totalSelected
        ? 'border-green-300 ring-1 ring-green-100'
        : 'border-gray-200'
    }`}>
      <div className="p-4">

        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-full bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="font-semibold text-gray-900 text-sm leading-tight truncate">{c.fullName}</h3>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
                  {c.city && (
                    <span className="text-xs text-gray-500 flex items-center gap-0.5">
                      <MapPin size={10} /> {c.city}
                    </span>
                  )}
                  {c.workPreference && c.workPreference !== 'any' && (
                    <span className="text-xs text-gray-500 flex items-center gap-0.5">
                      <Briefcase size={10} /> {workLabel(c.workPreference)}
                    </span>
                  )}
                  {c.immigrationStatus && (
                    <span className="text-xs text-gray-500 flex items-center gap-0.5">
                      <Globe size={10} /> {immLabel(c.immigrationStatus)}
                    </span>
                  )}
                </div>
              </div>

              {/* Skill match badge */}
              {totalSelected > 0 && (
                <span className={`flex-shrink-0 text-xs font-bold px-2 py-0.5 rounded-full ${
                  matchCount === totalSelected
                    ? 'bg-green-100 text-green-700'
                    : matchCount > 0
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-gray-100 text-gray-400'
                }`}>
                  {matchCount}/{totalSelected}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Bio */}
        {c.bio && (
          <p className="mt-2.5 text-xs text-gray-500 line-clamp-2 leading-relaxed">{c.bio}</p>
        )}

        {/* Skills */}
        {c.skills.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {c.skills.slice(0, expanded ? undefined : 8).map(skill => {
              const isMatch = c.matchedSkills.some(m => m.toLowerCase() === skill.toLowerCase())
              return (
                <span
                  key={skill}
                  className={`inline-flex items-center gap-0.5 text-xs px-2 py-0.5 rounded-full border font-medium ${
                    isMatch
                      ? 'bg-green-100 text-green-700 border-green-300'
                      : 'bg-gray-50 text-gray-600 border-gray-200'
                  }`}
                >
                  {isMatch && <Check size={9} />}
                  {skill}
                </span>
              )
            })}
            {!expanded && c.skills.length > 8 && (
              <button
                onClick={() => setExpanded(true)}
                className="text-xs text-gray-400 hover:text-red-600 px-2 py-0.5 rounded-full border border-dashed border-gray-200 hover:border-red-300 transition-colors"
              >
                +{c.skills.length - 8} more
              </button>
            )}
          </div>
        )}

        {/* Education (expanded only) */}
        {expanded && c.education && (
          <p className="mt-2 text-xs text-gray-500">
            <span className="font-medium text-gray-700">Education: </span>{c.education}
          </p>
        )}

        {/* Action row */}
        <div className="mt-3 pt-3 border-t border-gray-50 flex items-center gap-2 flex-wrap">
          <button
            onClick={() => onMessage(c.id)}
            className="flex items-center gap-1 text-xs bg-gray-50 hover:bg-blue-50 text-gray-600 hover:text-blue-700 border border-gray-200 hover:border-blue-300 px-2.5 py-1.5 rounded-lg transition-colors"
          >
            <MessageSquare size={13} /> Message
          </button>

          <Link
            href={scheduleUrl}
            className="flex items-center gap-1 text-xs bg-gray-50 hover:bg-green-50 text-gray-600 hover:text-green-700 border border-gray-200 hover:border-green-300 px-2.5 py-1.5 rounded-lg transition-colors"
          >
            <CalendarPlus size={13} /> Interview
          </Link>

          {c.resumePath && (
            <button
              onClick={() => onResume(c.resumePath!)}
              className="flex items-center gap-1 text-xs bg-gray-50 hover:bg-amber-50 text-gray-600 hover:text-amber-700 border border-gray-200 hover:border-amber-300 px-2.5 py-1.5 rounded-lg transition-colors"
            >
              <FileText size={13} /> Resume
            </button>
          )}

          {c.linkedinUrl && (
            <a
              href={c.linkedinUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs bg-gray-50 hover:bg-blue-50 text-gray-600 hover:text-blue-700 border border-gray-200 hover:border-blue-300 px-2.5 py-1.5 rounded-lg transition-colors"
            >
              <ExternalLink size={13} /> LinkedIn
            </a>
          )}

          <button
            onClick={() => onTogglePool(c.id, c.inPool)}
            disabled={poolLoading}
            className={`ml-auto flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${
              c.inPool
                ? 'bg-red-50 text-red-700 border-red-300 hover:bg-red-100'
                : 'bg-gray-50 text-gray-500 border-gray-200 hover:border-red-300 hover:text-red-600 hover:bg-red-50'
            }`}
          >
            {poolLoading
              ? <Loader2 size={13} className="animate-spin" />
              : c.inPool ? <BookmarkCheck size={13} /> : <Bookmark size={13} />
            }
            {c.inPool ? 'Saved' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
