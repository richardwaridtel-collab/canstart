'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { ArrowLeft, Send, Briefcase, CheckCheck, Clock } from 'lucide-react'

type Message = {
  id: string
  conversation_id: string
  sender_id: string
  content: string
  read_at: string | null
  created_at: string
}

type ConversationMeta = {
  id: string
  employer_id: string
  seeker_id: string
  opp_title: string | null
  other_name: string
  other_initial: string
  is_employer: boolean
}

export default function ChatPage() {
  const params = useParams()
  const router = useRouter()
  const conversationId = params.conversationId as string

  const [meta, setMeta] = useState<ConversationMeta | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null

    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/signin'); return }
      setUserId(user.id)
      await loadChat(user.id)
      setLoading(false)

      // Real-time subscription for new messages
      channel = supabase
        .channel(`chat-${conversationId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `conversation_id=eq.${conversationId}`,
          },
          (payload) => {
            const msg = payload.new as Message
            setMessages(prev => {
              if (prev.find(m => m.id === msg.id)) return prev
              return [...prev, msg]
            })
            // Mark as read if received (not sent by me)
            if (msg.sender_id !== user.id) {
              supabase.from('messages').update({ read_at: new Date().toISOString() }).eq('id', msg.id).then(() => {})
            }
          }
        )
        .subscribe()
    }

    init()
    return () => { if (channel) supabase.removeChannel(channel) }
  }, [conversationId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-scroll whenever messages change
  useEffect(() => {
    if (!loading) scrollToBottom()
  }, [messages, loading])

  const loadChat = async (uid: string) => {
    // Load conversation
    const { data: conv } = await supabase
      .from('conversations')
      .select('id, employer_id, seeker_id, opportunity_id, opportunities(title)')
      .eq('id', conversationId)
      .single()

    if (!conv) { router.push('/messages'); return }

    const isEmployer = conv.employer_id === uid
    const otherId = isEmployer ? conv.seeker_id : conv.employer_id
    const { data: otherProfile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('user_id', otherId)
      .single()

    const otherName = otherProfile?.full_name || 'Unknown'
    const opp = conv.opportunities as { title?: string } | null

    setMeta({
      id: conv.id,
      employer_id: conv.employer_id,
      seeker_id: conv.seeker_id,
      opp_title: opp?.title || null,
      other_name: otherName,
      other_initial: otherName.charAt(0).toUpperCase(),
      is_employer: isEmployer,
    })

    // Load messages
    const { data: msgs } = await supabase
      .from('messages')
      .select('id, conversation_id, sender_id, content, read_at, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })

    setMessages((msgs || []) as Message[])

    // Mark unread messages (from the other party) as read
    const unreadIds = (msgs || [])
      .filter((m: Record<string, unknown>) => m.sender_id !== uid && !m.read_at)
      .map((m: Record<string, unknown>) => m.id as string)
    if (unreadIds.length > 0) {
      await supabase
        .from('messages')
        .update({ read_at: new Date().toISOString() })
        .in('id', unreadIds)
    }
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const sendMessage = async () => {
    const content = newMessage.trim()
    if (!content || !userId || sending) return
    setSending(true)
    setNewMessage('')

    const { data: sent, error } = await supabase
      .from('messages')
      .insert({ conversation_id: conversationId, sender_id: userId, content })
      .select()
      .single()

    if (!error && sent) {
      // Optimistic add (real-time subscription might add it too — deduped by id check)
      setMessages(prev => prev.find(m => m.id === sent.id) ? prev : [...prev, sent as Message])

      // Update conversation preview
      await supabase
        .from('conversations')
        .update({
          last_message_at: new Date().toISOString(),
          last_message_preview: content.length > 80 ? content.slice(0, 77) + '…' : content,
        })
        .eq('id', conversationId)
    }
    setSending(false)
    inputRef.current?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const formatTime = (iso: string) => {
    const d = new Date(iso)
    const now = new Date()
    const diffD = Math.floor((now.getTime() - d.getTime()) / 86400000)
    if (diffD === 0) return d.toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit' })
    if (diffD === 1) return `Yesterday ${d.toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit' })}`
    return d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  const groupByDate = (msgs: Message[]) => {
    const groups: { date: string; messages: Message[] }[] = []
    msgs.forEach(msg => {
      const d = new Date(msg.created_at)
      const label = (() => {
        const now = new Date()
        const diffD = Math.floor((now.getTime() - d.getTime()) / 86400000)
        if (diffD === 0) return 'Today'
        if (diffD === 1) return 'Yesterday'
        return d.toLocaleDateString('en-CA', { weekday: 'long', month: 'short', day: 'numeric' })
      })()
      const last = groups[groups.length - 1]
      if (last && last.date === label) last.messages.push(msg)
      else groups.push({ date: label, messages: [msg] })
    })
    return groups
  }

  if (loading) return (
    <div className="flex flex-col h-screen max-w-2xl mx-auto px-4 py-6 animate-pulse space-y-3">
      <div className="h-16 bg-gray-100 rounded-2xl" />
      <div className="flex-1 bg-gray-50 rounded-2xl" />
      <div className="h-16 bg-gray-100 rounded-2xl" />
    </div>
  )

  if (!meta) return null

  const messageGroups = groupByDate(messages)

  return (
    <div className="bg-gray-50 min-h-screen flex flex-col">
      <div className="max-w-2xl mx-auto w-full flex flex-col flex-1 px-4 sm:px-6">

        {/* Chat header */}
        <div className="bg-white border-b border-gray-200 sticky top-16 z-10 py-4 flex items-center gap-3">
          <Link href="/messages" className="text-gray-400 hover:text-red-600 transition-colors p-1 rounded-lg">
            <ArrowLeft size={20} />
          </Link>
          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0 ${
            meta.is_employer ? 'bg-gradient-to-br from-purple-500 to-purple-700' : 'bg-gradient-to-br from-red-500 to-red-700'
          }`}>
            {meta.other_initial}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-900 truncate">{meta.other_name}</p>
            {meta.opp_title && (
              <p className="text-xs text-blue-600 flex items-center gap-1 truncate">
                <Briefcase size={10} /> {meta.opp_title}
              </p>
            )}
          </div>
        </div>

        {/* Messages area */}
        <div className="flex-1 py-6 space-y-1 overflow-y-auto">
          {messages.length === 0 && (
            <div className="text-center py-16">
              <div className="text-4xl mb-3">💬</div>
              <p className="text-gray-500 text-sm font-medium">Start the conversation</p>
              <p className="text-gray-400 text-xs mt-1">Messages are private between you and {meta.other_name}.</p>
            </div>
          )}

          {messageGroups.map(group => (
            <div key={group.date}>
              {/* Date separator */}
              <div className="flex items-center gap-3 my-4">
                <div className="flex-1 h-px bg-gray-200" />
                <span className="text-xs text-gray-400 font-medium flex-shrink-0">{group.date}</span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>

              {group.messages.map((msg, idx) => {
                const isMine = msg.sender_id === userId
                const prevMsg = idx > 0 ? group.messages[idx - 1] : null
                const showAvatar = !prevMsg || prevMsg.sender_id !== msg.sender_id

                return (
                  <div key={msg.id} className={`flex items-end gap-2 mb-1 ${isMine ? 'flex-row-reverse' : 'flex-row'}`}>
                    {/* Avatar placeholder to align messages */}
                    {!isMine && (
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${
                        meta.is_employer ? 'bg-gradient-to-br from-purple-500 to-purple-700' : 'bg-gradient-to-br from-red-500 to-red-700'
                      } ${showAvatar ? 'opacity-100' : 'opacity-0'}`}>
                        {meta.other_initial}
                      </div>
                    )}

                    <div className={`max-w-[75%] ${isMine ? 'items-end' : 'items-start'} flex flex-col`}>
                      <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                        isMine
                          ? 'bg-red-600 text-white rounded-br-sm'
                          : 'bg-white border border-gray-200 text-gray-800 rounded-bl-sm shadow-sm'
                      }`}>
                        {msg.content}
                      </div>
                      <div className={`flex items-center gap-1 mt-0.5 px-1 ${isMine ? 'flex-row-reverse' : ''}`}>
                        <span className="text-xs text-gray-400 flex items-center gap-0.5">
                          <Clock size={9} /> {formatTime(msg.created_at)}
                        </span>
                        {isMine && msg.read_at && (
                          <CheckCheck size={12} className="text-blue-400" aria-label="Read" />
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ))}

          <div ref={messagesEndRef} />
        </div>

        {/* Message input */}
        <div className="sticky bottom-0 bg-gray-50 pt-2 pb-4">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm flex items-end gap-2 p-2">
            <textarea
              ref={inputRef}
              value={newMessage}
              onChange={e => setNewMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Write a message… (Enter to send, Shift+Enter for new line)"
              rows={1}
              className="flex-1 resize-none px-3 py-2 text-sm text-gray-800 focus:outline-none bg-transparent leading-relaxed max-h-32 overflow-y-auto"
              style={{ minHeight: '40px' }}
              onInput={e => {
                const t = e.currentTarget
                t.style.height = 'auto'
                t.style.height = Math.min(t.scrollHeight, 128) + 'px'
              }}
            />
            <button
              onClick={sendMessage}
              disabled={!newMessage.trim() || sending}
              className="flex-shrink-0 w-10 h-10 bg-red-600 hover:bg-red-700 disabled:bg-gray-200 text-white rounded-xl flex items-center justify-center transition-colors"
            >
              {sending
                ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <Send size={16} />}
            </button>
          </div>
          <p className="text-center text-xs text-gray-400 mt-1.5">Enter to send · Shift+Enter for new line</p>
        </div>

      </div>
    </div>
  )
}
