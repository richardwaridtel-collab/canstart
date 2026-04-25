import { NextRequest, NextResponse } from 'next/server'

export interface ExtractedKeywords {
  required_skills: string[]
  preferred_skills: string[]
  keywords: string[]
}

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'

export async function POST(req: NextRequest) {
  const { description, title } = await req.json()

  if (!description || description.length < 30) {
    return NextResponse.json({ required_skills: [], preferred_skills: [], keywords: [] })
  }

  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'GROQ_API_KEY not configured' }, { status: 500 })
  }

  const prompt = `Extract keywords from this job posting. Return ONLY valid JSON, no markdown, no explanation.

Job title: ${title || 'Not provided'}
Job description (excerpt):
${description.slice(0, 4000)}

Return this exact JSON structure:
{
  "required_skills": [],
  "preferred_skills": [],
  "keywords": []
}

Rules:
- required_skills: tools/technologies/certs explicitly marked as required/must-have (max 12)
- preferred_skills: nice-to-have, preferred, asset, bonus skills (max 8)
- keywords: other important role-specific terms, methodologies, domain knowledge (max 10)
- Each item: 1–4 words, specific (e.g. "Power BI" not "software")
- No generic soft skills (communication, teamwork, etc.)
- No duplicates across arrays`

  try {
    const res = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 500,
        response_format: { type: 'json_object' },
      }),
    })

    if (!res.ok) {
      throw new Error(`Groq API error: ${res.status}`)
    }

    const data = await res.json()
    const content = data.choices?.[0]?.message?.content || '{}'
    const parsed: ExtractedKeywords = JSON.parse(content)

    // Sanitize — ensure arrays
    return NextResponse.json({
      required_skills: Array.isArray(parsed.required_skills) ? parsed.required_skills.filter(Boolean) : [],
      preferred_skills: Array.isArray(parsed.preferred_skills) ? parsed.preferred_skills.filter(Boolean) : [],
      keywords: Array.isArray(parsed.keywords) ? parsed.keywords.filter(Boolean) : [],
    })
  } catch (err) {
    console.error('extract-keywords error:', err)
    return NextResponse.json({ required_skills: [], preferred_skills: [], keywords: [] })
  }
}
