-- Fix RLS policies for friends table
-- Run this in Supabase SQL Editor

-- First, drop any existing policies (in case they exist but are incorrect)
DROP POLICY IF EXISTS "Users can view their friendships" ON friends;
DROP POLICY IF EXISTS "Users can insert friendships" ON friends;
DROP POLICY IF EXISTS "Users can update their friendships" ON friends;
DROP POLICY IF EXISTS "Users can delete their friendships" ON friends;

-- Enable RLS if not already enabled
ALTER TABLE friends ENABLE ROW LEVEL SECURITY;

-- SELECT: Users can view friendships they are part of
CREATE POLICY "Users can view their friendships"
  ON friends FOR SELECT
  USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- INSERT: Users can create friendships where they are either party
-- This is needed when accepting friend requests
CREATE POLICY "Users can insert friendships"
  ON friends FOR INSERT
  WITH CHECK (auth.uid() = user_id OR auth.uid() = friend_id);

-- UPDATE: Users can update friendships they are part of (for pending_challenge_id)
CREATE POLICY "Users can update their friendships"
  ON friends FOR UPDATE
  USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- DELETE: Users can delete friendships they are part of
CREATE POLICY "Users can delete their friendships"
  ON friends FOR DELETE
  USING (auth.uid() = user_id OR auth.uid() = friend_id);
