-- ──────────────────────────────────────────────────────────────────
-- Interview Scheduler
-- interview_requests table with RLS
-- ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS interview_requests (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  employer_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  seeker_id       uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  opportunity_id  uuid REFERENCES opportunities(id) ON DELETE SET NULL,
  application_id  uuid REFERENCES applications(id) ON DELETE SET NULL,
  conversation_id uuid REFERENCES conversations(id) ON DELETE SET NULL,
  -- Denormalised for display (avoids expensive joins)
  seeker_name     text,
  employer_name   text,
  opp_title       text,
  -- Scheduling data
  proposed_times  text[] NOT NULL DEFAULT '{}',   -- up to 3 ISO datetime strings
  confirmed_time  text,                            -- chosen ISO datetime string
  format          text DEFAULT 'video',            -- 'video' | 'phone' | 'in-person'
  meeting_link    text,                            -- video URL or address
  notes           text,
  status          text DEFAULT 'pending',          -- 'pending' | 'confirmed' | 'declined' | 'cancelled' | 'completed'
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE interview_requests ENABLE ROW LEVEL SECURITY;

-- Both parties can read their own interviews
CREATE POLICY "Participants read interviews"
  ON interview_requests FOR SELECT
  USING (auth.uid() = employer_id OR auth.uid() = seeker_id);

-- Only employers can create
CREATE POLICY "Employers create interviews"
  ON interview_requests FOR INSERT
  WITH CHECK (auth.uid() = employer_id);

-- Both parties can update (seeker confirms/declines, employer cancels/completes)
CREATE POLICY "Participants update interviews"
  ON interview_requests FOR UPDATE
  USING (auth.uid() = employer_id OR auth.uid() = seeker_id);
