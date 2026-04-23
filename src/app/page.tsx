import Link from 'next/link'
import { ArrowRight, Users, Building2, Shield, Star, MapPin, TrendingUp, CheckCircle, Briefcase, Globe } from 'lucide-react'

const stats = [
  { value: '450K+', label: 'Newcomers arrive in Canada yearly' },
  { value: '6 months', label: 'Average time to find first job' },
  { value: '80%', label: 'Newcomers open to volunteer work' },
  { value: '75%', label: 'Believe CanStart will speed up their journey' },
]

const features = [
  {
    icon: <Users className="w-6 h-6 text-red-600" />,
    title: 'Smart Profile Matching',
    desc: 'Our algorithm matches newcomers with opportunities based on skills, location, and preferences — no more endless searching.',
  },
  {
    icon: <Building2 className="w-6 h-6 text-red-600" />,
    title: 'Verified Local Businesses',
    desc: 'Every employer is verified to ensure you only connect with legitimate Canadian businesses — zero scam risk.',
  },
  {
    icon: <Globe className="w-6 h-6 text-red-600" />,
    title: 'Remote & Local Options',
    desc: 'Access virtual volunteering in translation, data analysis, project management, and more — no location barriers.',
  },
  {
    icon: <Star className="w-6 h-6 text-red-600" />,
    title: 'Feedback & Reviews',
    desc: 'Build a credible track record of Canadian work experience with verified reviews from real employers.',
  },
  {
    icon: <Shield className="w-6 h-6 text-red-600" />,
    title: 'Scam-Free Environment',
    desc: 'Every opportunity is posted by verified businesses. Your safety and trust are our top priority.',
  },
  {
    icon: <TrendingUp className="w-6 h-6 text-red-600" />,
    title: 'Career Growth Tools',
    desc: 'Access resources on Canadian resume formats, interview tips, and salary expectations to boost your candidacy.',
  },
]

const howItWorksSeeker = [
  { step: '1', title: 'Create Your Profile', desc: 'Add your skills, experience, education, and location preferences.' },
  { step: '2', title: 'Browse Opportunities', desc: 'Discover volunteer and micro-internship positions matched to your profile.' },
  { step: '3', title: 'Apply with One Click', desc: 'Express interest and connect directly with the business.' },
  { step: '4', title: 'Gain Canadian Experience', desc: 'Complete the opportunity, earn a verified review, and advance your career.' },
]

const howItWorksEmployer = [
  { step: '1', title: 'Register Your Business', desc: 'Complete our quick verification process to build trust with candidates.' },
  { step: '2', title: 'Post an Opportunity', desc: 'Describe the role, required skills, and duration — free to post.' },
  { step: '3', title: 'Review Matched Candidates', desc: 'Browse profiles of skilled newcomers matched to your requirements.' },
  { step: '4', title: 'Grow Your Team', desc: 'Connect with motivated talent eager to contribute to your business.' },
]

const cities = ['Ottawa', 'Toronto', 'Calgary', 'Vancouver', 'Montreal', 'Edmonton', 'Winnipeg', 'Halifax']

export default function LandingPage() {
  return (
    <div className="bg-white">
      {/* Hero */}
      <section className="relative bg-gradient-to-br from-red-700 via-red-600 to-red-800 text-white overflow-hidden">
        <div className="absolute inset-0 bg-[url('/maple-pattern.svg')] opacity-5" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full text-sm font-medium mb-6">
              <MapPin size={14} />
              Serving newcomers across Canada
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight mb-6">
              Your Canadian{' '}
              <span className="text-yellow-300">Experience</span>{' '}
              Starts Here
            </h1>
            <p className="text-lg sm:text-xl text-red-100 leading-relaxed mb-8 max-w-2xl">
              Connect with verified local businesses for volunteer and micro-internship opportunities.
              Build your Canadian work experience, expand your network, and launch your career — safely.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                href="/auth/signup?role=seeker"
                className="inline-flex items-center justify-center gap-2 bg-white text-red-600 hover:bg-yellow-300 hover:text-red-700 px-8 py-4 rounded-xl font-bold text-lg transition-all shadow-lg"
              >
                I&apos;m a Newcomer
                <ArrowRight size={20} />
              </Link>
              <Link
                href="/auth/signup?role=employer"
                className="inline-flex items-center justify-center gap-2 bg-transparent border-2 border-white/50 hover:border-white hover:bg-white/10 text-white px-8 py-4 rounded-xl font-bold text-lg transition-all"
              >
                I&apos;m an Employer
              </Link>
            </div>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-white" style={{ clipPath: 'ellipse(55% 100% at 50% 100%)' }} />
      </section>

      {/* Stats */}
      <section className="bg-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center p-6 rounded-2xl bg-gray-50 border border-gray-100">
                <div className="text-3xl lg:text-4xl font-bold text-red-600 mb-2">{stat.value}</div>
                <div className="text-sm text-gray-600 leading-snug">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Problem */}
      <section className="bg-gray-50 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mx-auto text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">The Challenge Newcomers Face</h2>
            <p className="text-gray-600 text-lg">
              Every year, 450,000 skilled professionals arrive in Canada ready to work — yet most spend 6+ months unable to find a job, simply because they lack &quot;Canadian experience.&quot;
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl mx-auto">
            {[
              'No "Canadian experience" despite strong international qualifications',
              'Limited professional network in Canada',
              'Unfamiliar with Canadian resume and interview norms',
              'Language barriers limit opportunities',
              'Fear of job scams and illegitimate postings',
              'Difficulty accessing opportunities without local references',
            ].map((challenge) => (
              <div key={challenge} className="flex items-start gap-3 bg-white p-4 rounded-xl border border-red-100">
                <div className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <div className="w-2 h-2 rounded-full bg-red-500" />
                </div>
                <span className="text-sm text-gray-700">{challenge}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="bg-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Everything You Need to Succeed</h2>
            <p className="text-gray-500 text-lg max-w-xl mx-auto">
              CanStart is built specifically for Canadian newcomers and the businesses that want to support them.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f) => (
              <div key={f.title} className="p-6 rounded-2xl bg-gray-50 border border-gray-100 hover:border-red-200 hover:shadow-sm transition-all group">
                <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center mb-4 group-hover:bg-red-100 transition-colors">
                  {f.icon}
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">{f.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-gray-50 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">How It Works</h2>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="bg-red-600 text-white text-sm font-bold px-3 py-1 rounded-full">For Newcomers</div>
              </div>
              <div className="space-y-4">
                {howItWorksSeeker.map((item) => (
                  <div key={item.step} className="flex gap-4 bg-white p-5 rounded-xl border border-gray-100">
                    <div className="w-9 h-9 bg-red-600 text-white rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0">
                      {item.step}
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-1">{item.title}</h4>
                      <p className="text-gray-500 text-sm">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <Link href="/auth/signup?role=seeker" className="inline-flex items-center gap-2 mt-6 bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-xl font-semibold transition-colors">
                Start as a Newcomer <ArrowRight size={18} />
              </Link>
            </div>
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="bg-gray-800 text-white text-sm font-bold px-3 py-1 rounded-full">For Employers</div>
              </div>
              <div className="space-y-4">
                {howItWorksEmployer.map((item) => (
                  <div key={item.step} className="flex gap-4 bg-white p-5 rounded-xl border border-gray-100">
                    <div className="w-9 h-9 bg-gray-800 text-white rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0">
                      {item.step}
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-1">{item.title}</h4>
                      <p className="text-gray-500 text-sm">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <Link href="/auth/signup?role=employer" className="inline-flex items-center gap-2 mt-6 bg-gray-800 hover:bg-gray-900 text-white px-6 py-3 rounded-xl font-semibold transition-colors">
                Post an Opportunity <ArrowRight size={18} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Cities */}
      <section className="bg-white py-14">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-gray-400 text-sm font-medium mb-4 uppercase tracking-wider">Active across Canada</p>
          <div className="flex flex-wrap justify-center gap-3">
            {cities.map((city) => (
              <Link
                key={city}
                href={`/opportunities?city=${city}`}
                className="flex items-center gap-1.5 bg-gray-50 hover:bg-red-50 border border-gray-200 hover:border-red-200 text-gray-700 hover:text-red-600 px-4 py-2 rounded-full text-sm font-medium transition-colors"
              >
                <MapPin size={13} />
                {city}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="bg-gray-50 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-10">Real Newcomers, Real Stories</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
              <div className="flex gap-1 mb-3">
                {[...Array(5)].map((_, i) => <Star key={i} size={16} className="text-yellow-400 fill-yellow-400" />)}
              </div>
              <p className="text-gray-700 text-sm leading-relaxed mb-4">
                &quot;Even having 10 years of experience as a Business Analyst, I was struggling to land a decent job in Ottawa. CanStart connected me with a local tech company for a micro-internship — now I have Canadian experience on my resume.&quot;
              </p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center text-red-600 font-bold">F</div>
                <div>
                  <div className="font-semibold text-gray-900 text-sm">Fariha J.</div>
                  <div className="text-xs text-gray-500">Business Analyst · Ottawa, ON · From Bangladesh</div>
                </div>
              </div>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
              <div className="flex gap-1 mb-3">
                {[...Array(5)].map((_, i) => <Star key={i} size={16} className="text-yellow-400 fill-yellow-400" />)}
              </div>
              <p className="text-gray-700 text-sm leading-relaxed mb-4">
                &quot;As a small business owner who immigrated from Ukraine, I understand the struggle. CanStart helped me find skilled volunteers who genuinely want to grow. It&apos;s a win-win — they get experience, I get the help I need to grow my business.&quot;
              </p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center text-red-600 font-bold">S</div>
                <div>
                  <div className="font-semibold text-gray-900 text-sm">Svitlana H.</div>
                  <div className="text-xs text-gray-500">Entrepreneur · Toronto, ON · From Ukraine</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Opportunity types */}
      <section className="bg-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-10">Types of Opportunities</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {[
              { type: 'Volunteer', color: 'green', icon: <Users size={24} />, desc: 'Give back while gaining local experience and references. Perfect for building your Canadian network.' },
              { type: 'Micro-Internship', color: 'blue', icon: <Briefcase size={24} />, desc: 'Short-term, project-based work (2–12 weeks) with real responsibilities and mentorship.' },
              { type: 'Paid Position', color: 'purple', icon: <TrendingUp size={24} />, desc: 'Entry-level paid roles with small businesses looking for skilled, motivated newcomers.' },
            ].map((t) => (
              <div key={t.type} className={`p-6 rounded-2xl border-2 ${t.color === 'green' ? 'border-green-100 bg-green-50' : t.color === 'blue' ? 'border-blue-100 bg-blue-50' : 'border-purple-100 bg-purple-50'}`}>
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${t.color === 'green' ? 'bg-green-100 text-green-600' : t.color === 'blue' ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600'}`}>
                  {t.icon}
                </div>
                <h3 className="font-bold text-gray-900 mb-2">{t.type}</h3>
                <p className="text-gray-600 text-sm">{t.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-gradient-to-br from-red-600 to-red-800 text-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">Ready to Start Your Canadian Journey?</h2>
          <p className="text-red-100 text-lg mb-8 max-w-xl mx-auto">
            Join thousands of newcomers already building their Canadian experience through CanStart.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link
              href="/auth/signup?role=seeker"
              className="inline-flex items-center justify-center gap-2 bg-white text-red-600 hover:bg-yellow-300 px-8 py-4 rounded-xl font-bold text-lg transition-colors shadow-lg"
            >
              Get Started Free <ArrowRight size={20} />
            </Link>
            <Link
              href="/opportunities"
              className="inline-flex items-center justify-center gap-2 bg-transparent border-2 border-white/50 hover:border-white hover:bg-white/10 text-white px-8 py-4 rounded-xl font-bold text-lg transition-colors"
            >
              Browse Opportunities
            </Link>
          </div>
          <div className="mt-8 flex flex-wrap justify-center gap-6 text-sm text-red-200">
            <span className="flex items-center gap-2"><CheckCircle size={16} /> Free for newcomers</span>
            <span className="flex items-center gap-2"><CheckCircle size={16} /> Verified employers only</span>
            <span className="flex items-center gap-2"><CheckCircle size={16} /> Across all major Canadian cities</span>
          </div>
        </div>
      </section>
    </div>
  )
}
