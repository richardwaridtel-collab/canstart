import { NextResponse } from 'next/server'

// Quick diagnostic endpoint — tells you which AI providers are configured
// Visit /api/ai-status to check
export async function GET() {
  const providers = {
    groq: !!process.env.GROQ_API_KEY,
    gemini: !!process.env.GEMINI_API_KEY,
    cerebras: !!process.env.CEREBRAS_API_KEY,
    openrouter: !!process.env.OPENROUTER_API_KEY,
  }

  const configured = Object.entries(providers).filter(([, v]) => v).map(([k]) => k)
  const missing = Object.entries(providers).filter(([, v]) => !v).map(([k]) => k)

  return NextResponse.json({
    configured,
    missing,
    total: configured.length,
    ready: configured.length > 0,
  })
}
