'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { Menu, X, MapPin, PlusCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'

const ADMIN_EMAILS = ['richard.waridtel@gmail.com']

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [user, setUser] = useState<{ email?: string; id?: string } | null>(null)
  const [role, setRole] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user)
      if (data.user) fetchRole(data.user.id)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchRole(session.user.id)
      else setRole(null)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  const fetchRole = async (userId: string) => {
    const { data } = await supabase.from('profiles').select('role').eq('user_id', userId).single()
    setRole(data?.role ?? null)
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    setRole(null)
    window.location.href = '/'
  }

  const isAdmin = ADMIN_EMAILS.includes(user?.email || '')
  const isEmployer = role === 'employer'
  const isSeeker = role === 'seeker'

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link href="/" className="flex items-center gap-2">
            <div className="bg-red-600 text-white font-bold text-xl px-3 py-1 rounded-lg">
              Can<span className="text-yellow-300">Start</span>
            </div>
            <span className="hidden sm:flex items-center text-xs text-gray-500 gap-1">
              <MapPin size={12} /> Canada
            </span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-6">
            {/* Always visible */}
            <Link href="/opportunities" className="text-gray-600 hover:text-red-600 font-medium transition-colors">
              Browse Jobs
            </Link>

            {/* Employer-specific */}
            {isEmployer && (
              <>
                <Link href="/candidates" className="text-gray-600 hover:text-red-600 font-medium transition-colors">
                  Find Candidates
                </Link>
                <Link href="/post-opportunity" className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors">
                  <PlusCircle size={15} /> Post Opportunity
                </Link>
              </>
            )}

            {/* Seeker-specific */}
            {isSeeker && (
              <>
                <Link href="/resume-builder" className="text-gray-600 hover:text-red-600 font-medium transition-colors">
                  Resume Builder
                </Link>
                <Link href="/profile/setup" className="text-gray-600 hover:text-red-600 font-medium transition-colors">
                  My Profile
                </Link>
              </>
            )}

            {user ? (
              <>
                <Link href="/dashboard" className="text-gray-600 hover:text-red-600 font-medium transition-colors">
                  Dashboard
                </Link>
                {isAdmin && (
                  <Link href="/admin" className="text-xs font-semibold bg-gray-800 text-white px-3 py-1.5 rounded-lg hover:bg-gray-700 transition-colors">
                    Admin
                  </Link>
                )}
                <button onClick={handleSignOut} className="text-sm text-gray-500 hover:text-red-600 transition-colors">
                  Sign Out
                </button>
              </>
            ) : (
              <>
                <Link href="/auth/signin" className="text-gray-600 hover:text-red-600 font-medium transition-colors">
                  Sign In
                </Link>
                <Link href="/auth/signup" className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium transition-colors">
                  Get Started
                </Link>
              </>
            )}
          </div>

          <button
            className="md:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden bg-white border-t border-gray-100 px-4 py-4 space-y-2">
          <Link href="/opportunities" className="block text-gray-700 hover:text-red-600 font-medium py-2" onClick={() => setMenuOpen(false)}>
            Browse Jobs
          </Link>
          {isEmployer && (
            <>
              <Link href="/candidates" className="block text-gray-700 hover:text-red-600 font-medium py-2" onClick={() => setMenuOpen(false)}>
                Find Candidates
              </Link>
              <Link href="/post-opportunity" className="block text-gray-700 hover:text-red-600 font-medium py-2" onClick={() => setMenuOpen(false)}>
                Post Opportunity
              </Link>
            </>
          )}
          {isSeeker && (
            <>
              <Link href="/resume-builder" className="block text-gray-700 hover:text-red-600 font-medium py-2" onClick={() => setMenuOpen(false)}>
                Resume Builder
              </Link>
              <Link href="/profile/setup" className="block text-gray-700 hover:text-red-600 font-medium py-2" onClick={() => setMenuOpen(false)}>
                My Profile
              </Link>
            </>
          )}
          {user ? (
            <>
              <Link href="/dashboard" className="block text-gray-700 hover:text-red-600 font-medium py-2" onClick={() => setMenuOpen(false)}>
                Dashboard
              </Link>
              {isAdmin && (
                <Link href="/admin" className="block text-gray-700 font-semibold py-2" onClick={() => setMenuOpen(false)}>
                  ⚙ Admin
                </Link>
              )}
              <button onClick={handleSignOut} className="block w-full text-left text-gray-500 py-2">
                Sign Out
              </button>
            </>
          ) : (
            <>
              <Link href="/auth/signin" className="block text-gray-700 hover:text-red-600 font-medium py-2" onClick={() => setMenuOpen(false)}>
                Sign In
              </Link>
              <Link href="/auth/signup" className="block bg-red-600 text-white text-center px-4 py-2 rounded-lg font-medium" onClick={() => setMenuOpen(false)}>
                Get Started Free
              </Link>
            </>
          )}
        </div>
      )}
    </nav>
  )
}
