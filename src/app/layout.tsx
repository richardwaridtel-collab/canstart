import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { Analytics } from '@vercel/analytics/react'

const geist = Geist({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'CanStart – Empowering Job Seekers, Building Communities',
  description: 'Connect skilled job seekers with meaningful volunteer and micro-internship opportunities at local Canadian businesses. Build your Canadian experience today.',
  keywords: ['Canadian experience', 'job seekers Canada', 'volunteer opportunities', 'micro-internship', 'immigrants jobs Canada', 'OWP jobs'],
  openGraph: {
    title: 'CanStart – Your Path to Canadian Experience',
    description: 'Connect with local Canadian businesses for volunteer and micro-internship opportunities.',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${geist.className} bg-gray-50 text-gray-900 antialiased`}>
        <Navbar />
        <main className="min-h-screen">
          {children}
        </main>
        <Footer />
        <Analytics />
      </body>
    </html>
  )
}
