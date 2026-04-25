'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Opportunity } from '@/lib/types'
import OpportunityCard from '@/components/OpportunityCard'
import { Search, MapPin, SlidersHorizontal, ExternalLink, RefreshCw, Briefcase, Star, Lock, Target, CheckCircle, X, Building2, Calendar, Sparkles } from 'lucide-react'
import { track } from '@vercel/analytics'
import Link from 'next/link'
import { matchesKeyword, scoreKeywords } from '@/lib/keywordMatcher'
import type { ExtractedKeywords } from '@/app/api/extract-keywords/route'

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
  posted_at?: string
  synced_at: string
}

const DATE_FILTERS = [
  { label: 'Any time',     days: 0  },
  { label: 'Last 24 hrs',  days: 1  },
  { label: 'Last 3 days',  days: 3  },
  { label: 'Last 5 days',  days: 5  },
  { label: 'Last 7 days',  days: 7  },
  { label: 'Last 15 days', days: 15 },
  { label: 'Last month',   days: 30 },
]

type SeekerProfile = { skills: string[]; work_preference: string; city: string; resume_text?: string }

function formatPostedDate(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays <= 6) return `${diffDays}d ago`
  if (diffDays <= 13) return '1 week ago'
  if (diffDays <= 20) return '2 weeks ago'
  if (diffDays <= 27) return '3 weeks ago'
  return `${Math.floor(diffDays / 7)}w ago`
}

function detectExperienceFromTitle(title: string): string {
  const t = title.toLowerCase()
  if (t.includes('junior') || t.includes('entry') || t.includes('associate') || t.includes('assistant') || t.includes('coordinator')) return 'Entry Level'
  if (t.includes('senior') || t.includes(' sr ') || t.includes('sr.') || t.includes('lead') || t.includes('principal') || t.includes('director') || t.includes('vp ') || t.includes('manager')) return 'Senior Level'
  return 'Mid Level'
}

// Generic soft skills that appear in every resume/job — exclude from keyword matching
// to prevent false cross-domain matches
const SOFT_SKILLS_EXCLUDED = new Set([
  'leadership','communication','presentation skills','problem-solving','critical thinking',
  'attention to detail','time management','teamwork','collaboration','adaptability',
  'organizational skills','interpersonal skills','written communication','verbal communication',
])

// Domain signals — used to detect job domain and candidate domain
const DOMAIN_SIGNALS: Record<string, string[]> = {
  tech: [
    '.net','c#','java','python','javascript','typescript','react','angular','vue','node.js',
    'sql','aws','azure','gcp','docker','kubernetes','php','ruby','swift','kotlin','html','css',
    'software developer','software engineer','backend','frontend','full stack','fullstack',
    'devops','cloud','database','programming','api','git','linux','microservices',
    'machine learning','data science','artificial intelligence','mobile developer',
  ],
  marketing: [
    'seo','sem','ppc','content marketing','digital marketing','social media marketing',
    'email marketing','influencer marketing','brand management','copywriting','advertising',
    'marketing campaign','google ads','facebook ads','hubspot','mailchimp','hootsuite',
    'marketing manager','marketing coordinator','communications','public relations','pr ',
    'media relations','content strategy','google analytics','a/b testing',
  ],
  finance: [
    'accounting','financial','cpa','gaap','ifrs','bookkeeping','audit','tax',
    'financial modeling','accounts payable','accounts receivable','quickbooks','xero',
    'budgeting','forecasting','financial analyst','controller','treasurer','cfo',
    'investment','portfolio','banking','insurance','actuarial',
  ],
  hr: [
    'recruitment','talent acquisition','hris','human resources','onboarding','payroll',
    'employee relations','workforce planning','benefits administration','hr manager',
    'hr coordinator','talent management','performance management','compensation',
    'labour relations','organizational development',
  ],
  sales: [
    'sales','business development','account executive','account manager','cold calling',
    'pipeline','quota','revenue target','crm','lead generation','b2b sales','b2c sales',
    'sales manager','territory','client acquisition','closing deals',
  ],
  data: [
    'data analysis','data analyst','data science','data engineer','power bi','tableau',
    'machine learning','statistics','python','r ','pandas','data warehouse','etl',
    'business intelligence','analytics','big data','looker','sql server',
  ],
  operations: [
    'supply chain','logistics','procurement','inventory management','operations manager',
    'quality assurance','process improvement','lean','six sigma','warehouse',
    'vendor management','facilities','manufacturing','production',
  ],
  design: [
    'graphic design','ui design','ux design','product design','web design','figma','sketch',
    'photoshop','illustrator','indesign','canva','adobe','motion graphics','visual design',
    'brand design','typography','user experience','user interface',
  ],
}

// Maps job category → domain. Partial/prefix matching handles both
// old truncated values ('Marketing', 'Technology') and new full values ('Marketing & Communications').
const CATEGORY_DOMAIN_MAP: Array<{ match: string; domain: string }> = [
  { match: 'marketing',           domain: 'marketing' },
  { match: 'communications',      domain: 'marketing' },
  { match: 'technology',          domain: 'tech' },
  { match: 'it ',                 domain: 'tech' },
  { match: ' it',                 domain: 'tech' },
  { match: 'software',            domain: 'tech' },
  { match: 'finance',             domain: 'finance' },
  { match: 'accounting',          domain: 'finance' },
  { match: 'human resources',     domain: 'hr' },
  { match: ' hr',                 domain: 'hr' },
  { match: 'sales',               domain: 'sales' },
  { match: 'business development',domain: 'sales' },
  { match: 'data & analytics',    domain: 'data' },
  { match: 'data analytics',      domain: 'data' },
  { match: 'business analysis',   domain: 'data' },
  { match: 'design',              domain: 'design' },
  { match: 'creative',            domain: 'design' },
  { match: 'operations',          domain: 'operations' },
  { match: 'logistics',           domain: 'operations' },
  { match: 'project management',  domain: 'pm' },
  { match: 'customer service',    domain: 'customer' },
  { match: 'administration',      domain: 'admin' },
  { match: 'office',              domain: 'admin' },
  { match: 'education',           domain: 'education' },
  { match: 'training',            domain: 'education' },
  { match: 'healthcare',          domain: 'healthcare' },
  { match: 'health',              domain: 'healthcare' },
  { match: 'engineering',         domain: 'engineering' },
  { match: 'legal',               domain: 'legal' },
  { match: 'compliance',          domain: 'legal' },
]

function categoryToDomain(category: string): string {
  const lower = (category || '').toLowerCase()
  for (const { match, domain } of CATEGORY_DOMAIN_MAP) {
    if (lower.includes(match)) return domain
  }
  return 'unknown'
}

function detectDomain(text: string): string {
  const lower = text.toLowerCase()
  const scores: Record<string, number> = {}
  Object.entries(DOMAIN_SIGNALS).forEach(([domain, signals]) => {
    scores[domain] = signals.filter((s) => lower.includes(s)).length
  })
  const top = Object.entries(scores).sort((a, b) => b[1] - a[1])
  return top[0][1] >= 2 ? top[0][0] : 'unknown' // require at least 2 signals, not just 1
}

function computeIndustryScore(candidateText: string, jobCategory: string): number {
  const jobDomain = categoryToDomain(jobCategory)
  const candidateDomain = detectDomain(candidateText)

  if (jobDomain === 'unknown' || candidateDomain === 'unknown') return 0 // don't give free points for unknowns

  if (jobDomain === candidateDomain) return 30 // exact industry match

  // Adjacent domains (partial credit)
  const adjacent: Record<string, string[]> = {
    tech: ['data', 'engineering'],
    data: ['tech', 'finance'],
    sales: ['marketing', 'customer'],
    marketing: ['sales', 'design', 'customer'],
    finance: ['data', 'operations'],
    hr: ['operations', 'admin'],
    design: ['marketing', 'tech'],
    operations: ['finance', 'hr', 'admin'],
    pm: ['tech', 'operations', 'data'],
    customer: ['sales', 'marketing'],
    admin: ['hr', 'operations'],
    engineering: ['tech', 'operations'],
  }
  if (adjacent[jobDomain]?.includes(candidateDomain)) return 12

  return 0 // completely different industry — no points
}

/**
 * 2-factor match score — purely skills & industry relevance.
 * No location, no work mode, no experience level defaults.
 * No free points — everything must be earned from actual content.
 *
 * Factor 1 — Domain-specific skill/keyword coverage  (70 pts)
 *   — soft skills excluded, required skills weighted 2×
 *   — scores 0 if no relevant keywords found in job
 * Factor 2 — Industry alignment from job category    (30 pts)
 *   — uses explicit category field, not guessed from text
 *   — scores 0 for unknown or cross-industry
 */
function computeJobMatch(
  seeker: SeekerProfile | null,
  jobTitle: string,
  jobDescription: string,
  requiredSkills: string[] = [],
  _workMode: string,
  _jobCity: string,
  jobCategory: string = '',
  llmKeywords?: ExtractedKeywords | null,
): number {
  if (!seeker) return 0

  const resumeText = seeker.resume_text?.toLowerCase() || ''
  const hasResume = resumeText.length > 50
  const candidateText = hasResume ? resumeText : seeker.skills.join(' ').toLowerCase()

  // ── Factor 1: Domain-specific keyword coverage (70 pts) ──────────────────────
  let keywords: Array<{ keyword: string; required: boolean }>

  if (llmKeywords && (llmKeywords.required_skills.length + llmKeywords.preferred_skills.length + llmKeywords.keywords.length) > 0) {
    // Use LLM-extracted keywords (higher quality, job-specific)
    keywords = [
      ...llmKeywords.required_skills.map(k => ({ keyword: k, required: true })),
      ...llmKeywords.preferred_skills.map(k => ({ keyword: k, required: false })),
      ...llmKeywords.keywords.map(k => ({ keyword: k, required: false })),
    ].filter(({ keyword }) => keyword.trim().length > 0 && !SOFT_SKILLS_EXCLUDED.has(keyword.toLowerCase()))
  } else {
    // Fall back to curated extraction
    keywords = extractJobKeywords(jobTitle, jobDescription, requiredSkills)
      .filter(({ keyword }) => !SOFT_SKILLS_EXCLUDED.has(keyword.toLowerCase()))
  }

  // Word-boundary matching (prevents "SQL" matching "MySQL", "Java" matching "JavaScript")
  const { weightedMatched, weightedTotal } = scoreKeywords(candidateText, keywords)

  // If using curated extraction, also check explicit requiredSkills with word-boundary
  if (!llmKeywords) {
    // already handled inside extractJobKeywords — nothing extra needed
  }

  // Confidence factor: if fewer than 6 domain keywords found, penalise score
  const uniqueKeywordCount = keywords.length
  const confidenceFactor = Math.min(1, uniqueKeywordCount / 10)
  const rawMatchRatio = weightedTotal > 0 ? weightedMatched / weightedTotal : 0
  const keywordScore = Math.round(rawMatchRatio * confidenceFactor * 70)

  // ── Factor 2: Industry alignment (30 pts) ────────────────────────────────────
  const industryScore = computeIndustryScore(candidateText, jobCategory)

  return Math.round(Math.min(100, keywordScore + industryScore))
}

function computeCanstartMatch(seeker: SeekerProfile | null, opp: Opportunity): number {
  const cat = (opp as unknown as { category?: string }).category || ''
  return computeJobMatch(seeker, opp.title, opp.description || '', opp.skills_required || [], opp.work_mode, opp.city, cat)
}

function computeExternalMatch(seeker: SeekerProfile | null, job: ExternalJob, llmKeywords?: ExtractedKeywords | null): number {
  return computeJobMatch(seeker, job.title, job.description || '', [], job.work_mode, job.city, job.category, llmKeywords)
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
  // Web & General Development
  'SQL','Python','Java','JavaScript','TypeScript','React','HTML','CSS','PHP',
  'R programming','VBA','Git','WordPress','Shopify','Node.js','Express','Next.js','Vue','Angular',
  'jQuery','REST API','GraphQL','JSON','XML','Bash','Shell scripting',
  // .NET Ecosystem
  '.NET','.NET Core','C#','ASP.NET','ASP.NET Core','Entity Framework','LINQ','WPF','WCF',
  'Blazor','MAUI','NuGet','Visual Studio',
  // Cloud & DevOps
  'Azure','AWS','GCP','Google Cloud','Azure DevOps','Azure AD','AWS Lambda',
  'S3','EC2','Docker','Kubernetes','CI/CD','Jenkins','GitHub Actions','Terraform',
  'Ansible','Linux','Unix','Nginx','Apache',
  // Databases
  'MySQL','PostgreSQL','SQL Server','MongoDB','Redis','Cosmos DB','Oracle DB',
  'DynamoDB','Firebase','Elasticsearch',
  // Mobile
  'iOS','Android','Swift','Kotlin','React Native','Flutter','Xamarin',
  // Testing & QA
  'unit testing','integration testing','Selenium','Jest','NUnit','xUnit','Postman',
  'test automation','QA','quality assurance','TDD','BDD',
  // Security
  'cybersecurity','network security','SIEM','penetration testing','IAM','CISSP',
  // Finance & Accounting
  'QuickBooks','Xero','Sage','SAP','Oracle','NetSuite','Workday','FreshBooks',
  'financial modeling','GAAP','IFRS','accounts payable','accounts receivable',
  // Project Management Tools
  'Jira','Trello','Asana','Monday.com','Notion','Airtable','ClickUp','MS Project','Basecamp',
  // Methodologies & Frameworks
  'Agile','Scrum','Kanban','Lean','Six Sigma','Waterfall','PRINCE2','SAFe','DevOps',
  // Certifications
  'PMP','CAPM','PMBOK','ITIL','CPA','CFA','MBA','CHRP','AWS Certified','Azure Certified',
  'Google Cloud Certified','CompTIA','CISSP','Scrum Master','CSM',
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
  'machine learning','AI','data science','NLP','ETL','data warehousing','Power Query',
  // HR
  'HRIS','talent acquisition','recruitment','onboarding','performance management',
  'payroll','employee relations','workforce planning','benefits administration',
  // Operations
  'supply chain','logistics','procurement','inventory management','vendor management',
  'operations management','compliance',
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

function ATSPanel({ resumeText, seekerProfile, jobTitle, jobDescription, requiredSkills, workMode, jobCity, jobCategory, llmKeywords, llmLoading }: {
  resumeText: string; seekerProfile: SeekerProfile | null; jobTitle: string; jobDescription: string; requiredSkills?: string[]; workMode: string; jobCity: string; jobCategory: string; llmKeywords?: ExtractedKeywords | null; llmLoading?: boolean
}) {
  // Prefer LLM-extracted keywords; fall back to curated extraction
  const usingLLM = llmKeywords && (llmKeywords.required_skills.length + llmKeywords.preferred_skills.length + llmKeywords.keywords.length) > 0
  const keywords: Array<{ keyword: string; required: boolean }> = usingLLM
    ? [
        ...llmKeywords!.required_skills.map(k => ({ keyword: k, required: true })),
        ...llmKeywords!.preferred_skills.map(k => ({ keyword: k, required: false })),
        ...llmKeywords!.keywords.map(k => ({ keyword: k, required: false })),
      ].filter(kw => kw.keyword.trim())
    : extractJobKeywords(jobTitle, jobDescription, requiredSkills)

  if (!keywords.length && !llmLoading) return null

  // No resume — show keywords only, prompt to upload
  if (!resumeText || resumeText.length < 50) {
    return (
      <div className="mt-3 pt-3 border-t border-dashed border-purple-100">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-gray-700 flex items-center gap-1">
            <Target size={12} className="text-purple-500" /> ATS Keywords for this role
            {usingLLM && <span className="flex items-center gap-0.5 text-[10px] text-purple-500 font-normal"><Sparkles size={9} /> AI</span>}
            {llmLoading && <span className="text-[10px] text-gray-400 font-normal animate-pulse">extracting…</span>}
          </span>
          <a href="/profile/setup" className="text-[11px] text-purple-600 hover:underline font-medium">Upload resume to check match →</a>
        </div>
        <div className="flex flex-wrap gap-1">
          {keywords.slice(0, 12).map(({ keyword, required }) => (
            <span key={keyword} className={`text-[11px] px-2 py-0.5 rounded-full border ${required ? 'bg-red-50 text-red-700 border-red-200' : 'bg-gray-50 text-gray-600 border-gray-200'}`}>
              {required && '★ '}{keyword}
            </span>
          ))}
        </div>
        <p className="text-[10px] text-gray-400 mt-2">★ = explicitly required · Upload resume for full match analysis</p>
      </div>
    )
  }

  // Word-boundary matching (from keywordMatcher.ts — prevents false substring matches)
  const { matched, missing } = scoreKeywords(resumeText, keywords)
  const atsPct = keywords.length > 0 ? Math.round((matched.length / keywords.length) * 100) : 0

  // Unified overall score
  const overallPct = computeJobMatch(seekerProfile, jobTitle, jobDescription, requiredSkills, workMode, jobCity, jobCategory, llmKeywords)

  // Score breakdown
  const domainKeywords = keywords.filter(({ keyword }) => !SOFT_SKILLS_EXCLUDED.has(keyword.toLowerCase()))
  const { weightedMatched, weightedTotal } = scoreKeywords(resumeText, domainKeywords)
  const confidenceFactor = Math.min(1, domainKeywords.length / 10)
  const rawMatchRatio = weightedTotal > 0 ? weightedMatched / weightedTotal : 0
  const keywordScore = Math.round(rawMatchRatio * confidenceFactor * 70)
  const industryScore = computeIndustryScore(resumeText.toLowerCase(), jobCategory)

  // Application strategy
  const strategy = overallPct >= 75
    ? { label: '✅ Apply Now', sub: 'Your profile is a strong fit. Tailor your cover letter to the keywords below.', color: 'bg-green-50 border-green-200 text-green-800' }
    : overallPct >= 55
    ? { label: '📝 Apply with a Tailored Resume', sub: 'Good fit — use the Resume Builder to tailor your resume before applying.', color: 'bg-yellow-50 border-yellow-200 text-yellow-700' }
    : overallPct >= 35
    ? { label: '🎯 Bridge the Gaps First', sub: 'Address the missing keywords below, then apply. See bridgeable gaps for quick wins.', color: 'bg-orange-50 border-orange-200 text-orange-700' }
    : { label: '📚 Build Toward This Role', sub: 'Significant experience gaps exist. Treat this as a target — focus on the skills listed below.', color: 'bg-red-50 border-red-200 text-red-700' }

  const barColor = overallPct >= 75 ? 'bg-green-500' : overallPct >= 55 ? 'bg-yellow-400' : overallPct >= 35 ? 'bg-orange-400' : 'bg-red-400'

  // Separate required missing keywords (critical gaps) from optional
  const missingRequired = missing.filter(({ required }) => required)
  const missingOptional = missing.filter(({ required }) => !required)
  const bridgeable = missing.filter(({ keyword }) => SKILL_BRIDGES[keyword.toLowerCase()])

  return (
    <div className="mt-3 pt-3 border-t border-dashed border-purple-100 space-y-3">

      {/* Overall match score + bar */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-semibold text-gray-700 flex items-center gap-1">
            <Target size={12} className="text-purple-500" /> Match Analysis
            {usingLLM && (
              <span className="flex items-center gap-0.5 bg-purple-50 text-purple-600 text-[10px] px-1.5 py-0.5 rounded-full border border-purple-200 font-medium">
                <Sparkles size={9} /> AI keywords
              </span>
            )}
            {llmLoading && <span className="text-[10px] text-gray-400 animate-pulse">analyzing…</span>}
          </span>
          <span className="text-xs font-bold text-gray-600">{overallPct}% overall match</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-2">
          <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${overallPct}%` }} />
        </div>

        {/* Score breakdown */}
        <div className="grid grid-cols-2 gap-1.5 mb-2">
          {[
            { label: 'Skills & Keywords', score: keywordScore, max: 70 },
            { label: 'Industry Fit', score: industryScore, max: 30 },
          ].map(({ label, score, max }) => (
            <div key={label} className="bg-gray-50 rounded-lg px-2 py-1.5">
              <div className="flex justify-between items-center">
                <span className="text-[10px] text-gray-500">{label}</span>
                <span className="text-[10px] font-bold text-gray-700">{score}/{max}</span>
              </div>
              <div className="h-1 bg-gray-200 rounded-full mt-1 overflow-hidden">
                <div className={`h-full rounded-full ${score >= max * 0.7 ? 'bg-green-400' : score >= max * 0.4 ? 'bg-yellow-400' : 'bg-red-400'}`} style={{ width: `${(score / max) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>

        {/* Application strategy */}
        <div className={`rounded-lg border px-3 py-2 ${strategy.color}`}>
          <p className="text-xs font-bold">{strategy.label}</p>
          <p className="text-[11px] mt-0.5 opacity-90">{strategy.sub}</p>
        </div>
      </div>

      {/* ATS keyword breakdown */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">ATS Keywords</span>
          <span className="text-[10px] text-gray-400">{matched.length}/{keywords.length} found · {atsPct}%</span>
        </div>

        {/* Matched */}
        {matched.length > 0 && (
          <div className="mb-2">
            <p className="text-[10px] text-green-600 font-semibold mb-1">✓ Found in your resume</p>
            <div className="flex flex-wrap gap-1">
              {matched.map(({ keyword, required }) => (
                <span key={keyword} className={`text-[11px] px-2 py-0.5 rounded-full border ${required ? 'bg-green-100 text-green-800 border-green-300 font-semibold' : 'bg-green-50 text-green-700 border-green-200'}`}>
                  {required && '★ '}{keyword}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Critical missing (required) */}
        {missingRequired.length > 0 && (
          <div className="mb-2">
            <p className="text-[10px] text-red-600 font-semibold mb-1">★ Critical gaps — required by employer</p>
            <div className="flex flex-wrap gap-1">
              {missingRequired.map(({ keyword }) => (
                <span key={keyword} className="text-[11px] px-2 py-0.5 rounded-full border bg-red-100 text-red-700 border-red-300 font-semibold">
                  {keyword}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Optional missing */}
        {missingOptional.length > 0 && (
          <div className="mb-2">
            <p className="text-[10px] text-gray-500 font-semibold mb-1">✗ Not found — consider adding if relevant</p>
            <div className="flex flex-wrap gap-1">
              {missingOptional.slice(0, 10).map(({ keyword }) => (
                <span key={keyword} className="text-[11px] px-2 py-0.5 rounded-full border bg-gray-50 text-gray-600 border-gray-200">
                  {keyword}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Bridgeable gaps with tips */}
      {bridgeable.length > 0 && (
        <div>
          <p className="text-[10px] text-amber-600 uppercase tracking-wide font-semibold mb-1.5">💡 Quick wins — bridge these gaps</p>
          <div className="space-y-1.5">
            {bridgeable.slice(0, 3).map(({ keyword }) => (
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
          Skills &amp; Experience Match
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
  const [dateFilter, setDateFilter] = useState(0) // 0 = any time, N = last N days
  const [loading, setLoading] = useState(false)
  const [externalLoading, setExternalLoading] = useState(false)
  const [lastSynced, setLastSynced] = useState<string | null>(null)
  const [appliedJobIds, setAppliedJobIds] = useState<Set<string>>(new Set())
  const [markingApplied, setMarkingApplied] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [selectedJob, setSelectedJob] = useState<ExternalJob | null>(null)

  // LLM keyword cache: jobId → extracted keywords (session-scoped, fetched on demand)
  const llmKeywordsCache = useRef<Map<string, ExtractedKeywords>>(new Map())
  const llmFetchingRef = useRef<Set<string>>(new Set())
  // forceUpdate triggers re-render after LLM keywords arrive (refs don't cause re-renders alone)
  const [llmTick, setLlmTick] = useState(0)

  const getLLMKeywords = (jobId: string): ExtractedKeywords | null => {
    void llmTick // ensure component re-renders when cache updates
    return llmKeywordsCache.current.get(jobId) ?? null
  }

  const isLLMFetching = (jobId: string): boolean => {
    void llmTick
    return llmFetchingRef.current.has(jobId)
  }

  const fetchLLMKeywords = async (job: ExternalJob) => {
    if (!job.description || llmKeywordsCache.current.has(job.id) || llmFetchingRef.current.has(job.id)) return
    llmFetchingRef.current.add(job.id)
    setLlmTick(t => t + 1)
    try {
      const res = await fetch('/api/extract-keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: job.description, title: job.title }),
      })
      if (res.ok) {
        const data: ExtractedKeywords = await res.json()
        llmKeywordsCache.current.set(job.id, data)
      }
    } catch { /* silent fail — fall back to curated extraction */ }
    llmFetchingRef.current.delete(job.id)
    setLlmTick(t => t + 1)
  }

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

    if (dateFilter > 0) {
      const cutoff = Date.now() - dateFilter * 24 * 60 * 60 * 1000
      ext = ext.filter((o) => {
        const dateStr = o.posted_at || o.synced_at
        return dateStr ? new Date(dateStr).getTime() >= cutoff : true
      })
    }

    setFilteredCanstart(cs)
    setFilteredExternal(ext)
  }, [search, city, type, mode, category, experience, dateFilter, canstartJobs, externalJobs])

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
      const { data } = await supabase.from('external_opportunities').select('*').order('synced_at', { ascending: false }).limit(1000)
      if (data && data.length > 0) {
        setExternalJobs(data as ExternalJob[])
        setLastSynced(data[0]?.synced_at || null)
      }
    } catch { /* ignore */ } finally { setExternalLoading(false) }
  }

  const handleSearch = (val: string) => { setSearch(val); if (val.length > 2) track('opportunity_search', { query: val }) }
  const clearFilters = () => { setCity('All Cities'); setType('All Types'); setMode('All Modes'); setCategory('All Categories'); setExperience('Any Level'); setDateFilter(0); setSearch('') }
  const hasFilters = city !== 'All Cities' || type !== 'All Types' || mode !== 'All Modes' || category !== 'All Categories' || experience !== 'Any Level' || dateFilter > 0 || search

  const formatSalary = (min?: number, max?: number) => {
    if (!min && !max) return null
    if (min && max) return `$${Math.round(min / 1000)}K–$${Math.round(max / 1000)}K/yr`
    if (min) return `$${Math.round(min / 1000)}K+/yr`
    return null
  }

  return (
    <>
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
            <>
              <select value={mode} onChange={(e) => setMode(e.target.value)} className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none">
                {MODES.map((m) => <option key={m} value={m}>{m === 'All Modes' ? m : m.charAt(0).toUpperCase() + m.slice(1)}</option>)}
              </select>
              <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-lg px-2">
                <Calendar size={14} className="text-gray-400" />
                <select value={dateFilter} onChange={(e) => setDateFilter(Number(e.target.value))} className="py-2 text-sm text-gray-700 focus:outline-none bg-transparent">
                  {DATE_FILTERS.map(({ label, days }) => <option key={days} value={days}>{label}</option>)}
                </select>
              </div>
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
                return (
                  <div key={opp.id} className="flex flex-col">
                    <OpportunityCard opportunity={opp} />
                    {seekerProfile && (
                      <div className="bg-white border border-t-0 border-gray-200 rounded-b-xl px-5 pb-4">
                        <ATSPanel resumeText={seekerProfile.resume_text || ''} seekerProfile={seekerProfile} jobTitle={opp.title} jobDescription={opp.description || ''} requiredSkills={opp.skills_required} workMode={opp.work_mode} jobCity={opp.city} jobCategory={(opp as unknown as { category?: string }).category || ''} />
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
                Match percentages are based on your skills, experience, and industry alignment — not location.
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
                        {(job.posted_at || job.synced_at) && (
                          <span className="flex items-center gap-1 ml-auto"><Calendar size={11} />{formatPostedDate(job.posted_at || job.synced_at)}</span>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div className="flex gap-2 mt-auto pt-3 border-t border-gray-100">
                        <button
                          onClick={() => {
                            if (!isLoggedIn) { router.push('/auth/signin?redirect=/opportunities'); return }
                            setSelectedJob(job); fetchLLMKeywords(job); track('external_job_view', { category: job.category, city: job.city })
                          }}
                          className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg transition-colors"
                        >
                          <Briefcase size={12} /> {isLoggedIn ? 'View Details' : 'Sign In to View'}
                        </button>
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

                      {seekerProfile && (() => {
                        // Trigger LLM keyword fetch on first render of this job card
                        if (!llmKeywordsCache.current.has(job.id) && !llmFetchingRef.current.has(job.id)) {
                          fetchLLMKeywords(job)
                        }
                        return (
                          <ATSPanel
                            resumeText={seekerProfile.resume_text || ''}
                            seekerProfile={seekerProfile}
                            jobTitle={job.title}
                            jobDescription={job.description || ''}
                            workMode={job.work_mode}
                            jobCity={job.city}
                            jobCategory={job.category}
                            llmKeywords={getLLMKeywords(job.id)}
                            llmLoading={isLLMFetching(job.id)}
                          />
                        )
                      })()}
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>

    {/* ── Job Detail Modal ── */}

    {selectedJob && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
        onClick={(e) => { if (e.target === e.currentTarget) setSelectedJob(null) }}
      >
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="flex items-start justify-between gap-4 p-6 border-b border-gray-100">
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap gap-1.5 mb-2">
                <span className="text-xs font-medium px-2 py-1 rounded-full bg-blue-100 text-blue-700">{selectedJob.category}</span>
                <span className="text-xs font-medium px-2 py-1 rounded-full bg-gray-100 text-gray-600 capitalize">{selectedJob.work_mode}</span>
                {appliedJobIds.has(selectedJob.id) && (
                  <span className="text-xs font-medium px-2 py-1 rounded-full bg-green-100 text-green-700 flex items-center gap-1"><CheckCircle size={10} /> Applied</span>
                )}
              </div>
              <h2 className="text-xl font-bold text-gray-900 leading-snug">{selectedJob.title}</h2>
              <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-gray-500">
                <span className="flex items-center gap-1"><Building2 size={14} />{selectedJob.company}</span>
                <span className="flex items-center gap-1"><MapPin size={14} />{selectedJob.city}</span>
                {formatSalary(selectedJob.salary_min, selectedJob.salary_max) && (
                  <span className="text-green-600 font-medium">{formatSalary(selectedJob.salary_min, selectedJob.salary_max)}</span>
                )}
                {(selectedJob.posted_at || selectedJob.synced_at) && (
                  <span className="flex items-center gap-1"><Calendar size={14} />Posted {new Date(selectedJob.posted_at || selectedJob.synced_at).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                )}
              </div>
            </div>
            <button onClick={() => setSelectedJob(null)} className="text-gray-400 hover:text-gray-600 flex-shrink-0 p-1 rounded-lg hover:bg-gray-100 transition-colors">
              <X size={20} />
            </button>
          </div>

          {/* Body — full description */}
          <div className="flex-1 overflow-y-auto p-6">
            {seekerProfile && (
              <div className="mb-5">
                <ATSPanel
                  resumeText={seekerProfile.resume_text || ''}
                  seekerProfile={seekerProfile}
                  jobTitle={selectedJob.title}
                  jobDescription={selectedJob.description || ''}
                  workMode={selectedJob.work_mode}
                  jobCity={selectedJob.city}
                  jobCategory={selectedJob.category}
                  llmKeywords={getLLMKeywords(selectedJob.id)}
                  llmLoading={isLLMFetching(selectedJob.id)}
                />
              </div>
            )}
            <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">Job Description</h3>
            <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
              {selectedJob.description || 'No description available.'}
            </div>
          </div>

          {/* Footer — actions */}
          <div className="flex gap-3 p-6 border-t border-gray-100">
            {appliedJobIds.has(selectedJob.id) ? (
              <div className="flex items-center justify-center gap-2 text-sm font-medium bg-green-100 text-green-700 px-4 py-2.5 rounded-xl">
                <CheckCircle size={15} /> Applied
              </div>
            ) : (
              <button
                onClick={() => markApplied(selectedJob)}
                disabled={markingApplied === selectedJob.id}
                className="flex items-center justify-center gap-2 text-sm font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2.5 rounded-xl transition-colors disabled:opacity-60"
              >
                {markingApplied === selectedJob.id ? <div className="w-4 h-4 border-2 border-gray-500 border-t-transparent rounded-full animate-spin" /> : <CheckCircle size={15} />}
                Mark as Applied
              </button>
            )}
            <a
              href={selectedJob.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => track('external_job_click', { category: selectedJob.category, city: selectedJob.city })}
              className="flex-1 flex items-center justify-center gap-2 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl transition-colors"
            >
              Apply Now <ExternalLink size={14} />
            </a>
          </div>
        </div>
      </div>
    )}
    </>
  )
}
