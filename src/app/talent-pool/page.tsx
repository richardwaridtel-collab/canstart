'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import {
  ArrowLeft, MapPin, Globe, Briefcase, Download, ExternalLink,
  BookmarkCheck, BookmarkX, Users, Search, Tag, Pencil, Check, X,
  Send, ChevronDown,
} from 'lucide-react'

// ── Types ────────────────────────────────────────────────────────────────────

type PoolEntry = {
  id: string
  seeker_id: string
  pool_name: string
  notes: string
  tags: string[]
  created_at: string
  // seeker info
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
}

type PostedJob = { id: string; title: string }

const POOL_NAMES = ['General', 'Marketing', 'Technology', 'Finance', 'Operations', 'Sales', 'Design', 'Future Roles']
const PREDEFINED_TAGS = ['Top Pick', 'Strong Fit', 'Culture Fit', 'Follow Up', 'Technical Interview', 'On Hold', 'Needs Experience']
const TAG_COLORS: Record<string, string> = {
  'Top Pick':            'bg-yellow-100 text-yellow-700 border-yellow-300',
  'Strong Fit':          'bg-green-100 text-green-700 border-green-300',
  'Culture Fit':         'bg-teal-100 text-teal-700 border-teal-300',
  'Follow Up':           'bg-blue-100 text-blue-700 border-blue-300',
  'Technical Interview': 'bg-purple-100 text-purple-700 border-purple-300',
  'On Hold':             'bg-gray-100 text-gray-600 border-gray-300',
  'Needs Experience':    'bg-orange-100 text-orange-700 border-orange-300',
}
const IMMIGRATION_LABELS: Record<string, string> = { owp: 'Open Work Permit', pr: 'Permanent Resident', student: 'Student Visa', citizen: 'Citizen' }
const MODE_LABELS: Record<string, string> = { remote: 'Remote', hybrid: 'Hybrid', onsite: 'On-site', any: 'Any' }

// ── Page ─────────────────────────────────────────────────────────────────────

export default function TalentPoolPage() {
  const router = useRouter()
  const [entries, setEntries] = useState<PoolEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [poolFilter, setPoolFilter] = useState('All')
  const [employerId, setEmployerId] = useState<string | null>(null)
  const [postedJobs, setPostedJobs] = useState<PostedJob[]>([])

  // Per-entry editing state
  const [editingNotes, setEditingNotes] = useState<string | null>(null)
  const [noteDraft, setNoteDraft] = useState<Record<string, string>>({})
  const [savingNotes, setSavingNotes] = useState<string | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [showTagPicker, setShowTagPicker] = useState<string | null>(null)
  const [editingPool, setEditingPool] = useState<string | null>(null)

  // Notify panel state
  const [notifyJobId, setNotifyJobId] = useState('')
  const [notifyMessage, setNotifyMessage] = useState('')
  const [notifyLoading, setNotifyLoading] = useState(false)
  const [notifySent, setNotifySent] = useState(false)
  const [showNotifyPanel, setShowNotifyPanel] = useState(false)

  useEffect(() => { checkAuth() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth/signin'); return }
    const { data: profile } = await supabase.from('profiles').select('role').eq('user_id', user.id).single()
    if (profile?.role !== 'employer') { router.push('/dashboard'); return }
    setEmployerId(user.id)
    await loadPool(user.id)
    setLoading(false)
  }

  const loadPool = async (empId: string) => {
    const { data: pool } = await supabase
      .from('talent_pool')
      .select('id, seeker_id, pool_name, notes, tags, created_at')
      .eq('employer_id', empId)
      .order('created_at', { ascending: false })
    if (!pool || pool.length === 0) { setEntries([]); return }

    const seekerIds = pool.map((p: Record<string, unknown>) => p.seeker_id as string)
    const [{ data: profiles }, { data: spData }, { data: jobs }] = await Promise.all([
      supabase.from('profiles').select('user_id, full_name, city').in('user_id', seekerIds),
      supabase.from('seeker_profiles').select('user_id, country_of_origin, immigration_status, skills, education, bio, linkedin_url, resume_path, work_preference').in('user_id', seekerIds),
      supabase.from('opportunities').select('id, title').eq('employer_id', empId).eq('status', 'open'),
    ])

    const pm = new Map((profiles || []).map((p: Record<string, unknown>) => [p.user_id as string, p]))
    const sm = new Map((spData || []).map((s: Record<string, unknown>) => [s.user_id as string, s]))
    setPostedJobs((jobs || []) as PostedJob[])

    setEntries(pool.map((e: Record<string, unknown>) => {
      const p = pm.get(e.seeker_id as string) as Record<string, unknown> | undefined
      const s = sm.get(e.seeker_id as string) as Record<string, unknown> | undefined
      return {
        id: e.id as string,
        seeker_id: e.seeker_id as string,
        pool_name: (e.pool_name as string) || 'General',
        notes: (e.notes as string) || '',
        tags: (e.tags as string[]) || [],
        created_at: e.created_at as string,
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
      }
    }))
  }

  const removeFromPool = async (id: string) => {
    if (!employerId) return
    setRemovingId(id)
    await supabase.from('talent_pool').delete().eq('id', id)
    setEntries(prev => prev.filter(e => e.id !== id))
    setRemovingId(null)
  }

  const saveNotes = async (id: string) => {
    const notes = noteDraft[id] ?? ''
    setSavingNotes(id)
    await supabase.from('talent_pool').update({ notes }).eq('id', id)
    setEntries(prev => prev.map(e => e.id === id ? { ...e, notes } : e))
    setEditingNotes(null)
    setSavingNotes(null)
  }

  const toggleTag = async (id: string, tag: string, currentTags: string[]) => {
    const newTags = currentTags.includes(tag)
      ? currentTags.filter(t => t !== tag)
      : [...currentTags, tag]
    await supabase.from('talent_pool').update({ tags: newTags }).eq('id', id)
    setEntries(prev => prev.map(e => e.id === id ? { ...e, tags: newTags } : e))
  }

  const updatePoolName = async (id: string, pool_name: string) => {
    await supabase.from('talent_pool').update({ pool_name }).eq('id', id)
    setEntries(prev => prev.map(e => e.id === id ? { ...e, pool_name } : e))
    setEditingPool(null)
  }

  const downloadResume = async (path: string, seekerId: string) => {
    setDownloadingId(seekerId)
    const { data } = await supabase.storage.from('candidate-documents').createSignedUrl(path, 3600)
    setDownloadingId(null)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  const notifyPool = async () => {
    if (!notifyJobId || !notifyMessage.trim()) return
    setNotifyLoading(true)
    // Insert a notification row per seeker in the visible pool
    const job = postedJobs.find(j => j.id === notifyJobId)
    const filtered = getFiltered()
    const inserts = filtered.map(e => ({
      seeker_id: e.seeker_id,
      employer_id: employerId,
      opportunity_id: notifyJobId,
      message: notifyMessage.trim(),
      opportunity_title: job?.title || '',
    }))
    // best-effort insert — if table exists
    await supabase.from('pool_notifications').insert(inserts).select()
    setNotifyLoading(false)
    setNotifySent(true)
    setTimeout(() => { setNotifySent(false); setShowNotifyPanel(false); setNotifyMessage(''); setNotifyJobId('') }, 3000)
  }

  const getFiltered = () => {
    let result = [...entries]
    if (poolFilter !== 'All') result = result.filter(e => e.pool_name === poolFilter)
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(e =>
        e.full_name.toLowerCase().includes(q) ||
        e.skills.some(s => s.toLowerCase().includes(q)) ||
        (e.city || '').toLowerCase().includes(q)
      )
    }
    return result
  }

  const poolNames = ['All', ...Array.from(new Set(entries.map(e => e.pool_name)))]
  const filtered = getFiltered()

  if (loading) return (
    <div className="max-w-5xl mx-auto px-4 py-10 animate-pulse space-y-4">
      <div className="h-8 bg-gray-200 rounded w-1/3" />
      <div className="h-48 bg-gray-100 rounded-xl" />
    </div>
  )

  return (
    <div className="bg-gray-50 min-h-screen py-8">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3 mb-6 flex-wrap">
          <Link href="/dashboard" className="inline-flex items-center gap-2 text-gray-500 hover:text-red-600 text-sm transition-colors">
            <ArrowLeft size={16} /> Dashboard
          </Link>
          <Link href="/candidates" className="text-sm text-gray-500 hover:text-gray-700 transition-colors ml-auto">
            Browse Candidates →
          </Link>
        </div>

        {/* Header */}
        <div className="bg-gradient-to-br from-purple-600 to-purple-800 text-white rounded-2xl p-6 mb-6">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <BookmarkCheck size={24} /> Talent Pool
              </h1>
              <p className="text-purple-200 text-sm mt-1">
                {entries.length} saved candidate{entries.length !== 1 ? 's' : ''} — your future hiring pipeline
              </p>
            </div>
            {entries.length > 0 && postedJobs.length > 0 && (
              <button
                onClick={() => setShowNotifyPanel(!showNotifyPanel)}
                className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 transition-colors"
              >
                <Send size={15} /> Notify Pool
              </button>
            )}
          </div>
        </div>

        {/* Notify panel */}
        {showNotifyPanel && (
          <div className="bg-white rounded-2xl border border-purple-200 p-5 mb-6">
            <h3 className="font-bold text-gray-900 mb-1 flex items-center gap-2">
              <Send size={16} className="text-purple-500" /> Notify Saved Candidates
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              Let candidates in your pool know about a new opening. Sends a notification to {filtered.length} candidate{filtered.length !== 1 ? 's' : ''} currently shown.
            </p>
            {notifySent ? (
              <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-xl p-4 text-sm">
                <Check size={16} /> Notifications sent to {filtered.length} candidate{filtered.length !== 1 ? 's' : ''}!
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Select Opportunity</label>
                  <div className="relative">
                    <select
                      value={notifyJobId}
                      onChange={e => setNotifyJobId(e.target.value)}
                      className="w-full appearance-none bg-gray-50 border border-gray-200 rounded-lg pl-3 pr-8 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-400"
                    >
                      <option value="">— Choose an open opportunity —</option>
                      {postedJobs.map(j => <option key={j.id} value={j.id}>{j.title}</option>)}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Message</label>
                  <textarea
                    value={notifyMessage}
                    onChange={e => setNotifyMessage(e.target.value)}
                    rows={2}
                    placeholder="Hi! We have a new opportunity that matches your profile..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 resize-none"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={notifyPool}
                    disabled={!notifyJobId || !notifyMessage.trim() || notifyLoading}
                    className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors"
                  >
                    {notifyLoading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Send size={14} />}
                    Send Notification
                  </button>
                  <button onClick={() => setShowNotifyPanel(false)} className="text-sm text-gray-400 hover:text-gray-600 px-3 py-2 rounded-xl transition-colors">Cancel</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Search + filter bar */}
        {entries.length > 0 && (
          <div className="flex flex-wrap gap-3 mb-5 items-center">
            <div className="relative flex-1 min-w-48">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by name, skill, city..."
                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {poolNames.map(name => (
                <button
                  key={name}
                  onClick={() => setPoolFilter(name)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    poolFilter === name
                      ? 'bg-purple-600 text-white'
                      : 'bg-white border border-gray-200 text-gray-600 hover:border-purple-300 hover:text-purple-600'
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>
            <span className="text-xs text-gray-400 ml-auto">{filtered.length} candidate{filtered.length !== 1 ? 's' : ''}</span>
          </div>
        )}

        {/* Empty state */}
        {entries.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-16 text-center">
            <BookmarkCheck size={40} className="mx-auto text-gray-300 mb-3" />
            <h3 className="font-semibold text-gray-700 mb-2">Your talent pool is empty</h3>
            <p className="text-sm text-gray-400 mb-6">Save candidates from the pipeline or browse page to build your future hiring pool.</p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link href="/candidates" className="bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium px-4 py-2 rounded-xl inline-flex items-center gap-2 transition-colors">
                <Users size={15} /> Browse Candidates
              </Link>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
            <p className="text-gray-500 text-sm">No candidates match your search.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map(entry => (
              <div key={entry.id} className="bg-white rounded-2xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
                {/* Header */}
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-11 h-11 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                    {entry.full_name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-bold text-gray-900">{entry.full_name}</h3>
                      <button
                        onClick={() => removeFromPool(entry.id)}
                        disabled={removingId === entry.id}
                        title="Remove from pool"
                        className="text-gray-300 hover:text-red-500 transition-colors flex-shrink-0 p-0.5"
                      >
                        {removingId === entry.id
                          ? <div className="w-3.5 h-3.5 border border-red-400 border-t-transparent rounded-full animate-spin" />
                          : <BookmarkX size={15} />}
                      </button>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5 text-xs text-gray-500">
                      {entry.city && <span className="flex items-center gap-0.5"><MapPin size={10} />{entry.city}</span>}
                      {entry.country_of_origin && <span className="flex items-center gap-0.5"><Globe size={10} />{entry.country_of_origin}</span>}
                      {entry.work_preference && <span className="flex items-center gap-0.5"><Briefcase size={10} />{MODE_LABELS[entry.work_preference] || entry.work_preference}</span>}
                    </div>
                  </div>
                </div>

                {/* Pool name + immigration */}
                <div className="flex flex-wrap gap-1.5 mb-3 items-center">
                  {editingPool === entry.id ? (
                    <select
                      defaultValue={entry.pool_name}
                      onChange={e => updatePoolName(entry.id, e.target.value)}
                      onBlur={() => setEditingPool(null)}
                      autoFocus
                      className="text-xs border border-purple-300 rounded-full px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-purple-400 bg-purple-50 text-purple-700"
                    >
                      {POOL_NAMES.map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  ) : (
                    <button
                      onClick={() => setEditingPool(entry.id)}
                      className="text-xs bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-full hover:bg-purple-100 transition-colors font-medium"
                    >
                      📁 {entry.pool_name}
                    </button>
                  )}
                  {entry.immigration_status && (
                    <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                      {IMMIGRATION_LABELS[entry.immigration_status] || entry.immigration_status}
                    </span>
                  )}
                </div>

                {/* Skills */}
                {entry.skills.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {entry.skills.slice(0, 5).map(s => (
                      <span key={s} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{s}</span>
                    ))}
                    {entry.skills.length > 5 && <span className="text-xs text-gray-400">+{entry.skills.length - 5}</span>}
                  </div>
                )}

                {/* Tags */}
                {entry.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {entry.tags.map(tag => (
                      <span key={tag} className={`text-xs px-2 py-0.5 rounded-full border font-medium ${TAG_COLORS[tag] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Tag picker */}
                <div className="mb-3">
                  <button
                    onClick={() => setShowTagPicker(showTagPicker === entry.id ? null : entry.id)}
                    className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <Tag size={11} /> {showTagPicker === entry.id ? 'Close tags' : 'Tags'}
                  </button>
                  {showTagPicker === entry.id && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {PREDEFINED_TAGS.map(tag => {
                        const active = entry.tags.includes(tag)
                        return (
                          <button
                            key={tag}
                            onClick={() => toggleTag(entry.id, tag, entry.tags)}
                            className={`text-xs px-2 py-0.5 rounded-full border font-medium transition-all ${
                              active
                                ? TAG_COLORS[tag] || 'bg-gray-200 text-gray-700 border-gray-300'
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

                {/* Notes */}
                <div className="bg-amber-50 rounded-xl p-3 mb-3 border border-amber-100">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide">Notes</p>
                    {editingNotes !== entry.id && (
                      <button
                        onClick={() => { setEditingNotes(entry.id); setNoteDraft(p => ({ ...p, [entry.id]: entry.notes })) }}
                        className="text-amber-400 hover:text-amber-600 transition-colors"
                      >
                        <Pencil size={11} />
                      </button>
                    )}
                  </div>
                  {editingNotes === entry.id ? (
                    <div className="space-y-1.5">
                      <textarea
                        value={noteDraft[entry.id] ?? entry.notes}
                        onChange={e => setNoteDraft(p => ({ ...p, [entry.id]: e.target.value }))}
                        rows={2}
                        placeholder="Private notes about this candidate..."
                        className="w-full px-2 py-1.5 border border-amber-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-amber-400 resize-none bg-white"
                        autoFocus
                      />
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => saveNotes(entry.id)}
                          disabled={savingNotes === entry.id}
                          className="flex items-center gap-1 text-xs bg-amber-500 hover:bg-amber-600 text-white px-2.5 py-1 rounded-lg font-medium disabled:opacity-60"
                        >
                          {savingNotes === entry.id ? <div className="w-3 h-3 border border-white/40 border-t-white rounded-full animate-spin" /> : <Check size={11} />}
                          Save
                        </button>
                        <button onClick={() => setEditingNotes(null)} className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1 rounded-lg">
                          <X size={11} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className={`text-xs leading-relaxed ${entry.notes ? 'text-amber-900' : 'text-amber-400 italic'}`}>
                      {entry.notes || 'No notes yet.'}
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-1.5 pt-3 border-t border-gray-100">
                  {entry.resume_path && (
                    <button
                      onClick={() => downloadResume(entry.resume_path!, entry.seeker_id)}
                      disabled={downloadingId === entry.seeker_id}
                      className="flex items-center gap-1 text-xs bg-red-50 hover:bg-red-100 text-red-700 px-2.5 py-1.5 rounded-full font-medium transition-colors disabled:opacity-50"
                    >
                      {downloadingId === entry.seeker_id ? <div className="w-3 h-3 border border-red-400 border-t-transparent rounded-full animate-spin" /> : <Download size={11} />}
                      Resume
                    </button>
                  )}
                  {entry.linkedin_url && (
                    <a
                      href={entry.linkedin_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 px-2.5 py-1.5 rounded-full font-medium transition-colors"
                    >
                      <ExternalLink size={11} /> LinkedIn
                    </a>
                  )}
                  <span className="text-xs text-gray-400 ml-auto self-center">
                    Saved {new Date(entry.created_at).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
