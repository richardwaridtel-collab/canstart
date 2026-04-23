'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { PlusCircle, X, CheckCircle, ArrowRight } from 'lucide-react'
import { track } from '@vercel/analytics'

const SKILL_SUGGESTIONS = ['Project Management', 'Data Analysis', 'Python', 'SQL', 'Marketing', 'Excel', 'Accounting', 'Customer Service', 'HR', 'Sales', 'Java', 'JavaScript', 'React', 'Figma', 'SEO', 'Content Writing', 'Bookkeeping', 'QuickBooks', 'Recruiting', 'PowerBI', 'Tableau', 'Financial Analysis', 'Supply Chain', 'Logistics', 'Engineering']

export default function ProfileSetupPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [role, setRole] = useState<'seeker' | 'employer' | null>(null)
  const [skills, setSkills] = useState<string[]>([])
  const [skillInput, setSkillInput] = useState('')
  const [form, setForm] = useState({
    bio: '',
    education: '',
    workPreference: 'any',
    linkedinUrl: '',
    website: '',
    description: '',
  })

  useEffect(() => {
    loadProfile()
  }, [])

  const loadProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth/signin'); return }

    const { data: profile } = await supabase.from('profiles').select('*').eq('user_id', user.id).single()
    if (!profile) { router.push('/auth/signup'); return }
    setRole(profile.role)

    if (profile.role === 'seeker') {
      const { data } = await supabase.from('seeker_profiles').select('*').eq('user_id', user.id).single()
      if (data) {
        setSkills(data.skills || [])
        setForm((f) => ({ ...f, bio: data.bio || '', education: data.education || '', workPreference: data.work_preference || 'any', linkedinUrl: data.linkedin_url || '' }))
      }
    } else {
      const { data } = await supabase.from('employer_profiles').select('*').eq('user_id', user.id).single()
      if (data) {
        setForm((f) => ({ ...f, website: data.website || '', description: data.description || '' }))
      }
    }
  }

  const addSkill = (skill: string) => {
    const s = skill.trim()
    if (s && !skills.includes(s)) setSkills([...skills, s])
    setSkillInput('')
  }

  const removeSkill = (skill: string) => setSkills(skills.filter((s) => s !== skill))

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    if (role === 'seeker') {
      await supabase.from('seeker_profiles').upsert({
        user_id: user.id,
        bio: form.bio,
        education: form.education,
        work_preference: form.workPreference,
        linkedin_url: form.linkedinUrl,
        skills,
      }, { onConflict: 'user_id' })
      track('profile_updated_seeker', { skills_count: skills.length })
    } else {
      await supabase.from('employer_profiles').upsert({
        user_id: user.id,
        website: form.website,
        description: form.description,
      }, { onConflict: 'user_id' })
      track('profile_updated_employer')
    }

    setSaved(true)
    setLoading(false)
    setTimeout(() => router.push('/dashboard'), 1500)
  }

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Complete Your Profile</h1>
          <p className="text-gray-500">Help employers find you with a detailed profile</p>
        </div>

        {saved && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-3 text-green-700">
            <CheckCircle size={20} />
            <span className="font-medium">Profile saved! Redirecting to dashboard...</span>
          </div>
        )}

        <form onSubmit={handleSave} className="bg-white rounded-2xl border border-gray-200 p-6 space-y-6">
          {role === 'seeker' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bio / Summary</label>
                <textarea
                  value={form.bio}
                  onChange={(e) => setForm({ ...form, bio: e.target.value })}
                  rows={3}
                  placeholder="Brief introduction about yourself, your experience, and your career goals in Canada..."
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Highest Education</label>
                <input
                  type="text"
                  value={form.education}
                  onChange={(e) => setForm({ ...form, education: e.target.value })}
                  placeholder="e.g., Bachelor's in Computer Science"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Work Preference</label>
                <select
                  value={form.workPreference}
                  onChange={(e) => setForm({ ...form, workPreference: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-white"
                >
                  <option value="any">Any (open to all)</option>
                  <option value="remote">Remote only</option>
                  <option value="hybrid">Hybrid</option>
                  <option value="onsite">On-site only</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">LinkedIn Profile URL</label>
                <input
                  type="url"
                  value={form.linkedinUrl}
                  onChange={(e) => setForm({ ...form, linkedinUrl: e.target.value })}
                  placeholder="https://linkedin.com/in/yourname"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Skills</label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {skills.map((skill) => (
                    <span key={skill} className="flex items-center gap-1.5 bg-red-50 text-red-700 border border-red-200 text-sm px-3 py-1.5 rounded-full font-medium">
                      {skill}
                      <button type="button" onClick={() => removeSkill(skill)} className="hover:text-red-900">
                        <X size={14} />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={skillInput}
                    onChange={(e) => setSkillInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSkill(skillInput) } }}
                    placeholder="Type a skill and press Enter..."
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                  <button
                    type="button"
                    onClick={() => addSkill(skillInput)}
                    className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm text-gray-600 transition-colors"
                  >
                    <PlusCircle size={18} />
                  </button>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {SKILL_SUGGESTIONS.filter((s) => !skills.includes(s)).slice(0, 8).map((s) => (
                    <button key={s} type="button" onClick={() => addSkill(s)} className="text-xs text-gray-500 hover:text-red-600 bg-gray-100 hover:bg-red-50 px-2.5 py-1 rounded-full transition-colors">
                      + {s}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {role === 'employer' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Company Website</label>
                <input
                  type="url"
                  value={form.website}
                  onChange={(e) => setForm({ ...form, website: e.target.value })}
                  placeholder="https://yourcompany.ca"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Company Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={4}
                  placeholder="Tell newcomers about your company, your culture, and why they should join you..."
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
                />
              </div>
            </>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={loading || saved}
              className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors"
            >
              {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><CheckCircle size={18} /> Save Profile</>}
            </button>
            <button
              type="button"
              onClick={() => router.push('/dashboard')}
              className="px-5 py-3 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 text-sm font-medium transition-colors flex items-center gap-2"
            >
              Skip <ArrowRight size={16} />
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
