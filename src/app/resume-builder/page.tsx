'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  Upload, FileText, Briefcase, CheckCircle, Download, Copy,
  Loader2, ChevronDown, ChevronUp, Sparkles, AlertCircle, Printer,
  BarChart2, ThumbsUp, ArrowDown, RefreshCw
} from 'lucide-react'

type ResumeExperience = { title: string; company: string; location: string; dates: string; bullets: string[] }
type ResumeEducation  = { degree: string; institution: string; location?: string; year: string }
type ResumeContact    = { name: string; city: string | null; province: string | null; phone: string | null; email: string | null; linkedin: string | null }
type ResumeScores     = { resumeRating: number; matchPercentage: number; ratingReasons: string[]; matchGaps: string[]; trainingRecommendations: string[] }
type GeneratedResume  = {
  contact: ResumeContact; summary: string; competencies: string[]; competencyCount: number
  experience: ResumeExperience[]; certifications: string[] | null; tools: string[] | null
  education: ResumeEducation[] | null; scores?: ResumeScores
}

export default function ResumeBuilderPage() {
  const router      = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const scoreRef     = useRef<HTMLDivElement>(null)
  const resumeRef    = useRef<HTMLDivElement>(null)

  const [authChecked, setAuthChecked] = useState(false)

  // ── inputs ──────────────────────────────────────────────
  const [resumeFile,      setResumeFile]      = useState<File | null>(null)
  const [resumePasteText, setResumePasteText] = useState('')
  const [useTextInput,    setUseTextInput]    = useState(false)
  const [jobDescription,  setJobDescription]  = useState('')
  const [dragOver,        setDragOver]        = useState(false)

  // ── state ────────────────────────────────────────────────
  const [scoreLoading,  setScoreLoading]  = useState(false)
  const [tailorLoading, setTailorLoading] = useState(false)
  const [error,         setError]         = useState('')

  const [scores,  setScores]  = useState<ResumeScores | null>(null)   // from "Check Score"
  const [resume,  setResume]  = useState<GeneratedResume | null>(null) // from "Build Tailored"
  const [satisfied, setSatisfied] = useState(false)                   // chose "I'm happy"

  const [copied,        setCopied]        = useState(false)
  const [expandedRoles, setExpandedRoles] = useState<Record<number, boolean>>({})

  // derived: is enough filled in to run anything?
  const hasResume = useTextInput ? resumePasteText.trim().length > 0 : !!resumeFile
  const hasJD     = jobDescription.trim().length > 0
  const canRun    = hasResume && hasJD

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
    if (ext !== 'pdf' && ext !== 'docx') { setError('Please upload a PDF or DOCX file.'); return }
    if (file.size > 5 * 1024 * 1024)    { setError('File must be under 5MB.'); return }
    setError('')
    setResumeFile(file)
    // Reset results when resume changes
    setScores(null); setResume(null); setSatisfied(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false)
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0])
  }

  const resetResults = () => { setScores(null); setResume(null); setSatisfied(false); setError('') }

  const buildFormData = (mode: 'score' | 'full') => {
    const fd = new FormData()
    fd.append('resume', useTextInput
      ? new File([resumePasteText], 'resume.txt', { type: 'text/plain' })
      : resumeFile!)
    fd.append('jobDescription', jobDescription)
    fd.append('mode', mode)
    return fd
  }

  // ── Step 1: score only ───────────────────────────────────
  const handleCheckScore = async () => {
    setScoreLoading(true); setError(''); setScores(null); setResume(null); setSatisfied(false)
    try {
      const res  = await fetch('/api/resume-builder', { method: 'POST', body: buildFormData('score') })
      const data = await res.json()
      if (!res.ok || data.error) {
        setError(data.error || 'Something went wrong. Please try again.')
      } else {
        setScores(data.scores)
        setTimeout(() => scoreRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
      }
    } catch { setError('Network error. Please try again.') }
    setScoreLoading(false)
  }

  // ── Step 2a: satisfied ───────────────────────────────────
  const handleSatisfied = () => {
    setSatisfied(true)
    setTimeout(() => scoreRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  }

  // ── Step 2b: build tailored ──────────────────────────────
  const handleGenerate = async () => {
    setTailorLoading(true); setError(''); setResume(null)
    try {
      const res  = await fetch('/api/resume-builder', { method: 'POST', body: buildFormData('full') })
      const data = await res.json()
      if (!res.ok || data.error) {
        setError(data.error || 'Something went wrong. Please try again.')
      } else {
        setResume(data.resume)
        const expanded: Record<number, boolean> = {}
        data.resume.experience.forEach((_: ResumeExperience, i: number) => { expanded[i] = true })
        setExpandedRoles(expanded)
        setTimeout(() => resumeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
      }
    } catch { setError('Network error. Please try again.') }
    setTailorLoading(false)
  }

  // ── resume text export ───────────────────────────────────
  const getResumeText = () => {
    if (!resume) return ''
    const lines: string[] = []
    if (resume.contact) {
      lines.push(resume.contact.name.toUpperCase())
      const loc   = [resume.contact.city, resume.contact.province].filter(Boolean).join(', ')
      const parts = [loc, resume.contact.phone, resume.contact.email, resume.contact.linkedin].filter(Boolean).join('  ·  ')
      if (parts) lines.push(parts)
      lines.push('')
    }
    lines.push('PROFESSIONAL SUMMARY', '─'.repeat(60), resume.summary, '')
    lines.push('CORE COMPETENCIES',   '─'.repeat(60))
    const cols = resume.competencies.length === 9 ? 3 : 4
    for (let i = 0; i < resume.competencies.length; i += cols)
      lines.push(resume.competencies.slice(i, i + cols).join('  ·  '))
    lines.push('')
    lines.push('WORK EXPERIENCE', '─'.repeat(60))
    resume.experience.forEach((r) => {
      lines.push(`${r.title} | ${r.company}`, `${r.location} | ${r.dates}`)
      r.bullets.forEach((b) => lines.push(`• ${b}`))
      lines.push('')
    })
    if (resume.certifications?.length) {
      lines.push('PROFESSIONAL TRAINING & CERTIFICATIONS', '─'.repeat(60))
      resume.certifications.forEach((c) => lines.push(`• ${c}`))
      lines.push('')
    }
    if (resume.tools?.length) {
      lines.push('TOOLS PROFICIENCY', '─'.repeat(60), resume.tools.join('  ·  '), '')
    }
    if (resume.education?.length) {
      lines.push('EDUCATION', '─'.repeat(60))
      resume.education.forEach((e) => lines.push(`${e.degree} — ${e.institution}${e.location ? `, ${e.location}` : ''}${e.year ? ` (${e.year})` : ''}`))
    }
    return lines.join('\n')
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(getResumeText())
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  const handleDownloadPDF = async () => {
    if (!resume) return
    const { jsPDF } = await import('jspdf')
    const doc = new jsPDF({ unit: 'mm', format: 'letter' })
    const pageW = 215.9, margin = 18, contentW = pageW - margin * 2
    let y = 22
    const checkPage = (n: number) => { if (y + n > 268) { doc.addPage(); y = 22 } }
    const sec = (title: string) => {
      checkPage(14)
      doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(180, 20, 20)
      doc.text(title.toUpperCase(), margin, y); y += 2
      doc.setDrawColor(220, 220, 220); doc.line(margin, y, pageW - margin, y); y += 5
      doc.setTextColor(0); doc.setFont('helvetica', 'normal')
    }
    doc.setFontSize(16); doc.setFont('helvetica', 'bold'); doc.setTextColor(0)
    doc.text(resume.contact?.name || '', pageW / 2, y, { align: 'center' }); y += 7
    if (resume.contact) {
      const p = [[resume.contact.city, resume.contact.province].filter(Boolean).join(', '), resume.contact.phone, resume.contact.email, resume.contact.linkedin].filter(Boolean).join('  ·  ')
      if (p) { doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(90); doc.text(p, pageW / 2, y, { align: 'center' }); y += 9; doc.setTextColor(0) }
    }
    sec('Professional Summary'); doc.setFontSize(10)
    const sl = doc.splitTextToSize(resume.summary, contentW); doc.text(sl, margin, y); y += sl.length * 5 + 7
    sec('Core Competencies')
    const cols = resume.competencies.length === 9 ? 3 : 4; const cw = contentW / cols
    for (let i = 0; i < resume.competencies.length; i += cols) {
      checkPage(6); resume.competencies.slice(i, i + cols).forEach((s, j) => { doc.setFontSize(9.5); doc.text(`• ${s}`, margin + j * cw, y) }); y += 5.5
    }; y += 4
    sec('Work Experience')
    resume.experience.forEach((r) => {
      checkPage(18); doc.setFontSize(10.5); doc.setFont('helvetica', 'bold'); doc.text(r.title, margin, y); y += 5
      doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(80)
      doc.text(`${r.company}  ·  ${r.location}  ·  ${r.dates}`, margin, y); y += 5; doc.setTextColor(0)
      r.bullets.forEach((b) => { checkPage(10); const bl = doc.splitTextToSize(`• ${b}`, contentW - 2); doc.setFontSize(9.5); doc.text(bl, margin, y); y += bl.length * 4.8 + 1.5 }); y += 4
    })
    if (resume.certifications?.length) {
      sec('Professional Training & Certifications')
      resume.certifications.forEach((c) => { checkPage(6); doc.setFontSize(9.5); doc.text(`• ${c}`, margin, y); y += 5.5 }); y += 2
    }
    if (resume.tools?.length) {
      sec('Tools Proficiency'); const tl = doc.splitTextToSize(resume.tools.join('  ·  '), contentW)
      doc.setFontSize(9.5); doc.text(tl, margin, y); y += tl.length * 5 + 4
    }
    if (resume.education?.length) {
      sec('Education')
      resume.education.forEach((e) => {
        checkPage(10); doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.text(e.degree, margin, y); y += 5
        doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(80)
        doc.text(`${e.institution}${e.location ? `, ${e.location}` : ''}${e.year ? ` (${e.year})` : ''}`, margin, y); doc.setTextColor(0); y += 6
      })
    }
    const fn = resume.contact?.name ? resume.contact.name.replace(/\s+/g, '_') : 'Resume'
    doc.save(`${fn}_Tailored.pdf`)
  }

  const handleDownloadDOCX = async () => {
    if (!resume) return
    const { Document, Paragraph, TextRun, Packer, AlignmentType, BorderStyle } = await import('docx')
    void Paragraph
    const RED = 'B41414', GRAY = '666666', BLACK = '1a1a1a'
    const sp = (title: string) => new Paragraph({
      spacing: { before: 280, after: 80 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: 'DDDDDD', space: 3 } },
      children: [new TextRun({ text: title.toUpperCase(), bold: true, size: 18, color: RED, font: 'Calibri' })]
    })
    const ch: never[] = []
    const push = (p: unknown) => (ch as unknown[]).push(p)
    push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 }, children: [new TextRun({ text: resume.contact?.name || '', bold: true, size: 32, font: 'Calibri', color: BLACK })] }))
    if (resume.contact) {
      const pts = [[resume.contact.city, resume.contact.province].filter(Boolean).join(', '), resume.contact.phone, resume.contact.email, resume.contact.linkedin].filter(Boolean)
      if (pts.length) {
        const runs: InstanceType<typeof TextRun>[] = []
        pts.forEach((p, i) => { runs.push(new TextRun({ text: p!, size: 18, font: 'Calibri', color: GRAY })); if (i < pts.length - 1) runs.push(new TextRun({ text: '  ·  ', size: 18, color: 'AAAAAA', font: 'Calibri' })) })
        push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: runs }))
      }
    }
    push(sp('Professional Summary')); push(new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: resume.summary, size: 20, font: 'Calibri', color: BLACK })] }))
    push(sp('Core Competencies'))
    const cols = resume.competencies.length === 9 ? 3 : 4
    for (let i = 0; i < resume.competencies.length; i += cols) {
      const row = resume.competencies.slice(i, i + cols)
      push(new Paragraph({ spacing: { after: 60 }, children: row.map((s, j) => new TextRun({ text: `• ${s}${j < row.length - 1 ? '          ' : ''}`, size: 19, font: 'Calibri', color: BLACK })) }))
    }
    push(sp('Work Experience'))
    resume.experience.forEach((r) => {
      push(new Paragraph({ spacing: { before: 120, after: 40 }, children: [new TextRun({ text: r.title, bold: true, size: 21, font: 'Calibri', color: BLACK })] }))
      push(new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: `${r.company}  ·  ${r.location}  ·  ${r.dates}`, size: 18, font: 'Calibri', color: GRAY })] }))
      r.bullets.forEach((b) => push(new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: `• ${b}`, size: 19, font: 'Calibri', color: BLACK })] })))
    })
    if (resume.certifications?.length) {
      push(sp('Professional Training & Certifications'))
      resume.certifications.forEach((c) => push(new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: `• ${c}`, size: 19, font: 'Calibri', color: BLACK })] })))
    }
    if (resume.tools?.length) {
      push(sp('Tools Proficiency')); push(new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: resume.tools.join('  ·  '), size: 19, font: 'Calibri', color: BLACK })] }))
    }
    if (resume.education?.length) {
      push(sp('Education'))
      resume.education.forEach((e) => {
        push(new Paragraph({ spacing: { before: 80, after: 40 }, children: [new TextRun({ text: e.degree, bold: true, size: 20, font: 'Calibri', color: BLACK })] }))
        push(new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: `${e.institution}${e.location ? `, ${e.location}` : ''}${e.year ? ` (${e.year})` : ''}`, size: 18, font: 'Calibri', color: GRAY })] }))
      })
    }
    const doc = new Document({ sections: [{ properties: {}, children: ch }] })
    const blob = await Packer.toBlob(doc); const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url
    a.download = `${(resume.contact?.name || 'Resume').replace(/\s+/g, '_')}_Tailored.docx`
    a.click(); URL.revokeObjectURL(url)
  }

  if (!authChecked) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-red-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  const ratingColor  = (n: number) => n >= 8 ? 'text-green-500' : n >= 6 ? 'text-yellow-500' : 'text-red-500'
  const ratingBg     = (n: number) => n >= 8 ? 'bg-green-500'  : n >= 6 ? 'bg-yellow-400'  : 'bg-red-500'
  const matchColor   = (n: number) => n >= 75 ? 'text-green-500' : n >= 55 ? 'text-yellow-500' : 'text-red-500'
  const matchBg      = (n: number) => n >= 75 ? 'bg-green-500'   : n >= 55 ? 'bg-yellow-400'   : 'bg-red-500'

  return (
    <div className="bg-gray-50 min-h-screen pb-20">

      {/* ── Hero ─────────────────────────────────────────── */}
      <div className="bg-gradient-to-br from-red-600 to-red-700 text-white py-12 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-white/20 px-4 py-1.5 rounded-full text-sm font-medium mb-4">
            <Sparkles size={14} /> AI Resume Builder
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold mb-3">Build Your Tailored Resume</h1>
          <p className="text-red-100 text-lg max-w-2xl mx-auto">
            Upload your resume and paste a job description. See how your current resume scores —
            then decide whether to generate a fully tailored version.
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">

        {/* ── Section 1: Inputs ───────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h2 className="text-base font-bold text-gray-800 mb-5 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-red-600 text-white text-xs font-bold flex items-center justify-center">1</span>
            Upload your resume &amp; paste the job description
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Resume */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-semibold text-gray-700">
                  Your Resume <span className="text-red-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => { setUseTextInput(!useTextInput); setError(''); resetResults() }}
                  className="text-xs text-red-600 hover:text-red-700 font-medium underline"
                >
                  {useTextInput ? 'Upload file instead' : 'Paste text instead'}
                </button>
              </div>

              {useTextInput ? (
                <textarea
                  value={resumePasteText}
                  onChange={(e) => { setResumePasteText(e.target.value); resetResults() }}
                  placeholder="Paste the full text of your resume here…"
                  rows={9}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
                />
              ) : (
                <div
                  className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                    dragOver    ? 'border-red-400 bg-red-50' :
                    resumeFile  ? 'border-green-400 bg-green-50' :
                    'border-gray-300 bg-gray-50 hover:border-red-400 hover:bg-red-50'
                  }`}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                >
                  <input ref={fileInputRef} type="file" accept=".pdf,.docx" className="hidden"
                    onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]) }} />
                  {resumeFile ? (
                    <div className="space-y-1">
                      <CheckCircle size={30} className="mx-auto text-green-500" />
                      <p className="font-semibold text-green-700 text-sm">{resumeFile.name}</p>
                      <p className="text-xs text-green-500">Click to replace</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Upload size={30} className="mx-auto text-gray-400" />
                      <p className="text-sm font-medium text-gray-600">Drop your resume or click to browse</p>
                      <p className="text-xs text-gray-400">DOCX recommended · PDF supported · Max 5 MB</p>
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
                onChange={(e) => { setJobDescription(e.target.value); resetResults() }}
                placeholder="Paste the full job posting here — responsibilities, requirements, and keywords…"
                rows={9}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
              />
              <p className="text-xs text-gray-400 mt-1">{jobDescription.length} characters</p>
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4 mt-5">
              <AlertCircle size={17} className="text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* ── CHECK SCORE button — always visible ── */}
          <div className="mt-6">
            <button
              onClick={handleCheckScore}
              disabled={!canRun || scoreLoading || tailorLoading}
              className={`w-full font-bold py-4 rounded-xl flex items-center justify-center gap-3 text-base transition-all ${
                canRun && !scoreLoading && !tailorLoading
                  ? 'bg-red-600 hover:bg-red-700 text-white shadow-sm hover:shadow-md'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed border-2 border-dashed border-gray-300'
              }`}
            >
              {scoreLoading ? (
                <><Loader2 size={20} className="animate-spin" /> Analysing your resume… about 10 seconds</>
              ) : (
                <><BarChart2 size={20} /> Check My Current Resume Score</>
              )}
            </button>

            {/* Helper message when disabled */}
            {!canRun && (
              <p className="text-center text-xs text-gray-400 mt-2">
                {!hasResume && !hasJD ? 'Upload your resume and paste a job description above to get started.'
                  : !hasResume ? 'Upload or paste your resume above to continue.'
                  : 'Paste the job description above to continue.'}
              </p>
            )}
          </div>
        </div>

        {/* ── Section 2: Score result + decision ─────────── */}
        {scores && (
          <div ref={scoreRef} className="bg-white rounded-2xl border border-gray-200 p-6 scroll-mt-6">
            <h2 className="text-base font-bold text-gray-800 mb-1 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-red-600 text-white text-xs font-bold flex items-center justify-center">2</span>
              Your current resume score against this job
            </h2>
            <p className="text-sm text-gray-500 mb-5 ml-8">
              This is your <span className="font-semibold">existing, un-tailored resume</span> evaluated against the job description.
            </p>

            {/* Score cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              {/* Profile strength */}
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-5">
                <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">Profile Strength</p>
                <div className="flex items-end gap-2 mb-3">
                  <span className={`text-5xl font-black ${ratingColor(scores.resumeRating)}`}>{scores.resumeRating}</span>
                  <span className="text-xl text-gray-300 font-semibold mb-1">/ 10</span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full mb-4 overflow-hidden">
                  <div className={`h-full rounded-full ${ratingBg(scores.resumeRating)}`} style={{ width: `${scores.resumeRating * 10}%` }} />
                </div>
                {scores.ratingReasons?.map((r, i) => {
                  const isWeakness = /\b(lacks?|missing|no mention|not explicitly|limited|without|gap|weak|unclear|no direct|not demonstrated|absent|no evidence|doesn't|does not|no \w+ experience)\b/i.test(r)
                  return (
                    <div key={i} className={`flex items-start gap-2 text-xs mb-1.5 ${isWeakness ? 'text-orange-700' : 'text-gray-600'}`}>
                      {isWeakness
                        ? <AlertCircle size={12} className="text-orange-400 flex-shrink-0 mt-0.5" />
                        : <CheckCircle  size={12} className="text-green-500 flex-shrink-0 mt-0.5" />
                      }
                      <span>{r}</span>
                    </div>
                  )
                })}
              </div>

              {/* Job match */}
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-5">
                <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">Job Description Match</p>
                <div className="flex items-end gap-2 mb-3">
                  <span className={`text-5xl font-black ${matchColor(scores.matchPercentage)}`}>{scores.matchPercentage}</span>
                  <span className="text-xl text-gray-300 font-semibold mb-1">%</span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full mb-4 overflow-hidden">
                  <div className={`h-full rounded-full ${matchBg(scores.matchPercentage)}`} style={{ width: `${scores.matchPercentage}%` }} />
                </div>
                {scores.matchGaps?.length > 0 ? (
                  <>
                    <p className="text-xs font-semibold text-gray-500 mb-2">Gaps found:</p>
                    <div className="space-y-1.5">
                      {scores.matchGaps.map((g, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs text-gray-600">
                          <AlertCircle size={12} className="text-orange-400 flex-shrink-0 mt-0.5" /><span>{g}</span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="flex items-center gap-2 text-xs text-green-600">
                    <CheckCircle size={12} /><span>Strong match — no major gaps found.</span>
                  </div>
                )}
              </div>
            </div>

            {/* Decision panel — shown unless already decided */}
            {!satisfied && !resume && (
              <div className="rounded-xl border-2 border-dashed border-gray-200 p-5">
                <p className="font-semibold text-gray-800 mb-1">What would you like to do?</p>
                <p className="text-sm text-gray-500 mb-5">
                  A tailored resume typically improves the match score by{' '}
                  <span className="font-semibold text-green-600">15–30%</span> by aligning your
                  experience to the exact keywords and responsibilities in this role.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    onClick={handleSatisfied}
                    className="flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-3.5 rounded-xl transition-colors text-sm"
                  >
                    <ThumbsUp size={16} /> I&apos;m happy with my score
                  </button>
                  <button
                    onClick={handleGenerate}
                    disabled={tailorLoading}
                    className="flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white font-bold py-3.5 rounded-xl transition-colors text-sm"
                  >
                    {tailorLoading
                      ? <><Loader2 size={16} className="animate-spin" /> Building… ~20 seconds</>
                      : <><Sparkles size={16} /> Build My Tailored Resume</>
                    }
                  </button>
                </div>
              </div>
            )}

            {/* "Satisfied" confirmation */}
            {satisfied && !resume && (
              <div className="rounded-xl bg-green-50 border border-green-200 p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <CheckCircle size={28} className="text-green-500 flex-shrink-0" />
                <div className="flex-1">
                  <p className="font-semibold text-green-800">Great — your resume is ready to submit!</p>
                  <p className="text-sm text-green-700 mt-0.5">
                    Your score looks good for this role. Consider the training recommendations below to strengthen future applications.
                  </p>
                  {scores.trainingRecommendations?.length > 0 && (
                    <div className="mt-3 space-y-1">
                      {scores.trainingRecommendations.map((t, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs text-green-700">
                          <ArrowDown size={11} className="flex-shrink-0 mt-0.5" /><span>{t}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-2 flex-shrink-0">
                  <button
                    onClick={handleGenerate}
                    className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-semibold py-2.5 px-4 rounded-lg text-sm transition-colors whitespace-nowrap"
                  >
                    <Sparkles size={14} /> Build tailored anyway
                  </button>
                  <button
                    onClick={resetResults}
                    className="flex items-center gap-2 bg-white border border-gray-200 hover:border-gray-400 text-gray-600 font-medium py-2.5 px-4 rounded-lg text-sm transition-colors whitespace-nowrap"
                  >
                    <RefreshCw size={14} /> Try another job
                  </button>
                </div>
              </div>
            )}

            {/* While generating */}
            {tailorLoading && (
              <div className="mt-4 rounded-xl bg-red-50 border border-red-100 p-5 flex items-center gap-4">
                <Loader2 size={24} className="text-red-500 animate-spin flex-shrink-0" />
                <div>
                  <p className="font-semibold text-red-800">Building your tailored resume…</p>
                  <p className="text-sm text-red-600 mt-0.5">This usually takes 15–20 seconds. Please don&apos;t close this tab.</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Section 3: Tailored resume output ───────────── */}
        {resume && (
          <div ref={resumeRef} className="scroll-mt-6">
            {/* Action bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
              <div>
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <CheckCircle size={20} className="text-green-500" /> Your Tailored Resume
                </h2>
                {scores && resume.scores && (
                  <p className="text-sm text-gray-500 mt-0.5">
                    Match improved from{' '}
                    <span className={`font-semibold ${matchColor(scores.matchPercentage)}`}>{scores.matchPercentage}%</span>
                    {' '}→{' '}
                    <span className={`font-semibold ${matchColor(resume.scores.matchPercentage)}`}>{resume.scores.matchPercentage}%</span>
                    {resume.scores.matchPercentage > scores.matchPercentage && (
                      <span className="ml-2 bg-green-100 text-green-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                        +{resume.scores.matchPercentage - scores.matchPercentage}%
                      </span>
                    )}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={handleCopy}
                  className="flex items-center gap-2 bg-white border border-gray-200 hover:border-gray-400 text-gray-700 text-sm font-medium px-4 py-2 rounded-xl transition-colors">
                  {copied ? <CheckCircle size={14} className="text-green-500" /> : <Copy size={14} />}
                  {copied ? 'Copied!' : 'Copy text'}
                </button>
                <button onClick={handleDownloadPDF}
                  className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors">
                  <Download size={14} /> PDF
                </button>
                <button onClick={handleDownloadDOCX}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors">
                  <FileText size={14} /> DOCX
                </button>
                <button onClick={() => window.print()}
                  className="flex items-center gap-2 bg-white border border-gray-200 hover:border-gray-400 text-gray-700 text-sm font-medium px-4 py-2 rounded-xl transition-colors">
                  <Printer size={14} /> Print
                </button>
                <button onClick={resetResults}
                  className="flex items-center gap-2 bg-white border border-gray-200 hover:border-gray-400 text-gray-600 text-sm font-medium px-4 py-2 rounded-xl transition-colors">
                  <RefreshCw size={14} /> New resume
                </button>
              </div>
            </div>

            {/* Remaining gaps after tailoring */}
            {resume.scores?.matchGaps && resume.scores.matchGaps.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-2xl p-5 mb-5">
                <p className="text-xs font-semibold text-gray-500 mb-2">Remaining gaps (even after tailoring):</p>
                <div className="space-y-1.5 mb-3">
                  {resume.scores.matchGaps.map((g, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-gray-600">
                      <AlertCircle size={12} className="text-orange-400 flex-shrink-0 mt-0.5" /><span>{g}</span>
                    </div>
                  ))}
                </div>
                {resume.scores.trainingRecommendations && resume.scores.trainingRecommendations.length > 0 && (
                  <div className="border-t border-gray-100 pt-3">
                    <p className="text-xs font-semibold text-blue-600 mb-2">📚 Close the gap — recommended training:</p>
                    <div className="space-y-1.5">
                      {resume.scores.trainingRecommendations.map((t, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs text-gray-600">
                          <CheckCircle size={12} className="text-blue-400 flex-shrink-0 mt-0.5" /><span>{t}</span>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-gray-400 mt-2 italic">Completing these would push your match score above 90%.</p>
                  </div>
                )}
              </div>
            )}

            {/* Resume card */}
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden" id="resume-print">
              {resume.contact && (
                <section className="p-6 pb-5 border-b border-gray-100 text-center">
                  <h2 className="text-2xl font-bold text-gray-900 tracking-wide mb-2">{resume.contact.name}</h2>
                  <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm text-gray-500">
                    {(resume.contact.city || resume.contact.province) && <span>{[resume.contact.city, resume.contact.province].filter(Boolean).join(', ')}</span>}
                    {resume.contact.phone    && <><span className="text-gray-300">·</span><span>{resume.contact.phone}</span></>}
                    {resume.contact.email    && <><span className="text-gray-300">·</span><span>{resume.contact.email}</span></>}
                    {resume.contact.linkedin && <><span className="text-gray-300">·</span><a href={resume.contact.linkedin} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">LinkedIn</a></>}
                  </div>
                </section>
              )}
              <section className="p-6 border-b border-gray-100">
                <h3 className="text-xs font-bold uppercase tracking-widest text-red-600 mb-3">Professional Summary</h3>
                <p className="text-gray-800 leading-relaxed">{resume.summary}</p>
              </section>
              <section className="p-6 border-b border-gray-100">
                <h3 className="text-xs font-bold uppercase tracking-widest text-red-600 mb-3">
                  Core Competencies <span className="text-gray-400 font-normal normal-case tracking-normal text-xs">({resume.competencies.length} skills)</span>
                </h3>
                <div className={`grid gap-2 ${resume.competencies.length === 9 ? 'grid-cols-3' : 'grid-cols-4'}`}>
                  {resume.competencies.map((s, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm text-gray-700">
                      <span className="w-1.5 h-1.5 bg-red-500 rounded-full flex-shrink-0" />{s}
                    </div>
                  ))}
                </div>
              </section>
              <section className="p-6 border-b border-gray-100">
                <h3 className="text-xs font-bold uppercase tracking-widest text-red-600 mb-4">Work Experience</h3>
                <div className="space-y-5">
                  {resume.experience.map((role, i) => (
                    <div key={i} className="border border-gray-100 rounded-xl overflow-hidden">
                      <div className="flex items-center justify-between p-4 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
                        onClick={() => setExpandedRoles((p) => ({ ...p, [i]: !p[i] }))}>
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
                          {role.bullets.map((b, j) => (
                            <li key={j} className="flex items-start gap-2.5 text-sm text-gray-700 leading-relaxed">
                              <span className="w-1.5 h-1.5 bg-red-400 rounded-full flex-shrink-0 mt-1.5" />
                              <span>{b}</span>
                              <span className="ml-auto text-xs text-gray-300 flex-shrink-0 self-start mt-0.5">{b.split(' ').length}w</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              </section>
              {resume.certifications && resume.certifications.length > 0 && (
                <section className="p-6 border-b border-gray-100">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-red-600 mb-3">Professional Training &amp; Certifications</h3>
                  <ul className="space-y-1.5">
                    {resume.certifications.map((c, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm text-gray-700">
                        <span className="w-1.5 h-1.5 bg-red-500 rounded-full flex-shrink-0" />{c}
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              {resume.tools && resume.tools.length > 0 && (
                <section className="p-6 border-b border-gray-100">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-red-600 mb-3">Tools Proficiency</h3>
                  <div className="flex flex-wrap gap-2">
                    {resume.tools.map((t, i) => <span key={i} className="bg-gray-100 text-gray-700 text-sm px-3 py-1 rounded-full">{t}</span>)}
                  </div>
                </section>
              )}
              {resume.education && resume.education.length > 0 && (
                <section className="p-6">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-red-600 mb-3">Education</h3>
                  <div className="space-y-2">
                    {resume.education.map((e, i) => (
                      <div key={i} className="text-sm text-gray-700">
                        <span className="font-semibold">{e.degree}</span>
                        <span className="text-gray-500"> — {e.institution}{e.location ? `, ${e.location}` : ''}{e.year ? ` (${e.year})` : ''}</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>

            <div className="mt-4 flex items-start gap-2 text-xs text-gray-400">
              <AlertCircle size={13} className="flex-shrink-0 mt-0.5" />
              <p>Review every bullet before submitting. Word count shown beside each bullet — aim for 15–22 words.</p>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @media print {
          body > *:not(#resume-print) { display: none !important; }
          #resume-print { display: block !important; }
        }
      `}</style>
    </div>
  )
}
