-- ──────────────────────────────────────────────────────────────────
-- Messaging System
-- conversations + messages tables with RLS + realtime
-- ──────────────────────────────────────────────────────────────────

-- 1. Conversations (one thread per employer + seeker + opportunity)
CREATE TABLE IF NOT EXISTS conversations (
  id                   uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  employer_id          uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  seeker_id            uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  opportunity_id       uuid REFERENCES opportunities(id) ON DELETE SET NULL,
  last_message_at      timestamptz DEFAULT now(),
  last_message_preview text,
  created_at           timestamptz DEFAULT now(),
  UNIQUE(employer_id, seeker_id, opportunity_id)
);

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants view conversations"
  ON conversations FOR SELECT
  USING (auth.uid() = employer_id OR auth.uid() = seeker_id);

CREATE POLICY "Employers create conversations"
  ON conversations FOR INSERT
  WITH CHECK (auth.uid() = employer_id);

CREATE POLICY "Participants update conversations"
  ON conversations FOR UPDATE
  USING (auth.uid() = employer_id OR auth.uid() = seeker_id);

-- 2. Messages
CREATE TABLE IF NOT EXISTS messages (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id uuid REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id       uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  content         text NOT NULL,
  read_at         timestamptz,
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants read messages"
  ON messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = conversation_id
      AND (c.employer_id = auth.uid() OR c.seeker_id = auth.uid())
    )
  );

CREATE POLICY "Participants send messages"
  ON messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id AND
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = conversation_id
      AND (c.employer_id = auth.uid() OR c.seeker_id = auth.uid())
    )
  );

CREATE POLICY "Recipients mark messages read"
  ON messages FOR UPDATE
  USING (
    auth.uid() != sender_id AND
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = conversation_id
      AND (c.employer_id = auth.uid() OR c.seeker_id = auth.uid())
    )
  );

-- 3. Enable realtime on both tables
-- Run these separately if the ALTER PUBLICATION command fails:
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE conversations;
