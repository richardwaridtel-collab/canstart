'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Eye, EyeOff, Lock, ArrowRight } from 'lucide-react'

const ADMIN_EMAILS = ['richard.waridtel@gmail.com']

export default function AdminLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!ADMIN_EMAILS.includes(email.toLowerCase().trim())) {
      setError('Access denied. Admin accounts only.')
      return
    }

    setLoading(true)
    const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setLoading(false)

    if (authError) {
      setError('Invalid email or password.')
      return
    }

    router.push('/admin')
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="bg-red-600 text-white font-bold text-xl px-3 py-1 rounded-lg">
              Can<span className="text-yellow-300">Start</span>
            </div>
          </div>
          <div className="flex items-center justify-center gap-2 text-gray-400 text-sm">
            <Lock size={14} />
            <span>Admin Access</span>
          </div>
        </div>

        <div className="bg-gray-800 border border-gray-700 rounded-2xl p-8 shadow-2xl">
          <h1 className="text-white font-bold text-lg mb-6 text-center">Sign in to Admin Panel</h1>

          {error && (
            <div className="mb-4 p-3 bg-red-900/50 border border-red-700 rounded-lg text-red-300 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm"
                placeholder="admin@example.com"
                autoComplete="username"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2.5 pr-10 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm"
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-red-600 hover:bg-red-700 disabled:bg-red-800 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors mt-2"
            >
              {loading
                ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <><span>Enter Admin Panel</span> <ArrowRight size={16} /></>
              }
            </button>
          </form>
        </div>

        <p className="text-center text-gray-600 text-xs mt-6">
          This area is restricted to platform administrators only.
        </p>
      </div>
    </div>
  )
}
