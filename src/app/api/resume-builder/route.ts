import { NextResponse } from 'next/server'

// Allow up to 60s — LLM calls can take 20-30s
export const maxDuration = 60

const BANNED_WORDS = [
  'leveraged','utilized','spearheaded','orchestrated','championed',
  'transformed','revolutionized','synergized','streamlined','facilitated',
  'ideated','pivoted','disrupted','mobilized','fostered','cultivated',
  'empowered','showcased','harnessed','capitalized','demonstrated',
  'delivered value','drove results','ensured','enabled','impactful',
  'passionate','dynamic','innovative','synergy','best-in-class','thought leader','visionary',
]

const RESUME_PROMPT = `You are a senior resume writer producing resumes that win interviews. Tailor the candidate's resume to the job description at the highest professional level.

=== BULLET STYLE ===
EXAMPLES (copy this exact style):
- "Maintained campaign brand standards across 292+ content touchpoints, ensuring visual and messaging consistency."
- "Coordinated contracts with external creative and media vendors, delivering 10+ national campaigns on time and within budget."
- "Tracked and reconciled campaign budgets quarterly, reporting on spend efficiency and reallocating resources based on performance."
- "Delivered 98% user migration on time by directing a 10-person team of Scrum Masters and BAs."
- "Launched refer-a-friend campaign that grew organic registrations by 50,000 in one quarter through targeted outreach."
- "Managed a $3M+ portfolio across SMB and enterprise segments, finishing 10% under budget."

BULLET RULES:
1. Start with a strong action verb — no "I", no preamble
2. One clear claim: what was done + scope or result
3. PRESERVE every real number from the original resume — never invent metrics
4. 15–22 words per bullet. Tight and specific.
5. Plain direct language. NEVER use: ${BANNED_WORDS.join(', ')}

BULLETS PER ROLE: Role 1 = 6 bullets · Roles 2–3 = 5 bullets each · Role 4+ = 3 bullets each

=== APPROVED VERBS ===
Managed, Built, Led, Ran, Set up, Tracked, Directed, Negotiated, Coordinated, Scoped,
Launched, Rolled out, Rebuilt, Supervised, Expanded, Produced, Owned, Delivered, Planned,
Reduced, Increased, Cut, Grew, Hired, Trained, Closed, Brought in, Wrote, Maintained,
Developed, Implemented, Executed, Partnered, Reviewed, Reported, Analyzed

=== PROFESSIONAL SUMMARY ===
Write 2–3 sentences in professional THIRD-PERSON tone (NOT "I've spent...").
Structure: [Role descriptor] with [X years] of experience in [key domains]. [Most notable achievement]. [What they bring to this specific role/org — reference the org's mission or sector if it's nonprofit/mission-driven].
Example: "Brand marketing professional with seven years of experience in brand standards development, campaign execution, and cross-functional collaboration; most recently leading national growth campaigns for bKash (70M+ users) and advising clients at RBC Royal Bank. Proven track record in brand governance, vendor management, and data-driven optimization. Seeking a role where mission-driven brand clarity translates directly into conservation impact."

=== COMPETENCIES — CRITICAL ===
- Exactly 9 competencies (displayed as 3 rows x 3 columns)
- Use Title Case (e.g. "Brand Governance & Compliance" NOT "brand governance")
- Map directly to JD section headings and requirements — use the JD's own category language
- Every competency must be evidenced by the candidate's actual experience
- Good examples: "Campaign Planning & Execution", "Vendor & Budget Management", "Brand Asset Library Management", "Cross-Functional Collaboration", "Data Analysis & Performance Optimization", "Stakeholder Communication & Training"
- Bad examples: "Communication Skills", "Team Player", "Hard Worker"

=== JD COVERAGE — THE MOST IMPORTANT STEP ===
This is what separates a good resume from a great one.

Step 1: List every KEY RESPONSIBILITY in the JD (brand asset library, vendor management, budget reconciliation, brand training/onboarding, campaign execution, brand governance, etc.).

Step 2: For EACH responsibility — find where in the candidate's background this work PLAUSIBLY happened, even if their original resume didn't explicitly state it.
- If they ran national campaigns at scale, they coordinated vendors.
- If they managed campaign budgets, they tracked and reconciled spend.
- If they worked cross-functionally, they trained or onboarded colleagues.
- If they managed brand assets/templates, they maintained a brand library.

Step 3: ADD a bullet surfacing that implicit experience using the JD's exact language. This is NOT fabrication — it makes visible the real work behind their roles.

Step 4: Ensure every major JD responsibility has at least one bullet in the resume.

EXAMPLES of surfacing implicit experience:
- JD: "vendor management" + ran 10+ national campaigns → "Coordinated contracts with external creative and media vendors, delivering campaigns on time and within budget."
- JD: "brand training" + led cross-functional work → "Developed internal onboarding guides to align teams on brand standards and messaging frameworks."
- JD: "budget management" + managed campaigns → "Tracked and reconciled campaign budgets quarterly, reporting spend efficiency to leadership."
- JD: "brand asset library" + used Canva/Adobe → "Maintained centralized library of approved brand assets, templates, and design files for team use."

=== KEYWORD INTEGRATION ===
1. Scan the JD for every required skill, tool, technology, methodology, and exact phrase.
2. For each keyword — if the candidate has done it (even worded differently) — use the JD's EXACT terminology in bullets, summary, and competencies.
3. Name tools explicitly in bullets where used (e.g. "using Adobe Creative Cloud and Canva").

=== OUTPUT — VALID JSON ONLY, NO MARKDOWN ===
{
  "contact": { "name": "FULL NAME IN CAPS", "city": "City", "province": "Province", "phone": "phone or null", "email": "email or null", "linkedin": "linkedin.com/in/handle or null" },
  "summary": "2-3 sentence third-person professional summary",
  "competencies": ["Title Case Skill 1", "Title Case Skill 2"],
  "competencyCount": 9,
  "experience": [{ "title": "Job Title", "company": "Company Name", "location": "City, Province", "dates": "Mon Year – Mon Year", "bullets": ["bullet1"] }],
  "certifications": ["cert1"] or null,
  "tools": ["tool1"] or null,
  "education": [{ "degree": "Degree Name", "institution": "School Name", "year": "Year" }] or null,
  "scores": {
    "resumeRating": 7,
    "matchPercentage": 78,
    "ratingReasons": ["reason1", "reason2"],
    "matchGaps": ["gap1", "gap2"],
    "trainingRecommendations": ["course1", "course2"]
  }
}

CONTACT: Name must be in ALL CAPS. LinkedIn: output as linkedin.com/in/handle (no https://). Missing fields = null.
EDUCATION: Include location if known. For non-Canadian credentials add "(Canadian Equivalent)" note where appropriate.

SCORES — be strict and honest:

resumeRating (0–10): Rate the candidate's PROFILE STRENGTH — not the writing quality.
  Real achievements (0–3): Original resume had real measurable results (numbers, %, $)?
  Experience relevance (0–3): Work history directly matches the core function of this job?
  Seniority/scope fit (0–2): Years and scope align with the role?
  Required skills (0–2): 2=75%+ covered, 1=40-74%, 0=below 40%
  Benchmarks: 9–10=exceptional, 7–8=strong, 5–6=decent, 3–4=weak, 1–2=poor. Most fall 4–7. Be strict.

matchPercentage (0–100): Rate the TAILORED RESUME against the JD.
  Required skills covered (40%), Keyword alignment (25%), Experience level match (20%), Industry relevance (15%).
  Tailored resumes should typically score 75–90% for relevant candidates.

ratingReasons: 2–3 sentences on the candidate's actual background and fit — not the writing.
matchGaps: 2–4 specific JD requirements the candidate genuinely lacks. Be concrete. [] if match above 90%.
trainingRecommendations: One specific named course/cert per gap (e.g. "Google Project Management Certificate on Coursera"). [] if no gaps.`

type LLMProvider = 'groq' | 'gemini' | 'mistral' | 'openrouter'

interface ProviderConfig {
  name: LLMProvider
  url: string
  model: string
  key: string
  extraHeaders?: Record<string, string>
}

function getAvailableProviders(): ProviderConfig[] {
  const providers: ProviderConfig[] = []
  if (process.env.GROQ_API_KEY) {
    providers.push({ name: 'groq', url: 'https://api.groq.com/openai/v1/chat/completions', model: 'llama-3.3-70b-versatile', key: process.env.GROQ_API_KEY })
  }
  if (process.env.GEMINI_API_KEY) {
    // Gemini free tier: 1,000,000 TPM — primary heavy-load relief
    providers.push({ name: 'gemini', url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', model: 'gemini-2.0-flash', key: process.env.GEMINI_API_KEY })
  }
  if (process.env.MISTRAL_API_KEY) {
    // Mistral free tier: no daily cap, 1 req/sec throttle
    providers.push({ name: 'mistral' as LLMProvider, url: 'https://api.mistral.ai/v1/chat/completions', model: 'mistral-small-latest', key: process.env.MISTRAL_API_KEY })
  }
  if (process.env.OPENROUTER_API_KEY) {
    // OpenRouter free tier: routes to free models across multiple providers
    providers.push({
      name: 'openrouter',
      url: 'https://openrouter.ai/api/v1/chat/completions',
      model: 'meta-llama/llama-3.3-70b-instruct:free',
      key: process.env.OPENROUTER_API_KEY,
      extraHeaders: { 'HTTP-Referer': 'https://canstart.ca', 'X-Title': 'CanStart Resume Builder' }
    })
  }
  return providers
}

async function callLLM(messages: object[], maxTokens: number, provider: ProviderConfig): Promise<Response> {
  return fetch(provider.url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${provider.key}`,
      'Content-Type': 'application/json',
      ...provider.extraHeaders,
    },
    body: JSON.stringify({
      model: provider.model,
      max_tokens: maxTokens,
      temperature: 0.4,
      messages,
    }),
  })
}

async function callWithFallback(messages: object[], maxTokens: number): Promise<{ res: Response; provider: string }> {
  const available = getAvailableProviders()
  if (available.length === 0) {
    throw new Error('No AI provider keys configured.')
  }

  console.log(`Available providers: ${available.map(p => p.name).join(', ')}`)

  // Shuffle providers so load is distributed randomly across requests
  const shuffled = available.sort(() => Math.random() - 0.5)

  const errors: string[] = []

  // Two passes: first try all providers, then retry 429s after a short wait
  for (let pass = 0; pass < 2; pass++) {
    if (pass === 1) {
      // Second pass: only retry providers that returned 429
      const had429 = errors.some(e => e.includes(':429'))
      if (!had429) break
      await new Promise(r => setTimeout(r, 4000))
    }

    for (const provider of shuffled) {
      // On second pass, skip providers that didn't return 429
      if (pass === 1 && !errors.find(e => e.startsWith(`${provider.name}:429`))) continue

      let res: Response
      try {
        res = await callLLM(messages, maxTokens, provider)
      } catch (e) {
        const msg = `${provider.name}:network_error`
        console.warn(msg, e)
        if (pass === 0) errors.push(msg)
        continue
      }

      if (res.ok) {
        console.log(`Resume built via ${provider.name} (pass ${pass + 1})`)
        return { res, provider: provider.name }
      }

      const errText = await res.text()
      const errSummary = `${provider.name}:${res.status}`
      if (pass === 0) errors.push(errSummary)
      console.warn(`${errSummary} pass${pass + 1} — ${errText.slice(0, 200)}`)
    }
  }

  console.error('All providers failed:', errors.join(', '))
  const any429 = errors.some(e => e.includes(':429'))
  if (any429) throw new Error(`ALL_RATE_LIMITED: ${errors.join(', ')}`)
  throw new Error(`ALL_FAILED: ${errors.join(', ')}`)
}

export async function POST(request: Request) {
  try {
    if (!process.env.GROQ_API_KEY && !process.env.GEMINI_API_KEY && !process.env.CEREBRAS_API_KEY) {
      console.error('No AI provider keys configured')
      return NextResponse.json({ error: 'Resume builder is not configured. Please contact support.' }, { status: 500 })
    }

    const formData = await request.formData()
    const resumeFile = formData.get('resume') as File | null
    const jobDescription = formData.get('jobDescription') as string | null

    if (!resumeFile || !jobDescription) {
      return NextResponse.json({ error: 'Resume file and job description are required' }, { status: 400 })
    }

    const buffer = Buffer.from(await resumeFile.arrayBuffer())
    const ext = resumeFile.name.split('.').pop()?.toLowerCase()
    let resumeText = ''

    try {
      if (ext === 'pdf') {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const pdfParse = require('pdf-parse/lib/pdf-parse.js') as (buf: Buffer) => Promise<{ text: string }>
        const result = await pdfParse(buffer)
        resumeText = result.text
      } else if (ext === 'docx') {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const mammoth = require('mammoth') as { extractRawText: (opts: { buffer: Buffer }) => Promise<{ value: string }> }
        const result = await mammoth.extractRawText({ buffer })
        resumeText = result.value
      } else if (ext === 'txt') {
        resumeText = buffer.toString('utf-8')
      } else {
        return NextResponse.json({ error: 'Please upload a PDF, DOCX, or paste your resume as text.' }, { status: 400 })
      }
    } catch (parseErr) {
      console.error('File parse error:', parseErr)
      return NextResponse.json({
        error: 'Could not read the file. Please try the "Paste Resume Text" option instead.'
      }, { status: 400 })
    }

    if (!resumeText.trim()) {
      return NextResponse.json({ error: 'Could not extract text from the resume. Please try a different file or paste the text instead.' }, { status: 400 })
    }

    // Cap inputs to control token usage and avoid rate limits
    const resumeTextTrimmed = resumeText.slice(0, 6000)
    const jobDescTrimmed = jobDescription.slice(0, 4000)

    const messages = [
      { role: 'system', content: RESUME_PROMPT },
      {
        role: 'user',
        content: `=== CANDIDATE'S RESUME ===\n${resumeTextTrimmed}\n\n=== JOB DESCRIPTION ===\n${jobDescTrimmed}\n\nReturn the tailored resume as valid JSON only.`,
      },
    ]

    let aiRes: Response
    let providerName: string
    try {
      ;({ res: aiRes, provider: providerName } = await callWithFallback(messages, 6000))
    } catch (e) {
      const msg = e instanceof Error ? e.message : ''
      if (msg.startsWith('ALL_RATE_LIMITED')) {
        const detail = msg.replace('ALL_RATE_LIMITED: ', '')
        return NextResponse.json({ error: `AI services busy — ${detail}. Please wait a minute and try again.` }, { status: 429 })
      }
      if (msg.startsWith('ALL_FAILED')) {
        const detail = msg.replace('ALL_FAILED: ', '')
        return NextResponse.json({ error: `All AI providers failed — ${detail}` }, { status: 500 })
      }
      console.error('No AI providers configured:', e)
      return NextResponse.json({ error: 'Resume builder is not configured. Please contact support.' }, { status: 500 })
    }

    const aiData = await aiRes.json()
    const raw = aiData.choices?.[0]?.message?.content || ''

    if (!raw) {
      console.error(`Empty response from ${providerName}. finish_reason:`, aiData.choices?.[0]?.finish_reason)
      return NextResponse.json({ error: 'No response from AI. Please try again.' }, { status: 500 })
    }

    // Extract JSON — handle plain JSON or ```json ... ``` code blocks
    let jsonStr: string | null = null
    const codeBlockMatch = raw.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/)
    if (codeBlockMatch) {
      jsonStr = codeBlockMatch[1]
    } else {
      const start = raw.indexOf('{')
      const end = raw.lastIndexOf('}')
      if (start !== -1 && end !== -1 && end > start) {
        jsonStr = raw.slice(start, end + 1)
      }
    }

    if (!jsonStr) {
      console.error('No JSON in response. Raw (first 300):', raw.slice(0, 300))
      return NextResponse.json({ error: 'Failed to generate resume. Please try again.' }, { status: 500 })
    }

    let resume
    try {
      resume = JSON.parse(jsonStr)
    } catch (parseErr) {
      console.error('JSON parse error:', parseErr)
      const finishReason = aiData.choices?.[0]?.finish_reason
      if (finishReason === 'length') {
        return NextResponse.json({
          error: 'Your resume or job description is very long. Please shorten the job description to the key requirements and try again.'
        }, { status: 500 })
      }
      return NextResponse.json({ error: 'Failed to parse the generated resume. Please try again.' }, { status: 500 })
    }

    return NextResponse.json({ resume })
  } catch (err) {
    console.error('Resume builder error:', err)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
