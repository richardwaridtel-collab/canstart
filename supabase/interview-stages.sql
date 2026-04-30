-- Add interview sub-stage tracking to applications table
ALTER TABLE applications ADD COLUMN IF NOT EXISTS interview_stage VARCHAR(50);
