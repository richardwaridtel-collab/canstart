'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import {
  Briefcase, ArrowLeft, CheckCircle2, Circle, Clock,
  ChevronRight, MapPin, Building2, CalendarDays, XCircle,
} from 'lucide-react'

// ── Stage definitions ─────────────────────────────────────────────────────────

// All internal pipeline stages (kept for type safety & history mapping)
const ALL_STAGE_KEYS = ['applied','reviewing','shortlisted','assessment','interview','offer','hired','rejected'] as const
type StageName = typeof ALL_STAGE_KEYS[number]

// Candidate-visible stepper stages — internal employer stages are intentionally hidden
const CANDIDATE_STAGES = [
  { key: 'applied',   label: 'Applied',        color: 'blue'    },
  { key: 'interview', label: 'Interview',      color: 'indigo'  },
  { key: 'offer',     label: 'Offer Extended', color: 'green'   },
  { key: 'hired',     label: 'Hired',          color: 'emerald' },
] as const

// Map any internal stage → candidate-facing label & color for the status badge
function getCandidateBadge(pipelineStage: string): { label: string; color: string } {
  switch (pipelineStage) {
    case 'applied':
    case 'reviewing':
    case 'shortlisted':
    case 'assessment':
      return { label: 'Application Received', color: 'blue' }
    case 'interview': return { label: 'Interview',       color: 'indigo'  }
    case 'offer':     return { label: 'Offer Extended',  color: 'green'   }
    case 'hired':     return { label: 'Hired!',          color: 'emerald' }
    case 'rejected':  return { label: 'Not Selected',    color: 'red'     }
    default:          return { label: 'Application Received', color: 'blue' }
  }
}

// Map pipeline stage to which CANDIDATE_STAGES step index is "current"
function getCandidateStepIdx(pipelineStage: string): number {
  if (['applied','reviewing','shortlisted','assessment'].includes(pipelineStage)) return 0
  if (pipelineStage === 'interview') return 1
  if (pipelineStage === 'offer')     return 2
  if (pipelineStage === 'hired')     return 3
  return 0
}

type Application = {
  id: string
  pipeline_stage: StageName
  interview_stage: string | null
  stage_history: { stage: string; at: string }[]
  stage_updated_at: string
  created_at: string
  opportunity: {
    id: string
    title: string
    type: string
    city?: string
    company_name?: string
  } | null
}

const INTERVIEW_SUB_STAGES: Record<string, string> = {
  initial_interview:          'Initial Interview',
  hiring_manager_interview:   'Hiring Manager Interview',
  final_interview:            'Final Interview',
}

// ── Color helpers ─────────────────────────────────────────────────────────────

const STAGE_COLORS: Record<string, { bg: string; text: string; ring: string; dot: string }> = {
  blue:    { bg: 'bg-blue-50',    text: 'text-blue-700',    ring: 'ring-blue-400',    dot: 'bg-blue-400' },
  yellow:  { bg: 'bg-yellow-50',  text: 'text-yellow-700',  ring: 'ring-yellow-400',  dot: 'bg-yellow-400' },
  purple:  { bg: 'bg-purple-50',  text: 'text-purple-700',  ring: 'ring-purple-400',  dot: 'bg-purple-400' },
  orange:  { bg: 'bg-orange-50',  text: 'text-orange-700',  ring: 'ring-orange-400',  dot: 'bg-orange-400' },
  indigo:  { bg: 'bg-indigo-50',  text: 'text-indigo-700',  ring: 'ring-indigo-400',  dot: 'bg-indigo-400' },
  green:   { bg: 'bg-green-50',   text: 'text-green-700',   ring: 'ring-green-400',   dot: 'bg-green-400' },
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700', ring: 'ring-emerald-400', dot: 'bg-emerald-400' },
  red:     { bg: 'bg-red-50',     text: 'text-red-700',     ring: 'ring-red-400',     dot: 'bg-red-400' },
}

// ── Stepper component ─────────────────────────────────────────────────────────

function ApplicationStepper({ app }: { app: Application }) {
  const isRejected = app.pipeline_stage === 'rejected'
  const candidateStepIdx = getCandidateStepIdx(app.pipeline_stage)
  const badge = getCandidateBadge(app.pipeline_stage)
  const badgeColors = STAGE_COLORS[badge.color]

  // Interview date from history (used below stepper)
  const historyMap = new Map(app.stage_history.map(h => [h.stage, h.at]))
  const interviewDate = historyMap.get('interview')

  return (
    <div>
      {/* Current status badge */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${badgeColors.bg} ${badgeColors.text}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${badgeColors.dot}`} />
          {badge.label}
          {app.stage_updated_at && (
            <span className="opacity-60 font-normal ml-1">
              · {new Date(app.stage_updated_at).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}
            </span>
          )}
        </div>
        {/* Interview sub-stage badge — only visible when in interview stage */}
        {app.pipeline_stage === 'interview' && app.interview_stage && INTERVIEW_SUB_STAGES[app.interview_stage] && (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-600 text-white">
            <ChevronRight size={10} />
            {INTERVIEW_SUB_STAGES[app.interview_stage]}
          </span>
        )}
      </div>

      {/* Rejection notice */}
      {isRejected && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl p-3 mb-3">
          <XCircle size={16} />
          <span>This application was not selected. Keep applying — the right opportunity is out there!</span>
        </div>
      )}

      {/* Candidate-facing stepper — hides internal employer stages */}
      {!isRejected && (
        <div className="overflow-x-auto">
          <div className="flex items-center min-w-max gap-0">
            {CANDIDATE_STAGES.map((stage, idx) => {
              const isCurrent = idx === candidateStepIdx
              const isPast    = idx < candidateStepIdx
              const c = STAGE_COLORS[stage.color]
              // Show interview date under the Interview node
              const nodeDate = stage.key === 'interview' ? interviewDate : undefined

              return (
                <div key={stage.key} className="flex items-center">
                  <div className="flex flex-col items-center gap-1" style={{ minWidth: 72 }}>
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ring-2 transition-all ${
                        isCurrent
                          ? `${c.bg} ${c.text} ${c.ring}`
                          : isPast
                          ? 'bg-green-100 text-green-700 ring-green-400'
                          : 'bg-gray-100 text-gray-400 ring-gray-200'
                      }`}
                    >
                      {isCurrent ? (
                        <span className={`w-2.5 h-2.5 rounded-full ${c.dot}`} />
                      ) : isPast ? (
                        <CheckCircle2 size={13} />
                      ) : (
                        <Circle size={13} />
                      )}
                    </div>
                    <span className={`text-[10px] font-medium text-center leading-tight ${
                      isCurrent ? c.text : isPast ? 'text-green-700' : 'text-gray-400'
                    }`} style={{ maxWidth: 64 }}>
                      {stage.label}
                    </span>
                    {nodeDate && (
                      <span className="text-[9px] text-gray-400">
                        {new Date(nodeDate).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}
                      </span>
                    )}
                  </div>

                  {/* Connector */}
                  {idx < CANDIDATE_STAGES.length - 1 && (
                    <div className={`h-0.5 w-6 mb-5 transition-colors ${
                      idx < candidateStepIdx ? 'bg-green-300' : 'bg-gray-200'
                    }`} />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Next-step hint — only show if in interview stage or beyond (not for pre-interview waiting) */}
      {!isRejected && candidateStepIdx < CANDIDATE_STAGES.length - 1 && candidateStepIdx > 0 && (
        (() => {
          const next = CANDIDATE_STAGES[candidateStepIdx + 1]
          if (!next) return null
          const nc = STAGE_COLORS[next.color]
          return (
            <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
              Next step: <span className={`font-semibold ${nc.text}`}>{next.label}</span>
            </p>
          )
        })()
      )}

      {/* History timeline — only shows interview-stage-onward entries */}
      {(() => {
        const visibleHistory = [...app.stage_history]
          .filter(h => ['interview','offer','hired'].includes(h.stage))
          .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
        if (visibleHistory.length === 0) return null
        return (
          <details className="mt-3">
            <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600 select-none flex items-center gap-1">
              <Clock size={11} /> View timeline
            </summary>
            <div className="mt-2 pl-3 border-l-2 border-gray-100 space-y-1">
              {visibleHistory.map((h, i) => {
                const badge2 = getCandidateBadge(h.stage)
                const sc = STAGE_COLORS[badge2.color]
                return (
                  <div key={i} className="flex items-center gap-2 text-xs text-gray-500">
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${sc.dot}`} />
                    <span className={`font-medium ${sc.text}`}>{badge2.label}</span>
                    <span className="text-gray-400">{new Date(h.at).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  </div>
                )
              })}
            </div>
          </details>
        )
      })()}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function MyApplicationsPage() {
  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)

      const { data } = await supabase
        .from('applications')
        .select(`
          id,
          pipeline_stage,
          interview_stage,
          stage_history,
          stage_updated_at,
          created_at,
          opportunities (
            id, title, type, city, employer_id
          )
        `)
        .eq('seeker_id', user.id)
        .order('created_at', { ascending: false })

      // Fetch company names separately — nested employer_profiles join fails
      // because employer_profiles.user_id has no FK relationship to opportunities.employer_id
      const employerIds = [...new Set(
        (data || []).map((row: Record<string, unknown>) => {
          const opp = Array.isArray(row.opportunities) ? row.opportunities[0] : row.opportunities
          return (opp as Record<string, unknown>)?.employer_id as string
        }).filter(Boolean)
      )]
      const companyMap = new Map<string, string>()
      if (employerIds.length > 0) {
        const { data: profiles } = await supabase
          .from('employer_profiles')
          .select('user_id, company_name')
          .in('user_id', employerIds)
        ;(profiles || []).forEach((p: Record<string, unknown>) => {
          companyMap.set(p.user_id as string, p.company_name as string)
        })
      }

      const mapped: Application[] = (data || []).map((row: Record<string, unknown>) => {
        const opp = Array.isArray(row.opportunities) ? row.opportunities[0] : row.opportunities
        const employerId = (opp as Record<string, unknown>)?.employer_id as string
        return {
          id: row.id as string,
          pipeline_stage: (row.pipeline_stage ?? 'applied') as StageName,
          interview_stage: (row.interview_stage as string | null) ?? null,
          stage_history: (row.stage_history ?? []) as { stage: string; at: string }[],
          stage_updated_at: row.stage_updated_at as string,
          created_at: row.created_at as string,
          opportunity: opp ? {
            id: (opp as Record<string, unknown>).id as string,
            title: (opp as Record<string, unknown>).title as string,
            type: (opp as Record<string, unknown>).type as string,
            city: (opp as Record<string, unknown>).city as string | undefined,
            company_name: companyMap.get(employerId),
          } : null,
        }
      })
      setApplications(mapped)
      setLoading(false)
    }
    load()
  }, [])

  const stats = {
    total: applications.length,
    active: applications.filter(a => !['hired', 'rejected'].includes(a.pipeline_stage)).length,
    interviews: applications.filter(a => a.pipeline_stage === 'interview').length,
    offers: applications.filter(a => ['offer', 'hired'].includes(a.pipeline_stage)).length,
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (!userId) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <p className="text-gray-500 mb-4">Please sign in to view your applications.</p>
        <Link href="/auth/signin" className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium">Sign In</Link>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="mb-8">
          <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4">
            <ArrowLeft size={14} /> Back to Dashboard
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">My Applications</h1>
          <p className="text-gray-500 text-sm mt-1">Track your application progress for each opportunity</p>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {[
            { label: 'Total Applied',  value: stats.total,      color: 'text-gray-900' },
            { label: 'In Progress',    value: stats.active,     color: 'text-blue-600' },
            { label: 'Interviews',     value: stats.interviews, color: 'text-indigo-600' },
            { label: 'Offers',         value: stats.offers,     color: 'text-green-600' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4 text-center">
              <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-xs text-gray-500 mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Applications list */}
        {applications.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
            <Briefcase size={40} className="mx-auto text-gray-300 mb-3" />
            <h3 className="font-semibold text-gray-700 mb-1">No applications yet</h3>
            <p className="text-sm text-gray-500 mb-4">Start applying to opportunities to track your progress here.</p>
            <Link href="/opportunities" className="bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-5 py-2 rounded-lg inline-flex items-center gap-2 transition-colors">
              Browse Opportunities <ChevronRight size={14} />
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {applications.map(app => {
              const job = app.opportunity
              if (!job) return null
              const company = job.company_name

              return (
                <div key={app.id} className="bg-white rounded-2xl border border-gray-200 p-6 hover:border-gray-300 transition-colors">
                  {/* Job info header */}
                  <div className="flex items-start justify-between gap-4 mb-5">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center flex-shrink-0">
                        <Building2 size={18} className="text-red-500" />
                      </div>
                      <div className="min-w-0">
                        <h2 className="font-bold text-gray-900 text-base truncate">{job.title}</h2>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-gray-500 mt-0.5">
                          {company && <span className="flex items-center gap-1"><Building2 size={11} />{company}</span>}
                          {job.city && <span className="flex items-center gap-1"><MapPin size={11} />{job.city}</span>}
                          <span className="flex items-center gap-1 capitalize"><Briefcase size={11} />{job.type?.replace(/-/g, ' ')}</span>
                          <span className="flex items-center gap-1"><CalendarDays size={11} />Applied {new Date(app.created_at).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                        </div>
                      </div>
                    </div>
                    <Link
                      href={`/opportunities/${job.id}`}
                      className="flex-shrink-0 text-xs text-gray-400 hover:text-red-600 flex items-center gap-1 transition-colors"
                    >
                      View job <ChevronRight size={12} />
                    </Link>
                  </div>

                  {/* Progress stepper */}
                  <ApplicationStepper app={app} />
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
