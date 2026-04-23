-- External Jobs Table (from Adzuna API)
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS external_opportunities (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  source text NOT NULL DEFAULT 'adzuna',
  external_id text NOT NULL,
  title text NOT NULL,
  company text NOT NULL,
  city text NOT NULL,
  province text NOT NULL DEFAULT 'Canada',
  description text,
  url text NOT NULL,
  category text NOT NULL,
  salary_min numeric,
  salary_max numeric,
  work_mode text NOT NULL DEFAULT 'onsite',
  created_at timestamptz DEFAULT now(),
  synced_at timestamptz DEFAULT now(),
  UNIQUE(source, external_id)
);

-- Public read access (no auth required to browse)
ALTER TABLE external_opportunities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "External jobs are viewable by everyone"
  ON external_opportunities FOR SELECT USING (true);
CREATE POLICY "Service can insert external jobs"
  ON external_opportunities FOR INSERT WITH CHECK (true);
CREATE POLICY "Service can update external jobs"
  ON external_opportunities FOR UPDATE USING (true);

-- Index for fast filtering
CREATE INDEX IF NOT EXISTS ext_opp_category_idx ON external_opportunities(category);
CREATE INDEX IF NOT EXISTS ext_opp_city_idx ON external_opportunities(city);
CREATE INDEX IF NOT EXISTS ext_opp_synced_idx ON external_opportunities(synced_at);
