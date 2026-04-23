export type UserRole = 'seeker' | 'employer'

export type OpportunityType = 'volunteer' | 'micro-internship' | 'paid'

export type WorkMode = 'remote' | 'hybrid' | 'onsite' | 'any'

export type Status = 'open' | 'closed' | 'filled'

export type ApplicationStatus = 'pending' | 'reviewed' | 'accepted' | 'rejected'

export interface Profile {
  id: string
  user_id: string
  role: UserRole
  full_name: string
  city: string
  created_at: string
}

export interface SeekerProfile extends Profile {
  country_of_origin: string
  immigration_status: 'pr' | 'owp' | 'student' | 'citizen'
  skills: string[]
  education: string
  work_preference: WorkMode
  linkedin_url?: string
  bio?: string
}

export interface EmployerProfile extends Profile {
  company_name: string
  industry: string
  company_size: string
  website?: string
  description?: string
  verified: boolean
}

export interface Opportunity {
  id: string
  employer_id: string
  employer_name: string
  company_name: string
  title: string
  description: string
  type: OpportunityType
  city: string
  work_mode: WorkMode
  skills_required: string[]
  duration: string
  compensation?: string
  status: Status
  created_at: string
  applications_count?: number
}

export interface Application {
  id: string
  opportunity_id: string
  seeker_id: string
  seeker_name: string
  cover_note?: string
  status: ApplicationStatus
  created_at: string
  opportunity?: Opportunity
}
