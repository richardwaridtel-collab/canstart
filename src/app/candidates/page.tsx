'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Search, MapPin, Globe, Briefcase, SlidersHorizontal, ExternalLink, FileText, Download, ChevronDown } from 'lucide-react'

type Candidate = {
  id: string
  full_name: string
  city: string
  country_of_origin: string
  immigration_status: string
  skills: string[]
  education: string
  work_preference: string
  bio: string
  linkedin_url?: string
  resume_path?: string
  additional_doc_path?: string
}

type PostedOpportunity = {
  id: string
  title: string
  skills_required: string[]
  work_mode: string
  city: string
}

const statusLabels: Record<string, string> = { owp: 'Open Work Permit', pr: 'Permanent Resident', student: 'Student Visa', citizen: 'Citizen' }
const modeLabels: Record<string, string> = { remote: 'Remote', hybrid: 'Hybrid', onsite: 'On-site', any: 'Any' }

function tieredSkillScore(matched: number): number {
  if (matched >= 4) return 65
  if (matched === 3) return 55
  if (matched === 2) return 42
  if (matched === 1) return 26
  return 0
}

function computeMatch(candidate: Candidate, opp: PostedOpportunity): number {
  const required = opp.skills_required || []
  let skillScore = 0
  if (required.length > 0) {
    const matched = required.filter((r) => candidate.skills.some((s) => s.toLowerCase().includes(r.toLowerCase()) || r.toLowerCase().includes(s.toLowerCase()))).length
    skillScore = tieredSkillScore(matched)
  } else {
    skillScore = 45
  }
  const modeScore = (candidate.work_preference === 'any' || candidate.work_preference === opp.work_mode || opp.work_mode === 'hybrid') ? 20 : 5
  const cityScore = candidate.city && opp.city && candidate.city.toLowerCase() === opp.city.toLowerCase() ? 15 : 0
  return Math.round(Math.min(100, skillScore + modeScore + cityScore))
}

function MatchBar({ pct }: { pct: number }) {
  const color = pct >= 70 ? 'bg-green-500' : pct >= 40 ? 'bg-yellow-400' : 'bg-orange-400'
  const label = pct >= 70 ? 'Strong Match' : pct >= 40 ? 'Good Match' : 'Partial Match'
  const textColor = pct >= 70 ? 'text-green-600' : pct >= 40 ? 'text-yellow-600' : 'text-orange-500'
  return (
    <div className="mt-3 pt-3 border-t border-gray-100">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-gray-400">Match Score</span>
        <span className={`text-xs font-semibold ${textColor}`}>{pct}% · {label}</span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export default function CandidatesPage() {
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [filtered, setFiltered] = useState<Candidate[]>([])
  const [search, setSearch] = useState('')
  const [city, setCity] = useState('All Cities')
  const [isEmployer, setIsEmployer] = useState(false)
  const [authChecked, setAuthChecked] = useState(false)
  const [postedJobs, setPostedJobs] = useState<PostedOpportunity[]>([])
  const [selectedJobId, setSelectedJobId] = useState<string>('')
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  const cities = ['All Cities', 'Ottawa', 'Toronto', 'Calgary', 'Vancouver', 'Montreal', 'Edmonton', 'Winnipeg', 'Halifax']
  const selectedJob = postedJobs.find((j) => j.id === selectedJobId) || null

  useEffect(() => {
    checkEmployer()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let result = [...candidates]
    if (search) result = result.filter((c) => c.full_name.toLowerCase().includes(search.toLowerCase()) || c.skills.some((s) => s.toLowerCase().includes(search.toLowerCase())) || c.education.toLowerCase().includes(search.toLowerCase()))
    if (city !== 'All Cities') result = result.filter((c) => c.city === city)
    if (selectedJob) result = [...result].sort((a, b) => computeMatch(b, selectedJob) - computeMatch(a, selectedJob))
    setFiltered(result)
  }, [search, city, candidates, selectedJobId])

  const checkEmployer = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth/signin'); return }
    const { data: profile } = await supabase.from('profiles').select('role').eq('user_id', user.id).single()
    if (profile?.role !== 'employer') { router.push('/dashboard'); return }
    setIsEmployer(true)
    setAuthChecked(true)
    const { data: jobs } = await supabase.from('opportunities').select('id, title, skills_required, work_mode, city').eq('employer_id', user.id).eq('status', 'open')
    if (jobs) setPostedJobs(jobs as PostedOpportunity[])
    loadCandidates()
  }

  const loadCandidates = async () => {
    try {
      const { data } = await supabase.from('profiles').select('*, seeker_profiles(*)').eq('role', 'seeker').limit(50)
      if (data && data.length > 0) {
        const mapped = data.map((p: Record<string, unknown>) => {
          const sp = p.seeker_profiles as Record<string, unknown> | null
          return {
            id: p.id as string,
            full_name: p.full_name as string,
            city: p.city as string,
            country_of_origin: (sp?.country_of_origin as string) || '',
            immigration_status: (sp?.immigration_status as string) || '',
            skills: (sp?.skills as string[]) || [],
            education: (sp?.education as string) || '',
            work_preference: (sp?.work_preference as string) || 'any',
            bio: (sp?.bio as string) || '',
            linkedin_url: sp?.linkedin_url as string | undefined,
            resume_path: sp?.resume_path as string | undefined,
            additional_doc_path: sp?.additional_doc_path as string | undefined,
          }
        })
        setCandidates(mapped)
      }
    } catch { /* ignore */ }
  }

  const downloadDoc = async (path: string, label: string, candidateId: string) => {
    setDownloadingId(candidateId + label)
    const { data, error } = await supabase.storage.from('candidate-documents').createSignedUrl(path, 3600)
    setDownloadingId(null)
    if (error || !data?.signedUrl) { alert('Could not generate download link. Please try again.'); return }
    window.open(data.signedUrl, '_blank')
  }

  if (!authChecked) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-gray-400 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-br from-gray-800 to-gray-900 text-white py-14">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl sm:text-4xl font-bold mb-3">Find Skilled Candidates</h1>
          <p className="text-gray-300 text-lg mb-8">Browse profiles of motivated newcomers ready to contribute to your business</p>
          <div className="relative max-w-2xl">
            <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by skill, education, or name..." className="w-full pl-12 pr-4 py-4 rounded-xl text-gray-900 text-base focus:outline-none focus:ring-2 focus:ring-red-400 shadow-lg" />
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-wrap gap-3 mb-6 items-center">
          <div className="flex items-center gap-2 text-gray-500 text-sm"><SlidersHorizontal size={16} /> Filter:</div>
          <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-lg px-2">
            <MapPin size={14} className="text-gray-400" />
            <select value={city} onChange={(e) => setCity(e.target.value)} className="py-2 text-sm text-gray-700 focus:outline-none bg-transparent">
              {cities.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <span className="ml-auto text-sm text-gray-500">{filtered.length} candidates</span>
        </div>

        {isEmployer && postedJobs.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <Briefcase size={16} className="text-red-500" />
              Match candidates against:
            </div>
            <div className="relative flex-1 min-w-48">
              <select
                value={selectedJobId}
                onChange={(e) => setSelectedJobId(e.target.value)}
                className="w-full appearance-none bg-gray-50 border border-gray-200 rounded-lg pl-3 pr-8 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                <option value="">— Select one of your opportunities —</option>
                {postedJobs.map((j) => <option key={j.id} value={j.id}>{j.title}</option>)}
              </select>
              <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
            {selectedJob && <span className="text-xs text-gray-400">Candidates sorted by match %</span>}
          </div>
        )}

        {filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">No candidates found.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((candidate) => {
              const matchPct = selectedJob ? computeMatch(candidate, selectedJob) : null
              return (
                <div key={candidate.id} className="bg-white rounded-2xl border border-gray-200 p-5 hover:shadow-md transition-shadow hover:border-gray-300">
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-red-700 rounded-full flex items-center justify-center text-white font-bold text-lg">
                      {candidate.full_name.charAt(0)}
                    </div>
                    {candidate.linkedin_url && (
                      <a href={candidate.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-700">
                        <ExternalLink size={16} />
                      </a>
                    )}
                  </div>
                  <h3 className="font-bold text-gray-900 text-lg">{candidate.full_name}</h3>
                  <div className="flex flex-wrap gap-2 mt-1 mb-3 text-xs text-gray-500">
                    <span className="flex items-center gap-1"><MapPin size={12} />{candidate.city}</span>
                    {candidate.country_of_origin && <span className="flex items-center gap-1"><Globe size={12} />From {candidate.country_of_origin}</span>}
                    <span className="flex items-center gap-1"><Briefcase size={12} />{modeLabels[candidate.work_preference] || 'Any'}</span>
                  </div>
                  {candidate.immigration_status && (
                    <span className="inline-block text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full mb-3">
                      {statusLabels[candidate.immigration_status] || candidate.immigration_status}
                    </span>
                  )}
                  {candidate.bio && <p className="text-gray-600 text-sm line-clamp-2 mb-3">{candidate.bio}</p>}
                  {candidate.education && <p className="text-xs text-gray-500 mb-3">{candidate.education}</p>}
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {candidate.skills.slice(0, 4).map((s) => (
                      <span key={s} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{s}</span>
                    ))}
                    {candidate.skills.length > 4 && <span className="text-xs text-gray-400">+{candidate.skills.length - 4}</span>}
                  </div>

                  {matchPct !== null && <MatchBar pct={matchPct} />}

                  {isEmployer && (candidate.resume_path || candidate.additional_doc_path) && (
                    <div className={`flex flex-wrap gap-2 ${matchPct !== null ? 'mt-3' : 'pt-3 border-t border-gray-100 mt-3'}`}>
                      {candidate.resume_path && (
                        <button
                          onClick={() => downloadDoc(candidate.resume_path!, 'resume', candidate.id)}
                          disabled={downloadingId === candidate.id + 'resume'}
                          className="flex items-center gap-1.5 text-xs bg-red-50 hover:bg-red-100 text-red-700 px-3 py-1.5 rounded-full font-medium transition-colors disabled:opacity-50"
                        >
                          {downloadingId === candidate.id + 'resume' ? <div className="w-3 h-3 border border-red-400 border-t-transparent rounded-full animate-spin" /> : <Download size={12} />}
                          Resume
                        </button>
                      )}
                      {candidate.additional_doc_path && (
                        <button
                          onClick={() => downloadDoc(candidate.additional_doc_path!, 'additional', candidate.id)}
                          disabled={downloadingId === candidate.id + 'additional'}
                          className="flex items-center gap-1.5 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-full font-medium transition-colors disabled:opacity-50"
                        >
                          {downloadingId === candidate.id + 'additional' ? <div className="w-3 h-3 border border-gray-400 border-t-transparent rounded-full animate-spin" /> : <FileText size={12} />}
                          Document
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
