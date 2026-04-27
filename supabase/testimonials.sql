-- Testimonials table — user-submitted stories shown on homepage
CREATE TABLE IF NOT EXISTS testimonials (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  quote text NOT NULL,
  name text NOT NULL,
  role_title text,
  city text,
  country_of_origin text,
  approved boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE testimonials ENABLE ROW LEVEL SECURITY;

-- Anyone can read approved testimonials (homepage)
CREATE POLICY "Public read approved testimonials"
  ON testimonials FOR SELECT
  USING (approved = true);

-- Logged-in users can submit their own
CREATE POLICY "Users can insert own testimonial"
  ON testimonials FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can read their own submission to check status
CREATE POLICY "Users can read own testimonials"
  ON testimonials FOR SELECT
  USING (auth.uid() = user_id);

-- To approve a testimonial, run:
-- UPDATE testimonials SET approved = true WHERE id = '<uuid>';
