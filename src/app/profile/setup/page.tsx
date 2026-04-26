'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { PlusCircle, X, CheckCircle, ArrowRight, Upload, FileText, Trash2 } from 'lucide-react'
import { track } from '@vercel/analytics'

const SKILL_SUGGESTIONS = ['Project Management', 'Data Analysis', 'Python', 'SQL', 'Marketing', 'Excel', 'Accounting', 'Customer Service', 'HR', 'Sales', 'Java', 'JavaScript', 'React', 'Figma', 'SEO', 'Content Writing', 'Bookkeeping', 'QuickBooks', 'Recruiting', 'PowerBI', 'Tableau', 'Financial Analysis', 'Supply Chain', 'Logistics', 'Engineering']

// Comprehensive role suggestions across all major industries
const ROLE_SUGGESTIONS = [
  // Marketing
  'Marketing Manager','Marketing Specialist','Marketing Coordinator','Digital Marketing Manager',
  'Content Marketing Manager','Social Media Manager','Social Media Specialist','Brand Manager',
  'Marketing Analyst','Growth Marketing Manager','Email Marketing Specialist','SEO Specialist',
  'SEM Specialist','PPC Specialist','Marketing Director','VP of Marketing','CMO',
  'Content Creator','Copywriter','Communications Manager','Public Relations Manager',
  'Community Manager','Influencer Marketing Manager','Performance Marketing Manager',
  // Sales
  'Sales Manager','Sales Representative','Account Executive','Account Manager',
  'Business Development Manager','Business Development Representative','Sales Director',
  'VP of Sales','Regional Sales Manager','Inside Sales Representative',
  'Outside Sales Representative','Sales Coordinator','Client Success Manager',
  'Customer Success Manager','Territory Manager','Channel Sales Manager',
  // Technology
  'Software Developer','Software Engineer','Frontend Developer','Backend Developer',
  'Full Stack Developer','iOS Developer','Android Developer','Mobile Developer',
  'Data Scientist','Data Analyst','Data Engineer','Machine Learning Engineer',
  'AI Engineer','DevOps Engineer','Cloud Engineer','Site Reliability Engineer',
  'QA Engineer','Test Analyst','Product Manager','Product Owner','Scrum Master',
  'UX Designer','UI Designer','UX/UI Designer','Solutions Architect','Systems Analyst',
  'IT Manager','IT Support Specialist','Cybersecurity Analyst','Network Engineer',
  'Database Administrator','Business Analyst','Technical Writer',
  // Finance & Accounting
  'Financial Analyst','Senior Financial Analyst','Accountant','Senior Accountant',
  'CPA','Controller','CFO','Finance Manager','Tax Specialist','Tax Analyst',
  'Bookkeeper','Payroll Specialist','Accounts Payable Specialist',
  'Accounts Receivable Specialist','Auditor','Budget Analyst','Investment Analyst',
  'Risk Analyst','Treasury Analyst','Financial Planner','Insurance Advisor',
  // Human Resources
  'HR Manager','HR Generalist','HR Coordinator','Talent Acquisition Specialist',
  'Recruiter','Senior Recruiter','HR Business Partner','Compensation Analyst',
  'Benefits Administrator','Training Coordinator','L&D Specialist','HRIS Analyst',
  'Payroll Manager','HR Director','CHRO','Organizational Development Specialist',
  'Employee Relations Specialist','Workforce Planning Analyst',
  // Operations & Project Management
  'Operations Manager','Operations Coordinator','Operations Analyst',
  'Supply Chain Manager','Logistics Coordinator','Procurement Specialist',
  'Purchasing Manager','Inventory Manager','Warehouse Manager',
  'Quality Assurance Manager','Process Improvement Specialist',
  'Project Manager','Project Coordinator','Program Manager','PMO Analyst',
  // Customer Service
  'Customer Service Representative','Customer Service Manager','Call Centre Agent',
  'Technical Support Specialist','Help Desk Analyst','Service Desk Analyst',
  'Client Relations Manager','Support Team Lead',
  // Design & Creative
  'Graphic Designer','Visual Designer','Motion Designer','Creative Director',
  'Art Director','Brand Designer','Video Editor','Photographer',
  'Multimedia Designer','Web Designer','Product Designer',
  // Administration
  'Administrative Assistant','Executive Assistant','Office Manager',
  'Receptionist','Data Entry Specialist','Operations Assistant','Legal Assistant',
  // Healthcare
  'Registered Nurse','Licensed Practical Nurse','Healthcare Administrator',
  'Medical Office Assistant','Pharmacist','Physiotherapist',
  'Occupational Therapist','Social Worker','Counsellor','Medical Technologist',
  // Education
  'Teacher','Professor','Curriculum Developer','Instructional Designer',
  'Training Coordinator','ESL Teacher','Academic Advisor','Education Coordinator',
  // Legal & Compliance
  'Lawyer','Paralegal','Legal Assistant','Compliance Officer',
  'Contract Manager','Legal Counsel','Regulatory Affairs Specialist',
  // Engineering
  'Civil Engineer','Mechanical Engineer','Electrical Engineer','Chemical Engineer',
  'Structural Engineer','Environmental Engineer','Project Engineer',
  'Manufacturing Engineer','Industrial Engineer',
].sort()

const ACCEPTED_TYPES = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
const ACCEPTED_EXTENSIONS = '.pdf,.doc,.docx'

function formatBytes(bytes: number) {
  return bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(0)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function FileUploadField({
  label,
  hint,
  maxBytes,
  currentPath,
  file,
  onFile,
  onClear,
}: {
  label: string
  hint: string
  maxBytes: number
  currentPath: string | null
  file: File | null
  onFile: (f: File) => void
  onClear: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState('')

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setError('')
    if (!ACCEPTED_TYPES.includes(f.type)) { setError('Only PDF, DOC, and DOCX files are accepted.'); return }
    if (f.size > maxBytes) { setError(`File too large. Max size is ${formatBytes(maxBytes)}.`); return }
    onFile(f)
  }

  const existingName = currentPath ? currentPath.split('/').pop() : null
  const displayName = file ? file.name : existingName

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <p className="text-xs text-gray-400 mb-2">{hint}</p>
      {displayName ? (
        <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
          <FileText size={18} className="text-green-600 flex-shrink-0" />
          <span className="text-sm text-green-800 font-medium flex-1 truncate">{displayName}</span>
          <span className="text-xs text-green-600">{file ? formatBytes(file.size) : ''}</span>
          <button
            type="button"
            onClick={() => { onClear(); if (inputRef.current) inputRef.current.value = '' }}
            className="text-red-400 hover:text-red-600 transition-colors"
            title="Remove file"
          >
            <Trash2 size={16} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-full border-2 border-dashed border-gray-200 rounded-lg px-4 py-5 text-center hover:border-red-300 hover:bg-red-50 transition-colors group"
        >
          <Upload size={20} className="mx-auto mb-1.5 text-gray-300 group-hover:text-red-400" />
          <span className="text-sm text-gray-500 group-hover:text-red-600">Click to upload</span>
          <span className="block text-xs text-gray-400 mt-0.5">PDF, DOC, DOCX · max {formatBytes(maxBytes)}</span>
        </button>
      )}
      <input ref={inputRef} type="file" accept={ACCEPTED_EXTENSIONS} onChange={handleChange} className="hidden" />
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  )
}

export default function ProfileSetupPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [role, setRole] = useState<'seeker' | 'employer' | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [skills, setSkills] = useState<string[]>([])
  const [skillInput, setSkillInput] = useState('')
  const [preferredRoles, setPreferredRoles] = useState<string[]>([])
  const [roleInput, setRoleInput] = useState('')
  const [roleSuggestions, setRoleSuggestions] = useState<string[]>([])
  const [form, setForm] = useState({
    bio: '',
    education: '',
    workPreference: 'any',
    linkedinUrl: '',
    website: '',
    description: '',
  })
  const [resumeFile, setResumeFile] = useState<File | null>(null)
  const [resumePath, setResumePath] = useState<string | null>(null)
  const [additionalDocFile, setAdditionalDocFile] = useState<File | null>(null)
  const [additionalDocPath, setAdditionalDocPath] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState('')
  const [resumeParsing, setResumeParsing] = useState(false)

  useEffect(() => { loadProfile() }, [])

  const loadProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth/signin'); return }
    setUserId(user.id)

    const { data: profile } = await supabase.from('profiles').select('*').eq('user_id', user.id).single()
    if (!profile) { router.push('/auth/signup'); return }
    setRole(profile.role)

    if (profile.role === 'seeker') {
      const { data } = await supabase.from('seeker_profiles').select('*').eq('user_id', user.id).single()
      if (data) {
        setSkills(data.skills || [])
        setPreferredRoles(data.preferred_roles || [])
        setForm((f) => ({ ...f, bio: data.bio || '', education: data.education || '', workPreference: data.work_preference || 'any', linkedinUrl: data.linkedin_url || '' }))
        setResumePath(data.resume_path || null)
        setAdditionalDocPath(data.additional_doc_path || null)
        // Auto-parse if resume exists but text was never extracted
        if (data.resume_path && (!data.resume_text || data.resume_text.length < 50)) {
          setResumeParsing(true)
          try {
            const { data: { session } } = await supabase.auth.getSession()
            await fetch('/api/parse-resume', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
              body: JSON.stringify({ resumePath: data.resume_path }),
            })
          } catch { /* silent */ } finally { setResumeParsing(false) }
        }
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

  const addRole = (role: string) => {
    const r = role.trim()
    if (r && !preferredRoles.includes(r)) setPreferredRoles([...preferredRoles, r])
    setRoleInput('')
    setRoleSuggestions([])
  }

  const removeRole = (role: string) => setPreferredRoles(preferredRoles.filter((r) => r !== role))

  const handleRoleInput = (val: string) => {
    setRoleInput(val)
    if (val.length < 2) { setRoleSuggestions([]); return }
    const q = val.toLowerCase()
    setRoleSuggestions(
      ROLE_SUGGESTIONS.filter(r => r.toLowerCase().includes(q) && !preferredRoles.includes(r)).slice(0, 8)
    )
  }

  const uploadFile = async (file: File, pathPrefix: string): Promise<string | null> => {
    const ext = file.name.split('.').pop()
    const path = `${userId}/${pathPrefix}.${ext}`
    const { error } = await supabase.storage.from('candidate-documents').upload(path, file, { upsert: true })
    if (error) { setUploadError(`Upload failed: ${error.message}`); return null }
    return path
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setUploadError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    if (role === 'seeker') {
      let newResumePath = resumePath
      let newAdditionalDocPath = additionalDocPath

      if (resumeFile) {
        newResumePath = await uploadFile(resumeFile, 'resume')
        if (!newResumePath) { setLoading(false); return }
      }
      if (additionalDocFile) {
        newAdditionalDocPath = await uploadFile(additionalDocFile, 'additional')
        if (!newAdditionalDocPath) { setLoading(false); return }
      }

      await supabase.from('seeker_profiles').upsert({
        user_id: user.id,
        bio: form.bio,
        education: form.education,
        work_preference: form.workPreference,
        linkedin_url: form.linkedinUrl,
        skills,
        preferred_roles: preferredRoles,
        resume_path: newResumePath,
        additional_doc_path: newAdditionalDocPath,
      }, { onConflict: 'user_id' })
      track('profile_updated_seeker', { skills_count: skills.length, has_resume: !!newResumePath })

      // Parse resume text for better job matching
      if (resumeFile && newResumePath) {
        setResumeParsing(true)
        try {
          const { data: { session } } = await supabase.auth.getSession()
          await fetch('/api/parse-resume', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
            body: JSON.stringify({ resumePath: newResumePath }),
          })
        } catch { /* non-critical */ } finally { setResumeParsing(false) }
      }
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

        {uploadError && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
            {uploadError}
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

              {/* ── Job Role Preferences ───────────────────────────────── */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Job Role Preferences
                </label>
                <p className="text-xs text-gray-400 mb-3">
                  Select roles you want to be matched with. Type to search — we&apos;ll prioritise these in your &quot;Picked for You&quot; recommendations.
                </p>
                {/* Selected role tags */}
                <div className="flex flex-wrap gap-2 mb-3">
                  {preferredRoles.map((role) => (
                    <span key={role} className="flex items-center gap-1.5 bg-blue-50 text-blue-700 border border-blue-200 text-sm px-3 py-1.5 rounded-full font-medium">
                      {role}
                      <button type="button" onClick={() => removeRole(role)} className="hover:text-blue-900">
                        <X size={14} />
                      </button>
                    </span>
                  ))}
                </div>
                {/* Typeahead input */}
                <div className="relative">
                  <input
                    type="text"
                    value={roleInput}
                    onChange={(e) => handleRoleInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { e.preventDefault(); if (roleSuggestions[0]) addRole(roleSuggestions[0]); else if (roleInput.trim()) addRole(roleInput) }
                      if (e.key === 'Escape') setRoleSuggestions([])
                    }}
                    placeholder="Type a role (e.g. Marketing Manager)..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {roleSuggestions.length > 0 && (
                    <div className="absolute z-10 top-full mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
                      {roleSuggestions.map((r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => addRole(r)}
                          className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors"
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {/* Popular role quick-picks */}
                {preferredRoles.length === 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {['Marketing Manager','Software Developer','Data Analyst','Project Manager','HR Manager','Financial Analyst','Sales Manager','Business Analyst','Graphic Designer','Customer Success Manager'].map((r) => (
                      <button key={r} type="button" onClick={() => addRole(r)}
                        className="text-xs text-gray-500 hover:text-blue-600 bg-gray-100 hover:bg-blue-50 px-2.5 py-1 rounded-full transition-colors">
                        + {r}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="border-t border-gray-100 pt-6 space-y-5">
                <div>
                  <h3 className="text-sm font-semibold text-gray-800 mb-1">Documents</h3>
                  <p className="text-xs text-gray-400 mb-4">Only verified employers can view your uploaded documents.</p>
                </div>

                <FileUploadField
                  label="Resume"
                  hint="PDF, DOC, or DOCX · Max 2 MB"
                  maxBytes={2 * 1024 * 1024}
                  currentPath={resumePath}
                  file={resumeFile}
                  onFile={setResumeFile}
                  onClear={() => { setResumeFile(null); setResumePath(null) }}
                />

                <FileUploadField
                  label="Additional Document (optional)"
                  hint="Cover letter, portfolio, certifications, etc. · PDF, DOC, or DOCX · Max 3 MB"
                  maxBytes={3 * 1024 * 1024}
                  currentPath={additionalDocPath}
                  file={additionalDocFile}
                  onFile={setAdditionalDocFile}
                  onClear={() => { setAdditionalDocFile(null); setAdditionalDocPath(null) }}
                />
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
              {loading || resumeParsing
              ? <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />{resumeParsing ? 'Analyzing resume...' : 'Saving...'}</>
              : <><CheckCircle size={18} /> Save Profile</>}
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
