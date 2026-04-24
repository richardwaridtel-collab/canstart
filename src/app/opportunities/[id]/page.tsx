'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import type { Opportunity } from '@/lib/types'
import { MapPin, Clock, Wifi, Building2, ArrowLeft, CheckCircle, Send, Briefcase, Shield } from 'lucide-react'
import { track } from '@vercel/analytics'


export default function OpportunityDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const [opportunity, setOpportunity] = useState<Opportunity | null>(null)
  const [loading, setLoading] = useState(true)
  const [applying, setApplying] = useState(false)
  const [applied, setApplied] = useState(false)
  const [coverNote, setCoverNote] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [user, setUser] = useState<{ id: string } | null>(null)
  const [userRole, setUserRole] = useState<string | null>(null)

  useEffect(() => {
    loadOpportunity()
    supabase.auth.getUser().then(async ({ data }) => {
      setUser(data.user)
      if (data.user) {
        const { data: profile } = await supabase.from('profiles').select('role').eq('user_id', data.user.id).single()
        setUserRole(profile?.role || null)
        // Check if already applied
        const { data: existing } = await supabase.from('applications').select('id').eq('opportunity_id', id).eq('seeker_id', data.user.id).single()
        if (existing) setApplied(true)
      }
    })
  }, [id])

  const loadOpportunity = async () => {
    const { data } = await supabase
      .from('opportunities')
      .select('*, employer_profiles(company_name)')
      .eq('id', id)
      .single()

    if (data) {
      setOpportunity({
        ...data,
        company_name: (data.employer_profiles as { company_name?: string } | null)?.company_name || 'Company',
        employer_name: (data.employer_profiles as { company_name?: string } | null)?.company_name || 'Company',
      })
    } else {
      setOpportunity(null)
    }
    setLoading(false)
  }

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) { router.push('/auth/signin'); return }
    setApplying(true)

    const { error } = await supabase.from('applications').insert({
      opportunity_id: id,
      seeker_id: user.id,
      cover_note: coverNote,
      status: 'pending',
    })

    if (!error) {
      setApplied(true)
      track('application_submitted', { opportunity_id: id, type: opportunity?.type })
    }
    setApplying(false)
  }

  const typeColors: Record<string, string> = { volunteer: 'bg-green-100 text-green-700', 'micro-internship': 'bg-blue-100 text-blue-700', paid: 'bg-purple-100 text-purple-700' }
  const typeLabels: Record<string, string> = { volunteer: 'Volunteer', 'micro-internship': 'Micro-Internship', paid: 'Paid Position' }

  if (loading) return (
    <div className="max-w-4xl mx-auto px-4 py-10 animate-pulse">
      <div className="h-8 bg-gray-200 rounded w-1/2 mb-4" />
      <div className="h-64 bg-gray-100 rounded" />
    </div>
  )

  if (!opportunity) return (
    <div className="max-w-4xl mx-auto px-4 py-16 text-center">
      <h2 className="text-xl font-semibold text-gray-700 mb-2">Opportunity not found</h2>
      <Link href="/opportunities" className="text-red-600 hover:underline">Browse all opportunities</Link>
    </div>
  )

  return (
    <div className="bg-gray-50 min-h-screen py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <Link href="/opportunities" className="inline-flex items-center gap-2 text-gray-500 hover:text-red-600 text-sm mb-6 transition-colors">
          <ArrowLeft size={16} /> Back to Opportunities
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <div className="flex flex-wrap gap-2 mb-4">
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${typeColors[opportunity.type]}`}>
                  {typeLabels[opportunity.type]}
                </span>
                <span className="text-xs font-medium px-2 py-1 rounded-full bg-emerald-100 text-emerald-700">Open</span>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-1">{opportunity.title}</h1>
              <p className="text-red-600 font-semibold mb-4">{opportunity.company_name}</p>

              <div className="flex flex-wrap gap-4 text-sm text-gray-500 mb-6">
                <span className="flex items-center gap-1.5"><MapPin size={15} />{opportunity.city}</span>
                <span className="flex items-center gap-1.5">{opportunity.work_mode === 'remote' ? <Wifi size={15} /> : <Building2 size={15} />}<span className="capitalize">{opportunity.work_mode}</span></span>
                <span className="flex items-center gap-1.5"><Clock size={15} />{opportunity.duration}</span>
                {opportunity.compensation && <span className="flex items-center gap-1.5"><Briefcase size={15} />{opportunity.compensation}</span>}
              </div>

              <div className="prose prose-sm max-w-none text-gray-700">
                {opportunity.description.split('\n').map((line, i) => (
                  <p key={i} className="mb-2">{line}</p>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <h2 className="font-semibold text-gray-900 mb-3">Skills Required</h2>
              <div className="flex flex-wrap gap-2">
                {opportunity.skills_required.map((skill) => (
                  <span key={skill} className="bg-gray-100 text-gray-700 text-sm px-3 py-1.5 rounded-full font-medium">{skill}</span>
                ))}
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5">
              <div className="flex items-start gap-3">
                <Shield size={20} className="text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-blue-900 text-sm mb-1">Verified Employer</h3>
                  <p className="text-blue-700 text-xs leading-relaxed">
                    This employer has been verified by CanStart. All opportunities are reviewed to ensure they are legitimate and safe for newcomers.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar / Apply */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl border border-gray-200 p-6 sticky top-24">
              {userRole === 'employer' ? (
                <div className="text-center py-4 text-gray-500 text-sm">
                  <Briefcase size={32} className="mx-auto text-gray-300 mb-2" />
                  Employer accounts cannot apply to opportunities.<br />
                  <Link href="/candidates" className="text-red-600 hover:underline text-sm mt-2 inline-block">Find candidates instead →</Link>
                </div>
              ) : applied ? (
                <div className="text-center py-4">
                  <CheckCircle size={40} className="text-green-500 mx-auto mb-3" />
                  <h3 className="font-semibold text-gray-900 mb-2">Application Sent!</h3>
                  <p className="text-sm text-gray-500">The employer will review your profile and reach out if there&apos;s a match.</p>
                </div>
              ) : (
                <>
                  <h2 className="font-bold text-gray-900 mb-4">Apply for this Opportunity</h2>
                  {!showForm ? (
                    <button
                      onClick={() => { if (!user) { router.push('/auth/signin') } else { setShowForm(true) } }}
                      className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors"
                    >
                      <Send size={18} /> Apply Now
                    </button>
                  ) : (
                    <form onSubmit={handleApply} className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Cover Note (optional)</label>
                        <textarea
                          value={coverNote}
                          onChange={(e) => setCoverNote(e.target.value)}
                          rows={4}
                          placeholder="Briefly introduce yourself and why you're interested in this opportunity..."
                          className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={applying}
                        className="w-full bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors"
                      >
                        {applying ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Send size={18} /> Submit Application</>}
                      </button>
                      <button type="button" onClick={() => setShowForm(false)} className="w-full text-sm text-gray-500 hover:text-gray-700">Cancel</button>
                    </form>
                  )}
                  <p className="text-xs text-gray-400 text-center mt-3">
                    {user ? 'Your profile will be shared with the employer.' : 'Sign in to apply for this opportunity.'}
                  </p>
                </>
              )}

              <div className="border-t border-gray-100 mt-5 pt-5 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Duration</span>
                  <span className="font-medium text-gray-900">{opportunity.duration}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Work Mode</span>
                  <span className="font-medium text-gray-900 capitalize">{opportunity.work_mode}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Location</span>
                  <span className="font-medium text-gray-900">{opportunity.city}</span>
                </div>
                {opportunity.compensation && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Compensation</span>
                    <span className="font-medium text-gray-900">{opportunity.compensation}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
