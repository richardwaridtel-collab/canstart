'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { ArrowLeft, Video, Phone, MapPin, Send, Plus, X, CalendarCheck } from 'lucide-react'

const FORMATS = [
  { key: 'video',      label: 'Video Call',  icon: Video,   hint: 'Google Meet, Zoom, Teams…' },
  { key: 'phone',      label: 'Phone Call',  icon: Phone,   hint: 'Candidate will call you'   },
  { key: 'in-person',  label: 'In-Person',   icon: MapPin,  hint: 'Office or public location'  },
]

function ScheduleForm() {
  const router = useRouter()
  const params = useSearchParams()

  const seekerId   = params.get('seekerId')   || ''
  const seekerName = params.get('seekerName') || 'Candidate'
  const appId      = params.get('appId')      || ''
  const oppId      = params.get('oppId')      || ''
  const oppTitle   = params.get('oppTitle')   || ''

  const [format, setFormat]     = useState('video')
  const [link, setLink]         = useState('')
  const [notes, setNotes]       = useState('')
  const [times, setTimes]       = useState(['', '', ''])
  const [loading, setLoading]   = useState(false)
  const [done, setDone]         = useState(false)
  const [error, setError]       = useState('')
  const [employerName, setEmployerName] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.push('/auth/signin'); return }
      const { data: profile } = await supabase.from('profiles').select('role, full_name').eq('user_id', data.user.id).single()
      if (profile?.role !== 'employer') { router.push('/dashboard'); return }
      setEmployerName(profile.full_name || '')
    })
  }, [router])

  const validTimes = times.filter(t => t.trim() !== '')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (validTimes.length === 0) { setError('Please add at least one proposed time.'); return }
    setError('')
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Find or create a conversation thread for this employer+seeker+opportunity
    let conversationId: string | null = null
    const { data: existing } = await supabase
      .from('conversations')
      .select('id')
      .eq('employer_id', user.id)
      .eq('seeker_id', seekerId)
      .eq('opportunity_id', oppId || null)
      .maybeSingle()

    if (existing) {
      conversationId = existing.id
    } else if (seekerId) {
      const { data: created } = await supabase
        .from('conversations')
        .insert({ employer_id: user.id, seeker_id: seekerId, opportunity_id: oppId || null })
        .select('id')
        .single()
      conversationId = created?.id || null
    }

    // Create interview request
    const { error: insertErr } = await supabase.from('interview_requests').insert({
      employer_id:     user.id,
      seeker_id:       seekerId,
      opportunity_id:  oppId || null,
      application_id:  appId || null,
      conversation_id: conversationId,
      seeker_name:     seekerName,
      employer_name:   employerName,
      opp_title:       oppTitle || null,
      proposed_times:  validTimes,
      format,
      meeting_link:    link.trim() || null,
      notes:           notes.trim() || null,
      status:          'pending',
    })

    if (insertErr) { setError('Could not send request. Please try again.'); setLoading(false); return }

    // Move pipeline stage to 'interview' if we have an application id
    if (appId) {
      await supabase.from('applications').update({ pipeline_stage: 'interview', status: 'reviewed' }).eq('id', appId)
    }

    // Post a message in the conversation so the candidate sees it in their inbox
    if (conversationId) {
      const formatLabel = FORMATS.find(f => f.key === format)?.label || format
      const timesList = validTimes
        .map(t => new Date(t).toLocaleString('en-CA', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }))
        .join('\n• ')
      const msgContent = `📅 Interview Request\n\nI'd like to schedule a ${formatLabel} interview with you for ${oppTitle || 'our opportunity'}.\n\nProposed times:\n• ${timesList}${link ? `\n\nMeeting link / Location: ${link}` : ''}${notes ? `\n\nNotes: ${notes}` : ''}\n\nPlease confirm your preferred time on your CanStart dashboard.`

      await supabase.from('messages').insert({
        conversation_id: conversationId,
        sender_id: user.id,
        content: msgContent,
      })
      await supabase.from('conversations').update({
        last_message_at: new Date().toISOString(),
        last_message_preview: `📅 Interview request sent for ${oppTitle || 'opportunity'}`,
      }).eq('id', conversationId)
    }

    setLoading(false)
    setDone(true)
    setTimeout(() => router.push(appId ? `/applications/${oppId}` : '/interviews'), 2000)
  }

  const updateTime = (idx: number, val: string) => {
    setTimes(prev => prev.map((t, i) => i === idx ? val : t))
  }

  // Minimum date-time = now + 1 hour, rounded up to next 30 min
  const minDateTime = (() => {
    const d = new Date(Date.now() + 3600000)
    d.setMinutes(d.getMinutes() < 30 ? 30 : 60, 0, 0)
    return d.toISOString().slice(0, 16)
  })()

  if (done) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl border border-green-200 p-10 text-center max-w-sm w-full shadow-sm">
        <CalendarCheck size={48} className="text-green-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-gray-900 mb-2">Interview Request Sent!</h2>
        <p className="text-sm text-gray-500">{seekerName} will receive a notification and can confirm their preferred time from their dashboard.</p>
        <p className="text-xs text-gray-400 mt-4">Redirecting…</p>
      </div>
    </div>
  )

  return (
    <div className="bg-gray-50 min-h-screen py-8">
      <div className="max-w-xl mx-auto px-4 sm:px-6">
        <Link href={appId ? `/applications/${oppId}` : '/interviews'} className="inline-flex items-center gap-2 text-gray-500 hover:text-red-600 text-sm mb-6 transition-colors">
          <ArrowLeft size={16} /> Back
        </Link>

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Schedule Interview</h1>
          <p className="text-gray-500 text-sm mt-1">
            Sending to <span className="font-semibold text-gray-700">{seekerName}</span>
            {oppTitle && <> for <span className="font-semibold text-gray-700">{oppTitle}</span></>}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-200 p-6 space-y-6">

          {/* Format */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">Interview Format</label>
            <div className="grid grid-cols-3 gap-3">
              {FORMATS.map(({ key, label, icon: Icon, hint }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFormat(key)}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all text-center ${
                    format === key
                      ? 'border-red-500 bg-red-50 text-red-700'
                      : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <Icon size={20} />
                  <span className="text-xs font-semibold">{label}</span>
                  <span className="text-xs text-gray-400 leading-tight hidden sm:block">{hint}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Proposed times */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Proposed Time Slots <span className="text-red-500">*</span>
            </label>
            <p className="text-xs text-gray-400 mb-3">Offer 2–3 options so the candidate can choose what works best.</p>
            <div className="space-y-2.5">
              {times.map((t, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 w-16 flex-shrink-0">Option {idx + 1}{idx === 0 ? ' *' : ''}</span>
                  <div className="flex-1 relative">
                    <input
                      type="datetime-local"
                      value={t}
                      onChange={e => updateTime(idx, e.target.value)}
                      min={minDateTime}
                      required={idx === 0}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                  </div>
                  {idx > 0 && t && (
                    <button type="button" onClick={() => updateTime(idx, '')} className="text-gray-300 hover:text-red-500 transition-colors p-1">
                      <X size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {validTimes.length < 3 && (
              <button
                type="button"
                onClick={() => setTimes(prev => [...prev.slice(0, validTimes.length), '', ...prev.slice(validTimes.length + 1)])}
                className="mt-2 flex items-center gap-1 text-xs text-gray-400 hover:text-red-600 transition-colors"
              >
                <Plus size={12} /> Add another time slot
              </button>
            )}
          </div>

          {/* Link / location */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              {format === 'in-person' ? 'Meeting Address' : 'Meeting Link'}
            </label>
            <input
              type={format === 'in-person' ? 'text' : 'url'}
              value={link}
              onChange={e => setLink(e.target.value)}
              placeholder={
                format === 'video' ? 'https://meet.google.com/xxx or Zoom link…'
                : format === 'phone' ? 'Your phone number (optional)'
                : '123 Main St, Ottawa, ON'
              }
              className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            />
            {format === 'video' && !link && (
              <p className="text-xs text-amber-600 mt-1">💡 Tip: You can add the link now or after the candidate confirms.</p>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Additional Notes <span className="text-gray-400 font-normal">(optional)</span></label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              placeholder="What to expect, who they'll meet, what to prepare…"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
            />
          </div>

          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-700">
            <strong>What happens next:</strong> {seekerName} will be notified and can confirm one of your proposed times from their dashboard. You'll see the confirmed slot in your interview schedule.
          </div>

          <button
            type="submit"
            disabled={loading || validTimes.length === 0}
            className="w-full bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors"
          >
            {loading
              ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : <><Send size={16} /> Send Interview Request</>}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function ScheduleInterviewPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="w-8 h-8 border-4 border-gray-300 border-t-red-500 rounded-full animate-spin" /></div>}>
      <ScheduleForm />
    </Suspense>
  )
}
