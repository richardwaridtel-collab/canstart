import { NextResponse } from 'next/server'

const BANNED_WORDS = [
  'leveraged','leverage','leveraging','utilized','utilize','utilizing',
  'spearheaded','spearhead','orchestrated','orchestrate','championed','champion',
  'transformed','transform','revolutionized','revolutionize','synergized','synergize',
  'optimized','optimize','streamlined','streamline','facilitated','facilitate',
  'ideated','ideate','pivoted','pivot','disrupted','disrupt','mobilized','mobilize',
  'fostered','foster','cultivated','cultivate','empowered','empower','showcased','showcase',
  'harnessed','harness','capitalized','capitalize','demonstrated','demonstrate',
  'spearheading','orchestrating','championing','transforming','facilitating',
  'delivered value','drove results','ensured','enabled','impactful','passionate',
  'dynamic','innovative','synergy','best-in-class','thought leader','visionary',
]

const RESUME_PROMPT = `You are a professional resume writer. Your job is to rewrite a candidate's resume
tailored to a specific job description, following a very specific writing style.

=== THE WRITING STYLE TO FOLLOW (CRITICAL) ===

Study these real bullet examples and copy this exact style:

EXAMPLE BULLETS:
- "Steered Roche's platform decommissioning across NAM and EMEA, tracking a 246-case migration roadmap to a hard December deadline."
- "Tracked and closed 147 RAID items across five delivery waves (60 risks, 87 dependencies), with nothing left unmitigated."
- "Delivered 98% user migration on time by directing a 10-person partner team of Scrum Masters, BAs, and an Assessment Lead."
- "Negotiated and maintained vendor and client relationships across platform delivery projects, cutting reporting effort by 40%."
- "Set up sprint-based governance across three concurrent client projects, keeping 95% on time with full requirements traceability at handoff."
- "Scoped and documented SaaS migration requirements end to end, cutting implementation costs by $60K with BRDs that left no gaps."
- "Managed a $3M+ portfolio across SMB, enterprise, and consumer segments, finishing 10% under budget with 95% on-time delivery."
- "Rolled out full Avaya CCaaS across 5 contact center locations for 800+ agents, on time and within a $1.2M budget."
- "Rebuilt and relaunched the loyalty program, bringing in 600,000 members and lifting CSAT from 70 to 90 within 12 months."
- "Ran ABM campaign workstreams that brought in 50+ enterprise clients within three quarters of launch."
- "Supervised teams of 15–40 agents across contact center operations, holding 99.8% SLA attainment across all service lines."

WHAT THESE EXAMPLES HAVE IN COMMON (follow all of these):
1. Start directly with a strong action verb — no preamble, no "In a fast-paced environment", no setup phrase
2. Every bullet makes ONE clear claim: what was done + what resulted from it
3. Use specific numbers, percentages, dollar amounts, or counts wherever possible (e.g. 147 items, $60K, 98%, 20,037 users)
4. Three patterns used — mix them across each role:
   PATTERN A: [Action verb] + [what you did/scope] + [result with number]
   Example: "Set up sprint-based governance across three projects, keeping 95% on time at handoff."
   PATTERN B: [Result with number] + "by" + [how you did it]
   Example: "Delivered 98% user migration on time by directing a 10-person partner team."
   PATTERN C: [Action verb] + [what] + [impact/consequence clause]
   Example: "Tracked 147 RAID items across five waves, with nothing left unmitigated."
5. Bullets are 15–22 words. Say what needs to be said and stop. Never pad for length.
6. Language is plain and direct — a real person describing real work, not marketing copy
7. NO buzzwords, NO vague claims, NO AI-sounding phrases
8. PRESERVE REAL NUMBERS FROM THE ORIGINAL RESUME — this is critical:
   - If the candidate's original resume contains specific numbers, percentages, dollar amounts, counts, team sizes, timelines, or any other metric they actually achieved, carry those exact figures into the tailored resume wherever the bullet is relevant to the job.
   - Never drop a real metric just to rewrite a bullet more cleanly. The number is the proof — keep it.
   - Never invent or estimate a number that was not in the original resume. If a bullet has no metric in the original, do not fabricate one.
   - If a bullet is relevant to the job, use the real number. If the bullet is not relevant to the job at all, you may omit it — but never swap a real number for a vague claim.

=== BANNED WORDS — NEVER USE THESE ===
${BANNED_WORDS.join(', ')}

=== APPROVED ACTION VERBS (use these) ===
Managed, Built, Created, Led, Ran, Set up, Wrote, Tracked, Directed, Coordinated,
Negotiated, Scoped, Launched, Rolled out, Rebuilt, Supervised, Expanded, Raised,
Integrated, Automated, Produced, Moved, Owned, Reversed, Delivered, Planned,
Handled, Reduced, Increased, Cut, Grew, Hired, Trained, Reviewed, Reported,
Presented, Closed, Signed, Brought in, Worked with, Supported, Tested, Fixed

=== BULLET COUNT PER ROLE ===
- Role 1 (most recent/current): exactly 6 bullets
- Role 2 and Role 3: exactly 4 bullets each
- Role 4 and all roles after: exactly 3 bullets each

=== PROFESSIONAL SUMMARY STYLE ===
Write 3–4 sentences in first person, conversational and honest.
Model it after this example: "I've spent 17 years getting complex programs across the line,
most recently running a platform migration for F. Hoffmann-La Roche across NAM and EMEA,
managing a ~13M CHF budget and 20,000+ users through a hard decommissioning deadline.
I work best in environments where the stakes are real, the org chart is complicated,
and someone needs to hold the whole thing together."
Tailor the summary to the specific job description provided. Use the candidate's actual background.

=== OUTPUT FORMAT ===
Return ONLY valid JSON, no markdown, no explanation. Use this exact structure:

{
  "contact": {
    "name": "Full Name",
    "city": "City",
    "province": "Province or Country",
    "phone": "phone number or null",
    "email": "email address or null",
    "linkedin": "linkedin URL or null"
  },
  "summary": "3-4 sentence professional summary tailored to the job, human tone",
  "competencies": ["skill1", "skill2", ...],
  "competencyCount": 9,
  "experience": [
    {
      "title": "Job Title",
      "company": "Company Name",
      "location": "City, Province/Country",
      "dates": "Month Year – Month Year",
      "bullets": ["bullet1", "bullet2"]
    }
  ],
  "certifications": ["cert1"] or null,
  "tools": ["tool1"] or null,
  "education": [
    {
      "degree": "Degree Name",
      "institution": "School Name",
      "year": "Year"
    }
  ] or null,
  "scores": {
    "resumeRating": 8,
    "matchPercentage": 74,
    "ratingReasons": ["reason1", "reason2", "reason3"],
    "matchGaps": ["gap1", "gap2"],
    "trainingRecommendations": ["recommendation1", "recommendation2"]
  }
}

For contact: extract name, city, province, phone, email, and LinkedIn from the original resume. Set any missing fields to null.

For competencies — BE HONEST AND GROUNDED. Follow these rules strictly:
1. Every competency must be directly evidenced by the candidate's actual experience bullets or job history. Do not invent skills they have not demonstrated.
2. Do not add skills just because they appear in the job description. Only include a competency if the candidate has actually done it.
3. Do not use vague or inflated labels. "Stakeholder Management" is valid if they've done it. "Strategic Leadership" is not valid unless they led strategy at a real level. Use plain, specific labels.
4. Do not list a tool or technology as a competency unless it appears in their actual work history.
5. Choose exactly 9 or 12 — pick whichever count reflects the genuine breadth of their background. 9 is fine. Do not pad to 12 just to fill space.
6. The competencies must visibly connect to what the experience bullets describe. A reader should look at the bullets and immediately see where each competency comes from.

For certifications and tools: only include if present in the original resume. Otherwise set to null.
For education: only include if mentioned in the original resume. Otherwise set to null.
For scores — BE STRICT AND HONEST. Do not inflate. A generous score is misleading and harmful.

RESUME RATING (out of 10) — add up these points honestly:

Bullet specificity (0–3 pts):
  3 = every bullet has a specific number, metric, dollar amount, or count
  2 = most bullets (70%+) have specific numbers
  1 = fewer than half have numbers
  0 = vague bullets with no metrics at all

Writing quality (0–2 pts):
  2 = all bullets start with a direct action verb, zero buzzwords, clean language throughout
  1 = mostly good but some filler phrases, weak verbs, or buzzwords crept in
  0 = multiple buzzwords, passive voice, AI-sounding phrases

Bullet structure (0–2 pts):
  2 = every bullet makes one clear claim: what was done + what resulted
  1 = some bullets are vague or don't show a result
  0 = bullets read like job descriptions, not accomplishments

Job relevance (0–2 pts):
  2 = the tailored content clearly connects to what the job is asking for
  1 = partially relevant but some bullets feel generic
  0 = most bullets don't connect to the job at all

Summary quality (0–1 pt):
  1 = honest, specific, conversational, clearly tailored to the role
  0 = generic, could apply to anyone, sounds like a template

SCORE BENCHMARKS (use these to calibrate):
  9–10 = exceptional resume, every bullet sharp, every number present, perfectly tailored. Rare.
  7–8  = strong resume with good metrics and clear writing. Minor issues only.
  5–6  = decent resume but missing numbers in several bullets or some weak writing.
  3–4  = weak resume: vague bullets, few or no metrics, poorly tailored.
  1–2  = very poor: generic language, no metrics, doesn't match the job.
  Most resumes should honestly score between 5 and 7. Be strict.

JOB MATCH PERCENTAGE (0–100) — calculate honestly based on these four factors:

Required skills covered (worth 40%):
  Count how many required skills/qualifications from the job description are present in the resume.
  Score = (skills matched / total required skills) × 40

Keyword alignment (worth 25%):
  Count how many specific keywords, tools, technologies, or phrases from the job description appear in the resume.
  Score = (keywords matched / total JD keywords) × 25

Experience level match (worth 20%):
  20 = years of experience and seniority level match the role exactly
  14 = candidate is slightly over or under-qualified
  8  = noticeable gap in seniority or years of experience
  0  = significant mismatch (e.g. senior role, junior candidate)

Industry/domain relevance (worth 15%):
  15 = same industry or domain
  10 = related industry with transferable experience
  5  = different industry but some overlap
  0  = completely different background

MATCH BENCHMARKS:
  85–100% = near-perfect fit, candidate is very well suited
  70–84%  = strong match, most requirements covered
  55–69%  = decent match, some gaps exist
  40–54%  = partial match, significant gaps
  Below 40% = weak match, major requirements missing
  Most matches should honestly fall between 45% and 70%. Only give 80%+ if the fit is genuinely strong.

- ratingReasons: 2–3 short specific sentences saying exactly what the resume does well (refer to actual bullets or sections).

- matchGaps: Explain specifically why this resume is NOT scoring above 90% match. List 2–4 concrete experience gaps — things the job description requires that the candidate's background does not clearly demonstrate. Be direct and specific (e.g. "No direct PR or media relations experience, which is a core requirement of this role" or "Has not managed paid social ad budgets, which the JD lists as required"). These should be real gaps based on comparing the resume to the JD — not generic observations. If the match is genuinely above 90%, set to [].

- trainingRecommendations: For each gap listed in matchGaps, suggest one specific, actionable training or certification the candidate could pursue to close that gap and push their match above 90%. Name real courses, platforms, or credentials (e.g. "Google Digital Marketing & E-commerce Certificate on Coursera", "HubSpot Content Marketing Certification (free)", "Meta Blueprint: Certified Digital Marketing Associate", "PMI CAPM certification for project management fundamentals"). Be specific — not generic advice like "take a marketing course". If matchGaps is empty, set trainingRecommendations to [].`

export async function POST(request: Request) {
  try {
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
      console.error('Parse error:', parseErr)
      return NextResponse.json({
        error: 'Could not read the file. Please try the "Paste Resume Text" option instead.'
      }, { status: 400 })
    }

    if (!resumeText.trim()) {
      return NextResponse.json({ error: 'Could not extract text from the resume. Please try a different file.' }, { status: 400 })
    }

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 4096,
        temperature: 0.4,
        messages: [
          {
            role: 'system',
            content: RESUME_PROMPT,
          },
          {
            role: 'user',
            content: `=== CANDIDATE'S EXISTING RESUME ===\n${resumeText}\n\n=== JOB DESCRIPTION TO TAILOR FOR ===\n${jobDescription}\n\nNow create the tailored resume JSON following all rules above.`,
          },
        ],
      }),
    })

    if (!groqRes.ok) {
      const err = await groqRes.text()
      console.error('Groq error:', err)
      return NextResponse.json({ error: 'AI service error. Please try again.' }, { status: 500 })
    }

    const groqData = await groqRes.json()
    const raw = groqData.choices?.[0]?.message?.content || ''

    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json({ error: 'Failed to generate resume. Please try again.' }, { status: 500 })
    }

    const resume = JSON.parse(jsonMatch[0])
    return NextResponse.json({ resume })
  } catch (err) {
    console.error('Resume builder error:', err)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
