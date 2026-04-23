'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Briefcase, Clock, CheckCircle, XCircle, PlusCircle, Users, ArrowRight, Eye } from 'lucide-react'

type Profile = { role: 'seeker' | 'employer'; full_name: string; city: string }
type Application = { id: string; status: string; created_at: string; opportunity?: { title: string; company_name?: string; type: string } }
type PostedJob = { id: string; title: string; status: string; created_at: string; type: string; applications_count?: number }

const statusIcon = (status: string) => {
  if (status === 'accepted') return <CheckCircle size={16} className="text-green-500" />
  if (status === 'rejected') return <XCircle size={16} className="text-red-400" />
  return <Clock size={16} className="text-yellow-500" />
}

const statusLabel: Record<string, string> = {
  pending: 'Under Review',
  reviewed: 'Reviewed',
  accepted: 'Accepted',
  rejected: 'Not Selected',
}

export default function DashboardPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [applications, setApplications] = useState<Application[]>([])
  const [postedJobs, setPostedJobs] = useState<PostedJob[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDashboard()
  }, [])

  const loadDashboard = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth/signin'); return }

    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (!profileData) { router.push('/profile/setup'); return }
    setProfile(profileData)

    if (profileData.role === 'seeker') {
      const { data: apps } = await supabase
        .from('applications')
        .select('*, opportunities(title, type, employer_profiles(company_name))')
        .eq('seeker_id', user.id)
        .order('created_at', { ascending: false })

      setApplications((apps || []).map((a: Record<string, unknown>) => ({
        id: a.id as string,
        status: a.status as string,
        created_at: a.created_at as string,
        opportunity: a.opportunities ? {
          title: (a.opportunities as Record<string, unknown>).title as string,
          type: (a.opportunities as Record<string, unknown>).type as string,
          company_name: ((a.opportunities as Record<string, unknown>).employer_profiles as { company_name?: string } | null)?.company_name,
        } : undefined,
      })))
    } else {
      const { data: jobs } = await supabase
        .from('opportunities')
        .select('*, applications(count)')
        .eq('employer_id', user.id)
        .order('created_at', { ascending: false })

      setPostedJobs((jobs || []).map((j: Record<string, unknown>) => ({
        id: j.id as string,
        title: j.title as string,
        status: j.status as string,
        created_at: j.created_at as string,
        type: j.type as string,
        applications_count: Array.isArray(j.applications) ? j.applications.length : 0,
      })))
    }

    setLoading(false)
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-10 animate-pulse space-y-4">
        <div className="h-8 bg-gray-200 rounded w-1/3" />
        <div className="h-32 bg-gray-100 rounded-xl" />
        <div className="h-48 bg-gray-100 rounded-xl" />
      </div>
    )
  }

  if (!profile) return null

  return (
    <div className="bg-gray-50 min-h-screen py-8">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="bg-gradient-to-r from-red-600 to-red-700 text-white rounded-2xl p-6 mb-6">
          <p className="text-red-200 text-sm mb-1">Welcome back</p>
          <h1 className="text-2xl font-bold">{profile.full_name}</h1>
          <p className="text-red-100 mt-1">{profile.city} · {profile.role === 'seeker' ? 'Job Seeker' : 'Employer'}</p>
          <div className="mt-4 flex flex-wrap gap-3">
            {profile.role === 'seeker' ? (
              <>
                <Link href="/opportunities" className="bg-white text-red-600 hover:bg-red-50 px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors">
                  <Briefcase size={16} /> Browse Opportunities
                </Link>
                <Link href="/profile/setup" className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors">
                  Edit Profile
                </Link>
              </>
            ) : (
              <>
                <Link href="/post-opportunity" className="bg-white text-red-600 hover:bg-red-50 px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors">
                  <PlusCircle size={16} /> Post Opportunity
                </Link>
                <Link href="/candidates" className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors">
                  <Users size={16} /> Browse Candidates
                </Link>
              </>
            )}
          </div>
        </div>

        {profile.role === 'seeker' ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
              <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
                <div className="text-2xl font-bold text-gray-900">{applications.length}</div>
                <div className="text-sm text-gray-500 mt-1">Applications Sent</div>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
                <div className="text-2xl font-bold text-green-600">{applications.filter((a) => a.status === 'accepted').length}</div>
                <div className="text-sm text-gray-500 mt-1">Accepted</div>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
                <div className="text-2xl font-bold text-yellow-500">{applications.filter((a) => a.status === 'pending' || a.status === 'reviewed').length}</div>
                <div className="text-sm text-gray-500 mt-1">Pending</div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-gray-900 text-lg">My Applications</h2>
                <Link href="/opportunities" className="text-sm text-red-600 hover:text-red-700 flex items-center gap-1">
                  Browse more <ArrowRight size={14} />
                </Link>
              </div>
              {applications.length === 0 ? (
                <div className="text-center py-10">
                  <Briefcase size={36} className="mx-auto text-gray-300 mb-3" />
                  <p className="text-gray-500 text-sm mb-4">You haven&apos;t applied to any opportunities yet.</p>
                  <Link href="/opportunities" className="bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-4 py-2 rounded-lg inline-flex items-center gap-2 transition-colors">
                    Browse Opportunities <ArrowRight size={14} />
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {applications.map((app) => (
                    <div key={app.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 text-sm truncate">{app.opportunity?.title || 'Opportunity'}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{app.opportunity?.company_name} · {new Date(app.created_at).toLocaleDateString()}</p>
                      </div>
                      <div className="flex items-center gap-2 ml-3">
                        {statusIcon(app.status)}
                        <span className="text-xs font-medium text-gray-600">{statusLabel[app.status] || app.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
              <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
                <div className="text-2xl font-bold text-gray-900">{postedJobs.length}</div>
                <div className="text-sm text-gray-500 mt-1">Posted Jobs</div>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
                <div className="text-2xl font-bold text-green-600">{postedJobs.filter((j) => j.status === 'open').length}</div>
                <div className="text-sm text-gray-500 mt-1">Active Listings</div>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
                <div className="text-2xl font-bold text-blue-600">{postedJobs.reduce((s, j) => s + (j.applications_count || 0), 0)}</div>
                <div className="text-sm text-gray-500 mt-1">Total Applications</div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-gray-900 text-lg">Posted Opportunities</h2>
                <Link href="/post-opportunity" className="text-sm text-red-600 hover:text-red-700 flex items-center gap-1">
                  <PlusCircle size={14} /> Post New
                </Link>
              </div>
              {postedJobs.length === 0 ? (
                <div className="text-center py-10">
                  <PlusCircle size={36} className="mx-auto text-gray-300 mb-3" />
                  <p className="text-gray-500 text-sm mb-4">You haven&apos;t posted any opportunities yet.</p>
                  <Link href="/post-opportunity" className="bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-4 py-2 rounded-lg inline-flex items-center gap-2 transition-colors">
                    Post Your First Opportunity <ArrowRight size={14} />
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {postedJobs.map((job) => (
                    <div key={job.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 text-sm truncate">{job.title}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{job.type} · {new Date(job.created_at).toLocaleDateString()}</p>
                      </div>
                      <div className="flex items-center gap-3 ml-3">
                        <span className="text-xs text-blue-600 font-medium flex items-center gap-1">
                          <Users size={12} /> {job.applications_count || 0}
                        </span>
                        <span className={`text-xs font-medium px-2 py-1 rounded-full ${job.status === 'open' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {job.status}
                        </span>
                        <Link href={`/opportunities/${job.id}`} className="text-gray-400 hover:text-red-600 transition-colors">
                          <Eye size={16} />
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
