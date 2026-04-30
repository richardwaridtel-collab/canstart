'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import {
  ArrowLeft, MapPin, Globe, Briefcase, Download, ExternalLink,
  Users, ChevronRight, ChevronLeft, Pencil, Check, X,
  BookmarkPlus, BookmarkCheck, Tag, ChevronDown, ChevronUp, MessageSquare,
} from 'lucide-react'

// ── Types ────────────────────────────────────────────────────────────────────

type PipelineStage = 'applied' | 'shortlisted' | 'interview' | 'offer' | 'hired' | 'rejected'

type Applicant = {
  id: string
  pipeline_stage: PipelineStage
  employer_notes: string
  tags: string[]
  cover_note?: string
  created_at: string
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

// ── Constants ─────────────────────────────────────────────────────────────────

const STAGES: {
  key: PipelineStage; label: string
  color: string; bg: string; border: string; headerBg: string; dot: string
}[] = [
  { key: 'applied',     label: 'Applied',     color: 'text-gray-700',   bg: 'bg-gray-50',    border: 'border-gray-200',  headerBg: 'bg-gray-100',   dot: 'bg-gray-400'   },
  { key: 'shortlisted', label: 'Shortlisted', color: 'text-blue-700',   bg: 'bg-blue-50',    border: 'border-blue-200',  headerBg: 'bg-blue-100',   dot: 'bg-blue-500'   },
  { key: 'interview',   label: 'Interview',   color: 'text-purple-700', bg: 'bg-purple-50',  border: 'border-purple-200',headerBg: 'bg-purple-100', dot: 'bg-purple-500' },
  { key: 'offer',       label: 'Offer Made',  color: 'text-amber-700',  bg: 'bg-amber-50',   border: 'border-amber-200', headerBg: 'bg-amber-100',  dot: 'bg-amber-500'  },
  { key: 'hired',       label: 'Hired',       color: 'text-green-700',  bg: 'bg-green-50',   border: 'border-green-200', headerBg: 'bg-green-100',  dot: 'bg-green-500'  },
  { key: 'rejected',    label: 'Rejected',    color: 'text-red-600',    bg: 'bg-red-50',     border: 'border-red-200',   headerBg: 'bg-red-100',    dot: 'bg-red-400'    },
]

const STAGE_MAP = Object.fromEntries(STAGES.map((s, i) => [s.key, i])) as Record<PipelineStage, number>

// What seeker sees in their dashboard
const STAGE_TO_STATUS: Record<PipelineStage, string> = {
  applied:     'pending',
  shortlisted: 'reviewed',
  interview:   'reviewed',
  offer:       'reviewed',
  hired:       'accepted',
  rejected:    'rejected',
}

const PREDEFINED_TAGS = ['Top Pick', 'Strong Fit', 'Culture Fit', 'Follow Up', 'Technical Interview', 'On Hold', 'Needs Experience']
const IMMIGRATION_LABELS: Record<string, string> = { owp: 'Open Work Permit', pr: 'Permanent Resident', student: 'Student Visa', citizen: 'Citizen' }
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
  const params = useParams()
  const router = useRouter()
  const jobId = params.jobId as string

  const [job, setJob] = useState<Job | null>(null)
  const [applicants, setApplicants] = useState<Applicant[]>([])
  const [loading, setLoading] = useState(true)
  const [movingId, setMovingId] = useState<string | null>(null)
  const [savingNotes, setSavingNotes] = useState<string | null>(null)
  const [editingNotes, setEditingNotes] = useState<string | null>(null)
  const [noteDraft, setNoteDraft] = useState<Record<string, string>>({})
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [showRejected, setShowRejected] = useState(false)
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set())
  const [poolLoadingId, setPoolLoadingId] = useState<string | null>(null)
  const [currentEmployerId, setCurrentEmployerId] = useState<string | null>(null)
  const [messagingId, setMessagingId] = useState<string | null>(null)

  useEffect(() => { checkAuth() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth/signin'); return }
    const { data: profile } = await supabase.from('profiles').select('role').eq('user_id', user.id).single()
    if (profile?.role !== 'employer') { router.push('/dashboard'); return }
    setCurrentEmployerId(user.id)
    await loadData(user.id)
    setLoading(false)
  }

  const loadData = async (employerId: string) => {
    const { data: jobData } = await supabase
      .from('opportunities')
      .select('id, title, type, city, employer_profiles(company_name)')
      .eq('id', jobId)
      .eq('employer_id', employerId)
      .single()
    if (!jobData) { router.push('/dashboard'); return }
    setJob({
      id: jobData.id, title: jobData.title, type: jobData.type, city: jobData.city,
      company_name: (jobData.employer_profiles as { company_name?: string } | null)?.company_name,
    })

    const { data: apps } = await supabase
      .from('applications')
      .select('id, status, pipeline_stage, employer_notes, tags, cover_note, created_at, seeker_id')
      .eq('opportunity_id', jobId)
      .order('created_at', { ascending: false })
    if (!apps || apps.length === 0) { setApplicants([]); return }

    const seekerIds = apps.map((a: Record<string, unknown>) => a.seeker_id as string)
    const [{ data: profiles }, { data: spData }, { data: poolData }] = await Promise.all([
      supabase.from('profiles').select('user_id, full_name, city').in('user_id', seekerIds),
      supabase.from('seeker_profiles').select('user_id, country_of_origin, immigration_status, skills, education, bio, linkedin_url, resume_path, work_preference').in('user_id', seekerIds),
      supabase.from('talent_pool').select('seeker_id').eq('employer_id', employerId).in('seeker_id', seekerIds),
    ])

    const pm = new Map((profiles || []).map((p: Record<string, unknown>) => [p.user_id as string, p]))
    const sm = new Map((spData || []).map((s: Record<string, unknown>) => [s.user_id as string, s]))
    const poolSet = new Set((poolData || []).map((p: Record<string, unknown>) => p.seeker_id as string))

    setApplicants(apps.map((a: Record<string, unknown>) => {
      const p = pm.get(a.seeker_id as string) as Record<string, unknown> | undefined
      const s = sm.get(a.seeker_id as string) as Record<string, unknown> | undefined
      // Derive pipeline_stage from status if column not yet present
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
      return {
        id: a.id as string,
        pipeline_stage: stage,
        employer_notes: (a.employer_notes as string) || '',
        tags: (a.tags as string[]) || [],
        cover_note: a.cover_note as string | undefined,
        created_at: a.created_at as string,
        seeker_id: a.seeker_id as string,
        full_name: p?.full_name as string || 'Unknown',
        city: p?.city as string | undefined,
        country_of_origin: s?.country_of_origin as string | undefined,
        immigration_status: s?.immigration_status as string | undefined,
        skills: (s?.skills as string[]) || [],
        education: s?.education as string | undefined,
        bio: s?.bio as string | undefined,
        linkedin_url: s?.linkedin_url as string | undefined,
        resume_path: s?.resume_path as string | undefined,
        work_preference: s?.work_preference as string | undefined,
        inPool: poolSet.has(a.seeker_id as string),
      }
    }))
  }

  const moveStage = async (appId: string, newStage: PipelineStage) => {
    setMovingId(appId)
    await supabase.from('applications').update({
      pipeline_stage: newStage,
      status: STAGE_TO_STATUS[newStage],
    }).eq('id', appId)
    setApplicants(prev => prev.map(a => a.id === appId ? { ...a, pipeline_stage: newStage } : a))
    setMovingId(null)
  }

  const saveNotes = async (appId: string) => {
    const notes = noteDraft[appId] ?? ''
    setSavingNotes(appId)
    await supabase.from('applications').update({ employer_notes: notes }).eq('id', appId)
    setApplicants(prev => prev.map(a => a.id === appId ? { ...a, employer_notes: notes } : a))
    setEditingNotes(null)
    setSavingNotes(null)
  }

  const toggleTag = async (appId: string, tag: string, currentTags: string[]) => {
    const newTags = currentTags.includes(tag)
      ? currentTags.filter(t => t !== tag)
      : [...currentTags, tag]
    await supabase.from('applications').update({ tags: newTags }).eq('id', appId)
    setApplicants(prev => prev.map(a => a.id === appId ? { ...a, tags: newTags } : a))
  }

  const startConversation = async (seekerId: string) => {
    if (!currentEmployerId) return
    setMessagingId(seekerId)
    // Check for existing conversation
    const { data: existing } = await supabase
      .from('conversations')
      .select('id')
      .eq('employer_id', currentEmployerId)
      .eq('seeker_id', seekerId)
      .eq('opportunity_id', jobId)
      .maybeSingle()
    if (existing) { router.push(`/messages/${existing.id}`); return }
    // Create new conversation
    const { data: created } = await supabase
      .from('conversations')
      .insert({ employer_id: currentEmployerId, seeker_id: seekerId, opportunity_id: jobId })
      .select('id')
      .single()
    setMessagingId(null)
    if (created) router.push(`/messages/${created.id}`)
  }

  const togglePool = async (seekerId: string, inPool: boolean) => {
    if (!currentEmployerId) return
    setPoolLoadingId(seekerId)
    if (inPool) {
      await supabase.from('talent_pool').delete().eq('employer_id', currentEmployerId).eq('seeker_id', seekerId)
    } else {
      await supabase.from('talent_pool').insert({ employer_id: currentEmployerId, seeker_id: seekerId })
    }
    setApplicants(prev => prev.map(a => a.seeker_id === seekerId ? { ...a, inPool: !inPool } : a))
    setPoolLoadingId(null)
  }

  const downloadResume = async (path: string, seekerId: string) => {
    setDownloadingId(seekerId)
    const { data } = await supabase.storage.from('candidate-documents').createSignedUrl(path, 3600)
    setDownloadingId(null)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  const toggleExpand = (id: string) => {
    setExpandedCards(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
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
      <div className="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-4 mb-6 flex-wrap">
          <Link href="/dashboard" className="inline-flex items-center gap-2 text-gray-500 hover:text-red-600 text-sm transition-colors">
            <ArrowLeft size={16} /> Dashboard
          </Link>
          <Link href="/talent-pool" className="inline-flex items-center gap-2 text-sm text-purple-600 hover:text-purple-700 font-medium ml-auto">
            <BookmarkCheck size={16} /> Talent Pool
          </Link>
        </div>

        {/* Job header */}
        {job && (
          <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-6 flex items-start justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-xl font-bold text-gray-900">{job.title}</h1>
              <p className="text-sm text-gray-500 mt-1 flex items-center gap-3">
                <span className="flex items-center gap-1"><MapPin size={13} />{job.city}</span>
                <span className="capitalize">{job.type}</span>
              </p>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-xl">
                <Users size={16} className="text-gray-400" />
                <span className="text-sm font-semibold text-gray-700">{applicants.length} applicant{applicants.length !== 1 ? 's' : ''}</span>
              </div>
              {rejectedCount > 0 && (
                <button
                  onClick={() => setShowRejected(!showRejected)}
                  className={`text-xs px-3 py-2 rounded-xl border transition-colors ${showRejected ? 'bg-red-50 border-red-200 text-red-600' : 'bg-white border-gray-200 text-gray-500 hover:border-gray-400'}`}
                >
                  {showRejected ? 'Hide Rejected' : `Show Rejected (${rejectedCount})`}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Kanban Board */}
        {applicants.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-16 text-center">
            <Users size={40} className="mx-auto text-gray-300 mb-3" />
            <h3 className="font-semibold text-gray-700 mb-1">No applications yet</h3>
            <p className="text-sm text-gray-400">Applications will appear here as candidates apply.</p>
          </div>
        ) : (
          <div className="overflow-x-auto pb-6">
            <div className="flex gap-4" style={{ minWidth: `${visibleStages.length * 300 + (visibleStages.length - 1) * 16}px` }}>
              {visibleStages.map((stage) => {
                const cols = applicants.filter(a => a.pipeline_stage === stage.key)
                return (
                  <div key={stage.key} className={`w-[288px] flex-shrink-0 rounded-2xl border ${stage.border} flex flex-col overflow-hidden`}>
                    {/* Column header */}
                    <div className={`${stage.headerBg} px-4 py-3 flex items-center justify-between flex-shrink-0`}>
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${stage.dot}`} />
                        <span className={`font-semibold text-sm ${stage.color}`}>{stage.label}</span>
                      </div>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full bg-white/60 ${stage.color}`}>{cols.length}</span>
                    </div>
                    {/* Cards */}
                    <div className={`${stage.bg} p-2.5 space-y-2.5 flex-1`}>
                      {cols.length === 0 && (
                        <p className="text-center text-xs text-gray-400 py-6">No candidates</p>
                      )}
                      {cols.map(app => (
                        <CandidateCard
                          key={app.id}
                          app={app}
                          stage={stage}
                          stageIdx={STAGE_MAP[app.pipeline_stage]}
                          totalStages={STAGES.length}
                          moving={movingId === app.id}
                          editingNotes={editingNotes === app.id}
                          savingNotes={savingNotes === app.id}
                          noteDraft={noteDraft[app.id] ?? app.employer_notes}
                          downloadingResume={downloadingId === app.seeker_id}
                          poolLoading={poolLoadingId === app.seeker_id}
                          expanded={expandedCards.has(app.id)}
                          onToggleExpand={() => toggleExpand(app.id)}
                          onMove={moveStage}
                          onEditNotes={() => { setEditingNotes(app.id); setNoteDraft(p => ({ ...p, [app.id]: app.employer_notes })) }}
                          onCancelNotes={() => setEditingNotes(null)}
                          onNoteDraftChange={(val) => setNoteDraft(p => ({ ...p, [app.id]: val }))}
                          onSaveNotes={() => saveNotes(app.id)}
                          onToggleTag={(tag) => toggleTag(app.id, tag, app.tags)}
                          onDownloadResume={() => downloadResume(app.resume_path!, app.seeker_id)}
                          onTogglePool={() => togglePool(app.seeker_id, !!app.inPool)}
                          onMessage={() => startConversation(app.seeker_id)}
                          messagingLoading={messagingId === app.seeker_id}
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

// ── Candidate Card ────────────────────────────────────────────────────────────

type CardProps = {
  app: Applicant
  stage: typeof STAGES[number]
  stageIdx: number
  totalStages: number
  moving: boolean
  editingNotes: boolean
  savingNotes: boolean
  noteDraft: string
  downloadingResume: boolean
  poolLoading: boolean
  expanded: boolean
  onToggleExpand: () => void
  onMove: (id: string, stage: PipelineStage) => void
  onEditNotes: () => void
  onCancelNotes: () => void
  onNoteDraftChange: (val: string) => void
  onSaveNotes: () => void
  onToggleTag: (tag: string) => void
  onDownloadResume: () => void
  onTogglePool: () => void
  onMessage: () => void
  messagingLoading: boolean
  predefinedTags: string[]
  tagColors: Record<string, string>
  immigrationLabels: Record<string, string>
  modeLabels: Record<string, string>
  stages: typeof STAGES
}

function CandidateCard({
  app, stage, stageIdx, totalStages, moving, editingNotes, savingNotes,
  noteDraft, downloadingResume, poolLoading, expanded, onToggleExpand,
  onMove, onEditNotes, onCancelNotes, onNoteDraftChange, onSaveNotes,
  onToggleTag, onDownloadResume, onTogglePool, onMessage, messagingLoading,
  predefinedTags, tagColors, immigrationLabels, modeLabels, stages,
}: CardProps) {
  const [showTagPicker, setShowTagPicker] = useState(false)

  const prevStage = stageIdx > 0 ? stages[stageIdx - 1] : null
  const nextStage = stageIdx < totalStages - 1 ? stages[stageIdx + 1] : null
  // Don't allow moving forward from 'hired'
  const canGoForward = nextStage && app.pipeline_stage !== 'hired'
  const canGoBack = prevStage && app.pipeline_stage !== 'applied'

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Card header */}
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
                title={app.inPool ? 'Remove from Talent Pool' : 'Save to Talent Pool'}
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

        {/* Immigration + work preference */}
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

        {/* Applied tags */}
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

      {/* Expandable detail section */}
      <button
        onClick={onToggleExpand}
        className="w-full flex items-center justify-between px-3 py-1.5 text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors border-t border-gray-100"
      >
        <span>{expanded ? 'Less detail' : 'More detail'}</span>
        {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-2.5 border-t border-gray-100 pt-2.5">
          {/* Skills */}
          {app.skills.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {app.skills.slice(0, 5).map(s => (
                <span key={s} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{s}</span>
              ))}
              {app.skills.length > 5 && <span className="text-xs text-gray-400">+{app.skills.length - 5}</span>}
            </div>
          )}

          {/* Education */}
          {app.education && (
            <p className="text-xs text-gray-500 leading-relaxed">{app.education}</p>
          )}

          {/* Cover note */}
          {app.cover_note && (
            <div className="bg-gray-50 rounded-lg p-2.5 border border-gray-100">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Cover Note</p>
              <p className="text-xs text-gray-700 leading-relaxed line-clamp-3">{app.cover_note}</p>
            </div>
          )}

          {/* Notes section */}
          <div className="bg-amber-50 rounded-lg p-2.5 border border-amber-100">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Private Notes</p>
              {!editingNotes && (
                <button onClick={onEditNotes} className="text-amber-500 hover:text-amber-700 p-0.5 rounded transition-colors">
                  <Pencil size={11} />
                </button>
              )}
            </div>
            {editingNotes ? (
              <div className="space-y-1.5">
                <textarea
                  value={noteDraft}
                  onChange={e => onNoteDraftChange(e.target.value)}
                  rows={3}
                  placeholder="Add private notes about this candidate..."
                  className="w-full px-2 py-1.5 border border-amber-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-amber-400 resize-none bg-white"
                  autoFocus
                />
                <div className="flex gap-1.5">
                  <button
                    onClick={onSaveNotes}
                    disabled={savingNotes}
                    className="flex items-center gap-1 text-xs bg-amber-500 hover:bg-amber-600 text-white px-2.5 py-1 rounded-lg font-medium transition-colors disabled:opacity-60"
                  >
                    {savingNotes ? <div className="w-3 h-3 border border-white/40 border-t-white rounded-full animate-spin" /> : <Check size={11} />}
                    Save
                  </button>
                  <button onClick={onCancelNotes} className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1 rounded-lg transition-colors">
                    <X size={11} />
                  </button>
                </div>
              </div>
            ) : (
              <p className={`text-xs leading-relaxed ${app.employer_notes ? 'text-amber-900' : 'text-amber-400 italic'}`}>
                {app.employer_notes || 'No notes yet. Click edit to add.'}
              </p>
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
                        active
                          ? tagColors[tag] || 'bg-gray-200 text-gray-700 border-gray-300'
                          : 'bg-white text-gray-400 border-gray-200 hover:border-gray-400'
                      }`}
                    >
                      {active ? '✓ ' : '+ '}{tag}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Document links + Message */}
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={onMessage}
              disabled={messagingLoading}
              className="flex items-center gap-1 text-xs bg-red-50 hover:bg-red-100 text-red-700 px-2.5 py-1.5 rounded-full font-medium transition-colors disabled:opacity-50"
            >
              {messagingLoading
                ? <div className="w-3 h-3 border border-red-400 border-t-transparent rounded-full animate-spin" />
                : <MessageSquare size={11} />}
              Message
            </button>
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
              <a
                href={app.linkedin_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 px-2.5 py-1.5 rounded-full font-medium transition-colors"
              >
                <ExternalLink size={11} /> LinkedIn
              </a>
            )}
          </div>

          <p className="text-xs text-gray-400">Applied {new Date(app.created_at).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}</p>
        </div>
      )}

      {/* Stage navigation footer */}
      <div className="flex items-center justify-between px-2 py-1.5 bg-gray-50 border-t border-gray-100">
        {canGoBack ? (
          <button
            onClick={() => onMove(app.id, prevStage!.key)}
            disabled={moving}
            title={`Move back to ${prevStage!.label}`}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-200 transition-colors disabled:opacity-40"
          >
            <ChevronLeft size={14} />
          </button>
        ) : <div className="w-6" />}

        {/* Stage quick-select dropdown */}
        <select
          value={app.pipeline_stage}
          onChange={e => onMove(app.id, e.target.value as PipelineStage)}
          disabled={moving}
          className={`text-xs font-medium px-2 py-0.5 rounded-full border appearance-none text-center cursor-pointer focus:outline-none focus:ring-1 focus:ring-gray-300 ${stage.color} ${stage.headerBg} ${stage.border} disabled:opacity-50`}
          style={{ backgroundImage: 'none' }}
        >
          {stages.map(s => (
            <option key={s.key} value={s.key}>{s.label}</option>
          ))}
        </select>

        {canGoForward ? (
          <button
            onClick={() => onMove(app.id, nextStage!.key)}
            disabled={moving}
            title={`Advance to ${nextStage!.label}`}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-200 transition-colors disabled:opacity-40"
          >
            {moving ? (
              <div className="w-3.5 h-3.5 border border-gray-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <ChevronRight size={14} />
            )}
          </button>
        ) : <div className="w-6" />}
      </div>
    </div>
  )
}
