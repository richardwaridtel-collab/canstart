'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import {
  ArrowLeft, MapPin, Building2, Calendar, ExternalLink,
  Bookmark, Briefcase, DollarSign, Tag, Wifi, Sparkles,
} from 'lucide-react'
import { MatchBattery } from '@/components/MatchBattery'

type JobMatch = {
  match_score: number
  matched_keywords: string[]
  missing_keywords: string[]
}

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

function formatPostedDate(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays <= 6) return `${diffDays}d ago`
  return new Date(dateStr).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatSalary(min?: number, max?: number): string | null {
  if (!min && !max) return null
  if (min && max) return `$${Math.round(min / 1000)}K–$${Math.round(max / 1000)}K/yr`
  if (min) return `$${Math.round(min / 1000)}K+/yr`
  return null
}

export default function JobDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params?.id as string

  const [job, setJob] = useState<ExternalJob | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [isApplied, setIsApplied] = useState(false)
  const [marking, setMarking] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [jobMatch, setJobMatch] = useState<JobMatch | null>(null)

  useEffect(() => {
    if (!id) return
    loadJob()
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadJob = async () => {
    const [{ data: jobData, error }, { data: { user } }] = await Promise.all([
      supabase.from('external_opportunities').select('*').eq('id', id).single(),
      supabase.auth.getUser(),
    ])

    if (error || !jobData) {
      setNotFound(true)
    } else {
      setJob(jobData as ExternalJob)
    }

    if (user) {
      setUserId(user.id)
      const [{ data: app }, { data: matchData }] = await Promise.all([
        supabase
          .from('external_applications')
          .select('id')
          .eq('seeker_id', user.id)
          .eq('external_opportunity_id', id)
          .maybeSingle(),
        supabase
          .from('job_matches')
          .select('match_score, matched_keywords, missing_keywords')
          .eq('seeker_id', user.id)
          .eq('job_id', id)
          .maybeSingle(),
      ])
      if (app) setIsApplied(true)
      if (matchData) setJobMatch(matchData as JobMatch)
    }

    setLoading(false)
  }

  const markApplied = async () => {
    if (!userId || !job || isApplied || marking) return
    setMarking(true)
    try {
      await supabase.from('external_applications').insert({
        seeker_id: userId,
        external_opportunity_id: job.id,
        job_title: job.title,
        company: job.company,
        job_url: job.url,
      })
      setIsApplied(true)
    } catch { /* ignore */ } finally {
      setMarking(false)
    }
  }

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10 animate-pulse space-y-4">
        <div className="h-4 bg-gray-200 rounded w-24" />
        <div className="h-8 bg-gray-200 rounded w-3/4" />
        <div className="h-6 bg-gray-100 rounded w-1/2" />
        <div className="h-64 bg-gray-100 rounded-2xl" />
      </div>
    )
  }

  // ── Not found ─────────────────────────────────────────────────────────────
  if (notFound || !job) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <Briefcase size={52} className="mx-auto text-gray-300 mb-4" />
        <h1 className="text-xl font-bold text-gray-700 mb-2">Job Posting Unavailable</h1>
        <p className="text-gray-500 mb-2 max-w-sm mx-auto">
          This job has been removed from our database. External postings are kept for up to 30 days.
        </p>
        <p className="text-xs text-gray-400 mb-8">Job ID: {id}</p>
        <Link
          href="/opportunities"
          className="bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 rounded-xl font-semibold text-sm inline-flex items-center gap-2 transition-colors"
        >
          <Briefcase size={15} /> Browse Current Openings
        </Link>
      </div>
    )
  }

  const salary = formatSalary(job.salary_min, job.salary_max)

  // ── Job detail ────────────────────────────────────────────────────────────
  return (
    <div className="bg-gray-50 min-h-screen py-8">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">

        {/* Back */}
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-6 transition-colors"
        >
          <ArrowLeft size={16} /> Back
        </button>

        {/* CanStart archive notice */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 mb-5 flex items-start gap-3">
          <Bookmark size={16} className="text-blue-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-blue-700">
            <span className="font-semibold">Saved on CanStart</span> — This listing is preserved in our database so you never lose it.
            The original posting may have changed or been filled. Always confirm details before applying.
          </p>
        </div>

        {/* Header card */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-4 shadow-sm">
          <div className="flex flex-wrap gap-2 mb-3">
            <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 flex items-center gap-1">
              <Tag size={10} /> {job.category}
            </span>
            <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-gray-100 text-gray-600 flex items-center gap-1 capitalize">
              <Wifi size={10} /> {job.work_mode}
            </span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 leading-snug mb-3">{job.title}</h1>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-gray-500">
            <span className="flex items-center gap-1.5 font-semibold text-blue-600">
              <Building2 size={15} /> {job.company}
            </span>
            <span className="flex items-center gap-1.5">
              <MapPin size={15} /> {job.city}
            </span>
            {salary && (
              <span className="flex items-center gap-1.5 font-semibold text-green-600">
                <DollarSign size={15} /> {salary}
              </span>
            )}
            {(job.posted_at || job.synced_at) && (
              <span className="flex items-center gap-1.5">
                <Calendar size={15} /> Posted {formatPostedDate(job.posted_at || job.synced_at)}
              </span>
            )}
          </div>
        </div>

        {/* Description */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-4 shadow-sm">
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">Job Description</h2>
          <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
            {job.description || 'No description available for this listing.'}
          </div>
        </div>

        {/* ── How You Match (only shown when a pre-computed match exists) ── */}
        {jobMatch && (
          <div className="bg-white rounded-2xl border border-purple-200 p-6 mb-4 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles size={16} className="text-purple-500" />
              <h2 className="text-sm font-bold text-gray-900 uppercase tracking-widest">How You Match</h2>
            </div>

            {/* Battery indicator */}
            <div className="flex items-center gap-3 mb-4">
              <MatchBattery score={jobMatch.match_score} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Matched skills */}
              {jobMatch.matched_keywords.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-green-700 mb-1.5">
                    ✅ Skills you have ({jobMatch.matched_keywords.length})
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {jobMatch.matched_keywords.map(kw => (
                      <span key={kw} className="text-xs px-2 py-0.5 rounded-full bg-green-50 border border-green-200 text-green-700 font-medium">
                        {kw}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Missing skills */}
              {jobMatch.missing_keywords.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-red-600 mb-1.5">
                    ➕ Skills to add to your resume ({jobMatch.missing_keywords.length})
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {jobMatch.missing_keywords.map(kw => (
                      <span key={kw} className="text-xs px-2 py-0.5 rounded-full bg-red-50 border border-red-200 text-red-600 font-medium">
                        {kw}
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-gray-400 mt-2">
                    Adding relevant missing skills to your resume improves your visibility to employers.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Action card */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Mark applied */}
            {userId && (
              isApplied ? (
                <div className="flex items-center justify-center gap-2 text-sm font-medium bg-green-100 text-green-700 px-4 py-3 rounded-xl">
                  ✓ Marked as Applied
                </div>
              ) : (
                <button
                  onClick={markApplied}
                  disabled={marking}
                  className="flex items-center justify-center gap-2 text-sm font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-3 rounded-xl transition-colors disabled:opacity-60 sm:flex-shrink-0"
                >
                  {marking
                    ? <div className="w-4 h-4 border-2 border-gray-500 border-t-transparent rounded-full animate-spin" />
                    : '☑'}
                  Track as Applied
                </button>
              )
            )}

            {/* Apply externally */}
            <a
              href={job.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-2 text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white py-3 px-6 rounded-xl transition-colors"
            >
              Apply on Original Site <ExternalLink size={15} />
            </a>
          </div>
          <p className="text-xs text-gray-400 mt-3 text-center">
            Link opens the employer&apos;s original job posting. If it no longer works, the role may have been filled.
          </p>
        </div>

        {/* Browse more */}
        <div className="mt-6 text-center">
          <Link href="/opportunities" className="text-sm text-gray-500 hover:text-red-600 transition-colors">
            ← Browse more opportunities
          </Link>
        </div>

      </div>
    </div>
  )
}
