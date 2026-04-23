-- CanStart Database Schema
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Profiles (shared between seekers and employers)
create table if not exists profiles (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null unique,
  role text not null check (role in ('seeker', 'employer')),
  full_name text not null,
  city text not null,
  created_at timestamptz default now()
);

-- Seeker-specific profile
create table if not exists seeker_profiles (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null unique,
  country_of_origin text not null default '',
  immigration_status text not null default 'owp' check (immigration_status in ('pr', 'owp', 'student', 'citizen')),
  skills text[] not null default '{}',
  education text not null default '',
  work_preference text not null default 'any' check (work_preference in ('remote', 'hybrid', 'onsite', 'any')),
  linkedin_url text,
  bio text,
  created_at timestamptz default now()
);

-- Employer-specific profile
create table if not exists employer_profiles (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null unique,
  company_name text not null,
  industry text not null default '',
  company_size text not null default '',
  website text,
  description text,
  verified boolean not null default false,
  created_at timestamptz default now()
);

-- Opportunities
create table if not exists opportunities (
  id uuid primary key default uuid_generate_v4(),
  employer_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  description text not null,
  type text not null check (type in ('volunteer', 'micro-internship', 'paid')),
  city text not null,
  work_mode text not null check (work_mode in ('remote', 'hybrid', 'onsite', 'any')),
  skills_required text[] not null default '{}',
  duration text not null,
  compensation text,
  status text not null default 'open' check (status in ('open', 'closed', 'filled')),
  created_at timestamptz default now()
);

-- Applications
create table if not exists applications (
  id uuid primary key default uuid_generate_v4(),
  opportunity_id uuid references opportunities(id) on delete cascade not null,
  seeker_id uuid references auth.users(id) on delete cascade not null,
  cover_note text,
  status text not null default 'pending' check (status in ('pending', 'reviewed', 'accepted', 'rejected')),
  created_at timestamptz default now(),
  unique(opportunity_id, seeker_id)
);

-- Row Level Security
alter table profiles enable row level security;
alter table seeker_profiles enable row level security;
alter table employer_profiles enable row level security;
alter table opportunities enable row level security;
alter table applications enable row level security;

-- Profiles: users can read any profile, only edit their own
create policy "Public profiles are viewable by everyone" on profiles for select using (true);
create policy "Users can insert their own profile" on profiles for insert with check (auth.uid() = user_id);
create policy "Users can update their own profile" on profiles for update using (auth.uid() = user_id);

-- Seeker profiles: public read, own write
create policy "Seeker profiles are viewable by everyone" on seeker_profiles for select using (true);
create policy "Users can insert their own seeker profile" on seeker_profiles for insert with check (auth.uid() = user_id);
create policy "Users can update their own seeker profile" on seeker_profiles for update using (auth.uid() = user_id);

-- Employer profiles: public read, own write
create policy "Employer profiles are viewable by everyone" on employer_profiles for select using (true);
create policy "Users can insert their own employer profile" on employer_profiles for insert with check (auth.uid() = user_id);
create policy "Users can update their own employer profile" on employer_profiles for update using (auth.uid() = user_id);

-- Opportunities: public read, employer write
create policy "Opportunities are viewable by everyone" on opportunities for select using (true);
create policy "Employers can insert opportunities" on opportunities for insert with check (auth.uid() = employer_id);
create policy "Employers can update their own opportunities" on opportunities for update using (auth.uid() = employer_id);
create policy "Employers can delete their own opportunities" on opportunities for delete using (auth.uid() = employer_id);

-- Applications: seekers see their own, employers see apps to their opportunities
create policy "Seekers can view their own applications" on applications for select using (auth.uid() = seeker_id);
create policy "Employers can view applications to their opportunities" on applications for select using (
  exists (select 1 from opportunities where id = opportunity_id and employer_id = auth.uid())
);
create policy "Seekers can insert applications" on applications for insert with check (auth.uid() = seeker_id);
create policy "Seekers can update their own applications" on applications for update using (auth.uid() = seeker_id);
create policy "Employers can update application status" on applications for update using (
  exists (select 1 from opportunities where id = opportunity_id and employer_id = auth.uid())
);

-- Indexes for performance
create index if not exists opportunities_status_idx on opportunities(status);
create index if not exists opportunities_city_idx on opportunities(city);
create index if not exists opportunities_type_idx on opportunities(type);
create index if not exists opportunities_employer_idx on opportunities(employer_id);
create index if not exists applications_seeker_idx on applications(seeker_id);
create index if not exists applications_opportunity_idx on applications(opportunity_id);
