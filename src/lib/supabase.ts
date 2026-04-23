import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          user_id: string
          role: 'seeker' | 'employer'
          full_name: string
          city: string
          created_at: string
        }
      }
      seeker_profiles: {
        Row: {
          id: string
          user_id: string
          country_of_origin: string
          immigration_status: string
          skills: string[]
          education: string
          work_preference: string
          linkedin_url: string | null
          bio: string | null
        }
      }
      employer_profiles: {
        Row: {
          id: string
          user_id: string
          company_name: string
          industry: string
          company_size: string
          website: string | null
          description: string | null
          verified: boolean
        }
      }
      opportunities: {
        Row: {
          id: string
          employer_id: string
          title: string
          description: string
          type: string
          city: string
          work_mode: string
          skills_required: string[]
          duration: string
          compensation: string | null
          status: string
          created_at: string
        }
      }
      applications: {
        Row: {
          id: string
          opportunity_id: string
          seeker_id: string
          cover_note: string | null
          status: string
          created_at: string
        }
      }
    }
  }
}
