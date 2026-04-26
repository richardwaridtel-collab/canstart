'use client'

import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Users, Building2, Eye, EyeOff, ArrowRight, CheckCircle } from 'lucide-react'
import { track } from '@vercel/analytics'

type Role = 'seeker' | 'employer'

export default function SignUpPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin" /></div>}>
      <SignUpForm />
    </Suspense>
  )
}

function SignUpForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [role, setRole] = useState<Role>((searchParams.get('role') as Role) || 'seeker')
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const [form, setForm] = useState({
    email: '',
    password: '',
    fullName: '',
    city: '',
    countryOfOrigin: '',
    immigrationStatus: 'owp',
    companyName: '',
    industry: '',
    companySize: '',
  })

  const cities = ['Ottawa', 'Toronto', 'Calgary', 'Vancouver', 'Montreal', 'Edmonton', 'Winnipeg', 'Halifax', 'Other']
  const industries = ['Technology', 'Healthcare', 'Finance', 'Retail', 'Education', 'Construction', 'Hospitality', 'Non-profit', 'Other']
  const companySizes = ['1-10 employees', '11-50 employees', '51-200 employees', '200+ employees']

  useEffect(() => {
    const roleParam = searchParams.get('role') as Role
    if (roleParam === 'seeker' || roleParam === 'employer') setRole(roleParam)
  }, [searchParams])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          data: {
            full_name: form.fullName,
            role,
          },
        },
      })

      if (authError) throw authError
      if (!authData.user) throw new Error('Signup failed')

      const userId = authData.user.id
      const hasSession = !!authData.session

      // Update profile with full details (trigger already created the base record)
      if (hasSession) {
        await supabase.from('profiles').upsert({
          user_id: userId, role, full_name: form.fullName, city: form.city,
        }, { onConflict: 'user_id' })

        if (role === 'seeker') {
          await supabase.from('seeker_profiles').upsert({
            user_id: userId,
            country_of_origin: form.countryOfOrigin,
            immigration_status: form.immigrationStatus,
            skills: [], education: '', work_preference: 'any',
          }, { onConflict: 'user_id' })
          track('signup_seeker', { city: form.city })
        } else {
          await supabase.from('employer_profiles').upsert({
            user_id: userId,
            company_name: form.companyName,
            industry: form.industry,
            company_size: form.companySize,
            verified: false,
          }, { onConflict: 'user_id' })
          track('signup_employer', { city: form.city, industry: form.industry })
        }
        router.push('/profile/setup')
      } else {
        // Email confirmation required — profile created by DB trigger
        track('signup_pending_confirmation', { role })
        router.push('/auth/check-email')
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : (err as { message?: string })?.message || JSON.stringify(err)
      setError(msg || 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-6">
            <div className="bg-red-600 text-white font-bold text-xl px-3 py-1 rounded-lg">
              Can<span className="text-yellow-300">Start</span>
            </div>
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Create your account</h1>
          <p className="text-gray-500 mt-2">Join thousands building Canadian connections</p>
        </div>

        {/* Role selector */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <button
            type="button"
            onClick={() => setRole('seeker')}
            className={`flex flex-col items-center gap-3 p-5 rounded-xl border-2 transition-all ${
              role === 'seeker'
                ? 'border-red-600 bg-red-50 text-red-700'
                : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
            }`}
          >
            <Users size={28} />
            <div>
              <div className="font-semibold text-sm">Job Seeker</div>
              <div className="text-xs text-gray-500 mt-0.5">Looking for opportunities</div>
            </div>
            {role === 'seeker' && <CheckCircle size={16} className="text-red-600" />}
          </button>
          <button
            type="button"
            onClick={() => setRole('employer')}
            className={`flex flex-col items-center gap-3 p-5 rounded-xl border-2 transition-all ${
              role === 'employer'
                ? 'border-red-600 bg-red-50 text-red-700'
                : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
            }`}
          >
            <Building2 size={28} />
            <div>
              <div className="font-semibold text-sm">Employer</div>
              <div className="text-xs text-gray-500 mt-0.5">Posting opportunities</div>
            </div>
            {role === 'employer' && <CheckCircle size={16} className="text-red-600" />}
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={form.fullName}
                  onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm"
                  placeholder="Your full name"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm"
                  placeholder="you@example.com"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    className="w-full px-3 py-2.5 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm"
                    placeholder="At least 8 characters"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                <select
                  required
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm bg-white"
                >
                  <option value="">Select city</option>
                  {cities.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              {role === 'seeker' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Country of Origin</label>
                    <input
                      type="text"
                      required
                      value={form.countryOfOrigin}
                      onChange={(e) => setForm({ ...form, countryOfOrigin: e.target.value })}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm"
                      placeholder="e.g., India, Philippines"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Immigration Status</label>
                    <select
                      required
                      value={form.immigrationStatus}
                      onChange={(e) => setForm({ ...form, immigrationStatus: e.target.value })}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm bg-white"
                    >
                      <option value="owp">Open Work Permit (OWP)</option>
                      <option value="pr">Permanent Resident (PR)</option>
                      <option value="student">Student Visa</option>
                      <option value="citizen">Canadian Citizen</option>
                    </select>
                  </div>
                </>
              )}

              {role === 'employer' && (
                <>
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
                    <input
                      type="text"
                      required
                      value={form.companyName}
                      onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm"
                      placeholder="Your company name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Industry</label>
                    <select
                      required
                      value={form.industry}
                      onChange={(e) => setForm({ ...form, industry: e.target.value })}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm bg-white"
                    >
                      <option value="">Select industry</option>
                      {industries.map((i) => <option key={i} value={i}>{i}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Company Size</label>
                    <select
                      required
                      value={form.companySize}
                      onChange={(e) => setForm({ ...form, companySize: e.target.value })}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm bg-white"
                    >
                      <option value="">Select size</option>
                      {companySizes.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors mt-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  Create Account <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-4">
            Already have an account?{' '}
            <Link href="/auth/signin" className="text-red-600 hover:text-red-700 font-medium">
              Sign in
            </Link>
          </p>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          By signing up, you agree to our Terms of Service and Privacy Policy.
          CanStart is free for newcomers, always.
        </p>
      </div>
    </div>
  )
}
