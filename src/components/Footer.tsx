import Link from 'next/link'
import { MapPin, Mail, Heart } from 'lucide-react'

export default function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <div className="bg-red-600 text-white font-bold text-xl px-3 py-1 rounded-lg">
                Can<span className="text-yellow-300">Start</span>
              </div>
            </div>
            <p className="text-gray-400 text-sm leading-relaxed max-w-sm">
              Empowering newcomers to gain Canadian work experience through volunteer and micro-internship opportunities with local businesses.
            </p>
            <div className="flex items-center gap-2 mt-4 text-sm text-gray-500">
              <MapPin size={14} />
              <span>Serving communities across Canada</span>
            </div>
          </div>

          <div>
            <h3 className="text-white font-semibold mb-4">For Newcomers</h3>
            <ul className="space-y-2 text-sm">
              <li><Link href="/opportunities" className="hover:text-white transition-colors">Browse Opportunities</Link></li>
              <li><Link href="/auth/signup?role=seeker" className="hover:text-white transition-colors">Create Profile</Link></li>
              <li><Link href="/dashboard" className="hover:text-white transition-colors">My Applications</Link></li>
              <li><Link href="/profile/setup" className="hover:text-white transition-colors">Edit Profile</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="text-white font-semibold mb-4">For Businesses</h3>
            <ul className="space-y-2 text-sm">
              <li><Link href="/candidates" className="hover:text-white transition-colors">Find Candidates</Link></li>
              <li><Link href="/post-opportunity" className="hover:text-white transition-colors">Post Opportunity</Link></li>
              <li><Link href="/dashboard" className="hover:text-white transition-colors">Manage Listings</Link></li>
              <li><Link href="/auth/signup?role=employer" className="hover:text-white transition-colors">Register Business</Link></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 mt-10 pt-6 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-sm text-gray-500">
            © {new Date().getFullYear()} CanStart. Built with{' '}
            <Heart size={12} className="inline text-red-500" /> for Canada&apos;s newcomers.
          </p>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Mail size={14} />
            <a href="mailto:hello@canstart.ca" className="hover:text-white transition-colors">hello@canstart.ca</a>
          </div>
        </div>
      </div>
    </footer>
  )
}
