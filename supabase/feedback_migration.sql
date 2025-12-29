-- Feedback Table Migration
-- Run this in Supabase SQL Editor

-- ============================================================
-- 1. CREATE FEEDBACK TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS feedback (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  username TEXT,
  message TEXT NOT NULL,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for querying by user
CREATE INDEX IF NOT EXISTS idx_feedback_user_id ON feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback(created_at DESC);

-- ============================================================
-- 2. RLS POLICIES
-- ============================================================

ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- Users can insert feedback (even anonymous users)
DROP POLICY IF EXISTS "Anyone can submit feedback" ON feedback;
CREATE POLICY "Anyone can submit feedback" ON feedback
  FOR INSERT WITH CHECK (true);

-- Only admins/service role can read feedback (for now)
-- Users don't need to see their own feedback
DROP POLICY IF EXISTS "Service role can read feedback" ON feedback;
CREATE POLICY "Service role can read feedback" ON feedback
  FOR SELECT USING (auth.role() = 'service_role');

-- ============================================================
-- 3. STORAGE BUCKET FOR FEEDBACK IMAGES
-- ============================================================

-- Create storage bucket (run this separately if needed)
-- Note: Storage buckets are typically created via Supabase Dashboard
-- Go to Storage > Create new bucket:
--   - Name: feedback-images
--   - Public: Yes (so images can be displayed)
--   - File size limit: 5MB

-- If using SQL, you can try:
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('feedback-images', 'feedback-images', true, 5242880)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for the bucket
-- Allow authenticated and anonymous users to upload
DROP POLICY IF EXISTS "Anyone can upload feedback images" ON storage.objects;
CREATE POLICY "Anyone can upload feedback images" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'feedback-images'
  );

-- Allow public read access to feedback images
DROP POLICY IF EXISTS "Public can view feedback images" ON storage.objects;
CREATE POLICY "Public can view feedback images" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'feedback-images'
  );

-- ============================================================
-- DONE
-- ============================================================
--
-- Summary:
-- - feedback table created with user_id, username, message, image_url
-- - RLS enabled: anyone can insert, only service role can read
-- - Storage bucket 'feedback-images' created for image uploads
-- - Storage policies allow upload and public read
--
