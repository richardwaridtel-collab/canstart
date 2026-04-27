import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request) {
  try {
    const { user_id, quote, name, role_title, city, country_of_origin } = await request.json()

    if (!user_id || !quote?.trim() || !name?.trim()) {
      return NextResponse.json({ error: 'Name and story are required.' }, { status: 400 })
    }

    if (quote.trim().length < 30) {
      return NextResponse.json({ error: 'Please write at least a sentence about your experience.' }, { status: 400 })
    }

    // Check user hasn't already submitted
    const { data: existing } = await supabase
      .from('testimonials')
      .select('id')
      .eq('user_id', user_id)
      .single()

    if (existing) {
      return NextResponse.json({ error: 'You have already submitted a story. Thank you!' }, { status: 409 })
    }

    const { error } = await supabase.from('testimonials').insert({
      user_id,
      quote: quote.trim(),
      name: name.trim(),
      role_title: role_title?.trim() || null,
      city: city?.trim() || null,
      country_of_origin: country_of_origin?.trim() || null,
      approved: false,
    })

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Testimonial submit error:', err)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
