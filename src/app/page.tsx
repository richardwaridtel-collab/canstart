import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import {
  ArrowRight, CheckCircle, X, MapPin, Star,
  FileText, BarChart2, Shield, Sparkles, Zap,
  Users, Building2, TrendingUp, Briefcase
} from 'lucide-react'

const cities = ['Ottawa', 'Toronto', 'Calgary', 'Vancouver', 'Montreal', 'Edmonton', 'Winnipeg', 'Halifax']

async function getTestimonials() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { data } = await supabase
      .from('testimonials')
      .select('id, quote, name, role_title, city, country_of_origin')
      .eq('approved', true)
      .order('created_at', { ascending: false })
      .limit(4)
    return data || []
  } catch {
    return []
  }
}

export default async function LandingPage() {
  const testimonials = await getTestimonials()

  return (
    <div className="bg-white">

      {/* ── HERO ─────────────────────────────────────────────── */}
      <section className="relative bg-gradient-to-br from-red-700 via-red-600 to-red-800 text-white overflow-hidden">
        <div className="absolute inset-0 bg-[url('/maple-pattern.svg')] opacity-5" />

        {/* Floating resume score card — decorative */}
        <div className="hidden lg:block absolute right-12 top-1/2 -translate-y-1/2 w-64 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 p-5 shadow-2xl">
          <p className="text-xs font-semibold uppercase tracking-widest text-white/60 mb-3">Resume Score</p>
          <div className="flex items-end gap-2 mb-3">
            <span className="text-5xl font-black text-green-300">87</span>
            <span className="text-xl text-white/40 font-semibold mb-1">%</span>
            <span className="ml-auto text-xs bg-green-400/20 text-green-300 px-2 py-1 rounded-full font-semibold">+29%</span>
          </div>
          <div className="h-2 bg-white/10 rounded-full mb-4 overflow-hidden">
            <div className="h-full bg-green-400 rounded-full" style={{ width: '87%' }} />
          </div>
          {['ATS keywords matched', 'Canadian format applied', 'Tailored to this role'].map((item) => (
            <div key={item} className="flex items-center gap-2 text-xs text-white/70 mb-1.5">
              <CheckCircle size={11} className="text-green-400 flex-shrink-0" />{item}
            </div>
          ))}
          <p className="text-xs text-white/30 mt-3 pt-3 border-t border-white/10">Before: 58% · After: 87%</p>
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full text-sm font-medium mb-6 border border-white/20">
              <Sparkles size={13} className="text-yellow-300" />
              Canada&apos;s only AI-powered job platform for job seekers
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black leading-[1.1] mb-6 tracking-tight">
              Stop Losing Jobs<br />
              to <span className="text-yellow-300">&ldquo;No Canadian<br />Experience&rdquo;</span>
            </h1>
            <p className="text-lg sm:text-xl text-red-100 leading-relaxed mb-10 max-w-xl">
              CanStart tailors your resume to every job in seconds, shows your match score before you apply,
              and connects you with verified Canadian employers — all free, all in one place.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link href="/auth/signup?role=seeker"
                className="inline-flex items-center justify-center gap-2 bg-white text-red-600 hover:bg-yellow-300 hover:text-red-700 px-8 py-4 rounded-xl font-bold text-lg transition-all shadow-lg">
                Get Started Free <ArrowRight size={20} />
              </Link>
              <Link href="/opportunities"
                className="inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 border border-white/30 hover:border-white/50 text-white px-8 py-4 rounded-xl font-bold text-lg transition-all">
                Browse Jobs
              </Link>
            </div>
            <div className="mt-8 flex flex-wrap gap-5 text-sm text-red-200">
              <span className="flex items-center gap-2"><CheckCircle size={15} className="text-green-400" /> 100% free for job seekers</span>
              <span className="flex items-center gap-2"><CheckCircle size={15} className="text-green-400" /> Verified employers only</span>
              <span className="flex items-center gap-2"><CheckCircle size={15} className="text-green-400" /> No account needed to browse</span>
            </div>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-white" style={{ clipPath: 'ellipse(55% 100% at 50% 100%)' }} />
      </section>

      {/* ── WHY CANSTART IS DIFFERENT ──────────────────────── */}
      <section className="bg-gray-950 py-20 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <p className="text-red-400 text-sm font-semibold uppercase tracking-widest mb-3">Built differently</p>
            <h2 className="text-3xl sm:text-4xl font-black text-white">CanStart vs General Job Boards</h2>
            <p className="text-gray-400 mt-3 text-lg">General platforms were built for everyone. CanStart was built for you.</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-4 pr-6 text-gray-400 font-medium w-3/5">Feature</th>
                  <th className="py-4 px-6 text-center">
                    <span className="bg-red-600 text-white font-bold px-4 py-1.5 rounded-lg text-sm">CanStart</span>
                  </th>
                  <th className="py-4 px-6 text-center text-gray-500 font-medium">Other Platforms</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { feature: 'Built specifically for Canadian job seekers', canstart: true, others: false },
                  { feature: 'AI resume tailoring to each job description', canstart: true, others: false },
                  { feature: 'See your match score before applying', canstart: true, others: false },
                  { feature: 'Verified scam-free employers', canstart: true, others: false },
                  { feature: 'Canadian experience building (volunteer & internships)', canstart: true, others: false },
                  { feature: '100% free — no premium tier ever', canstart: true, others: false },
                ].map((row, i) => (
                  <tr key={i} className="border-b border-white/5">
                    <td className="py-4 pr-6 text-gray-300">{row.feature}</td>
                    <td className="py-4 px-6 text-center">
                      <CheckCircle size={18} className="mx-auto text-green-400" />
                    </td>
                    <td className="py-4 px-6 text-center">
                      <X size={18} className="mx-auto text-gray-600" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── THREE FLAGSHIP FEATURES ───────────────────────── */}
      <section className="bg-white py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <p className="text-red-600 text-sm font-semibold uppercase tracking-widest mb-3">What makes us different</p>
            <h2 className="text-3xl sm:text-4xl font-black text-gray-900">Three tools no other job board gives you</h2>
          </div>

          <div className="space-y-24">

            {/* Feature 1 — AI Resume Builder */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div>
                <div className="inline-flex items-center gap-2 bg-red-50 text-red-700 text-sm font-semibold px-3 py-1.5 rounded-full mb-5">
                  <Sparkles size={14} /> AI Resume Builder
                </div>
                <h3 className="text-2xl sm:text-3xl font-black text-gray-900 mb-4">
                  Your resume, tailored to every job in under 60 seconds
                </h3>
                <p className="text-gray-500 text-lg leading-relaxed mb-6">
                  Paste any job description, upload your resume — our AI rewrites your bullets using the exact language
                  employers scan for, without inventing anything. Every certification, degree, and skill you have is preserved.
                </p>
                <div className="space-y-3 mb-8">
                  {[
                    'See your current score first — then decide to tailor',
                    'Before vs after match comparison so you know it worked',
                    'Download as PDF or DOCX, ready to submit',
                    'Never overstates — only what\'s on your resume',
                  ].map((pt) => (
                    <div key={pt} className="flex items-start gap-3 text-sm text-gray-700">
                      <CheckCircle size={16} className="text-green-500 flex-shrink-0 mt-0.5" />{pt}
                    </div>
                  ))}
                </div>
                <Link href="/auth/signup?role=seeker"
                  className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold px-6 py-3 rounded-xl transition-colors">
                  Try the Resume Builder <ArrowRight size={16} />
                </Link>
              </div>
              <div className="bg-gray-50 rounded-2xl border border-gray-200 p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Score comparison</span>
                  <span className="text-xs bg-green-100 text-green-700 font-semibold px-2 py-1 rounded-full">+29% match</span>
                </div>
                <div className="grid grid-cols-2 gap-4 mb-5">
                  <div className="bg-white rounded-xl border border-gray-100 p-4 text-center">
                    <p className="text-xs text-gray-400 mb-1">Before tailoring</p>
                    <p className="text-4xl font-black text-red-500">58<span className="text-lg text-gray-300">%</span></p>
                    <div className="h-1.5 bg-gray-100 rounded-full mt-2 overflow-hidden">
                      <div className="h-full bg-red-400 rounded-full" style={{ width: '58%' }} />
                    </div>
                  </div>
                  <div className="bg-white rounded-xl border border-green-200 p-4 text-center">
                    <p className="text-xs text-gray-400 mb-1">After tailoring</p>
                    <p className="text-4xl font-black text-green-500">87<span className="text-lg text-gray-300">%</span></p>
                    <div className="h-1.5 bg-gray-100 rounded-full mt-2 overflow-hidden">
                      <div className="h-full bg-green-500 rounded-full" style={{ width: '87%' }} />
                    </div>
                  </div>
                </div>
                <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-2">
                  <p className="text-xs font-semibold text-gray-500 mb-2">What was improved</p>
                  {['ATS keywords aligned to job posting', 'Degree & certifications preserved', 'Implied skills surfaced honestly', 'Canadian resume format applied'].map((item) => (
                    <div key={item} className="flex items-center gap-2 text-xs text-gray-600">
                      <CheckCircle size={11} className="text-green-500 flex-shrink-0" />{item}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Feature 2 — Smart Match Score */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div className="order-2 lg:order-1 bg-gray-950 rounded-2xl p-6 shadow-sm">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">Live match breakdown</p>
                {[
                  { label: 'Required skills covered', pct: 90, color: 'bg-green-400' },
                  { label: 'Keyword alignment', pct: 85, color: 'bg-green-400' },
                  { label: 'Experience level match', pct: 80, color: 'bg-yellow-400' },
                  { label: 'Industry relevance', pct: 70, color: 'bg-yellow-400' },
                ].map((item) => (
                  <div key={item.label} className="mb-4">
                    <div className="flex justify-between text-xs text-gray-400 mb-1.5">
                      <span>{item.label}</span>
                      <span className="font-semibold text-white">{item.pct}%</span>
                    </div>
                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                      <div className={`h-full ${item.color} rounded-full`} style={{ width: `${item.pct}%` }} />
                    </div>
                  </div>
                ))}
                <div className="mt-4 pt-4 border-t border-white/10">
                  <p className="text-xs text-gray-500 mb-1.5">Gap to close before applying:</p>
                  <div className="flex items-start gap-2 text-xs text-orange-400">
                    <span className="mt-0.5">⚠</span>
                    <span>Project management certification not listed on resume</span>
                  </div>
                </div>
              </div>
              <div className="order-1 lg:order-2">
                <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 text-sm font-semibold px-3 py-1.5 rounded-full mb-5">
                  <BarChart2 size={14} /> Smart Match Score
                </div>
                <h3 className="text-2xl sm:text-3xl font-black text-gray-900 mb-4">
                  Know your chances before spending an hour on an application
                </h3>
                <p className="text-gray-500 text-lg leading-relaxed mb-6">
                  Every job on CanStart shows you a live match score against your profile. See which skills are missing,
                  which keywords to add, and what a hiring manager&apos;s ATS will flag — before you click Apply.
                </p>
                <div className="space-y-3">
                  {[
                    'Instant ATS keyword analysis on every job',
                    'Pinpoints exact gaps — no guessing',
                    'Training recommendations to close each gap',
                    'Apply only when you\'re confident',
                  ].map((pt) => (
                    <div key={pt} className="flex items-start gap-3 text-sm text-gray-700">
                      <CheckCircle size={16} className="text-green-500 flex-shrink-0 mt-0.5" />{pt}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Feature 3 — Verified Employers */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div>
                <div className="inline-flex items-center gap-2 bg-green-50 text-green-700 text-sm font-semibold px-3 py-1.5 rounded-full mb-5">
                  <Shield size={14} /> Verified Employers
                </div>
                <h3 className="text-2xl sm:text-3xl font-black text-gray-900 mb-4">
                  Every employer is verified. Zero scam risk.
                </h3>
                <p className="text-gray-500 text-lg leading-relaxed mb-6">
                  Job scams disproportionately target internationally-trained professionals. On CanStart, every business
                  is reviewed before their first posting goes live. No fake companies, no unpaid traps, no vanishing acts.
                </p>
                <div className="space-y-3 mb-8">
                  {[
                    'Business identity reviewed before going live',
                    'Real employer profiles with verified contact info',
                    'Volunteer, micro-internship, and paid roles clearly labelled',
                    'Report any concern — reviewed within 24 hours',
                  ].map((pt) => (
                    <div key={pt} className="flex items-start gap-3 text-sm text-gray-700">
                      <CheckCircle size={16} className="text-green-500 flex-shrink-0 mt-0.5" />{pt}
                    </div>
                  ))}
                </div>
                <Link href="/opportunities"
                  className="inline-flex items-center gap-2 bg-gray-900 hover:bg-gray-800 text-white font-bold px-6 py-3 rounded-xl transition-colors">
                  Browse Verified Jobs <ArrowRight size={16} />
                </Link>
              </div>
              {/* Visual — opportunity types, no fake company names */}
              <div className="bg-gray-50 rounded-2xl border border-gray-200 p-6 shadow-sm">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">Opportunity types on CanStart</p>
                <div className="space-y-4">
                  {[
                    { type: 'Volunteer', color: 'green', desc: 'Give back while building local experience and references. Perfect for expanding your Canadian network.' },
                    { type: 'Micro-Internship', color: 'blue', desc: 'Short-term, project-based work (2–12 weeks) with real responsibilities and mentorship from local employers.' },
                    { type: 'Paid Position', color: 'purple', desc: 'Entry-level paid roles at small businesses actively looking for skilled, motivated international talent.' },
                  ].map((t) => (
                    <div key={t.type} className={`rounded-xl p-4 border-2 ${
                      t.color === 'green' ? 'bg-green-50 border-green-100' :
                      t.color === 'blue'  ? 'bg-blue-50 border-blue-100' :
                      'bg-purple-50 border-purple-100'
                    }`}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                          t.color === 'green' ? 'bg-green-100 text-green-700' :
                          t.color === 'blue'  ? 'bg-blue-100 text-blue-700' :
                          'bg-purple-100 text-purple-700'
                        }`}>{t.type}</span>
                        <Shield size={11} className="text-green-500" />
                        <span className="text-xs text-green-600 font-medium">Verified only</span>
                      </div>
                      <p className="text-xs text-gray-600 leading-relaxed">{t.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ──────────────────────────────────── */}
      <section className="bg-gray-50 py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <p className="text-red-600 text-sm font-semibold uppercase tracking-widest mb-3">Simple by design</p>
            <h2 className="text-3xl sm:text-4xl font-black text-gray-900">From signup to job offer in 4 steps</h2>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            <div>
              <div className="mb-6">
                <span className="bg-red-600 text-white text-xs font-bold px-3 py-1.5 rounded-full">For Job Seekers</span>
              </div>
              <div className="space-y-4">
                {[
                  { step: '1', title: 'Create your free profile', desc: 'Upload your resume, add your skills and immigration status. Takes 3 minutes.' },
                  { step: '2', title: 'Browse & see your match score', desc: 'Browse live Canadian jobs. See your match score on every single one before applying.' },
                  { step: '3', title: 'Tailor your resume in seconds', desc: 'Paste the job description — AI rewrites your resume for that role. See before vs after score.' },
                  { step: '4', title: 'Apply & track everything', desc: 'Submit your application and track every status in one dashboard.' },
                ].map((item) => (
                  <div key={item.step} className="flex gap-4 bg-white p-5 rounded-xl border border-gray-100 hover:border-red-200 hover:shadow-sm transition-all">
                    <div className="w-9 h-9 bg-red-600 text-white rounded-full flex items-center justify-center font-black text-sm flex-shrink-0">{item.step}</div>
                    <div>
                      <h4 className="font-bold text-gray-900 mb-0.5 text-sm">{item.title}</h4>
                      <p className="text-gray-500 text-sm">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <Link href="/auth/signup?role=seeker"
                className="inline-flex items-center gap-2 mt-6 bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-xl font-bold transition-colors">
                Start for Free <ArrowRight size={16} />
              </Link>
            </div>
            <div>
              <div className="mb-6">
                <span className="bg-gray-900 text-white text-xs font-bold px-3 py-1.5 rounded-full">For Employers</span>
              </div>
              <div className="space-y-4">
                {[
                  { step: '1', title: 'Register your business', desc: 'Create a verified company profile. Fast, free, and reviewed within 24 hours.' },
                  { step: '2', title: 'Post an opportunity', desc: 'Describe the role and required skills — live within minutes of approval.' },
                  { step: '3', title: 'Review matched candidates', desc: 'See applications ranked by match score. Review profiles and resumes at a glance.' },
                  { step: '4', title: 'Build your team', desc: 'Connect directly with skilled international talent ready to contribute from day one.' },
                ].map((item) => (
                  <div key={item.step} className="flex gap-4 bg-white p-5 rounded-xl border border-gray-100 hover:border-gray-300 hover:shadow-sm transition-all">
                    <div className="w-9 h-9 bg-gray-900 text-white rounded-full flex items-center justify-center font-black text-sm flex-shrink-0">{item.step}</div>
                    <div>
                      <h4 className="font-bold text-gray-900 mb-0.5 text-sm">{item.title}</h4>
                      <p className="text-gray-500 text-sm">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <Link href="/auth/signup?role=employer"
                className="inline-flex items-center gap-2 mt-6 bg-gray-900 hover:bg-gray-800 text-white px-6 py-3 rounded-xl font-bold transition-colors">
                Post an Opportunity <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS — real user submissions only ─────── */}
      {testimonials.length > 0 ? (
        <section className="bg-white py-20">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <p className="text-red-600 text-sm font-semibold uppercase tracking-widest mb-3">Real people, real results</p>
              <h2 className="text-3xl sm:text-4xl font-black text-gray-900">Job seekers who made it work</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {testimonials.map((t) => (
                <div key={t.id} className="bg-gray-50 p-7 rounded-2xl border border-gray-100">
                  <div className="flex gap-1 mb-4">
                    {[...Array(5)].map((_, i) => <Star key={i} size={15} className="text-yellow-400 fill-yellow-400" />)}
                  </div>
                  <p className="text-gray-700 leading-relaxed mb-6">&ldquo;{t.quote}&rdquo;</p>
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 bg-red-600 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                      {t.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-bold text-gray-900 text-sm">{t.name}</p>
                      <p className="text-xs text-gray-500">
                        {[t.role_title, t.city, t.country_of_origin ? `From ${t.country_of_origin}` : null].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-center text-sm text-gray-400 mt-8">
              Using CanStart?{' '}
              <Link href="/dashboard" className="text-red-600 hover:underline font-medium">Share your story</Link>
              {' '}from your dashboard.
            </p>
          </div>
        </section>
      ) : (
        <section className="bg-white py-16">
          <div className="max-w-2xl mx-auto px-4 text-center">
            <p className="text-red-600 text-sm font-semibold uppercase tracking-widest mb-3">Community</p>
            <h2 className="text-2xl font-black text-gray-900 mb-3">Be one of the first success stories</h2>
            <p className="text-gray-500 mb-6">After landing your role through CanStart, share your experience from your dashboard — your story could help the next person just like you.</p>
            <Link href="/auth/signup?role=seeker"
              className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold px-6 py-3 rounded-xl transition-colors">
              Get Started Free <ArrowRight size={16} />
            </Link>
          </div>
        </section>
      )}

      {/* ── CITIES ────────────────────────────────────────── */}
      <section className="bg-gray-50 py-12">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-gray-400 text-xs font-semibold uppercase tracking-widest mb-4">Active across Canada</p>
          <div className="flex flex-wrap justify-center gap-2">
            {cities.map((city) => (
              <Link key={city} href={`/opportunities?city=${city}`}
                className="flex items-center gap-1.5 bg-white hover:bg-red-50 border border-gray-200 hover:border-red-200 text-gray-600 hover:text-red-600 px-4 py-2 rounded-full text-sm font-medium transition-colors">
                <MapPin size={12} />{city}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ─────────────────────────────────────── */}
      <section className="bg-gradient-to-br from-gray-950 to-red-950 text-white py-24">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 px-4 py-2 rounded-full text-sm font-medium mb-6 border border-white/20">
            <Sparkles size={13} className="text-yellow-300" /> Free forever for job seekers
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black mb-5 leading-tight">
            Your next Canadian job starts<br />
            <span className="text-yellow-300">with one upload.</span>
          </h2>
          <p className="text-gray-300 text-lg mb-10 max-w-xl mx-auto">
            Upload your resume, paste a job description, and see your match score in 10 seconds.
            No credit card. No catch.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link href="/auth/signup?role=seeker"
              className="inline-flex items-center justify-center gap-2 bg-white text-gray-900 hover:bg-yellow-300 px-8 py-4 rounded-xl font-black text-lg transition-all shadow-lg">
              Get Started Free <ArrowRight size={20} />
            </Link>
            <Link href="/auth/signup?role=employer"
              className="inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 border border-white/20 hover:border-white/40 text-white px-8 py-4 rounded-xl font-bold text-lg transition-all">
              I&apos;m an Employer
            </Link>
          </div>
        </div>
      </section>

    </div>
  )
}
