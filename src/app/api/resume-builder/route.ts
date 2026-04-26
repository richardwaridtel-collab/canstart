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

const RESUME_PROMPT = `You are a professional resume writer. Rewrite the candidate's resume tailored to the job description.

=== BULLET STYLE (copy exactly) ===
EXAMPLES:
- "Tracked and closed 147 RAID items across five delivery waves, with nothing left unmitigated."
- "Delivered 98% user migration on time by directing a 10-person team of Scrum Masters and BAs."
- "Managed a $3M+ portfolio across SMB and enterprise segments, finishing 10% under budget."
- "Rolled out Avaya CCaaS across 5 contact center locations for 800+ agents within a $1.2M budget."
- "Rebuilt the loyalty program, bringing in 600,000 members and lifting CSAT from 70 to 90 in 12 months."

RULES:
1. Start with a strong action verb — no preamble
2. One clear claim per bullet: what was done + result
3. Use specific numbers from the original resume — never invent metrics
4. Mix three patterns: A) Action+scope+result  B) Result+by+how  C) Action+impact clause
5. 15–22 words per bullet. No padding.
6. Plain direct language. No buzzwords.
7. NEVER use: ${BANNED_WORDS.join(', ')}

BULLETS PER ROLE: Role 1 = 6 bullets · Roles 2–3 = 4 bullets each · Role 4+ = 3 bullets each

=== APPROVED VERBS ===
Managed, Built, Led, Ran, Set up, Tracked, Directed, Negotiated, Scoped, Launched,
Rolled out, Rebuilt, Supervised, Expanded, Automated, Produced, Owned, Delivered,
Planned, Reduced, Increased, Cut, Grew, Hired, Trained, Closed, Brought in, Wrote

=== SUMMARY ===
3–4 sentences, first person, honest and conversational. Tailor to the job. Use the candidate's actual background.
Example style: "I've spent 12 years getting complex programs across the line, most recently running a platform migration for Roche across NAM and EMEA. I work best where the stakes are real and someone needs to hold the whole thing together."

=== KEYWORD INTEGRATION — TARGET 90%+ MATCH ===
1. Scan the JD for every required skill, tool, technology, and methodology.
2. For each: if the candidate has done it (even with different wording) → rewrite the bullet using the JD's EXACT terminology.
   - JD says "stakeholder management" + candidate managed clients → use "stakeholder management"
   - JD says "CRM management" + candidate used Salesforce → use "CRM management (Salesforce)"
3. Mirror JD language in the summary. Include JD tools in competencies where evidence exists.
4. Do NOT fabricate experience. Only relabel real work using the JD's vocabulary.

=== COMPETENCIES ===
- Exactly 9 or 12 (pick whichever fits) — each must be directly evidenced by the experience bullets
- Do not add skills just because they appear in the JD
- Plain specific labels only

=== OUTPUT — VALID JSON ONLY, NO MARKDOWN ===
{
  "contact": { "name": "Full Name", "city": "City", "province": "Province", "phone": "phone or null", "email": "email or null", "linkedin": "url or null" },
  "summary": "3-4 sentence summary",
  "competencies": ["skill1", "skill2"],
  "competencyCount": 9,
  "experience": [{ "title": "Title", "company": "Company", "location": "City, Province", "dates": "Mon Year – Mon Year", "bullets": ["bullet1"] }],
  "certifications": ["cert1"] or null,
  "tools": ["tool1"] or null,
  "education": [{ "degree": "Degree", "institution": "School", "year": "Year" }] or null,
  "scores": {
    "resumeRating": 7,
    "matchPercentage": 78,
    "ratingReasons": ["reason1", "reason2"],
    "matchGaps": ["gap1", "gap2"],
    "trainingRecommendations": ["course1", "course2"]
  }
}

SCORES — be strict and honest:

resumeRating (0–10): Rate the candidate's PROFILE STRENGTH for this role — not the writing quality.
  Real achievements (0–3): Did the original resume have measurable results (numbers, %, $)?
  Experience relevance (0–3): How directly does their work history match the core function of this job?
  Seniority/scope fit (0–2): Do years of experience and team/budget scope align with the role?
  Required skills (0–2): What % of required skills does the candidate actually have? (2=75%+, 1=40–74%, 0=<40%)
  Benchmarks: 9–10=exceptional, 7–8=strong, 5–6=decent, 3–4=weak fit, 1–2=poor fit. Most fall 4–7. Be strict.

matchPercentage (0–100): Rate the TAILORED RESUME against the JD.
  Required skills covered (40%): matched/total × 40
  Keyword alignment (25%): JD keywords present in resume × 25
  Experience level (20%): 20=exact match, 14=slight gap, 8=noticeable gap, 0=major mismatch
  Industry relevance (15%): 15=same, 10=related, 5=some overlap, 0=different
  Tailored resumes with keyword integration should score 75–90% for relevant candidates.

ratingReasons: 2–3 short sentences about the candidate's actual background and fit (not the writing).
matchGaps: 2–4 specific things the JD requires that the candidate lacks. Be concrete. Empty array [] if match >90%.
trainingRecommendations: One specific named course/cert per gap (e.g. "Google Project Management Certificate on Coursera"). Empty array [] if no gaps.`

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
