-- Async Friend Duels Migration
-- Run this in your Supabase SQL Editor

-- ============================================
-- 1. Add async duel columns to duels table
-- ============================================

ALTER TABLE duels
ADD COLUMN IF NOT EXISTS player1_completed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS player2_completed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS player1_result JSONB,
ADD COLUMN IF NOT EXISTS player2_result JSONB;

-- player_result JSONB structure:
-- {
--   "answer": "string",     -- Selected answer
--   "time": 1234,           -- Response time in ms
--   "correct": true/false   -- Was answer correct
-- }

-- ============================================
-- 2. Update status constraint to include new statuses
-- ============================================

-- Drop existing constraint if it exists
ALTER TABLE duels DROP CONSTRAINT IF EXISTS duels_status_check;

-- Add new constraint with all status options
-- waiting: Quick duel waiting for random opponent
-- active: Both players joined, game in progress (real-time)
-- completed: Game finished, winner determined
-- invite: Friend invite duel waiting for specific friend
-- declined: Challenge was declined
-- waiting_for_p2: Async duel - player1 completed, waiting for player2
-- expired: Async duel expired (48h passed without player2 completing)
ALTER TABLE duels ADD CONSTRAINT duels_status_check
CHECK (status IN ('waiting', 'active', 'completed', 'invite', 'declined', 'waiting_for_p2', 'expired'));

-- ============================================
-- 3. Add last_active to profiles table for online status
-- ============================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_active TIMESTAMPTZ DEFAULT NOW();

-- ============================================
-- 4. Create indexes for performance
-- ============================================

-- Index for finding expired duels efficiently
CREATE INDEX IF NOT EXISTS idx_duels_expires_at
ON duels(expires_at)
WHERE status = 'waiting_for_p2';

-- Index for online status queries
CREATE INDEX IF NOT EXISTS idx_profiles_last_active
ON profiles(last_active);

-- Index for finding pending async challenges for a user
CREATE INDEX IF NOT EXISTS idx_duels_pending_async
ON duels(player2_id, status)
WHERE status = 'waiting_for_p2';

-- ============================================
-- 5. Update RLS policies if needed
-- ============================================

-- The existing RLS policies should work since they check for player1_id or player2_id
-- But let's ensure the policies cover the new statuses

-- Drop and recreate the select policy to be explicit
DROP POLICY IF EXISTS "Users can view their own duels" ON duels;
CREATE POLICY "Users can view their own duels" ON duels
  FOR SELECT
  USING (auth.uid() = player1_id OR auth.uid() = player2_id);

-- Drop and recreate the update policy
DROP POLICY IF EXISTS "Users can update their own duels" ON duels;
CREATE POLICY "Users can update their own duels" ON duels
  FOR UPDATE
  USING (auth.uid() = player1_id OR auth.uid() = player2_id);

-- ============================================
-- Done!
-- ============================================
-- After running this migration:
-- 1. Async duels can be created with status 'waiting_for_p2'
-- 2. Player results are stored in player1_result and player2_result JSONB
-- 3. expires_at tracks the 48-hour deadline
-- 4. profiles.last_active tracks online status
