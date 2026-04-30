'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { MessageSquare, ArrowRight, Clock, CheckCheck, Briefcase } from 'lucide-react'

type Conversation = {
  id: string
  employer_id: string
  seeker_id: string
  opportunity_id: string | null
  last_message_at: string
  last_message_preview: string | null
  opp_title: string | null
  other_name: string
  other_initial: string
  unread: number
  is_employer: boolean
}

export default function MessagesInboxPage() {
  const router = useRouter()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => { loadInbox() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const loadInbox = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth/signin'); return }
    setUserId(user.id)

    // Load all conversations for this user
    const { data: convos } = await supabase
      .from('conversations')
      .select('id, employer_id, seeker_id, opportunity_id, last_message_at, last_message_preview, opportunities(title)')
      .order('last_message_at', { ascending: false })

    if (!convos || convos.length === 0) { setLoading(false); return }

    // Collect other-party IDs
    const otherIds = convos.map((c: Record<string, unknown>) =>
      c.employer_id === user.id ? c.seeker_id as string : c.employer_id as string
    )
    const uniqueIds = [...new Set(otherIds)]

    // Load their names
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, full_name')
      .in('user_id', uniqueIds)
    const nameMap = new Map((profiles || []).map((p: Record<string, unknown>) => [p.user_id as string, p.full_name as string]))

    // Load unread counts per conversation
    const { data: unreadMsgs } = await supabase
      .from('messages')
      .select('conversation_id')
      .neq('sender_id', user.id)
      .is('read_at', null)
    const unreadMap = new Map<string, number>()
    ;(unreadMsgs || []).forEach((m: Record<string, unknown>) => {
      const cid = m.conversation_id as string
      unreadMap.set(cid, (unreadMap.get(cid) || 0) + 1)
    })

    setConversations(convos.map((c: Record<string, unknown>) => {
      const isEmployer = c.employer_id === user.id
      const otherId = isEmployer ? c.seeker_id as string : c.employer_id as string
      const otherName = nameMap.get(otherId) || 'Unknown'
      const opp = c.opportunities as { title?: string } | null
      return {
        id: c.id as string,
        employer_id: c.employer_id as string,
        seeker_id: c.seeker_id as string,
        opportunity_id: c.opportunity_id as string | null,
        last_message_at: c.last_message_at as string,
        last_message_preview: c.last_message_preview as string | null,
        opp_title: opp?.title || null,
        other_name: otherName,
        other_initial: otherName.charAt(0).toUpperCase(),
        unread: unreadMap.get(c.id as string) || 0,
        is_employer: isEmployer,
      }
    }))
    setLoading(false)
  }

  const formatTime = (iso: string) => {
    const d = new Date(iso)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffH = Math.floor(diffMs / 3600000)
    const diffD = Math.floor(diffMs / 86400000)
    if (diffH < 1) return 'Just now'
    if (diffH < 24) return `${diffH}h ago`
    if (diffD === 1) return 'Yesterday'
    if (diffD < 7) return `${diffD}d ago`
    return d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })
  }

  const totalUnread = conversations.reduce((s, c) => s + c.unread, 0)

  if (loading) return (
    <div className="max-w-2xl mx-auto px-4 py-10 animate-pulse space-y-3">
      {[1, 2, 3].map(i => <div key={i} className="h-20 bg-gray-100 rounded-2xl" />)}
    </div>
  )

  return (
    <div className="bg-gray-50 min-h-screen py-8">
      <div className="max-w-2xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <MessageSquare size={22} className="text-red-600" /> Messages
              {totalUnread > 0 && (
                <span className="ml-1 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                  {totalUnread}
                </span>
              )}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {conversations.length === 0
                ? 'No conversations yet'
                : `${conversations.length} conversation${conversations.length !== 1 ? 's' : ''}`}
            </p>
          </div>
          <Link href="/dashboard" className="text-sm text-gray-500 hover:text-red-600 transition-colors">
            ← Dashboard
          </Link>
        </div>

        {/* Empty state */}
        {conversations.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-16 text-center">
            <MessageSquare size={40} className="mx-auto text-gray-300 mb-3" />
            <h3 className="font-semibold text-gray-700 mb-2">No messages yet</h3>
            <p className="text-sm text-gray-400 mb-6">
              {userId
                ? 'Conversations will appear here once an employer messages you, or you message a candidate.'
                : 'Sign in to view your messages.'}
            </p>
          </div>
        )}

        {/* Conversation list */}
        <div className="space-y-2">
          {conversations.map(conv => (
            <Link
              key={conv.id}
              href={`/messages/${conv.id}`}
              className={`block bg-white rounded-2xl border transition-all hover:shadow-md ${
                conv.unread > 0 ? 'border-red-200 shadow-sm' : 'border-gray-200'
              }`}
            >
              <div className="p-4 flex items-center gap-4">
                {/* Avatar */}
                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg flex-shrink-0 ${
                  conv.is_employer ? 'bg-gradient-to-br from-purple-500 to-purple-700' : 'bg-gradient-to-br from-red-500 to-red-700'
                }`}>
                  {conv.other_initial}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className={`font-semibold text-gray-900 truncate ${conv.unread > 0 ? 'font-bold' : ''}`}>
                      {conv.other_name}
                    </p>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {conv.unread > 0 ? (
                        <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                          {conv.unread}
                        </span>
                      ) : (
                        <CheckCheck size={14} className="text-gray-300" />
                      )}
                      <span className="text-xs text-gray-400 flex items-center gap-1">
                        <Clock size={10} /> {formatTime(conv.last_message_at)}
                      </span>
                    </div>
                  </div>
                  {conv.opp_title && (
                    <p className="text-xs text-blue-600 flex items-center gap-1 mt-0.5">
                      <Briefcase size={10} /> {conv.opp_title}
                    </p>
                  )}
                  <p className={`text-sm mt-0.5 truncate ${conv.unread > 0 ? 'text-gray-800 font-medium' : 'text-gray-500'}`}>
                    {conv.last_message_preview || 'No messages yet'}
                  </p>
                </div>

                <ArrowRight size={16} className="text-gray-300 flex-shrink-0" />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
