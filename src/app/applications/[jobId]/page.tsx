'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import {
  ArrowLeft, MapPin, Globe, Briefcase, Download, ExternalLink,
  Users, ChevronRight, ChevronLeft, Pencil, Check, X, XCircle, Circle,
  BookmarkPlus, BookmarkCheck, Tag, ChevronDown, ChevronUp,
  MessageSquare, CalendarPlus, Lock,
} from 'lucide-react'

// ── Interview sub-stages ──────────────────────────────────────────────────────

const INTERVIEW_SUB_STAGES = [
  { key: 'initial_interview',        label: 'Initial Interview',          color: 'text-blue-700',   bg: 'bg-blue-50',   border: 'border-blue-200',   active: 'bg-blue-600'   },
  { key: 'hiring_manager_interview', label: 'Hiring Manager Interview',   color: 'text-indigo-700', bg: 'bg-indigo-50', border: 'border-indigo-200', active: 'bg-indigo-600' },
  { key: 'final_interview',          label: 'Final Interview',            color: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-200', active: 'bg-purple-600' },
]

// ── Types ─────────────────────────────────────────────────────────────────────

type PipelineStage =
  | 'applied' | 'reviewing' | 'shortlisted' | 'assessment'
  | 'interview' | 'offer' | 'hired' | 'rejected'

type Applicant = {
  id: string
  pipeline_stage: PipelineStage
  stage_notes: Record<string, string>   // per-stage private notes
  tags: string[]
  cover_note?: string
  created_at: string
  stage_updated_at?: string
  stage_history: { stage: string; at: string }[]
  interview_stage: string | null
  seeker_id: string
  full_name: string
  city?: string
  country_of_origin?: string
  immigration_status?: string
  skills: string[]
  education?: string
  bio?: string
  linkedin_url?: string
  resume_path?: string
  work_preference?: string
  inPool?: boolean
}

type Job = { id: string; title: string; type: string; city: string; company_name?: string }

// ── Stages ────────────────────────────────────────────────────────────────────

const STAGES: {
  key: PipelineStage
  label: string
  description: string
  color: string; bg: string; border: string; headerBg: string; dot: string
}[] = [
  { key: 'applied',     label: 'Applied',        description: 'Application received',      color: 'text-gray-700',    bg: 'bg-gray-50',     border: 'border-gray-200',   headerBg: 'bg-gray-100',    dot: 'bg-gray-400'    },
  { key: 'reviewing',   label: 'Under Review',   description: 'Employer is reviewing',     color: 'text-blue-700',    bg: 'bg-blue-50',     border: 'border-blue-200',   headerBg: 'bg-blue-100',    dot: 'bg-blue-500'    },
  { key: 'shortlisted', label: 'Shortlisted',    description: 'Selected for next steps',   color: 'text-indigo-700',  bg: 'bg-indigo-50',   border: 'border-indigo-200', headerBg: 'bg-indigo-100',  dot: 'bg-indigo-500'  },
  { key: 'assessment',  label: 'Assessment',     description: 'Skills test / assignment',  color: 'text-amber-700',   bg: 'bg-amber-50',    border: 'border-amber-200',  headerBg: 'bg-amber-100',   dot: 'bg-amber-500'   },
  { key: 'interview',   label: 'Interview',      description: 'Interview stage',           color: 'text-purple-700',  bg: 'bg-purple-50',   border: 'border-purple-200', headerBg: 'bg-purple-100',  dot: 'bg-purple-500'  },
  { key: 'offer',       label: 'Offer Extended', description: 'Job offer sent',            color: 'text-orange-700',  bg: 'bg-orange-50',   border: 'border-orange-200', headerBg: 'bg-orange-100',  dot: 'bg-orange-500'  },
  { key: 'hired',       label: 'Hired',          description: 'Offer accepted',            color: 'text-green-700',   bg: 'bg-green-50',    border: 'border-green-200',  headerBg: 'bg-green-100',   dot: 'bg-green-500'   },
  { key: 'rejected',    label: 'Not Selected',   description: 'Application closed',        color: 'text-red-600',     bg: 'bg-red-50',      border: 'border-red-200',    headerBg: 'bg-red-100',     dot: 'bg-red-400'     },
]

const STAGE_MAP = Object.fromEntries(STAGES.map((s, i) => [s.key, i])) as Record<PipelineStage, number>

const STAGE_TO_STATUS: Record<PipelineStage, string> = {
  applied:     'pending',
  reviewing:   'pending',
  shortlisted: 'reviewed',
  assessment:  'reviewed',
  interview:   'reviewed',
  offer:       'reviewed',
  hired:       'accepted',
  rejected:    'rejected',
}

const PREDEFINED_TAGS = ['Top Pick', 'Strong Fit', 'Culture Fit', 'Follow Up', 'Technical Interview', 'On Hold', 'Needs Experience']
const IMMIGRATION_LABELS: Record<string, string> = { owp: 'Open Work Permit', pr: 'Permanent Resident', student: 'Study Permit', citizen: 'Citizen' }
const MODE_LABELS: Record<string, string> = { remote: 'Remote', hybrid: 'Hybrid', onsite: 'On-site', any: 'Any' }

const TAG_COLORS: Record<string, string> = {
  'Top Pick':            'bg-yellow-100 text-yellow-700 border-yellow-300',
  'Strong Fit':          'bg-green-100 text-green-700 border-green-300',
  'Culture Fit':         'bg-teal-100 text-teal-700 border-teal-300',
  'Follow Up':           'bg-blue-100 text-blue-700 border-blue-300',
  'Technical Interview': 'bg-purple-100 text-purple-700 border-purple-300',
  'On Hold':             'bg-gray-100 text-gray-600 border-gray-300',
  'Needs Experience':    'bg-orange-100 text-orange-700 border-orange-300',
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function PipelinePage() {
  const params  = useParams()
  const router  = useRouter()
  const jobId   = params.jobId as string

  const [job, setJob]           = useState<Job | null>(null)
  const [applicants, setApps]   = useState<Applicant[]>([])
  const [loading, setLoading]   = useState(true)
  const [movingId, setMoving]   = useState<string | null>(null)
  const [savingNotes, setSaving]= useState<string | null>(null)
  const [editingNotes, setEditing] = useState<{ appId: string; stage: string } | null>(null)
  const [noteDraft, setDraft]   = useState('')
  const [downloadingId, setDL]  = useState<string | null>(null)
  const [showRejected, setShowR]= useState(false)
  const [expandedCards, setExp] = useState<Set<string>>(new Set())
  const [poolLoadingId, setPool]= useState<string | null>(null)
  const [empId, setEmpId]       = useState<string | null>(null)
  const [messagingId, setMsg]   = useState<string | null>(null)
  const [settingInterviewId, setSettingInterview] = useState<string | null>(null)

  useEffect(() => { checkAuth() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth/signin'); return }
    const { data: p } = await supabase.from('profiles').select('role').eq('user_id', user.id).single()
    if (p?.role !== 'employer') { router.push('/dashboard'); return }
    setEmpId(user.id)
    await loadData(user.id)
    setLoading(false)
  }

  const loadData = async (employerId: string) => {
    const { data: jobData } = await supabase
      .from('opportunities')
      .select('id, title, type, city')
      .eq('id', jobId).eq('employer_id', employerId).single()
    if (!jobData) { router.push('/dashboard'); return }

    const { data: empProfile } = await supabase
      .from('employer_profiles')
      .select('company_name')
      .eq('user_id', employerId)
      .single()

    setJob({
      id: jobData.id, title: jobData.title, type: jobData.type, city: jobData.city,
      company_name: empProfile?.company_name ?? undefined,
    })

    const { data: apps } = await supabase
      .from('applications')
      .select('id, status, pipeline_stage, stage_notes, tags, cover_note, created_at, stage_updated_at, stage_history, seeker_id, interview_stage')
      .eq('opportunity_id', jobId)
      .order('created_at', { ascending: false })
    if (!apps?.length) { setApps([]); return }

    const seekerIds = apps.map(a => a.seeker_id as string)
    const [{ data: profiles }, { data: spData }, { data: poolData }] = await Promise.all([
      supabase.from('profiles').select('user_id, full_name, city').in('user_id', seekerIds),
      supabase.from('seeker_profiles').select('*').in('user_id', seekerIds),
      supabase.from('talent_pool').select('seeker_id').eq('employer_id', employerId).in('seeker_id', seekerIds),
    ])

    const pm  = new Map((profiles || []).map(p => [p.user_id as string, p]))
    const sm  = new Map((spData   || []).map(s => [s.user_id as string, s]))
    const poolSet = new Set((poolData || []).map(p => p.seeker_id as string))

    setApps(apps.map(a => {
      const p = pm.get(a.seeker_id as string)
      const s = sm.get(a.seeker_id as string)
      const rawStage = a.pipeline_stage as string | null
      let stage: PipelineStage = 'applied'
      if (rawStage && STAGE_MAP[rawStage as PipelineStage] !== undefined) {
        stage = rawStage as PipelineStage
      } else {
        const st = a.status as string
        if (st === 'accepted') stage = 'hired'
        else if (st === 'rejected') stage = 'rejected'
        else if (st === 'reviewed') stage = 'shortlisted'
      }

      // Normalise stage_notes — could be null or {}
      const rawNotes = a.stage_notes
      const stageNotes: Record<string, string> =
        rawNotes && typeof rawNotes === 'object' && !Array.isArray(rawNotes)
          ? (rawNotes as Record<string, string>)
          : {}

      // Normalise stage_history
      const rawHist = a.stage_history
      const history: { stage: string; at: string }[] =
        Array.isArray(rawHist) ? (rawHist as { stage: string; at: string }[]) :
        [{ stage: 'applied', at: a.created_at as string }]

      return {
        id:                a.id as string,
        pipeline_stage:    stage,
        stage_notes:       stageNotes,
        tags:              (a.tags as string[]) || [],
        cover_note:        a.cover_note as string | undefined,
        created_at:        a.created_at as string,
        stage_updated_at:  a.stage_updated_at as string | undefined,
        stage_history:     history,
        interview_stage:   (a.interview_stage as string | null) ?? null,
        seeker_id:         a.seeker_id as string,
        full_name:         (p?.full_name as string) || 'Unknown',
        city:              p?.city as string | undefined,
        country_of_origin: s?.country_of_origin as string | undefined,
        immigration_status:s?.immigration_status as string | undefined,
        skills:            Array.isArray(s?.skills) ? (s.skills as string[]) : [],
        education:         s?.education as string | undefined,
        bio:               s?.bio as string | undefined,
        linkedin_url:      s?.linkedin_url as string | undefined,
        resume_path:       s?.resume_path as string | undefined,
        work_preference:   s?.work_preference as string | undefined,
        inPool:            poolSet.has(a.seeker_id as string),
      }
    }))
  }

  // Move stage + record in history
  const moveStage = async (appId: string, newStage: PipelineStage) => {
    setMoving(appId)
    const app = applicants.find(a => a.id === appId)
    if (!app) { setMoving(null); return }

    // Append to history if not already there
    const alreadyRecorded = app.stage_history.some(h => h.stage === newStage)
    const newHistory = alreadyRecorded
      ? app.stage_history
      : [...app.stage_history, { stage: newStage, at: new Date().toISOString() }]

    await supabase.from('applications').update({
      pipeline_stage:   newStage,
      status:           STAGE_TO_STATUS[newStage],
      stage_updated_at: new Date().toISOString(),
      stage_history:    newHistory,
    }).eq('id', appId)

    setApps(prev => prev.map(a =>
      a.id === appId ? { ...a, pipeline_stage: newStage, stage_history: newHistory } : a
    ))
    setMoving(null)
  }

  // Set interview sub-stage
  const setInterviewStage = async (appId: string, stage: string) => {
    setSettingInterview(appId)
    const newStage = stage || null
    await supabase.from('applications').update({ interview_stage: newStage }).eq('id', appId)
    setApps(prev => prev.map(a => a.id === appId ? { ...a, interview_stage: newStage } : a))
    setSettingInterview(null)
  }

  // Save per-stage note
  const saveStageNote = async (appId: string, stage: string, note: string) => {
    setSaving(appId)
    const app = applicants.find(a => a.id === appId)
    if (!app) { setSaving(null); return }
    const updatedNotes = { ...app.stage_notes, [stage]: note }
    await supabase.from('applications').update({ stage_notes: updatedNotes }).eq('id', appId)
    setApps(prev => prev.map(a => a.id === appId ? { ...a, stage_notes: updatedNotes } : a))
    setEditing(null)
    setSaving(null)
  }

  const toggleTag = async (appId: string, tag: string, currentTags: string[]) => {
    const newTags = currentTags.includes(tag) ? currentTags.filter(t => t !== tag) : [...currentTags, tag]
    await supabase.from('applications').update({ tags: newTags }).eq('id', appId)
    setApps(prev => prev.map(a => a.id === appId ? { ...a, tags: newTags } : a))
  }

  const startConversation = async (seekerId: string) => {
    if (!empId) return
    setMsg(seekerId)
    const { data: existing } = await supabase.from('conversations').select('id')
      .eq('employer_id', empId).eq('seeker_id', seekerId).eq('opportunity_id', jobId).maybeSingle()
    if (existing) { router.push(`/messages/${existing.id}`); return }
    const { data: created } = await supabase.from('conversations')
      .insert({ employer_id: empId, seeker_id: seekerId, opportunity_id: jobId })
      .select('id').single()
    setMsg(null)
    if (created) router.push(`/messages/${created.id}`)
  }

  const togglePool = async (seekerId: string, inPool: boolean) => {
    if (!empId) return
    setPool(seekerId)
    if (inPool) {
      await supabase.from('talent_pool').delete().eq('employer_id', empId).eq('seeker_id', seekerId)
    } else {
      await supabase.from('talent_pool').insert({ employer_id: empId, seeker_id: seekerId })
    }
    setApps(prev => prev.map(a => a.seeker_id === seekerId ? { ...a, inPool: !inPool } : a))
    setPool(null)
  }

  const downloadResume = async (path: string, seekerId: string) => {
    setDL(seekerId)
    const { data } = await supabase.storage.from('candidate-documents').createSignedUrl(path, 3600)
    setDL(null)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  const toggleExpand = (id: string) => {
    setExp(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  const visibleStages = showRejected ? STAGES : STAGES.filter(s => s.key !== 'rejected')
  const rejectedCount = applicants.filter(a => a.pipeline_stage === 'rejected').length

  if (loading) return (
    <div className="max-w-full px-4 py-10 animate-pulse space-y-4">
      <div className="h-8 bg-gray-200 rounded w-1/3" />
      <div className="h-48 bg-gray-100 rounded-xl" />
    </div>
  )

  return (
    <div className="bg-gray-50 min-h-screen py-8">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-4 mb-6 flex-wrap">
          <Link href="/dashboard" className="inline-flex items-center gap-2 text-gray-500 hover:text-red-600 text-sm transition-colors">
            <ArrowLeft size={16} /> Dashboard
          </Link>
          <Link href="/talent-pool" className="inline-flex items-center gap-2 text-sm text-purple-600 hover:text-purple-700 font-medium ml-auto">
            <BookmarkCheck size={16} /> Talent Pool
          </Link>
        </div>

        {job && (
          <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-6 flex items-start justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-xl font-bold text-gray-900">{job.title}</h1>
              <p className="text-sm text-gray-500 mt-1 flex items-center gap-3">
                <span className="flex items-center gap-1"><MapPin size={13} />{job.city}</span>
                <span className="capitalize">{job.type.replace('-', ' ')}</span>
              </p>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-xl">
                <Users size={16} className="text-gray-400" />
                <span className="text-sm font-semibold text-gray-700">{applicants.length} applicant{applicants.length !== 1 ? 's' : ''}</span>
              </div>
              {rejectedCount > 0 && (
                <button
                  onClick={() => setShowR(!showRejected)}
                  className={`text-xs px-3 py-2 rounded-xl border transition-colors ${showRejected ? 'bg-red-50 border-red-200 text-red-600' : 'bg-white border-gray-200 text-gray-500 hover:border-gray-400'}`}
                >
                  {showRejected ? 'Hide Not Selected' : `Not Selected (${rejectedCount})`}
                </button>
              )}
            </div>
          </div>
        )}

        {applicants.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-16 text-center">
            <Users size={40} className="mx-auto text-gray-300 mb-3" />
            <h3 className="font-semibold text-gray-700 mb-1">No applications yet</h3>
            <p className="text-sm text-gray-400">Applications will appear here as candidates apply.</p>
          </div>
        ) : (
          <div className="overflow-x-auto pb-6">
            <div className="flex gap-4" style={{ minWidth: `${visibleStages.length * 300 + (visibleStages.length - 1) * 16}px` }}>
              {visibleStages.map(stage => {
                const cols = applicants.filter(a => a.pipeline_stage === stage.key)
                return (
                  <div key={stage.key} className={`w-[288px] flex-shrink-0 rounded-2xl border ${stage.border} flex flex-col overflow-hidden`}>
                    <div className={`${stage.headerBg} px-4 py-3 flex items-center justify-between flex-shrink-0`}>
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${stage.dot}`} />
                        <div>
                          <span className={`font-semibold text-sm ${stage.color}`}>{stage.label}</span>
                          <p className="text-xs text-gray-400 leading-tight">{stage.description}</p>
                        </div>
                      </div>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full bg-white/60 ${stage.color}`}>{cols.length}</span>
                    </div>
                    <div className={`${stage.bg} p-2.5 space-y-2.5 flex-1`}>
                      {cols.length === 0 && <p className="text-center text-xs text-gray-400 py-6">No candidates</p>}
                      {cols.map(app => (
                        <CandidateCard
                          key={app.id}
                          app={app}
                          stage={stage}
                          stageIdx={STAGE_MAP[app.pipeline_stage]}
                          moving={movingId === app.id}
                          editingNotes={editingNotes?.appId === app.id ? editingNotes.stage : null}
                          savingNotes={savingNotes === app.id}
                          noteDraft={noteDraft}
                          downloadingResume={downloadingId === app.seeker_id}
                          poolLoading={poolLoadingId === app.seeker_id}
                          expanded={expandedCards.has(app.id)}
                          onToggleExpand={() => toggleExpand(app.id)}
                          onMove={moveStage}
                          onEditNotes={(stage) => { setEditing({ appId: app.id, stage }); setDraft(app.stage_notes[stage] || '') }}
                          onCancelNotes={() => setEditing(null)}
                          onNoteDraftChange={setDraft}
                          onSaveNotes={(stage) => saveStageNote(app.id, stage, noteDraft)}
                          onToggleTag={(tag) => toggleTag(app.id, tag, app.tags)}
                          onDownloadResume={() => downloadResume(app.resume_path!, app.seeker_id)}
                          onTogglePool={() => togglePool(app.seeker_id, !!app.inPool)}
                          onMessage={() => startConversation(app.seeker_id)}
                          messagingLoading={messagingId === app.seeker_id}
                          interviewStage={app.interview_stage}
                          settingInterviewStage={settingInterviewId === app.id}
                          onSetInterviewStage={(stage) => setInterviewStage(app.id, stage)}
                          scheduleUrl={`/interviews/new?seekerId=${app.seeker_id}&seekerName=${encodeURIComponent(app.full_name)}&appId=${app.id}&oppId=${jobId}&oppTitle=${encodeURIComponent(job?.title || '')}`}
                          predefinedTags={PREDEFINED_TAGS}
                          tagColors={TAG_COLORS}
                          immigrationLabels={IMMIGRATION_LABELS}
                          modeLabels={MODE_LABELS}
                          stages={STAGES}
                        />
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Candidate Card ─────────────────────────────────────────────────────────────

type CardProps = {
  app: Applicant
  stage: typeof STAGES[number]
  stageIdx: number
  moving: boolean
  editingNotes: string | null   // which stage is being edited, or null
  savingNotes: boolean
  noteDraft: string
  downloadingResume: boolean
  poolLoading: boolean
  expanded: boolean
  onToggleExpand: () => void
  onMove: (id: string, stage: PipelineStage) => void
  onEditNotes: (stage: string) => void
  onCancelNotes: () => void
  onNoteDraftChange: (val: string) => void
  onSaveNotes: (stage: string) => void
  onToggleTag: (tag: string) => void
  onDownloadResume: () => void
  onTogglePool: () => void
  onMessage: () => void
  messagingLoading: boolean
  interviewStage: string | null
  settingInterviewStage: boolean
  onSetInterviewStage: (stage: string) => void
  scheduleUrl: string
  predefinedTags: string[]
  tagColors: Record<string, string>
  immigrationLabels: Record<string, string>
  modeLabels: Record<string, string>
  stages: typeof STAGES
}

function CandidateCard({
  app, stage, stageIdx, moving, editingNotes, savingNotes,
  noteDraft, downloadingResume, poolLoading, expanded, onToggleExpand,
  onMove, onEditNotes, onCancelNotes, onNoteDraftChange, onSaveNotes,
  onToggleTag, onDownloadResume, onTogglePool, onMessage, messagingLoading,
  interviewStage, settingInterviewStage, onSetInterviewStage,
  scheduleUrl, predefinedTags, tagColors, immigrationLabels, modeLabels, stages,
}: CardProps) {
  const [showTagPicker, setShowTagPicker] = useState(false)

  const prevStage = stageIdx > 0 ? stages[stageIdx - 1] : null
  const nextStage = stageIdx < stages.length - 1 ? stages[stageIdx + 1] : null
  const canGoForward = nextStage && app.pipeline_stage !== 'hired'
  const canGoBack    = prevStage && app.pipeline_stage !== 'applied'

  // Stages that have notes saved
  const stagesWithNotes = Object.entries(app.stage_notes).filter(([, v]) => v.trim())

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-3 pt-3 pb-2">
        <div className="flex items-start gap-2.5">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
            {app.full_name.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-1">
              <p className="font-semibold text-gray-900 text-sm leading-tight truncate">{app.full_name}</p>
              <button
                onClick={onTogglePool}
                disabled={poolLoading}
                className={`flex-shrink-0 p-1 rounded-lg transition-colors ${app.inPool ? 'text-purple-600 hover:text-purple-700' : 'text-gray-300 hover:text-purple-400'}`}
              >
                {poolLoading
                  ? <div className="w-3.5 h-3.5 border border-purple-400 border-t-transparent rounded-full animate-spin" />
                  : app.inPool ? <BookmarkCheck size={14} /> : <BookmarkPlus size={14} />}
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5 text-xs text-gray-500">
              {app.city && <span className="flex items-center gap-0.5"><MapPin size={10} />{app.city}</span>}
              {app.country_of_origin && <span className="flex items-center gap-0.5"><Globe size={10} />{app.country_of_origin}</span>}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-1 mt-2">
          {app.immigration_status && (
            <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
              {immigrationLabels[app.immigration_status] || app.immigration_status}
            </span>
          )}
          {app.work_preference && app.work_preference !== 'any' && (
            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full flex items-center gap-1">
              <Briefcase size={10} />{modeLabels[app.work_preference]}
            </span>
          )}
        </div>

        {/* Interview sub-stage badge (visible without expanding) */}
        {stage.key === 'interview' && interviewStage && (
          <div className="mt-2">
            {INTERVIEW_SUB_STAGES.filter(s => s.key === interviewStage).map(sub => (
              <span key={sub.key} className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium ${sub.bg} ${sub.color} ${sub.border}`}>
                <Check size={10} /> {sub.label}
              </span>
            ))}
          </div>
        )}

        {app.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {app.tags.map(tag => (
              <span key={tag} className={`text-xs px-2 py-0.5 rounded-full border font-medium ${tagColors[tag] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Expand toggle */}
      <button
        onClick={onToggleExpand}
        className="w-full flex items-center justify-between px-3 py-1.5 text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors border-t border-gray-100"
      >
        <span>{expanded ? 'Less detail' : 'More detail'}</span>
        {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-3 border-t border-gray-100 pt-2.5">

          {/* Skills */}
          {app.skills.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {app.skills.slice(0, 6).map(s => (
                <span key={s} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{s}</span>
              ))}
              {app.skills.length > 6 && <span className="text-xs text-gray-400">+{app.skills.length - 6}</span>}
            </div>
          )}

          {/* Cover note */}
          {app.cover_note && (
            <div className="bg-gray-50 rounded-lg p-2.5 border border-gray-100">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Cover Note</p>
              <p className="text-xs text-gray-700 leading-relaxed line-clamp-3">{app.cover_note}</p>
            </div>
          )}

          {/* ── Per-stage private notes ──────────────────────────────── */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <Lock size={11} className="text-amber-500" />
              <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Private Stage Notes</p>
              <span className="text-xs text-gray-400">(not visible to candidate)</span>
            </div>

            {/* Current stage note */}
            <div className={`rounded-lg p-2.5 border ${stage.border} ${stage.bg}`}>
              <div className="flex items-center justify-between mb-1.5">
                <span className={`text-xs font-semibold ${stage.color}`}>{stage.label} Stage</span>
                {editingNotes !== stage.key && (
                  <button onClick={() => onEditNotes(stage.key)} className={`${stage.color} opacity-60 hover:opacity-100 p-0.5 rounded transition-opacity`}>
                    <Pencil size={11} />
                  </button>
                )}
              </div>
              {editingNotes === stage.key ? (
                <div className="space-y-1.5">
                  <textarea
                    value={noteDraft}
                    onChange={e => onNoteDraftChange(e.target.value)}
                    rows={3}
                    placeholder={`Notes for ${stage.label} stage...`}
                    className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-amber-400 resize-none bg-white"
                    autoFocus
                  />
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => onSaveNotes(stage.key)}
                      disabled={savingNotes}
                      className="flex items-center gap-1 text-xs bg-amber-500 hover:bg-amber-600 text-white px-2.5 py-1 rounded-lg font-medium transition-colors disabled:opacity-60"
                    >
                      {savingNotes ? <div className="w-3 h-3 border border-white/40 border-t-white rounded-full animate-spin" /> : <Check size={11} />}
                      Save
                    </button>
                    <button onClick={onCancelNotes} className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1 rounded-lg">
                      <X size={11} />
                    </button>
                  </div>
                </div>
              ) : (
                <p className={`text-xs leading-relaxed ${app.stage_notes[stage.key] ? stage.color : 'text-gray-400 italic'}`}>
                  {app.stage_notes[stage.key] || `No notes for ${stage.label} stage yet.`}
                </p>
              )}
            </div>

            {/* Previous stage notes (read-only summary) */}
            {stagesWithNotes.filter(([s]) => s !== stage.key).length > 0 && (
              <div className="space-y-1">
                <p className="text-xs text-gray-400">Notes from previous stages:</p>
                {stagesWithNotes.filter(([s]) => s !== stage.key).map(([s, note]) => {
                  const stageInfo = stages.find(st => st.key === s)
                  return (
                    <div key={s} className="bg-gray-50 rounded-lg px-2.5 py-2 border border-gray-100">
                      <p className={`text-xs font-semibold mb-0.5 ${stageInfo?.color || 'text-gray-500'}`}>{stageInfo?.label || s}</p>
                      <p className="text-xs text-gray-600 leading-relaxed line-clamp-2">{note}</p>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Tag picker */}
          <div>
            <button
              onClick={() => setShowTagPicker(!showTagPicker)}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 transition-colors"
            >
              <Tag size={11} /> {showTagPicker ? 'Close tags' : 'Add / remove tags'}
            </button>
            {showTagPicker && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {predefinedTags.map(tag => {
                  const active = app.tags.includes(tag)
                  return (
                    <button
                      key={tag}
                      onClick={() => onToggleTag(tag)}
                      className={`text-xs px-2 py-0.5 rounded-full border font-medium transition-all ${
                        active ? tagColors[tag] || 'bg-gray-200 text-gray-700 border-gray-300' : 'bg-white text-gray-400 border-gray-200 hover:border-gray-400'
                      }`}
                    >
                      {active ? '✓ ' : '+ '}{tag}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* ── Interview Progress (interview stage only) ──────────── */}
          {stage.key === 'interview' && (
            <div className="rounded-xl border border-indigo-200 overflow-hidden">
              <div className="bg-indigo-100 px-3 py-2 flex items-center gap-1.5">
                <CalendarPlus size={12} className="text-indigo-600" />
                <p className="text-xs font-semibold text-indigo-700">Interview Progress</p>
              </div>

              {/* Sequential round tracker */}
              {(() => {
                const currentRoundIdx = INTERVIEW_SUB_STAGES.findIndex(s => s.key === interviewStage)
                const nextRound = currentRoundIdx === -1
                  ? INTERVIEW_SUB_STAGES[0]
                  : currentRoundIdx < INTERVIEW_SUB_STAGES.length - 1
                  ? INTERVIEW_SUB_STAGES[currentRoundIdx + 1]
                  : null

                return (
                  <>
                    <div className="p-2 space-y-1.5">
                      {INTERVIEW_SUB_STAGES.map((sub, idx) => {
                        const isCompleted = currentRoundIdx !== -1 && idx < currentRoundIdx
                        const isCurrent   = interviewStage === sub.key
                        const isUpcoming  = !isCompleted && !isCurrent

                        return (
                          <div
                            key={sub.key}
                            className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg border text-xs font-medium transition-colors ${
                              isCompleted ? 'bg-green-50 border-green-200' :
                              isCurrent   ? `${sub.active} border-transparent` :
                              'bg-gray-50 border-gray-200 opacity-50'
                            }`}
                          >
                            {isCompleted
                              ? <Check size={12} className="text-green-600 flex-shrink-0" />
                              : isCurrent
                              ? <span className="w-2.5 h-2.5 rounded-full border-2 border-white/60 bg-white/30 flex-shrink-0" />
                              : <Circle size={12} className="text-gray-300 flex-shrink-0" />}
                            <span className={
                              isCompleted ? 'text-green-700' :
                              isCurrent   ? 'text-white' :
                              'text-gray-400'
                            }>
                              {sub.label}
                            </span>
                            {isCompleted && <span className="ml-auto text-[10px] text-green-500 font-normal">Done</span>}
                            {isCurrent   && <span className="ml-auto text-[10px] text-white/70 font-normal">Active</span>}
                          </div>
                        )
                      })}
                    </div>

                    {/* Call for next round */}
                    {nextRound && (
                      <div className="px-2 pb-2">
                        <button
                          onClick={() => onSetInterviewStage(nextRound.key)}
                          disabled={settingInterviewStage}
                          className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-lg transition-colors disabled:opacity-50"
                        >
                          {settingInterviewStage
                            ? <div className="w-3 h-3 border border-white/40 border-t-white rounded-full animate-spin" />
                            : <><CalendarPlus size={11} /> Call for {nextRound.label}</>}
                        </button>
                      </div>
                    )}
                  </>
                )
              })()}

              {/* Outcome buttons */}
              <div className="px-2 pb-2 pt-1 border-t border-indigo-100 space-y-1">
                <p className="text-[10px] text-indigo-400 font-semibold uppercase tracking-wide px-0.5">Interview Outcome</p>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => onMove(app.id, 'rejected')}
                    disabled={moving}
                    className="flex-1 flex items-center justify-center gap-1 text-xs font-medium bg-red-50 hover:bg-red-100 text-red-700 px-2 py-1.5 rounded-lg border border-red-200 transition-colors disabled:opacity-50"
                  >
                    <XCircle size={11} /> Not Selected
                  </button>
                  <button
                    onClick={onTogglePool}
                    disabled={poolLoading}
                    className={`flex-1 flex items-center justify-center gap-1 text-xs font-medium px-2 py-1.5 rounded-lg border transition-colors disabled:opacity-50 ${
                      app.inPool
                        ? 'bg-purple-100 text-purple-700 border-purple-300'
                        : 'bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-200'
                    }`}
                  >
                    {poolLoading
                      ? <div className="w-3 h-3 border border-purple-400 border-t-transparent rounded-full animate-spin" />
                      : app.inPool ? <BookmarkCheck size={11} /> : <BookmarkPlus size={11} />}
                    {app.inPool ? 'In Pool' : 'Pool for Future'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={onMessage}
              disabled={messagingLoading}
              className="flex items-center gap-1 text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 px-2.5 py-1.5 rounded-full font-medium transition-colors disabled:opacity-50"
            >
              {messagingLoading ? <div className="w-3 h-3 border border-blue-400 border-t-transparent rounded-full animate-spin" /> : <MessageSquare size={11} />}
              Message
            </button>
            <Link
              href={scheduleUrl}
              className="flex items-center gap-1 text-xs bg-green-50 hover:bg-green-100 text-green-700 px-2.5 py-1.5 rounded-full font-medium transition-colors"
            >
              <CalendarPlus size={11} /> Schedule Interview
            </Link>
            {app.resume_path && (
              <button
                onClick={onDownloadResume}
                disabled={downloadingResume}
                className="flex items-center gap-1 text-xs bg-red-50 hover:bg-red-100 text-red-700 px-2.5 py-1.5 rounded-full font-medium transition-colors disabled:opacity-50"
              >
                {downloadingResume ? <div className="w-3 h-3 border border-red-400 border-t-transparent rounded-full animate-spin" /> : <Download size={11} />}
                Resume
              </button>
            )}
            {app.linkedin_url && (
              <a href={app.linkedin_url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs bg-gray-50 hover:bg-gray-100 text-gray-600 px-2.5 py-1.5 rounded-full font-medium transition-colors">
                <ExternalLink size={11} /> LinkedIn
              </a>
            )}
          </div>

          <p className="text-xs text-gray-400">Applied {new Date(app.created_at).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
        </div>
      )}

      {/* Stage navigation footer */}
      <div className="flex items-center justify-between px-2 py-1.5 bg-gray-50 border-t border-gray-100">
        {canGoBack ? (
          <button onClick={() => onMove(app.id, prevStage!.key)} disabled={moving}
            className="flex items-center gap-1 text-xs font-medium text-gray-400 hover:text-gray-700 hover:bg-gray-100 px-2 py-0.5 rounded-lg transition-colors disabled:opacity-40">
            <ChevronLeft size={12} /><span className="truncate max-w-[88px]">{prevStage!.label}</span>
          </button>
        ) : <div className="w-6" />}

        <select
          value={app.pipeline_stage}
          onChange={e => onMove(app.id, e.target.value as PipelineStage)}
          disabled={moving}
          className={`text-xs font-medium px-2 py-0.5 rounded-full border appearance-none text-center cursor-pointer focus:outline-none ${stage.color} ${stage.headerBg} ${stage.border} disabled:opacity-50`}
          style={{ backgroundImage: 'none' }}
        >
          {stages.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>

        {canGoForward ? (
          <button onClick={() => onMove(app.id, nextStage!.key)} disabled={moving}
            className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-green-700 hover:bg-green-50 px-2 py-0.5 rounded-lg transition-colors disabled:opacity-40">
            {moving
              ? <div className="w-3 h-3 border border-gray-400 border-t-transparent rounded-full animate-spin" />
              : <><span className="truncate max-w-[88px]">{nextStage!.label}</span><ChevronRight size={12} /></>}
          </button>
        ) : <div className="w-6" />}
      </div>

      {/* Call for Initial Interview — CTA at bottom of Interview cards with no round set yet */}
      {stage.key === 'interview' && !interviewStage && (
        <button
          onClick={() => onSetInterviewStage('initial_interview')}
          disabled={settingInterviewStage || moving}
          className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white py-2 transition-colors rounded-b-xl disabled:opacity-50"
        >
          {settingInterviewStage
            ? <div className="w-3 h-3 border border-white/40 border-t-white rounded-full animate-spin" />
            : <><CalendarPlus size={12} /> Call for Initial Interview</>}
        </button>
      )}
    </div>
  )
}
