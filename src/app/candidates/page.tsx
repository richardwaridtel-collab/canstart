'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Search, MapPin, Globe, Briefcase, SlidersHorizontal, ExternalLink } from 'lucide-react'

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
}

const DEMO_CANDIDATES: Candidate[] = [
  { id: '1', full_name: 'Fariha J.', city: 'Ottawa', country_of_origin: 'Bangladesh', immigration_status: 'owp', skills: ['Business Analysis', 'SQL', 'Excel', 'JIRA', 'Agile'], education: "Master's in Business Administration", work_preference: 'hybrid', bio: 'Experienced Business Analyst with 10 years of international experience, eager to contribute to Canadian organizations while gaining local experience.' },
  { id: '2', full_name: 'Arjun P.', city: 'Toronto', country_of_origin: 'India', immigration_status: 'pr', skills: ['Python', 'Machine Learning', 'Data Science', 'TensorFlow', 'SQL'], education: "Bachelor's in Computer Science", work_preference: 'remote', bio: 'Data Scientist with expertise in ML models. Looking to apply my skills in the Canadian tech sector.' },
  { id: '3', full_name: 'Maria G.', city: 'Vancouver', country_of_origin: 'Philippines', immigration_status: 'student', skills: ['Marketing', 'Social Media', 'Content Creation', 'SEO', 'Canva'], education: "Bachelor's in Marketing", work_preference: 'hybrid', bio: 'Creative marketing professional passionate about digital content and brand growth.' },
  { id: '4', full_name: 'Ahmed M.', city: 'Calgary', country_of_origin: 'Egypt', immigration_status: 'owp', skills: ['Project Management', 'AutoCAD', 'Engineering', 'MS Project'], education: "Bachelor's in Civil Engineering", work_preference: 'onsite', bio: 'Civil engineer with 8 years experience in infrastructure projects. PMP certified.' },
  { id: '5', full_name: 'Lin W.', city: 'Ottawa', country_of_origin: 'China', immigration_status: 'pr', skills: ['Accounting', 'QuickBooks', 'Financial Analysis', 'Excel', 'Tax'], education: "Bachelor's in Accounting (CPA candidate)", work_preference: 'hybrid', bio: 'CPA candidate with extensive accounting experience, familiar with GAAP and IFRS.' },
  { id: '6', full_name: 'Priya S.', city: 'Montreal', country_of_origin: 'India', immigration_status: 'owp', skills: ['HR', 'Recruiting', 'HRIS', 'Onboarding', 'Employee Relations'], education: "Master's in Human Resources Management", work_preference: 'remote', bio: 'HR professional with 6 years of experience across multiple industries. Bilingual (English/French).' },
]

const statusLabels: Record<string, string> = { owp: 'Open Work Permit', pr: 'Permanent Resident', student: 'Student Visa', citizen: 'Citizen' }
const modeLabels: Record<string, string> = { remote: 'Remote', hybrid: 'Hybrid', onsite: 'On-site', any: 'Any' }

export default function CandidatesPage() {
  const [candidates, setCandidates] = useState<Candidate[]>(DEMO_CANDIDATES)
  const [filtered, setFiltered] = useState<Candidate[]>(DEMO_CANDIDATES)
  const [search, setSearch] = useState('')
  const [city, setCity] = useState('All Cities')
  const [loading] = useState(false)

  const cities = ['All Cities', 'Ottawa', 'Toronto', 'Calgary', 'Vancouver', 'Montreal', 'Edmonton', 'Winnipeg', 'Halifax']

  useEffect(() => {
    loadCandidates()
  }, [])

  useEffect(() => {
    let result = [...candidates]
    if (search) result = result.filter((c) => c.full_name.toLowerCase().includes(search.toLowerCase()) || c.skills.some((s) => s.toLowerCase().includes(search.toLowerCase())) || c.education.toLowerCase().includes(search.toLowerCase()))
    if (city !== 'All Cities') result = result.filter((c) => c.city === city)
    setFiltered(result)
  }, [search, city, candidates])

  const loadCandidates = async () => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('*, seeker_profiles(*)')
        .eq('role', 'seeker')
        .limit(50)

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
          }
        })
        setCandidates(mapped)
      }
    } catch { /* use demo */ }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-br from-gray-800 to-gray-900 text-white py-14">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl sm:text-4xl font-bold mb-3">Find Skilled Candidates</h1>
          <p className="text-gray-300 text-lg mb-8">Browse profiles of motivated newcomers ready to contribute to your business</p>
          <div className="relative max-w-2xl">
            <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by skill, education, or name..."
              className="w-full pl-12 pr-4 py-4 rounded-xl text-gray-900 text-base focus:outline-none focus:ring-2 focus:ring-red-400 shadow-lg"
            />
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-wrap gap-3 mb-8 items-center">
          <div className="flex items-center gap-2 text-gray-500 text-sm">
            <SlidersHorizontal size={16} /> Filter:
          </div>
          <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-lg px-2">
            <MapPin size={14} className="text-gray-400" />
            <select value={city} onChange={(e) => setCity(e.target.value)} className="py-2 text-sm text-gray-700 focus:outline-none bg-transparent">
              {cities.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <span className="ml-auto text-sm text-gray-500">{filtered.length} candidates</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((candidate) => (
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
              {candidate.education && (
                <p className="text-xs text-gray-500 mb-3">{candidate.education}</p>
              )}
              <div className="flex flex-wrap gap-1.5">
                {candidate.skills.slice(0, 4).map((s) => (
                  <span key={s} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{s}</span>
                ))}
                {candidate.skills.length > 4 && <span className="text-xs text-gray-400">+{candidate.skills.length - 4}</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
