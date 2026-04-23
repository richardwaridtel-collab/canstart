import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { resumePath } = await request.json()
  if (!resumePath) return NextResponse.json({ error: 'resumePath required' }, { status: 400 })

  // Ensure user can only parse their own file
  const pathUserId = resumePath.split('/')[0]
  if (pathUserId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: fileData, error: downloadError } = await supabase.storage
    .from('candidate-documents')
    .download(resumePath)

  if (downloadError || !fileData) {
    return NextResponse.json({ error: 'Could not download resume' }, { status: 500 })
  }

  const buffer = Buffer.from(await fileData.arrayBuffer())
  const ext = resumePath.split('.').pop()?.toLowerCase()
  let text = ''

  try {
    if (ext === 'pdf') {
      // Import from lib directly to avoid Next.js webpack test-file issue
      const pdfParse = (await import('pdf-parse/lib/pdf-parse.js')).default
      const result = await pdfParse(buffer)
      text = result.text
    } else if (ext === 'docx') {
      const mammoth = await import('mammoth')
      const result = await mammoth.extractRawText({ buffer })
      text = result.value
    } else if (ext === 'doc') {
      // .doc (old binary format) not supported — skip silently
      text = ''
    }
  } catch (err) {
    return NextResponse.json({ error: `Parse failed: ${err instanceof Error ? err.message : 'unknown'}` }, { status: 500 })
  }

  if (text) {
    await supabase
      .from('seeker_profiles')
      .update({ resume_text: text })
      .eq('user_id', user.id)
  }

  return NextResponse.json({ success: true, parsed: !!text, textLength: text.length })
}
