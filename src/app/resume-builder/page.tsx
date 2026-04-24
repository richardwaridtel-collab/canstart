'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  Upload, FileText, Briefcase, CheckCircle, Download, Copy,
  Loader2, ChevronDown, ChevronUp, Sparkles, AlertCircle, Printer
} from 'lucide-react'

type ResumeExperience = {
  title: string
  company: string
  location: string
  dates: string
  bullets: string[]
}

type ResumeEducation = {
  degree: string
  institution: string
  year: string
}

type ResumeContact = {
  name: string
  city: string | null
  province: string | null
  phone: string | null
  email: string | null
  linkedin: string | null
}

type ResumeScores = {
  resumeRating: number
  matchPercentage: number
  ratingReasons: string[]
  matchGaps: string[]
  trainingRecommendations: string[]
}

type GeneratedResume = {
  contact: ResumeContact
  summary: string
  competencies: string[]
  competencyCount: number
  experience: ResumeExperience[]
  certifications: string[] | null
  tools: string[] | null
  education: ResumeEducation[] | null
  scores?: ResumeScores
}

export default function ResumeBuilderPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [authChecked, setAuthChecked] = useState(false)
  const [resumeFile, setResumeFile] = useState<File | null>(null)
  const [resumePasteText, setResumePasteText] = useState('')
  const [useTextInput, setUseTextInput] = useState(false)
  const [jobDescription, setJobDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [resume, setResume] = useState<GeneratedResume | null>(null)
  const [copied, setCopied] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [expandedRoles, setExpandedRoles] = useState<Record<number, boolean>>({})

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.push('/auth/signin'); return }
      const { data: profile } = await supabase.from('profiles').select('role').eq('user_id', data.user.id).single()
      if (profile?.role === 'employer') { router.push('/dashboard'); return }
      setAuthChecked(true)
    })
  }, [router])

  const handleFile = (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (ext !== 'pdf' && ext !== 'docx') {
      setError('Please upload a PDF or DOCX file.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('File must be under 5MB.')
      return
    }
    setError('')
    setResumeFile(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const handleGenerate = async () => {
    if (useTextInput && !resumePasteText.trim()) {
      setError('Please paste your resume text.')
      return
    }
    if (!useTextInput && !resumeFile) {
      setError('Please upload your resume file.')
      return
    }
    if (!jobDescription.trim()) {
      setError('Please paste the job description.')
      return
    }
    setError('')
    setLoading(true)
    setResume(null)

    try {
      const formData = new FormData()
      if (useTextInput) {
        // Create a text file from pasted content
        const textBlob = new Blob([resumePasteText], { type: 'text/plain' })
        const textFile = new File([textBlob], 'resume.txt', { type: 'text/plain' })
        formData.append('resume', textFile)
      } else {
        formData.append('resume', resumeFile!)
      }
      formData.append('jobDescription', jobDescription)

      const res = await fetch('/api/resume-builder', { method: 'POST', body: formData })
      const data = await res.json()

      if (!res.ok || data.error) {
        setError(data.error || 'Something went wrong. Please try again.')
      } else {
        setResume(data.resume)
        // expand all roles by default
        const expanded: Record<number, boolean> = {}
        data.resume.experience.forEach((_: ResumeExperience, i: number) => { expanded[i] = true })
        setExpandedRoles(expanded)
        setTimeout(() => document.getElementById('resume-output')?.scrollIntoView({ behavior: 'smooth' }), 100)
      }
    } catch {
      setError('Network error. Please try again.')
    }

    setLoading(false)
  }

  const getResumeText = () => {
    if (!resume) return ''
    const lines: string[] = []

    // Header
    if (resume.contact) {
      lines.push(resume.contact.name.toUpperCase())
      const locationParts = [resume.contact.city, resume.contact.province].filter(Boolean).join(', ')
      const contactParts = [locationParts, resume.contact.phone, resume.contact.email, resume.contact.linkedin].filter(Boolean).join('  ·  ')
      if (contactParts) lines.push(contactParts)
      lines.push('')
    }

    lines.push('PROFESSIONAL SUMMARY')
    lines.push('─'.repeat(60))
    lines.push(resume.summary)
    lines.push('')

    lines.push('CORE COMPETENCIES')
    lines.push('─'.repeat(60))
    const cols = resume.competencies.length === 9 ? 3 : 4
    for (let i = 0; i < resume.competencies.length; i += cols) {
      lines.push(resume.competencies.slice(i, i + cols).join('  ·  '))
    }
    lines.push('')

    lines.push('WORK EXPERIENCE')
    lines.push('─'.repeat(60))
    resume.experience.forEach((role) => {
      lines.push(`${role.title} | ${role.company}`)
      lines.push(`${role.location} | ${role.dates}`)
      role.bullets.forEach((b) => lines.push(`• ${b}`))
      lines.push('')
    })

    if (resume.certifications?.length) {
      lines.push('PROFESSIONAL TRAINING & CERTIFICATIONS')
      lines.push('─'.repeat(60))
      resume.certifications.forEach((c) => lines.push(`• ${c}`))
      lines.push('')
    }

    if (resume.tools?.length) {
      lines.push('TOOLS PROFICIENCY')
      lines.push('─'.repeat(60))
      lines.push(resume.tools.join('  ·  '))
      lines.push('')
    }

    if (resume.education?.length) {
      lines.push('EDUCATION')
      lines.push('─'.repeat(60))
      resume.education.forEach((e) => lines.push(`${e.degree} — ${e.institution}${e.year ? ` (${e.year})` : ''}`))
    }

    return lines.join('\n')
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(getResumeText())
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownloadPDF = async () => {
    if (!resume) return
    const { jsPDF } = await import('jspdf')
    const doc = new jsPDF({ unit: 'mm', format: 'letter' })
    const pageW = 215.9
    const margin = 18
    const contentW = pageW - margin * 2
    let y = 22

    const checkPage = (needed: number) => { if (y + needed > 268) { doc.addPage(); y = 22 } }

    const sectionHeader = (title: string) => {
      checkPage(14)
      doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(180, 20, 20)
      doc.text(title.toUpperCase(), margin, y); y += 2
      doc.setDrawColor(220, 220, 220); doc.line(margin, y, pageW - margin, y); y += 5
      doc.setTextColor(0); doc.setFont('helvetica', 'normal')
    }

    // Name
    doc.setFontSize(16); doc.setFont('helvetica', 'bold'); doc.setTextColor(0)
    doc.text(resume.contact?.name || '', pageW / 2, y, { align: 'center' }); y += 7

    // Contact
    if (resume.contact) {
      const parts = [
        [resume.contact.city, resume.contact.province].filter(Boolean).join(', '),
        resume.contact.phone, resume.contact.email, resume.contact.linkedin
      ].filter(Boolean).join('  ·  ')
      if (parts) {
        doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(90)
        doc.text(parts, pageW / 2, y, { align: 'center' }); y += 9
        doc.setTextColor(0)
      }
    }

    // Summary
    sectionHeader('Professional Summary')
    doc.setFontSize(10)
    const sumLines = doc.splitTextToSize(resume.summary, contentW)
    doc.text(sumLines, margin, y); y += sumLines.length * 5 + 7

    // Competencies
    sectionHeader('Core Competencies')
    const cols = resume.competencies.length === 9 ? 3 : 4
    const colW = contentW / cols
    for (let i = 0; i < resume.competencies.length; i += cols) {
      checkPage(6)
      resume.competencies.slice(i, i + cols).forEach((s, j) => {
        doc.setFontSize(9.5); doc.text(`• ${s}`, margin + j * colW, y)
      }); y += 5.5
    }
    y += 4

    // Experience
    sectionHeader('Work Experience')
    resume.experience.forEach((role) => {
      checkPage(18)
      doc.setFontSize(10.5); doc.setFont('helvetica', 'bold')
      doc.text(role.title, margin, y); y += 5
      doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(80)
      doc.text(`${role.company}  ·  ${role.location}  ·  ${role.dates}`, margin, y); y += 5
      doc.setTextColor(0)
      role.bullets.forEach((b) => {
        checkPage(10)
        const bLines = doc.splitTextToSize(`• ${b}`, contentW - 2)
        doc.setFontSize(9.5); doc.text(bLines, margin, y); y += bLines.length * 4.8 + 1.5
      }); y += 4
    })

    // Certifications
    if (resume.certifications?.length) {
      sectionHeader('Professional Training & Certifications')
      resume.certifications.forEach((c) => { checkPage(6); doc.setFontSize(9.5); doc.text(`• ${c}`, margin, y); y += 5.5 })
      y += 2
    }

    // Tools
    if (resume.tools?.length) {
      sectionHeader('Tools Proficiency')
      const tLines = doc.splitTextToSize(resume.tools.join('  ·  '), contentW)
      doc.setFontSize(9.5); doc.text(tLines, margin, y); y += tLines.length * 5 + 4
    }

    // Education
    if (resume.education?.length) {
      sectionHeader('Education')
      resume.education.forEach((e) => {
        checkPage(10)
        doc.setFontSize(10); doc.setFont('helvetica', 'bold')
        doc.text(e.degree, margin, y); y += 5
        doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(80)
        doc.text(`${e.institution}${e.year ? ` (${e.year})` : ''}`, margin, y)
        doc.setTextColor(0); y += 6
      })
    }

    const fname = resume.contact?.name ? resume.contact.name.replace(/\s+/g, '_') : 'Resume'
    doc.save(`${fname}_Tailored.pdf`)
  }

  const handleDownloadDOCX = async () => {
    if (!resume) return
    const {
      Document, Paragraph, TextRun, Packer, AlignmentType, BorderStyle
    } = await import('docx')

    void Paragraph

    const RED = 'B41414'
    const GRAY = '666666'
    const BLACK = '1a1a1a'

    const sectionPara = (title: string) => new Paragraph({
      spacing: { before: 280, after: 80 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: 'DDDDDD', space: 3 } },
      children: [new TextRun({ text: title.toUpperCase(), bold: true, size: 18, color: RED, font: 'Calibri' })]
    })

    const children = []

    // Name
    children.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
      children: [new TextRun({ text: resume.contact?.name || '', bold: true, size: 32, font: 'Calibri', color: BLACK })]
    }))

    // Contact line
    if (resume.contact) {
      const parts = [
        [resume.contact.city, resume.contact.province].filter(Boolean).join(', '),
        resume.contact.phone, resume.contact.email, resume.contact.linkedin
      ].filter(Boolean)
      if (parts.length) {
        const runs: InstanceType<typeof TextRun>[] = []
        parts.forEach((p, i) => {
          runs.push(new TextRun({ text: p!, size: 18, font: 'Calibri', color: GRAY }))
          if (i < parts.length - 1) runs.push(new TextRun({ text: '  ·  ', size: 18, color: 'AAAAAA', font: 'Calibri' }))
        })
        children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: runs }))
      }
    }

    // Summary
    children.push(sectionPara('Professional Summary'))
    children.push(new Paragraph({
      spacing: { after: 200 },
      children: [new TextRun({ text: resume.summary, size: 20, font: 'Calibri', color: BLACK })]
    }))

    // Competencies
    children.push(sectionPara('Core Competencies'))
    const cols = resume.competencies.length === 9 ? 3 : 4
    for (let i = 0; i < resume.competencies.length; i += cols) {
      const row = resume.competencies.slice(i, i + cols)
      children.push(new Paragraph({
        spacing: { after: 60 },
        children: row.map((s, j) => new TextRun({
          text: `• ${s}${j < row.length - 1 ? '          ' : ''}`,
          size: 19, font: 'Calibri', color: BLACK
        }))
      }))
    }

    // Experience
    children.push(sectionPara('Work Experience'))
    resume.experience.forEach((role) => {
      children.push(new Paragraph({
        spacing: { before: 120, after: 40 },
        children: [new TextRun({ text: role.title, bold: true, size: 21, font: 'Calibri', color: BLACK })]
      }))
      children.push(new Paragraph({
        spacing: { after: 80 },
        children: [new TextRun({ text: `${role.company}  ·  ${role.location}  ·  ${role.dates}`, size: 18, font: 'Calibri', color: GRAY })]
      }))
      role.bullets.forEach((b) => {
        children.push(new Paragraph({
          spacing: { after: 60 },
          children: [new TextRun({ text: `• ${b}`, size: 19, font: 'Calibri', color: BLACK })]
        }))
      })
    })

    // Certifications
    if (resume.certifications?.length) {
      children.push(sectionPara('Professional Training & Certifications'))
      resume.certifications.forEach((c) => {
        children.push(new Paragraph({
          spacing: { after: 60 },
          children: [new TextRun({ text: `• ${c}`, size: 19, font: 'Calibri', color: BLACK })]
        }))
      })
    }

    // Tools
    if (resume.tools?.length) {
      children.push(sectionPara('Tools Proficiency'))
      children.push(new Paragraph({
        spacing: { after: 120 },
        children: [new TextRun({ text: resume.tools.join('  ·  '), size: 19, font: 'Calibri', color: BLACK })]
      }))
    }

    // Education
    if (resume.education?.length) {
      children.push(sectionPara('Education'))
      resume.education.forEach((e) => {
        children.push(new Paragraph({
          spacing: { before: 80, after: 40 },
          children: [new TextRun({ text: e.degree, bold: true, size: 20, font: 'Calibri', color: BLACK })]
        }))
        children.push(new Paragraph({
          spacing: { after: 80 },
          children: [new TextRun({ text: `${e.institution}${e.year ? ` (${e.year})` : ''}`, size: 18, font: 'Calibri', color: GRAY })]
        }))
      })
    }

    const doc = new Document({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      sections: [{ properties: {}, children: children as any[] }]
    })
    const blob = await Packer.toBlob(doc)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const fname = resume.contact?.name ? resume.contact.name.replace(/\s+/g, '_') : 'Resume'
    a.download = `${fname}_Tailored.docx`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handlePrint = () => window.print()

  if (!authChecked) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-red-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="bg-gray-50 min-h-screen pb-16">
      {/* Header */}
      <div className="bg-gradient-to-br from-red-600 to-red-700 text-white py-12 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-white/20 px-4 py-1.5 rounded-full text-sm font-medium mb-4">
            <Sparkles size={14} /> AI Resume Builder
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold mb-3">Build Your Tailored Resume</h1>
          <p className="text-red-100 text-lg max-w-2xl mx-auto">
            Upload your resume and a job description — we'll create a tailored resume with
            structured bullets, the right keywords, and a natural human tone.
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

        {/* Input Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Resume Upload */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-semibold text-gray-700">
                Your Current Resume <span className="text-red-500">*</span>
              </label>
              <button
                type="button"
                onClick={() => { setUseTextInput(!useTextInput); setError('') }}
                className="text-xs text-red-600 hover:text-red-700 font-medium underline"
              >
                {useTextInput ? 'Upload file instead' : 'Paste text instead'}
              </button>
            </div>

            {useTextInput ? (
              <textarea
                value={resumePasteText}
                onChange={(e) => setResumePasteText(e.target.value)}
                placeholder="Copy and paste all text from your resume here..."
                rows={8}
                className="w-full px-4 py-3 border border-gray-300 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none bg-white"
              />
            ) : (
              <div
                className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
                  dragOver ? 'border-red-400 bg-red-50' :
                  resumeFile ? 'border-green-400 bg-green-50' :
                  'border-gray-300 bg-white hover:border-red-400 hover:bg-red-50'
                }`}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx"
                  className="hidden"
                  onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]) }}
                />
                {resumeFile ? (
                  <div className="space-y-1">
                    <CheckCircle size={32} className="mx-auto text-green-500" />
                    <p className="font-semibold text-green-700 text-sm">{resumeFile.name}</p>
                    <p className="text-xs text-green-600">Click to replace · If PDF fails, try DOCX or paste text</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Upload size={32} className="mx-auto text-gray-400" />
                    <p className="text-sm font-medium text-gray-600">Drop your resume here or click to browse</p>
                    <p className="text-xs text-gray-400">DOCX recommended · PDF also supported · Max 5MB</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Job Description */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Job Description <span className="text-red-500">*</span>
            </label>
            <textarea
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              placeholder="Paste the full job posting here — including responsibilities, requirements, and any keywords..."
              rows={8}
              className="w-full px-4 py-3 border border-gray-300 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none bg-white"
            />
            <p className="text-xs text-gray-400 mt-1">{jobDescription.length} characters · Paste the full posting for best results</p>
          </div>
        </div>

        {/* What we follow */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5 mb-6">
          <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <FileText size={16} className="text-red-500" /> What this builder follows
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-gray-600">
            {[
              'No AI-generated buzzwords — natural human language only',
              '3 bullet patterns: action+result, result+how, action+impact',
              'Every bullet is 15–22 words — concise, no padding',
              'Current role: 6 bullets · Next 2 roles: 4 · Older roles: 3',
              'Keywords tailored to your specific job description',
              'Structure: Summary → Competencies → Experience → Certs → Tools → Education',
            ].map((item) => (
              <div key={item} className="flex items-start gap-2">
                <CheckCircle size={14} className="text-green-500 flex-shrink-0 mt-0.5" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
            <AlertCircle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Generate Button */}
        <button
          onClick={handleGenerate}
          disabled={loading || (!resumeFile && !resumePasteText.trim()) || !jobDescription.trim()}
          className="w-full bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-3 text-lg transition-colors"
        >
          {loading ? (
            <>
              <Loader2 size={22} className="animate-spin" />
              Building your tailored resume… this takes about 20 seconds
            </>
          ) : (
            <>
              <Sparkles size={22} />
              Build My Tailored Resume
            </>
          )}
        </button>

        {/* Resume Output */}
        {resume && (
          <div id="resume-output" className="mt-10">
            {/* Action buttons */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <CheckCircle size={20} className="text-green-500" /> Your Tailored Resume
              </h2>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-2 bg-white border border-gray-200 hover:border-gray-400 text-gray-700 text-sm font-medium px-4 py-2 rounded-xl transition-colors"
                >
                  {copied ? <CheckCircle size={15} className="text-green-500" /> : <Copy size={15} />}
                  {copied ? 'Copied!' : 'Copy'}
                </button>
                <button
                  onClick={handleDownloadPDF}
                  className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors"
                >
                  <Download size={15} /> Download PDF
                </button>
                <button
                  onClick={handleDownloadDOCX}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors"
                >
                  <FileText size={15} /> Download DOCX
                </button>
                <button
                  onClick={handlePrint}
                  className="flex items-center gap-2 bg-white border border-gray-200 hover:border-gray-400 text-gray-700 text-sm font-medium px-4 py-2 rounded-xl transition-colors"
                >
                  <Printer size={15} /> Print
                </button>
              </div>
            </div>

            {/* Scores */}
            {resume.scores && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                {/* Resume Rating */}
                <div className="bg-white border border-gray-200 rounded-2xl p-5">
                  <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">Resume Quality Rating</p>
                  <div className="flex items-end gap-2 mb-3">
                    <span className={`text-5xl font-black ${resume.scores.resumeRating >= 8 ? 'text-green-500' : resume.scores.resumeRating >= 6 ? 'text-yellow-500' : 'text-red-500'}`}>
                      {resume.scores.resumeRating}
                    </span>
                    <span className="text-xl text-gray-300 font-semibold mb-1">/ 10</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full mb-4 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${resume.scores.resumeRating >= 8 ? 'bg-green-500' : resume.scores.resumeRating >= 6 ? 'bg-yellow-400' : 'bg-red-500'}`}
                      style={{ width: `${resume.scores.resumeRating * 10}%` }}
                    />
                  </div>
                  {resume.scores.ratingReasons?.map((r, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-gray-600 mb-1.5">
                      <CheckCircle size={12} className="text-green-500 flex-shrink-0 mt-0.5" />
                      <span>{r}</span>
                    </div>
                  ))}
                </div>

                {/* Job Match */}
                <div className="bg-white border border-gray-200 rounded-2xl p-5">
                  <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">Job Description Match</p>
                  <div className="flex items-end gap-2 mb-3">
                    <span className={`text-5xl font-black ${resume.scores.matchPercentage >= 75 ? 'text-green-500' : resume.scores.matchPercentage >= 55 ? 'text-yellow-500' : 'text-red-500'}`}>
                      {resume.scores.matchPercentage}
                    </span>
                    <span className="text-xl text-gray-300 font-semibold mb-1">%</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full mb-4 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${resume.scores.matchPercentage >= 75 ? 'bg-green-500' : resume.scores.matchPercentage >= 55 ? 'bg-yellow-400' : 'bg-red-500'}`}
                      style={{ width: `${resume.scores.matchPercentage}%` }}
                    />
                  </div>

                  {resume.scores.matchGaps && resume.scores.matchGaps.length > 0 ? (
                    <>
                      <p className="text-xs font-semibold text-gray-500 mb-2">Why this isn&apos;t a 90%+ match:</p>
                      <div className="space-y-1.5 mb-4">
                        {resume.scores.matchGaps.map((g, i) => (
                          <div key={i} className="flex items-start gap-2 text-xs text-gray-600">
                            <AlertCircle size={12} className="text-orange-400 flex-shrink-0 mt-0.5" />
                            <span>{g}</span>
                          </div>
                        ))}
                      </div>

                      {resume.scores.trainingRecommendations && resume.scores.trainingRecommendations.length > 0 && (
                        <>
                          <div className="border-t border-gray-100 pt-3 mt-3">
                            <p className="text-xs font-semibold text-blue-600 mb-2">📚 Close the gap — recommended training:</p>
                            <div className="space-y-1.5">
                              {resume.scores.trainingRecommendations.map((t, i) => (
                                <div key={i} className="flex items-start gap-2 text-xs text-gray-600">
                                  <CheckCircle size={12} className="text-blue-400 flex-shrink-0 mt-0.5" />
                                  <span>{t}</span>
                                </div>
                              ))}
                            </div>
                            <p className="text-xs text-gray-400 mt-2 italic">Completing these would push your match score above 90%.</p>
                          </div>
                        </>
                      )}
                    </>
                  ) : (
                    <div className="flex items-center gap-2 text-xs text-green-600">
                      <CheckCircle size={12} />
                      <span>Strong match — no major gaps found.</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden print:shadow-none print:border-none" id="resume-print">

              {/* Contact Header */}
              {resume.contact && (
                <section className="p-6 pb-5 border-b border-gray-100 text-center">
                  <h2 className="text-2xl font-bold text-gray-900 tracking-wide mb-2">
                    {resume.contact.name}
                  </h2>
                  <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm text-gray-500">
                    {(resume.contact.city || resume.contact.province) && (
                      <span>{[resume.contact.city, resume.contact.province].filter(Boolean).join(', ')}</span>
                    )}
                    {resume.contact.phone && (
                      <><span className="text-gray-300">·</span><span>{resume.contact.phone}</span></>
                    )}
                    {resume.contact.email && (
                      <><span className="text-gray-300">·</span><span>{resume.contact.email}</span></>
                    )}
                    {resume.contact.linkedin && (
                      <><span className="text-gray-300">·</span>
                      <a href={resume.contact.linkedin} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                        LinkedIn
                      </a></>
                    )}
                  </div>
                </section>
              )}

              {/* Professional Summary */}
              <section className="p-6 border-b border-gray-100">
                <h3 className="text-xs font-bold uppercase tracking-widest text-red-600 mb-3">Professional Summary</h3>
                <p className="text-gray-800 leading-relaxed">{resume.summary}</p>
              </section>

              {/* Core Competencies */}
              <section className="p-6 border-b border-gray-100">
                <h3 className="text-xs font-bold uppercase tracking-widest text-red-600 mb-3">
                  Core Competencies
                  <span className="ml-2 text-gray-400 font-normal normal-case tracking-normal text-xs">
                    ({resume.competencies.length} skills)
                  </span>
                </h3>
                <div className={`grid gap-2 ${resume.competencies.length === 9 ? 'grid-cols-3' : 'grid-cols-4'}`}>
                  {resume.competencies.map((skill, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm text-gray-700">
                      <span className="w-1.5 h-1.5 bg-red-500 rounded-full flex-shrink-0" />
                      {skill}
                    </div>
                  ))}
                </div>
              </section>

              {/* Work Experience */}
              <section className="p-6 border-b border-gray-100">
                <h3 className="text-xs font-bold uppercase tracking-widest text-red-600 mb-4">Work Experience</h3>
                <div className="space-y-5">
                  {resume.experience.map((role, i) => (
                    <div key={i} className="border border-gray-100 rounded-xl overflow-hidden">
                      <div
                        className="flex items-center justify-between p-4 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
                        onClick={() => setExpandedRoles((prev) => ({ ...prev, [i]: !prev[i] }))}
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <Briefcase size={14} className="text-red-500" />
                            <span className="font-bold text-gray-900">{role.title}</span>
                            {i === 0 && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Current</span>}
                          </div>
                          <p className="text-sm text-gray-500 mt-0.5 ml-5">{role.company} · {role.location} · {role.dates}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400">{role.bullets.length} bullets</span>
                          {expandedRoles[i] ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                        </div>
                      </div>
                      {expandedRoles[i] && (
                        <ul className="p-4 space-y-2.5">
                          {role.bullets.map((bullet, j) => (
                            <li key={j} className="flex items-start gap-2.5 text-sm text-gray-700 leading-relaxed">
                              <span className="w-1.5 h-1.5 bg-red-400 rounded-full flex-shrink-0 mt-1.5" />
                              <span>{bullet}</span>
                              <span className="ml-auto text-xs text-gray-300 flex-shrink-0 self-start mt-0.5">
                                {bullet.split(' ').length}w
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              </section>

              {/* Certifications */}
              {resume.certifications && resume.certifications.length > 0 && (
                <section className="p-6 border-b border-gray-100">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-red-600 mb-3">Professional Training &amp; Certifications</h3>
                  <ul className="space-y-1.5">
                    {resume.certifications.map((cert, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm text-gray-700">
                        <span className="w-1.5 h-1.5 bg-red-500 rounded-full flex-shrink-0" />
                        {cert}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {/* Tools */}
              {resume.tools && resume.tools.length > 0 && (
                <section className="p-6 border-b border-gray-100">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-red-600 mb-3">Tools Proficiency</h3>
                  <div className="flex flex-wrap gap-2">
                    {resume.tools.map((tool, i) => (
                      <span key={i} className="bg-gray-100 text-gray-700 text-sm px-3 py-1 rounded-full">{tool}</span>
                    ))}
                  </div>
                </section>
              )}

              {/* Education */}
              {resume.education && resume.education.length > 0 && (
                <section className="p-6">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-red-600 mb-3">Education</h3>
                  <div className="space-y-2">
                    {resume.education.map((edu, i) => (
                      <div key={i} className="text-sm text-gray-700">
                        <span className="font-semibold">{edu.degree}</span>
                        <span className="text-gray-500"> — {edu.institution}{edu.year ? ` (${edu.year})` : ''}</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>

            {/* Footer tip */}
            <div className="mt-4 flex items-start gap-2 text-xs text-gray-400">
              <AlertCircle size={13} className="flex-shrink-0 mt-0.5" />
              <p>
                Review every bullet before submitting. The word count is shown beside each bullet (aim for 15–22).
                Use "Print / PDF" to save a clean version, or "Copy Text" to paste into Word.
              </p>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @media print {
          body > *:not(#resume-print) { display: none !important; }
          #resume-print { display: block !important; }
          .print\\:hidden { display: none !important; }
        }
      `}</style>
    </div>
  )
}
