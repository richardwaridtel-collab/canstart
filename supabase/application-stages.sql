-- Application Stages Migration
-- Run this in Supabase SQL Editor

-- 1. Add per-stage private notes (employer only, never shown to candidates)
ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS stage_notes jsonb DEFAULT '{}'::jsonb;

-- 2. Track when the stage last changed
ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS stage_updated_at timestamptz DEFAULT now();

-- 3. Store stage history so candidates can see progress timeline
--    Format: [{"stage":"applied","at":"2024-01-01T00:00:00Z"}, ...]
ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS stage_history jsonb DEFAULT '[]'::jsonb;

-- 4. Backfill stage_history for existing applications (set applied stage = created_at)
UPDATE applications
SET stage_history = jsonb_build_array(
  jsonb_build_object('stage', 'applied', 'at', created_at)
)
WHERE stage_history = '[]'::jsonb OR stage_history IS NULL;

-- 5. Backfill stage_updated_at
UPDATE applications
SET stage_updated_at = created_at
WHERE stage_updated_at IS NULL;
