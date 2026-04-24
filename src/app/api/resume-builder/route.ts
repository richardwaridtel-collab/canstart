import { NextResponse } from 'next/server'

const BANNED_WORDS = [
  'leveraged','leverage','leveraging','utilized','utilize','utilizing',
  'spearheaded','spearhead','orchestrated','orchestrate','championed','champion',
  'transformed','transform','revolutionized','revolutionize','synergized','synergize',
  'optimized','optimize','streamlined','streamline','facilitated','facilitate',
  'ideated','ideate','pivoted','pivot','disrupted','disrupt','scaled','mobilized',
  'mobilize','executed','execute','deployed','deploy','fostered','foster',
  'cultivated','cultivate','empowered','empower','showcased','showcase',
  'harnessed','harness','capitalized','capitalize','demonstrated','demonstrate',
  'spearheading','orchestrating','championing','transforming','facilitating',
]

const RESUME_PROMPT = `You are a professional resume writer helping newcomers to Canada.
Create a tailored resume based on the candidate's existing resume and the job description provided.

=== STRICT RULES — FOLLOW EXACTLY ===

RULE 1 — BANNED WORDS: Never use any of these words in any bullet or sentence:
${BANNED_WORDS.join(', ')}

Instead use simple human verbs like: managed, built, created, led, wrote, helped, worked,
made, set up, ran, found, fixed, trained, reviewed, coordinated, planned, handled, improved,
reduced, increased, supported, assisted, prepared, worked with, talked to, responded to,
checked, updated, reported, tested, tracked, answered, organized, scheduled

RULE 2 — BULLET METHOD: Every bullet must follow EITHER CAR or STAR format. Mix both within each role.
- CAR (Context → Action → Result): "In a [context], [action verb] [what you did], which [result with number if possible]."
- STAR (Situation → Task → Action → Result): "When [situation], [task required], [what you did] and [result]."
Both types must read naturally, like a real person wrote them, not an AI.

RULE 3 — WORD COUNT: Count every word. Each bullet must be between 18 and 20 words. No exceptions.

RULE 4 — BULLET COUNT PER ROLE (based on how many roles exist):
- Role 1 (most recent / current): exactly 6 bullets
- Role 2 and Role 3: exactly 4 bullets each
- Role 4 and all roles after: exactly 3 bullets each

RULE 5 — SIMPLE TONE: Write the way a real professional would talk about their work.
Avoid buzzwords, corporate speak, and anything that sounds AI-generated.

=== OUTPUT FORMAT ===
Return ONLY valid JSON, no markdown, no explanation. Use this exact structure:

{
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
  ] or null
}

For competencies: choose exactly 9 or 12 skills matching the job description and candidate background.
For certifications and tools: only include if present in the original resume. Otherwise set to null.
For education: only include if mentioned in the original resume. Otherwise set to null.`

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
        const pdfParse = require('pdf-parse/lib/pdf-parse.js') as (buf: Buffer, opts?: object) => Promise<{ text: string }>
        const result = await pdfParse(buffer, {})
        resumeText = result.text
      } else if (ext === 'docx') {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const mammoth = require('mammoth') as { extractRawText: (opts: { buffer: Buffer }) => Promise<{ value: string }> }
        const result = await mammoth.extractRawText({ buffer })
        resumeText = result.value
      } else {
        return NextResponse.json({ error: 'Please upload a PDF or DOCX file' }, { status: 400 })
      }
    } catch {
      return NextResponse.json({ error: 'Could not read the resume file. Please try a different file.' }, { status: 400 })
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
