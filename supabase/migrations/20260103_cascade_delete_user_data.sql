-- Cascade delete user data when account is deleted
-- This ensures no orphaned data remains when a user deletes their account

-- First, clean up any existing orphaned data (users in user_stats but not in profiles)
DELETE FROM user_stats
WHERE id NOT IN (SELECT id FROM profiles);

-- Delete orphaned friend relationships
DELETE FROM friends
WHERE user_id NOT IN (SELECT id FROM profiles)
   OR friend_id NOT IN (SELECT id FROM profiles);

-- Delete orphaned friend requests
DELETE FROM friend_requests
WHERE sender_id NOT IN (SELECT id FROM profiles)
   OR receiver_id NOT IN (SELECT id FROM profiles);

-- Delete orphaned duels (where both players are gone)
DELETE FROM duels
WHERE player1_id NOT IN (SELECT id FROM profiles)
  AND player2_id NOT IN (SELECT id FROM profiles);

-- For duels where only one player is deleted, we could either:
-- Option A: Delete the duel entirely
-- Option B: Keep it but the remaining player sees "Deleted User"
-- Going with Option A for cleaner data:
DELETE FROM duels
WHERE player1_id NOT IN (SELECT id FROM profiles)
   OR player2_id NOT IN (SELECT id FROM profiles);

-- Delete orphaned league memberships (if table exists)
DO $$
BEGIN
  DELETE FROM league_members WHERE user_id NOT IN (SELECT id FROM profiles);
EXCEPTION WHEN undefined_table THEN
  -- Table doesn't exist, skip
END $$;

-- Now set up CASCADE DELETE for future deletions
-- Note: These require dropping and recreating foreign key constraints

-- user_stats: Delete when profile is deleted
ALTER TABLE user_stats
DROP CONSTRAINT IF EXISTS user_stats_id_fkey;

ALTER TABLE user_stats
ADD CONSTRAINT user_stats_id_fkey
FOREIGN KEY (id) REFERENCES profiles(id) ON DELETE CASCADE;

-- friends: Delete friendship when either user is deleted
ALTER TABLE friends
DROP CONSTRAINT IF EXISTS friends_user_id_fkey,
DROP CONSTRAINT IF EXISTS friends_friend_id_fkey;

ALTER TABLE friends
ADD CONSTRAINT friends_user_id_fkey
FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE friends
ADD CONSTRAINT friends_friend_id_fkey
FOREIGN KEY (friend_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- friend_requests: Delete when either user is deleted
ALTER TABLE friend_requests
DROP CONSTRAINT IF EXISTS friend_requests_sender_id_fkey,
DROP CONSTRAINT IF EXISTS friend_requests_receiver_id_fkey;

ALTER TABLE friend_requests
ADD CONSTRAINT friend_requests_sender_id_fkey
FOREIGN KEY (sender_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE friend_requests
ADD CONSTRAINT friend_requests_receiver_id_fkey
FOREIGN KEY (receiver_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- duels: Delete when either player is deleted
ALTER TABLE duels
DROP CONSTRAINT IF EXISTS duels_player1_id_fkey,
DROP CONSTRAINT IF EXISTS duels_player2_id_fkey;

ALTER TABLE duels
ADD CONSTRAINT duels_player1_id_fkey
FOREIGN KEY (player1_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE duels
ADD CONSTRAINT duels_player2_id_fkey
FOREIGN KEY (player2_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- league_members: Delete membership when user is deleted (if table exists)
DO $$
BEGIN
  ALTER TABLE league_members DROP CONSTRAINT IF EXISTS league_members_user_id_fkey;
  ALTER TABLE league_members ADD CONSTRAINT league_members_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
EXCEPTION WHEN undefined_table THEN
  -- Table doesn't exist, skip
END $$;

-- leagues: Set creator to NULL when user is deleted (if table exists)
DO $$
BEGIN
  ALTER TABLE leagues DROP CONSTRAINT IF EXISTS leagues_created_by_fkey;
  ALTER TABLE leagues ADD CONSTRAINT leagues_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
EXCEPTION WHEN undefined_table THEN
  -- Table doesn't exist, skip
END $$;
