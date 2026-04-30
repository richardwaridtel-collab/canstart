'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import {
  CalendarCheck, Video, Phone, MapPin, Clock, CheckCircle2,
  XCircle, ArrowLeft, CalendarX, AlertCircle, ChevronDown, ChevronUp,
} from 'lucide-react'

type InterviewRequest = {
  id: string
  employer_id: string
  seeker_id: string
  seeker_name: string
  employer_name: string
  opp_title: string | null
  proposed_times: string[]
  confirmed_time: string | null
  format: string
  meeting_link: string | null
  notes: string | null
  status: string
  created_at: string
  application_id: string | null
  opportunity_id: string | null
}

const FORMAT_ICON: Record<string, React.ElementType> = { video: Video, phone: Phone, 'in-person': MapPin }
const FORMAT_LABEL: Record<string, string> = { video: 'Video Call', phone: 'Phone Call', 'in-person': 'In-Person' }

const STATUS_STYLE: Record<string, string> = {
  pending:   'bg-amber-100 text-amber-700 border-amber-200',
  confirmed: 'bg-green-100 text-green-700 border-green-200',
  declined:  'bg-red-100 text-red-600 border-red-200',
  cancelled: 'bg-gray-100 text-gray-500 border-gray-200',
  completed: 'bg-blue-100 text-blue-700 border-blue-200',
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'Awaiting Confirmation', confirmed: 'Confirmed', declined: 'Declined',
  cancelled: 'Cancelled', completed: 'Completed',
}

function formatDT(iso: string) {
  return new Date(iso).toLocaleString('en-CA', {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function countdown(iso: string) {
  const ms = new Date(iso).getTime() - Date.now()
  if (ms < 0) return null
  const h = Math.floor(ms / 3600000)
  const d = Math.floor(h / 24)
  if (d > 1) return `In ${d} days`
  if (d === 1) return 'Tomorrow'
  if (h >= 1) return `In ${h} hour${h !== 1 ? 's' : ''}`
  const m = Math.floor(ms / 60000)
  return `In ${m} minute${m !== 1 ? 's' : ''}`
}

export default function InterviewsPage() {
  const router = useRouter()
  const [interviews, setInterviews] = useState<InterviewRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [isEmployer, setIsEmployer] = useState(false)
  const [filter, setFilter] = useState<'upcoming' | 'pending' | 'past'>('upcoming')
  const [actionId, setActionId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => { loadInterviews() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const loadInterviews = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth/signin'); return }
    setUserId(user.id)
    const { data: profile } = await supabase.from('profiles').select('role').eq('user_id', user.id).single()
    const emp = profile?.role === 'employer'
    setIsEmployer(emp)

    const { data } = await supabase
      .from('interview_requests')
      .select('*')
      .order('created_at', { ascending: false })

    setInterviews((data || []) as InterviewRequest[])
    setLoading(false)
  }

  const confirmTime = async (id: string, time: string) => {
    setActionId(id)
    await supabase.from('interview_requests').update({ status: 'confirmed', confirmed_time: time }).eq('id', id)

    // Post confirmation message in conversation
    const req = interviews.find(r => r.id === id)
    if (req) {
      const { data: conv } = await supabase
        .from('conversations')
        .select('id')
        .eq('employer_id', req.employer_id)
        .eq('seeker_id', req.seeker_id)
        .maybeSingle()
      if (conv) {
        const formatted = new Date(time).toLocaleString('en-CA', { weekday: 'long', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })
        await supabase.from('messages').insert({
          conversation_id: conv.id,
          sender_id: userId,
          content: `✅ Interview Confirmed!\n\nI've confirmed the interview for ${formatted}. Looking forward to speaking with you!`,
        })
        await supabase.from('conversations').update({
          last_message_at: new Date().toISOString(),
          last_message_preview: `✅ Interview confirmed for ${formatted}`,
        }).eq('id', conv.id)
      }
    }

    setInterviews(prev => prev.map(r => r.id === id ? { ...r, status: 'confirmed', confirmed_time: time } : r))
    setActionId(null)
  }

  const updateStatus = async (id: string, status: string) => {
    setActionId(id)
    await supabase.from('interview_requests').update({ status }).eq('id', id)
    setInterviews(prev => prev.map(r => r.id === id ? { ...r, status } : r))
    setActionId(null)
  }

  const getFiltered = () => {
    const now = Date.now()
    if (filter === 'upcoming') return interviews.filter(r =>
      r.status === 'confirmed' && r.confirmed_time && new Date(r.confirmed_time).getTime() > now
    ).sort((a, b) => new Date(a.confirmed_time!).getTime() - new Date(b.confirmed_time!).getTime())
    if (filter === 'pending') return interviews.filter(r => r.status === 'pending')
    return interviews.filter(r =>
      r.status === 'completed' || r.status === 'cancelled' || r.status === 'declined' ||
      (r.status === 'confirmed' && r.confirmed_time && new Date(r.confirmed_time).getTime() <= now)
    )
  }

  const counts = {
    upcoming: interviews.filter(r => r.status === 'confirmed' && r.confirmed_time && new Date(r.confirmed_time).getTime() > Date.now()).length,
    pending: interviews.filter(r => r.status === 'pending').length,
    past: interviews.filter(r => ['completed', 'cancelled', 'declined'].includes(r.status) || (r.status === 'confirmed' && r.confirmed_time && new Date(r.confirmed_time).getTime() <= Date.now())).length,
  }

  const filtered = getFiltered()

  if (loading) return (
    <div className="max-w-3xl mx-auto px-4 py-10 animate-pulse space-y-4">
      <div className="h-8 bg-gray-200 rounded w-1/3" />
      {[1, 2].map(i => <div key={i} className="h-32 bg-gray-100 rounded-2xl" />)}
    </div>
  )

  return (
    <div className="bg-gray-50 min-h-screen py-8">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">

        {/* Header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-gray-400 hover:text-red-600 transition-colors">
              <ArrowLeft size={20} />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <CalendarCheck size={22} className="text-red-600" /> Interviews
              </h1>
              <p className="text-sm text-gray-500 mt-0.5">
                {interviews.length === 0 ? 'No interviews yet' : `${interviews.length} total · ${counts.upcoming} upcoming`}
              </p>
            </div>
          </div>
          {isEmployer && (
            <Link
              href="/candidates"
              className="bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-4 py-2 rounded-xl flex items-center gap-2 transition-colors"
            >
              Schedule New
            </Link>
          )}
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {(['upcoming', 'pending', 'past'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors flex items-center gap-1.5 ${
                filter === f ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-400'
              }`}
            >
              {f === 'upcoming' && <CalendarCheck size={14} />}
              {f === 'pending' && <Clock size={14} />}
              {f === 'past' && <CalendarX size={14} />}
              {f.charAt(0).toUpperCase() + f.slice(1)}
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${filter === f ? 'bg-white/20' : 'bg-gray-100'}`}>
                {counts[f]}
              </span>
            </button>
          ))}
        </div>

        {/* Empty state */}
        {filtered.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-14 text-center">
            <CalendarCheck size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500 font-medium">
              {filter === 'upcoming' ? 'No upcoming interviews'
               : filter === 'pending' ? 'No pending requests'
               : 'No past interviews'}
            </p>
            {filter === 'pending' && isEmployer && (
              <p className="text-sm text-gray-400 mt-2">
                Go to the <Link href="/dashboard" className="text-red-600 hover:underline">pipeline</Link> and click &quot;Schedule Interview&quot; on a candidate.
              </p>
            )}
          </div>
        )}

        {/* Interview cards */}
        <div className="space-y-4">
          {filtered.map(req => {
            const FormatIcon = FORMAT_ICON[req.format] || Video
            const isMine = req.employer_id === userId
            const isExpanded = expandedId === req.id
            const cd = req.confirmed_time ? countdown(req.confirmed_time) : null

            return (
              <div key={req.id} className={`bg-white rounded-2xl border overflow-hidden transition-shadow hover:shadow-sm ${
                req.status === 'confirmed' && cd ? 'border-green-200' : 'border-gray-200'
              }`}>
                {/* Card header */}
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0 ${
                        isMine ? 'bg-gradient-to-br from-purple-500 to-purple-700' : 'bg-gradient-to-br from-red-500 to-red-700'
                      }`}>
                        {(isMine ? req.seeker_name : req.employer_name)?.charAt(0) || '?'}
                      </div>
                      <div>
                        <p className="font-bold text-gray-900">
                          {isMine ? req.seeker_name : req.employer_name}
                        </p>
                        {req.opp_title && (
                          <p className="text-xs text-blue-600 mt-0.5">{req.opp_title}</p>
                        )}
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="flex items-center gap-1 text-xs text-gray-500">
                            <FormatIcon size={11} /> {FORMAT_LABEL[req.format] || req.format}
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${STATUS_STYLE[req.status] || STATUS_STYLE.pending}`}>
                            {STATUS_LABEL[req.status] || req.status}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Confirmed time + countdown */}
                    {req.confirmed_time && (
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-semibold text-gray-900">{formatDT(req.confirmed_time)}</p>
                        {cd && <p className="text-xs text-green-600 font-medium mt-0.5">{cd}</p>}
                      </div>
                    )}
                  </div>

                  {/* Meeting link */}
                  {req.meeting_link && req.status === 'confirmed' && (
                    <div className="mt-3 p-3 bg-blue-50 rounded-xl border border-blue-100 flex items-center gap-2">
                      <FormatIcon size={14} className="text-blue-600 flex-shrink-0" />
                      <a
                        href={req.meeting_link.startsWith('http') ? req.meeting_link : `https://${req.meeting_link}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-700 hover:text-blue-900 font-medium truncate"
                      >
                        {req.format === 'in-person' ? req.meeting_link : 'Join Meeting →'}
                      </a>
                    </div>
                  )}
                </div>

                {/* Expand / collapse details */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : req.id)}
                  className="w-full flex items-center justify-between px-5 py-2.5 bg-gray-50 border-t border-gray-100 text-xs text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <span>{isExpanded ? 'Hide details' : 'Show details'}</span>
                  {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                </button>

                {isExpanded && (
                  <div className="px-5 pb-5 space-y-4 border-t border-gray-100 pt-4">

                    {/* Notes */}
                    {req.notes && (
                      <div className="bg-amber-50 rounded-xl p-3 border border-amber-100">
                        <p className="text-xs font-semibold text-amber-700 mb-1">Notes</p>
                        <p className="text-sm text-gray-700 leading-relaxed">{req.notes}</p>
                      </div>
                    )}

                    {/* Proposed times — seeker confirming */}
                    {!isMine && req.status === 'pending' && (
                      <div>
                        <p className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
                          <AlertCircle size={14} className="text-amber-500" /> Choose a time to confirm:
                        </p>
                        <div className="space-y-2">
                          {req.proposed_times.map(t => (
                            <button
                              key={t}
                              onClick={() => confirmTime(req.id, t)}
                              disabled={actionId === req.id}
                              className="w-full flex items-center justify-between px-4 py-3 bg-green-50 hover:bg-green-100 border border-green-200 rounded-xl text-sm font-medium text-green-800 transition-colors disabled:opacity-50"
                            >
                              <span className="flex items-center gap-2">
                                <CalendarCheck size={14} className="text-green-600" />
                                {formatDT(t)}
                              </span>
                              {actionId === req.id
                                ? <div className="w-4 h-4 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
                                : <span className="text-xs bg-green-600 text-white px-2 py-0.5 rounded-full">Confirm</span>}
                            </button>
                          ))}
                        </div>
                        <button
                          onClick={() => updateStatus(req.id, 'declined')}
                          disabled={actionId === req.id}
                          className="mt-2 flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700 transition-colors disabled:opacity-40"
                        >
                          <XCircle size={13} /> Decline this interview request
                        </button>
                      </div>
                    )}

                    {/* Proposed times — employer view (pending) */}
                    {isMine && req.status === 'pending' && (
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Proposed Times</p>
                        <div className="space-y-1.5">
                          {req.proposed_times.map(t => (
                            <div key={t} className="flex items-center gap-2 text-sm text-gray-700 bg-gray-50 px-3 py-2 rounded-lg">
                              <Clock size={13} className="text-gray-400 flex-shrink-0" />
                              {formatDT(t)}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex flex-wrap gap-2 pt-1">
                      {req.status === 'confirmed' && (
                        <button
                          onClick={() => updateStatus(req.id, 'completed')}
                          disabled={actionId === req.id}
                          className="flex items-center gap-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-full font-medium transition-colors disabled:opacity-50"
                        >
                          <CheckCircle2 size={12} /> Mark Complete
                        </button>
                      )}
                      {(req.status === 'pending' || req.status === 'confirmed') && isMine && (
                        <button
                          onClick={() => updateStatus(req.id, 'cancelled')}
                          disabled={actionId === req.id}
                          className="flex items-center gap-1.5 text-xs bg-gray-100 hover:bg-red-50 text-gray-500 hover:text-red-600 px-3 py-1.5 rounded-full font-medium transition-colors disabled:opacity-50"
                        >
                          <XCircle size={12} /> Cancel
                        </button>
                      )}
                      {req.opportunity_id && isMine && (
                        <Link
                          href={`/applications/${req.opportunity_id}`}
                          className="flex items-center gap-1.5 text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 px-3 py-1.5 rounded-full font-medium transition-colors"
                        >
                          View Pipeline
                        </Link>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
