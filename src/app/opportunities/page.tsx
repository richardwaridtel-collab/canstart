'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Opportunity } from '@/lib/types'
import OpportunityCard from '@/components/OpportunityCard'
import { Search, MapPin, SlidersHorizontal, ExternalLink, RefreshCw, Briefcase, Star, Lock, Target, CheckCircle } from 'lucide-react'
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

// ─── ATS Keyword Analysis ────────────────────────────────────────────────────

const KNOWN_SKILLS = [
  // Office & Productivity
  'Excel','Word','PowerPoint','Outlook','SharePoint','Teams','Access','Visio',
  'Google Workspace','Google Docs','Google Sheets','Google Slides','Zoom','Slack','Skype',
  // CRM & Marketing Platforms
  'Salesforce','HubSpot','Marketo','Mailchimp','Constant Contact','Hootsuite','Buffer',
  'Sprout Social','Pardot','ActiveCampaign','Zoho CRM','Pipedrive',
  // Design
  'Canva','Adobe Creative Suite','Photoshop','Illustrator','InDesign','Figma','Sketch',
  'Premiere Pro','After Effects','Final Cut Pro',
  // Analytics & Advertising
  'Tableau','Power BI','Looker','Google Analytics','Google Ads','Facebook Ads',
  'LinkedIn Ads','SEMrush','Ahrefs','Google Search Console','Google Tag Manager',
  // Development
  'SQL','Python','Java','JavaScript','TypeScript','React','HTML','CSS','PHP',
  'R','VBA','Git','WordPress','Shopify',
  // Finance & Accounting
  'QuickBooks','Xero','Sage','SAP','Oracle','NetSuite','Workday','FreshBooks',
  'financial modeling','GAAP','IFRS','accounts payable','accounts receivable',
  // Project Management Tools
  'Jira','Trello','Asana','Monday.com','Notion','Airtable','ClickUp','MS Project','Basecamp',
  // Methodologies & Frameworks
  'Agile','Scrum','Kanban','Lean','Six Sigma','Waterfall','PRINCE2',
  // Certifications
  'PMP','CAPM','PMBOK','ITIL','CPA','CFA','MBA','CHRP',
  // Digital Marketing
  'SEO','SEM','PPC','content marketing','digital marketing','email marketing',
  'social media marketing','copywriting','brand management','influencer marketing','A/B testing',
  // Business & Strategy
  'CRM','ERP','KPI','ROI','B2B','B2C','SaaS','stakeholder management',
  'change management','risk management','business development','strategic planning',
  'project management','process improvement','cross-functional collaboration',
  // Data & Analysis
  'data analysis','data visualization','business analysis','financial analysis',
  'forecasting','budgeting','variance analysis','reporting','dashboards',
  // HR
  'HRIS','talent acquisition','recruitment','onboarding','performance management',
  'payroll','employee relations','workforce planning','benefits administration',
  // Operations
  'supply chain','logistics','procurement','inventory management','vendor management',
  'operations management','quality assurance','compliance',
  // Customer-facing
  'customer service','account management','client relations','customer success',
  'sales','business development','cold calling','CRM management',
  // Languages
  'bilingual','French','English','Spanish','Mandarin','Arabic',
  // Soft skills recruiters list explicitly
  'leadership','communication','presentation skills','problem-solving',
  'critical thinking','attention to detail','time management',
]

// How to bridge common missing skills using existing experience
const SKILL_BRIDGES: Record<string, string> = {
  'salesforce': 'Any CRM (HubSpot, Zoho, Dynamics) is transferable. Highlight it + note you can ramp up on Salesforce.',
  'hubspot': 'Mailchimp, Marketo or any marketing automation experience is directly relevant.',
  'power bi': 'Tableau or Excel pivot/charts experience shows the same analytical thinking.',
  'tableau': 'Power BI or Excel dashboard experience demonstrates equivalent data visualization skills.',
  'google analytics': 'General web/marketing analytics experience qualifies. Free GA4 cert takes ~4 hours.',
  'python': 'SQL, Excel (VBA/formulas), or R shows analytical programming aptitude.',
  'sql': 'Excel data analysis or Access database experience bridges this; SQL basics take 2-3 weeks to learn.',
  'pmp': 'Highlight project coordination, timelines managed, and budget ownership — you may qualify without the cert.',
  'agile': 'Any iterative work, sprint-based delivery, or project coordination qualifies as agile experience.',
  'scrum': 'Agile project experience, sprint planning, or daily standups — describe these explicitly.',
  'seo': 'Content writing, keyword research, or digital marketing experience shows SEO awareness.',
  'financial modeling': 'Excel skills combined with financial reporting experience is a strong bridge.',
  'budgeting': 'Any experience managing costs, tracking expenses, or P&L responsibility counts.',
  'bilingual': 'Even conversational proficiency in a second language is worth noting.',
  'french': 'Basic French significantly improves candidacy in many Canadian markets. Mention any level.',
  'cross-functional collaboration': 'Describe any projects where you worked with multiple departments.',
  'stakeholder management': 'Client communication, executive reporting, or vendor relations all qualify.',
  'data analysis': 'Excel pivot tables, reporting, or any quantitative work demonstrates data analysis skills.',
  'change management': 'Any experience implementing new processes or systems is relevant.',
  'procurement': 'Vendor relations, purchasing, or supplier management experience bridges this gap.',
}

// Extract keywords from job using curated list + requirement patterns
function extractJobKeywords(title: string, description: string, requiredSkills: string[] = []): Array<{ keyword: string; required: boolean }> {
  const found = new Map<string, boolean>() // keyword → isRequired
  const fullText = (title + ' ' + description).toLowerCase()

  // 1. Explicit required skills (highest confidence)
  requiredSkills.forEach((s) => { if (s.trim()) found.set(s.trim(), true) })

  // 2. Curated skills detected in job text
  KNOWN_SKILLS.forEach((skill) => {
    if (fullText.includes(skill.toLowerCase()) && !found.has(skill)) {
      // Check if mentioned in a "required/must" context
      const isRequired = new RegExp(`(?:required|must|essential)[^.]{0,60}${skill.toLowerCase()}|${skill.toLowerCase()}[^.]{0,60}(?:required|must|essential)`, 'i').test(description)
      found.set(skill, isRequired)
    }
  })

  // 3. Extract requirement phrases: "experience with X", "knowledge of X", "proficiency in X"
  const patterns = [
    /experience (?:in|with|using)\s+([a-zA-Z][a-zA-Z\s+#.]{2,28}?)(?:\s*[,;(\n]|$)/gi,
    /knowledge of\s+([a-zA-Z][a-zA-Z\s+#.]{2,28}?)(?:\s*[,;(\n]|$)/gi,
    /proficiency (?:in|with)\s+([a-zA-Z][a-zA-Z\s+#.]{2,28}?)(?:\s*[,;(\n]|$)/gi,
    /familiar(?:ity)? with\s+([a-zA-Z][a-zA-Z\s+#.]{2,28}?)(?:\s*[,;(\n]|$)/gi,
    /(?:strong|proven|demonstrated)\s+([a-zA-Z][a-zA-Z\s]{2,28}?)\s+skills?/gi,
  ]
  patterns.forEach((re) => {
    let m
    re.lastIndex = 0
    while ((m = re.exec(description)) !== null) {
      const term = m[1].trim().replace(/\s+/g, ' ')
      if (term.length >= 3 && term.length <= 35 && !found.has(term)) {
        found.set(term, false)
      }
    }
  })

  return Array.from(found.entries())
    .map(([keyword, required]) => ({ keyword, required }))
    .slice(0, 28)
}

function ATSPanel({ resumeText, jobTitle, jobDescription, requiredSkills }: {
  resumeText: string; jobTitle: string; jobDescription: string; requiredSkills?: string[]
}) {
  const keywords = extractJobKeywords(jobTitle, jobDescription, requiredSkills)
  if (!keywords.length) return null

  // No resume — show keywords only, prompt to upload
  if (!resumeText || resumeText.length < 50) {
    return (
      <div className="mt-3 pt-3 border-t border-dashed border-purple-100">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-gray-700 flex items-center gap-1">
            <Target size={12} className="text-purple-500" /> ATS Keywords for this role
          </span>
          <a href="/profile/setup" className="text-[11px] text-purple-600 hover:underline font-medium">Upload resume to check match →</a>
        </div>
        <div className="flex flex-wrap gap-1">
          {keywords.map(({ keyword, required }) => (
            <span key={keyword} className={`text-[11px] px-2 py-0.5 rounded-full border ${required ? 'bg-red-50 text-red-700 border-red-200' : 'bg-gray-50 text-gray-600 border-gray-200'}`}>
              {required && '★ '}{keyword}
            </span>
          ))}
        </div>
        <p className="text-[10px] text-gray-400 mt-2">★ = explicitly required by employer</p>
      </div>
    )
  }

  const lower = resumeText.toLowerCase()
  const matched = keywords.filter(({ keyword }) => lower.includes(keyword.toLowerCase()))
  const missing = keywords.filter(({ keyword }) => !lower.includes(keyword.toLowerCase()))
  const pct = Math.round((matched.length / keywords.length) * 100)

  // Suitability verdict
  const verdict = pct >= 70
    ? { label: 'Strong Match', sub: 'Your resume closely aligns with this role.', color: 'bg-green-50 border-green-200 text-green-800' }
    : pct >= 45
    ? { label: 'Good Match', sub: 'You meet most requirements. Address the gaps below.', color: 'bg-yellow-50 border-yellow-200 text-yellow-800' }
    : pct >= 25
    ? { label: 'Partial Match', sub: 'Transferable experience may bridge some gaps — see tips below.', color: 'bg-orange-50 border-orange-200 text-orange-800' }
    : { label: 'Stretch Role', sub: 'Significant gaps exist. Consider this a target role to work towards.', color: 'bg-red-50 border-red-200 text-red-800' }

  const barColor = pct >= 70 ? 'bg-green-500' : pct >= 45 ? 'bg-yellow-400' : pct >= 25 ? 'bg-orange-400' : 'bg-red-400'

  // Find bridgeable gaps
  const bridgeable = missing.filter(({ keyword }) => SKILL_BRIDGES[keyword.toLowerCase()])
  const hardGaps = missing.filter(({ keyword }) => !SKILL_BRIDGES[keyword.toLowerCase()])

  return (
    <div className="mt-3 pt-3 border-t border-dashed border-purple-100 space-y-3">
      {/* Header + verdict */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-gray-700 flex items-center gap-1">
            <Target size={12} className="text-purple-500" /> ATS Keyword Match
          </span>
          <span className="text-xs font-bold text-gray-500">{pct}% · {matched.length}/{keywords.length} keywords</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-2">
          <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
        </div>
        <div className={`rounded-lg border px-3 py-2 ${verdict.color}`}>
          <p className="text-xs font-bold">{verdict.label}</p>
          <p className="text-[11px] mt-0.5 opacity-90">{verdict.sub}</p>
        </div>
      </div>

      {/* Found keywords */}
      {matched.length > 0 && (
        <div>
          <p className="text-[10px] text-green-600 uppercase tracking-wide font-semibold mb-1.5">✓ Keywords found in your resume ({matched.length})</p>
          <div className="flex flex-wrap gap-1">
            {matched.map(({ keyword, required }) => (
              <span key={keyword} className={`text-[11px] px-2 py-0.5 rounded-full border font-medium ${required ? 'bg-green-100 text-green-800 border-green-300' : 'bg-green-50 text-green-700 border-green-200'}`}>
                {required && '★ '}{keyword}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Hard gaps — not bridgeable */}
      {hardGaps.length > 0 && (
        <div>
          <p className="text-[10px] text-red-500 uppercase tracking-wide font-semibold mb-1.5">✗ Missing keywords — add to your resume ({hardGaps.length})</p>
          <div className="flex flex-wrap gap-1">
            {hardGaps.map(({ keyword, required }) => (
              <span key={keyword} className={`text-[11px] px-2 py-0.5 rounded-full border ${required ? 'bg-red-100 text-red-700 border-red-300 font-semibold' : 'bg-red-50 text-red-600 border-red-200'}`}>
                {required && '★ '}{keyword}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Bridgeable gaps with tips */}
      {bridgeable.length > 0 && (
        <div>
          <p className="text-[10px] text-amber-600 uppercase tracking-wide font-semibold mb-1.5">💡 Bridgeable gaps — you can address these ({bridgeable.length})</p>
          <div className="space-y-1.5">
            {bridgeable.map(({ keyword }) => (
              <div key={keyword} className="bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
                <p className="text-[11px] font-semibold text-amber-800">{keyword}</p>
                <p className="text-[11px] text-amber-700 mt-0.5">{SKILL_BRIDGES[keyword.toLowerCase()]}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

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
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin" /></div>}>
      <OpportunitiesInner />
    </Suspense>
  )
}

function OpportunitiesInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
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
  const [appliedJobIds, setAppliedJobIds] = useState<Set<string>>(new Set())
  const [markingApplied, setMarkingApplied] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    checkAuth()
    loadExternalJobs()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Read ?city= query param from home page city links
  useEffect(() => {
    const urlCity = searchParams.get('city')
    if (urlCity && CITIES.includes(urlCity)) setCity(urlCity)
  }, [searchParams]) // eslint-disable-line react-hooks/exhaustive-deps

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
      setUserId(user.id)
      const { data: profile } = await supabase.from('profiles').select('role, city').eq('user_id', user.id).single()
      if (profile?.role === 'seeker') {
        const { data: sp } = await supabase.from('seeker_profiles').select('skills, work_preference, resume_text, resume_path').eq('user_id', user.id).single()
        if (sp) {
          setSeekerProfile({ skills: sp.skills || [], work_preference: sp.work_preference || 'any', city: profile.city || '', resume_text: sp.resume_text || '' })
          // Auto-parse resume in background if file exists but text not yet extracted
          if (sp.resume_path && (!sp.resume_text || sp.resume_text.length < 50)) {
            autoParseResume(user.id, sp.resume_path)
          }
        }
        // Load previously marked external applications
        const { data: extApps } = await supabase.from('external_applications').select('external_opportunity_id').eq('seeker_id', user.id)
        if (extApps) setAppliedJobIds(new Set(extApps.map((a: { external_opportunity_id: string }) => a.external_opportunity_id)))
      }
      loadCanstartJobs()
    }
  }

  const markApplied = async (job: ExternalJob) => {
    if (!userId || markingApplied || appliedJobIds.has(job.id)) return
    setMarkingApplied(job.id)
    try {
      await supabase.from('external_applications').insert({
        seeker_id: userId,
        external_opportunity_id: job.id,
        job_title: job.title,
        company: job.company,
        job_url: job.url,
      })
      setAppliedJobIds((prev) => new Set([...prev, job.id]))
    } catch { /* ignore */ } finally {
      setMarkingApplied(null)
    }
    // Open the external job in a new tab
    window.open(job.url, '_blank', 'noopener,noreferrer')
    track('external_job_click', { category: job.category, city: job.city })
  }

  const autoParseResume = async (userId: string, resumePath: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const res = await fetch('/api/parse-resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ resumePath }),
      })
      if (res.ok) {
        // Reload resume_text into state so ATS analysis updates without page refresh
        const { data: fresh } = await supabase.from('seeker_profiles').select('resume_text').eq('user_id', userId).single()
        if (fresh?.resume_text && fresh.resume_text.length > 50) {
          setSeekerProfile((prev) => prev ? { ...prev, resume_text: fresh.resume_text } : prev)
        }
      }
    } catch { /* silent — non-critical */ }
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
                const fromResume = !!seekerProfile?.resume_text && seekerProfile.resume_text.length > 50
                return (
                  <div key={opp.id} className="flex flex-col">
                    <OpportunityCard opportunity={opp} />
                    {seekerProfile && (
                      <div className="bg-white border border-t-0 border-gray-200 rounded-b-xl px-5 pb-4">
                        <MatchBar pct={pct} fromResume={fromResume} />
                        <ATSPanel resumeText={seekerProfile.resume_text || ''} jobTitle={opp.title} jobDescription={opp.description || ''} requiredSkills={opp.skills_required} />
                      </div>
                    )}
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
                  const isApplied = appliedJobIds.has(job.id)
                  const isMarking = markingApplied === job.id
                  return (
                    <div key={job.id} className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md transition-shadow hover:border-blue-200 flex flex-col">
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap gap-1.5 mb-2">
                            <span className="text-xs font-medium px-2 py-1 rounded-full bg-blue-100 text-blue-700">{job.category}</span>
                            <span className="text-xs font-medium px-2 py-1 rounded-full bg-gray-100 text-gray-600 capitalize">{job.work_mode}</span>
                            <span className="text-xs font-medium px-2 py-1 rounded-full bg-purple-50 text-purple-600">{expLevel}</span>
                            {isApplied && <span className="text-xs font-medium px-2 py-1 rounded-full bg-green-100 text-green-700 flex items-center gap-1"><CheckCircle size={10} /> Applied</span>}
                          </div>
                          <h3 className="font-semibold text-gray-900 leading-snug">{job.title}</h3>
                          <p className="text-sm text-blue-600 font-medium mt-1">{job.company}</p>
                        </div>
                      </div>
                      <p className="text-gray-500 text-sm line-clamp-2 mb-3">{job.description}</p>
                      <div className="flex items-center gap-3 text-xs text-gray-400 mb-3">
                        <span className="flex items-center gap-1"><MapPin size={12} />{job.city}</span>
                        {formatSalary(job.salary_min, job.salary_max) && (
                          <span className="text-green-600 font-medium">{formatSalary(job.salary_min, job.salary_max)}</span>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div className="flex gap-2 mt-auto pt-3 border-t border-gray-100">
                        <a
                          href={job.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => track('external_job_click', { category: job.category, city: job.city })}
                          className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-lg transition-colors"
                        >
                          <ExternalLink size={12} /> View Job
                        </a>
                        {isLoggedIn && seekerProfile ? (
                          isApplied ? (
                            <div className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium bg-green-100 text-green-700 px-3 py-2 rounded-lg cursor-default">
                              <CheckCircle size={12} /> Applied
                            </div>
                          ) : (
                            <button
                              onClick={() => markApplied(job)}
                              disabled={isMarking}
                              className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg transition-colors disabled:opacity-60"
                            >
                              {isMarking ? <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" /> : <CheckCircle size={12} />}
                              Mark as Applied
                            </button>
                          )
                        ) : null}
                      </div>

                      {seekerProfile && <MatchBar pct={pct} fromResume={!!seekerProfile.resume_text && seekerProfile.resume_text.length > 50} />}
                      {seekerProfile && (
                        <ATSPanel resumeText={seekerProfile.resume_text || ''} jobTitle={job.title} jobDescription={job.description || ''} />
                      )}
                    </div>
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
