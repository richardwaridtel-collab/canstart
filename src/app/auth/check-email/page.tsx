import Link from 'next/link'
import { Mail, CheckCircle } from 'lucide-react'

export default function CheckEmailPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-10">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-5">
            <Mail size={32} className="text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-3">Check your email</h1>
          <p className="text-gray-500 mb-6 leading-relaxed">
            We sent a confirmation link to your email address. Click the link to activate your account and start exploring opportunities.
          </p>
          <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-600 mb-6 text-left space-y-2">
            <div className="flex items-center gap-2"><CheckCircle size={16} className="text-green-500" /> Check your inbox</div>
            <div className="flex items-center gap-2"><CheckCircle size={16} className="text-green-500" /> Check your spam/junk folder</div>
            <div className="flex items-center gap-2"><CheckCircle size={16} className="text-green-500" /> The link expires in 1 hour</div>
          </div>
          <Link href="/auth/signin" className="block w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3 rounded-xl transition-colors">
            Go to Sign In
          </Link>
          <p className="text-xs text-gray-400 mt-4">
            Didn&apos;t receive the email? Check your spam folder or{' '}
            <Link href="/auth/signup" className="text-red-600 hover:underline">try signing up again</Link>.
          </p>
        </div>
      </div>
    </div>
  )
}
