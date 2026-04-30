-- Add application deadline column to opportunities table
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS application_deadline DATE;
