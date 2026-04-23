import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const ADZUNA_BASE = 'https://api.adzuna.com/v1/api/jobs/ca/search'

const CANADIAN_CITIES = ['Ottawa', 'Toronto', 'Calgary', 'Vancouver', 'Montreal', 'Edmonton', 'Winnipeg', 'Halifax']

const SEARCH_QUERIES = [
  { what: 'marketing manager', category: 'Marketing' },
  { what: 'digital marketing', category: 'Marketing' },
  { what: 'marketing coordinator', category: 'Marketing' },
  { what: 'content marketing', category: 'Marketing' },
  { what: 'project manager', category: 'Project Management' },
  { what: 'project coordinator', category: 'Project Management' },
  { what: 'junior project manager', category: 'Project Management' },
  { what: 'data analyst', category: 'Data & Analytics' },
  { what: 'business analyst', category: 'Business Analysis' },
  { what: 'hr coordinator', category: 'Human Resources' },
  { what: 'accountant bookkeeper', category: 'Finance & Accounting' },
  { what: 'customer service', category: 'Customer Service' },
  { what: 'administrative assistant', category: 'Administration' },
  { what: 'software developer junior', category: 'Technology' },
]

interface AdzunaJob {
  id: string
  title: string
  company: { display_name: string }
  location: { display_name: string; area?: string[] }
  description: string
  redirect_url: string
  salary_min?: number
  salary_max?: number
  contract_time?: string
  created: string
}

function extractCity(location: AdzunaJob['location']): string {
  const display = location.display_name || ''
  for (const city of CANADIAN_CITIES) {
    if (display.toLowerCase().includes(city.toLowerCase())) return city
  }
  if (location.area) {
    for (const area of location.area) {
      for (const city of CANADIAN_CITIES) {
        if (area.toLowerCase().includes(city.toLowerCase())) return city
      }
    }
  }
  return display.split(',')[0]?.trim() || 'Canada'
}

function detectWorkMode(title: string, description: string): string {
  const text = (title + ' ' + description).toLowerCase()
  if (text.includes('remote') || text.includes('work from home') || text.includes('télétravail')) return 'remote'
  if (text.includes('hybrid')) return 'hybrid'
  return 'onsite'
}

async function fetchAdzunaJobs(what: string, appId: string, appKey: string, page = 1): Promise<AdzunaJob[]> {
  const params = new URLSearchParams({
    app_id: appId,
    app_key: appKey,
    results_per_page: '20',
    what,
    where: 'canada',
    'content-type': 'application/json',
    sort_by: 'date',
  })

  const res = await fetch(`${ADZUNA_BASE}/${page}?${params}`, {
    headers: { Accept: 'application/json' },
    next: { revalidate: 0 },
  })

  if (!res.ok) return []
  const data = await res.json()
  return data.results || []
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const ADZUNA_APP_ID = process.env.ADZUNA_APP_ID
  const ADZUNA_APP_KEY = process.env.ADZUNA_APP_KEY

  if (!ADZUNA_APP_ID || !ADZUNA_APP_KEY) {
    return NextResponse.json({ error: 'Adzuna API keys not configured' }, { status: 500 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  let totalInserted = 0
  const errors: string[] = []

  for (const { what, category } of SEARCH_QUERIES) {
    try {
      const jobs = await fetchAdzunaJobs(what, ADZUNA_APP_ID, ADZUNA_APP_KEY)

      for (const job of jobs) {
        const city = extractCity(job.location)
        const workMode = detectWorkMode(job.title, job.description || '')

        const record = {
          source: 'adzuna',
          external_id: job.id,
          title: job.title,
          company: job.company.display_name,
          city,
          description: (job.description || '').slice(0, 1000),
          url: job.redirect_url,
          category,
          salary_min: job.salary_min || null,
          salary_max: job.salary_max || null,
          work_mode: workMode,
          synced_at: new Date().toISOString(),
        }

        const { error } = await supabase
          .from('external_opportunities')
          .upsert(record, { onConflict: 'source,external_id' })

        if (error) {
          errors.push(`${job.id}: ${error.message}`)
        } else {
          totalInserted++
        }
      }

      await new Promise((r) => setTimeout(r, 500))
    } catch (err) {
      errors.push(`Query "${what}": ${err instanceof Error ? err.message : 'unknown error'}`)
    }
  }

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  await supabase.from('external_opportunities').delete().lt('synced_at', thirtyDaysAgo)

  return NextResponse.json({
    success: true,
    synced: totalInserted,
    errors: errors.length,
    errorDetails: errors.slice(0, 5),
    timestamp: new Date().toISOString(),
  })
}

export async function POST(request: Request) {
  return GET(request)
}
