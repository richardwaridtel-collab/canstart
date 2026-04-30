-- ──────────────────────────────────────────────────────────────────
-- Employer Pipeline Migration
-- Adds pipeline_stage, employer_notes, tags to applications
-- Creates talent_pool table
-- ──────────────────────────────────────────────────────────────────

-- 1. Extend applications table
ALTER TABLE applications ADD COLUMN IF NOT EXISTS pipeline_stage text DEFAULT 'applied';
ALTER TABLE applications ADD COLUMN IF NOT EXISTS employer_notes text;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';

-- 2. Backfill pipeline_stage from existing status values
UPDATE applications SET pipeline_stage = 'hired'      WHERE status = 'accepted'  AND pipeline_stage = 'applied';
UPDATE applications SET pipeline_stage = 'rejected'   WHERE status = 'rejected'  AND pipeline_stage = 'applied';
UPDATE applications SET pipeline_stage = 'shortlisted' WHERE status = 'reviewed' AND pipeline_stage = 'applied';
-- pending stays as 'applied' (already the default)

-- 3. Talent pool table
CREATE TABLE IF NOT EXISTS talent_pool (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  employer_id  uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  seeker_id    uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  pool_name    text DEFAULT 'General',
  notes        text,
  tags         text[] DEFAULT '{}',
  created_at   timestamptz DEFAULT now(),
  UNIQUE(employer_id, seeker_id)
);

ALTER TABLE talent_pool ENABLE ROW LEVEL SECURITY;

-- Employers can fully manage their own pool
CREATE POLICY "Employers manage own talent pool"
  ON talent_pool FOR ALL
  USING  (auth.uid() = employer_id)
  WITH CHECK (auth.uid() = employer_id);
