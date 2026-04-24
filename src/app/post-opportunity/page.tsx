'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { PlusCircle, X, CheckCircle, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { track } from '@vercel/analytics'

const SKILL_SUGGESTIONS = ['Project Management', 'Data Analysis', 'Python', 'SQL', 'Marketing', 'Excel', 'Accounting', 'Customer Service', 'HR', 'Sales', 'JavaScript', 'React', 'Figma', 'SEO', 'Content Writing', 'Bookkeeping', 'QuickBooks', 'Recruiting', 'PowerBI', 'Tableau']

export default function PostOpportunityPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [posted, setPosted] = useState(false)
  const [skills, setSkills] = useState<string[]>([])
  const [skillInput, setSkillInput] = useState('')
  const [form, setForm] = useState({
    title: '',
    description: '',
    type: 'volunteer',
    city: 'Ottawa',
    workMode: 'hybrid',
    duration: '',
    compensation: '',
    experienceLevel: 'any',
    category: 'General',
  })

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth/signin'); return }
    const { data: profile } = await supabase.from('profiles').select('role').eq('user_id', user.id).single()
    if (!profile || profile.role !== 'employer') { router.push('/dashboard') }
  }

  const addSkill = (skill: string) => {
    const s = skill.trim()
    if (s && !skills.includes(s)) setSkills([...skills, s])
    setSkillInput('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase.from('opportunities').insert({
      employer_id: user.id,
      title: form.title,
      description: form.description,
      type: form.type,
      city: form.city,
      work_mode: form.workMode,
      duration: form.duration,
      compensation: form.compensation || null,
      skills_required: skills,
      experience_level: form.experienceLevel,
      category: form.category,
      status: 'open',
    })

    if (!error) {
      track('opportunity_posted', { type: form.type, city: form.city })
      setPosted(true)
      setTimeout(() => router.push('/dashboard'), 1500)
    }
    setLoading(false)
  }

  const cities = ['Ottawa', 'Toronto', 'Calgary', 'Vancouver', 'Montreal', 'Edmonton', 'Winnipeg', 'Halifax']
  const categories = ['General', 'Marketing & Communications', 'Sales & Business Development', 'Project Management', 'Data & Analytics', 'Technology & IT', 'Finance & Accounting', 'Human Resources', 'Customer Service', 'Administration & Office', 'Business Analysis', 'Operations & Logistics', 'Design & Creative', 'Education & Training', 'Healthcare & Social Services', 'Engineering', 'Legal & Compliance']

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-gray-500 hover:text-red-600 text-sm mb-6 transition-colors">
          <ArrowLeft size={16} /> Back to Dashboard
        </Link>

        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Post an Opportunity</h1>
          <p className="text-gray-500">Connect with skilled newcomers ready to contribute to your business</p>
        </div>

        {posted && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-3 text-green-700">
            <CheckCircle size={20} />
            <span className="font-medium">Opportunity posted successfully! Redirecting...</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Opportunity Title <span className="text-red-500">*</span></label>
            <input
              type="text"
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g., Digital Marketing Volunteer, Data Analyst Micro-Internship"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description <span className="text-red-500">*</span></label>
            <textarea
              required
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={5}
              placeholder="Describe the role, responsibilities, what the candidate will learn, and what they will gain from this experience..."
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Opportunity Type <span className="text-red-500">*</span></label>
              <select
                required
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-white"
              >
                <option value="volunteer">Volunteer</option>
                <option value="micro-internship">Micro-Internship</option>
                <option value="paid">Paid Position</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">City <span className="text-red-500">*</span></label>
              <select
                required
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-white"
              >
                {cities.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Work Mode <span className="text-red-500">*</span></label>
              <select required value={form.workMode} onChange={(e) => setForm({ ...form, workMode: e.target.value })} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-white">
                <option value="remote">Remote</option>
                <option value="hybrid">Hybrid</option>
                <option value="onsite">On-site</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Duration <span className="text-red-500">*</span></label>
              <input type="text" required value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} placeholder="e.g., 3 months, 6 weeks" className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Experience Level</label>
              <select value={form.experienceLevel} onChange={(e) => setForm({ ...form, experienceLevel: e.target.value })} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-white">
                <option value="any">Any Level</option>
                <option value="entry">Entry Level (0–2 yrs)</option>
                <option value="mid">Mid Level (3–5 yrs)</option>
                <option value="senior">Senior Level (5+ yrs)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-white">
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Compensation (optional)</label>
            <input
              type="text"
              value={form.compensation}
              onChange={(e) => setForm({ ...form, compensation: e.target.value })}
              placeholder="e.g., $18/hr, $500 stipend, Unpaid (volunteer)"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Required Skills</label>
            <div className="flex flex-wrap gap-2 mb-3">
              {skills.map((skill) => (
                <span key={skill} className="flex items-center gap-1.5 bg-red-50 text-red-700 border border-red-200 text-sm px-3 py-1.5 rounded-full font-medium">
                  {skill}
                  <button type="button" onClick={() => setSkills(skills.filter((s) => s !== skill))} className="hover:text-red-900">
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
              <button type="button" onClick={() => addSkill(skillInput)} className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm transition-colors">
                <PlusCircle size={18} className="text-gray-600" />
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

          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-700">
            <strong>Free to post.</strong> Your opportunity goes live immediately and is visible to all candidates on CanStart. Make sure your description is clear and accurate.
          </div>

          <button
            type="submit"
            disabled={loading || posted}
            className="w-full bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors"
          >
            {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><PlusCircle size={18} /> Post Opportunity</>}
          </button>
        </form>
      </div>
    </div>
  )
}
