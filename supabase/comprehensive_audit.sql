-- ============================================================
-- BALLRS COMPREHENSIVE SUPABASE AUDIT & FIX
-- Run this in Supabase SQL Editor to ensure all tables,
-- columns, indexes, RLS policies, and functions are set up
-- ============================================================

-- ============================================================
-- 1. PROFILES TABLE - Core user profiles
-- ============================================================

-- Ensure profiles table has all required columns
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS username TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS country TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS push_token TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_active TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- Indexes for profiles
CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username);
CREATE INDEX IF NOT EXISTS idx_profiles_last_active ON profiles(last_active);
CREATE INDEX IF NOT EXISTS idx_profiles_push_token ON profiles(push_token) WHERE push_token IS NOT NULL;

-- RLS for profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view all profiles" ON profiles;
CREATE POLICY "Users can view all profiles" ON profiles
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- ============================================================
-- 2. USER_STATS TABLE - XP, levels, streaks, points
-- ============================================================

-- Ensure user_stats has all required columns
-- Core stats
ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS xp INTEGER DEFAULT 0;
ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS level INTEGER DEFAULT 1;
ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS daily_streak INTEGER DEFAULT 0;
ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS last_played_date DATE;

-- NBA stats
ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS nba_current_streak INTEGER DEFAULT 0;
ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS nba_best_streak INTEGER DEFAULT 0;
ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS nba_total_solved INTEGER DEFAULT 0;

-- Premier League stats
ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS pl_current_streak INTEGER DEFAULT 0;
ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS pl_best_streak INTEGER DEFAULT 0;
ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS pl_total_solved INTEGER DEFAULT 0;

-- NFL stats
ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS nfl_current_streak INTEGER DEFAULT 0;
ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS nfl_best_streak INTEGER DEFAULT 0;
ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS nfl_total_solved INTEGER DEFAULT 0;

-- MLB stats (MISSING - adding now)
ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS mlb_current_streak INTEGER DEFAULT 0;
ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS mlb_best_streak INTEGER DEFAULT 0;
ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS mlb_total_solved INTEGER DEFAULT 0;

-- Leaderboard points
ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS points_weekly INTEGER DEFAULT 0;
ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS points_monthly INTEGER DEFAULT 0;
ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS points_all_time INTEGER DEFAULT 0;

-- Profile customization (icons/frames selection)
ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS selected_icon_id UUID;
ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS selected_frame_id UUID;

-- Indexes for user_stats
CREATE INDEX IF NOT EXISTS idx_user_stats_level ON user_stats(level DESC);
CREATE INDEX IF NOT EXISTS idx_user_stats_xp ON user_stats(xp DESC);
CREATE INDEX IF NOT EXISTS idx_user_stats_points_weekly ON user_stats(points_weekly DESC);
CREATE INDEX IF NOT EXISTS idx_user_stats_points_monthly ON user_stats(points_monthly DESC);
CREATE INDEX IF NOT EXISTS idx_user_stats_points_all_time ON user_stats(points_all_time DESC);
CREATE INDEX IF NOT EXISTS idx_user_stats_daily_streak ON user_stats(daily_streak DESC);

-- RLS for user_stats
ALTER TABLE user_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view all stats" ON user_stats;
CREATE POLICY "Users can view all stats" ON user_stats
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can update own stats" ON user_stats;
CREATE POLICY "Users can update own stats" ON user_stats
  FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own stats" ON user_stats;
CREATE POLICY "Users can insert own stats" ON user_stats
  FOR INSERT WITH CHECK (auth.uid() = id);

-- ============================================================
-- 3. DUELS TABLE - Duel games
-- ============================================================

-- Ensure duels has all required columns
ALTER TABLE duels ADD COLUMN IF NOT EXISTS player1_id UUID NOT NULL;
ALTER TABLE duels ADD COLUMN IF NOT EXISTS player2_id UUID;
ALTER TABLE duels ADD COLUMN IF NOT EXISTS sport TEXT NOT NULL;
ALTER TABLE duels ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'waiting';
ALTER TABLE duels ADD COLUMN IF NOT EXISTS winner_id UUID;
ALTER TABLE duels ADD COLUMN IF NOT EXISTS question_id TEXT;
ALTER TABLE duels ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- Multi-question duel columns
ALTER TABLE duels ADD COLUMN IF NOT EXISTS total_questions INTEGER DEFAULT 1;
ALTER TABLE duels ADD COLUMN IF NOT EXISTS current_question INTEGER DEFAULT 1;
ALTER TABLE duels ADD COLUMN IF NOT EXISTS player1_score INTEGER DEFAULT 0;
ALTER TABLE duels ADD COLUMN IF NOT EXISTS player2_score INTEGER DEFAULT 0;

-- Async duel columns
ALTER TABLE duels ADD COLUMN IF NOT EXISTS player1_completed_at TIMESTAMPTZ;
ALTER TABLE duels ADD COLUMN IF NOT EXISTS player2_completed_at TIMESTAMPTZ;
ALTER TABLE duels ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE duels ADD COLUMN IF NOT EXISTS player1_result JSONB;
ALTER TABLE duels ADD COLUMN IF NOT EXISTS player2_result JSONB;

-- Result tracking
ALTER TABLE duels ADD COLUMN IF NOT EXISTS player1_seen_result BOOLEAN DEFAULT false;

-- Update status constraint to include all statuses
ALTER TABLE duels DROP CONSTRAINT IF EXISTS duels_status_check;
ALTER TABLE duels ADD CONSTRAINT duels_status_check
CHECK (status IN ('waiting', 'active', 'completed', 'invite', 'declined', 'waiting_for_p2', 'expired'));

-- Update sport constraint to include all sports
ALTER TABLE duels DROP CONSTRAINT IF EXISTS duels_sport_check;
ALTER TABLE duels ADD CONSTRAINT duels_sport_check
CHECK (sport IN ('nba', 'pl', 'nfl', 'mlb'));

-- Indexes for duels
CREATE INDEX IF NOT EXISTS idx_duels_player1 ON duels(player1_id);
CREATE INDEX IF NOT EXISTS idx_duels_player2 ON duels(player2_id);
CREATE INDEX IF NOT EXISTS idx_duels_status ON duels(status);
CREATE INDEX IF NOT EXISTS idx_duels_sport ON duels(sport);
CREATE INDEX IF NOT EXISTS idx_duels_created_at ON duels(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_duels_expires_at ON duels(expires_at) WHERE status = 'waiting_for_p2';
CREATE INDEX IF NOT EXISTS idx_duels_pending_async ON duels(player2_id, status) WHERE status = 'waiting_for_p2';
CREATE INDEX IF NOT EXISTS idx_duels_player1_unseen ON duels(player1_id, player1_seen_result)
  WHERE status = 'completed' AND player1_seen_result = false;

-- RLS for duels
ALTER TABLE duels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own duels" ON duels;
CREATE POLICY "Users can view their own duels" ON duels
  FOR SELECT USING (auth.uid() = player1_id OR auth.uid() = player2_id);

DROP POLICY IF EXISTS "Users can create duels" ON duels;
CREATE POLICY "Users can create duels" ON duels
  FOR INSERT WITH CHECK (auth.uid() = player1_id);

DROP POLICY IF EXISTS "Users can update their own duels" ON duels;
CREATE POLICY "Users can update their own duels" ON duels
  FOR UPDATE USING (auth.uid() = player1_id OR auth.uid() = player2_id);

DROP POLICY IF EXISTS "Users can join waiting duels" ON duels;
CREATE POLICY "Users can join waiting duels" ON duels
  FOR UPDATE USING (status = 'waiting' AND player2_id IS NULL);

-- Enable realtime for duels (skip if already added)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'duels'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE duels;
  END IF;
END $$;

-- ============================================================
-- 4. FRIENDS TABLE - Friendships
-- ============================================================

-- Ensure friends table exists and has columns
CREATE TABLE IF NOT EXISTS friends (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  friend_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pending_challenge_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, friend_id)
);

-- Indexes for friends
CREATE INDEX IF NOT EXISTS idx_friends_user ON friends(user_id);
CREATE INDEX IF NOT EXISTS idx_friends_friend ON friends(friend_id);

-- RLS for friends
ALTER TABLE friends ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their friendships" ON friends;
CREATE POLICY "Users can view their friendships" ON friends
  FOR SELECT USING (auth.uid() = user_id OR auth.uid() = friend_id);

DROP POLICY IF EXISTS "Users can insert friendships" ON friends;
CREATE POLICY "Users can insert friendships" ON friends
  FOR INSERT WITH CHECK (auth.uid() = user_id OR auth.uid() = friend_id);

DROP POLICY IF EXISTS "Users can update their friendships" ON friends;
CREATE POLICY "Users can update their friendships" ON friends
  FOR UPDATE USING (auth.uid() = user_id OR auth.uid() = friend_id);

DROP POLICY IF EXISTS "Users can delete their friendships" ON friends;
CREATE POLICY "Users can delete their friendships" ON friends
  FOR DELETE USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- ============================================================
-- 5. FRIEND_REQUESTS TABLE - Friend request system
-- ============================================================

CREATE TABLE IF NOT EXISTS friend_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(sender_id, receiver_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_friend_requests_sender ON friend_requests(sender_id);
CREATE INDEX IF NOT EXISTS idx_friend_requests_receiver ON friend_requests(receiver_id);
CREATE INDEX IF NOT EXISTS idx_friend_requests_status ON friend_requests(status) WHERE status = 'pending';

-- RLS
ALTER TABLE friend_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own friend requests" ON friend_requests;
CREATE POLICY "Users can view their own friend requests" ON friend_requests
  FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

DROP POLICY IF EXISTS "Users can send friend requests" ON friend_requests;
CREATE POLICY "Users can send friend requests" ON friend_requests
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

DROP POLICY IF EXISTS "Users can respond to received requests" ON friend_requests;
CREATE POLICY "Users can respond to received requests" ON friend_requests
  FOR UPDATE USING (auth.uid() = receiver_id);

DROP POLICY IF EXISTS "Users can delete their friend requests" ON friend_requests;
CREATE POLICY "Users can delete their friend requests" ON friend_requests
  FOR DELETE USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- Enable realtime (skip if already added)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'friend_requests'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE friend_requests;
  END IF;
END $$;

-- ============================================================
-- 6. LEAGUES & LEAGUE_MEMBERS TABLES
-- ============================================================

-- Ensure leagues table exists (minimal definition)
CREATE TABLE IF NOT EXISTS leagues (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add all potentially missing columns
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS code TEXT;
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS creator_id UUID;
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS sport TEXT DEFAULT 'all';
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS max_members INTEGER DEFAULT 50;
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- Make code unique (only if not already)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'leagues_code_key'
  ) THEN
    ALTER TABLE leagues ADD CONSTRAINT leagues_code_key UNIQUE (code);
  END IF;
EXCEPTION WHEN others THEN
  NULL; -- Ignore if constraint already exists
END $$;

-- Update sport constraint for leagues to include all sports (with error handling)
DO $$
BEGIN
  ALTER TABLE leagues DROP CONSTRAINT IF EXISTS leagues_sport_check;
  ALTER TABLE leagues ADD CONSTRAINT leagues_sport_check
    CHECK (sport IN ('nba', 'pl', 'nfl', 'mlb', 'all'));
EXCEPTION WHEN others THEN
  NULL; -- Ignore constraint errors
END $$;

-- Indexes (with error handling)
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS idx_leagues_code ON leagues(code);
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS idx_leagues_creator ON leagues(creator_id);
EXCEPTION WHEN others THEN NULL;
END $$;

-- RLS for leagues
ALTER TABLE leagues ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view leagues" ON leagues;
CREATE POLICY "Anyone can view leagues" ON leagues FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can create leagues" ON leagues;
CREATE POLICY "Users can create leagues" ON leagues
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Creators can update leagues" ON leagues;
CREATE POLICY "Creators can update leagues" ON leagues
  FOR UPDATE USING (creator_id IS NULL OR auth.uid() = creator_id);

-- League members table
CREATE TABLE IF NOT EXISTS league_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(league_id, user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_league_members_league ON league_members(league_id);
CREATE INDEX IF NOT EXISTS idx_league_members_user ON league_members(user_id);

-- RLS for league_members
ALTER TABLE league_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view league members" ON league_members;
CREATE POLICY "Anyone can view league members" ON league_members FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can join leagues" ON league_members;
CREATE POLICY "Users can join leagues" ON league_members
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can leave leagues" ON league_members;
CREATE POLICY "Users can leave leagues" ON league_members
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- 7. ACHIEVEMENTS & USER_ACHIEVEMENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS achievements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  requirement_type TEXT,
  requirement_value INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_achievements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_id UUID NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
  unlocked_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, achievement_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_achievements_user ON user_achievements(user_id);
CREATE INDEX IF NOT EXISTS idx_user_achievements_achievement ON user_achievements(achievement_id);

-- RLS
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view achievements" ON achievements;
CREATE POLICY "Anyone can view achievements" ON achievements FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can view their achievements" ON user_achievements;
CREATE POLICY "Users can view their achievements" ON user_achievements
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "System can insert achievements" ON user_achievements;
CREATE POLICY "System can insert achievements" ON user_achievements
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 8. PROFILE_ICONS & PROFILE_FRAMES
-- ============================================================

CREATE TABLE IF NOT EXISTS profile_icons (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  icon_url TEXT NOT NULL,
  unlock_type TEXT NOT NULL CHECK (unlock_type IN ('level', 'achievement', 'default')),
  unlock_level INTEGER,
  unlock_achievement_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS profile_frames (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  frame_style JSONB NOT NULL,
  unlock_level INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE profile_icons ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_frames ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read profile icons" ON profile_icons;
CREATE POLICY "Anyone can read profile icons" ON profile_icons FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can read profile frames" ON profile_frames;
CREATE POLICY "Anyone can read profile frames" ON profile_frames FOR SELECT USING (true);

-- ============================================================
-- 9. LEADERBOARD FUNCTIONS
-- ============================================================

-- Function to award points
CREATE OR REPLACE FUNCTION award_leaderboard_points(
  p_user_id UUID,
  p_points INTEGER
)
RETURNS VOID AS $$
BEGIN
  UPDATE user_stats
  SET
    points_weekly = points_weekly + p_points,
    points_monthly = points_monthly + p_points,
    points_all_time = points_all_time + p_points
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    INSERT INTO user_stats (id, points_weekly, points_monthly, points_all_time)
    VALUES (p_user_id, p_points, p_points, p_points);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get global leaderboard (FIXED: uses user_stats.id, not user_customization)
CREATE OR REPLACE FUNCTION get_global_leaderboard(
  p_time_period TEXT DEFAULT 'weekly',
  p_sport_filter TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  rank BIGINT,
  user_id UUID,
  username TEXT,
  country TEXT,
  points INTEGER,
  avatar TEXT
) AS $$
BEGIN
  RETURN QUERY
  WITH ranked_users AS (
    SELECT
      p.id as user_id,
      p.username,
      p.country,
      NULL::TEXT as avatar,
      CASE p_time_period
        WHEN 'weekly' THEN COALESCE(us.points_weekly, 0)
        WHEN 'monthly' THEN COALESCE(us.points_monthly, 0)
        WHEN 'all_time' THEN COALESCE(us.points_all_time, 0)
        ELSE COALESCE(us.points_weekly, 0)
      END as points
    FROM profiles p
    LEFT JOIN user_stats us ON p.id = us.id
    WHERE
      CASE p_time_period
        WHEN 'weekly' THEN COALESCE(us.points_weekly, 0) > 0
        WHEN 'monthly' THEN COALESCE(us.points_monthly, 0) > 0
        WHEN 'all_time' THEN COALESCE(us.points_all_time, 0) > 0
        ELSE COALESCE(us.points_weekly, 0) > 0
      END
  )
  SELECT
    ROW_NUMBER() OVER (ORDER BY ru.points DESC, ru.username ASC)::BIGINT as rank,
    ru.user_id,
    ru.username,
    ru.country,
    ru.points::INTEGER,
    ru.avatar
  FROM ranked_users ru
  ORDER BY ru.points DESC, ru.username ASC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get total player count
CREATE OR REPLACE FUNCTION get_leaderboard_player_count(
  p_time_period TEXT DEFAULT 'weekly'
)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*)::INTEGER INTO v_count
  FROM user_stats us
  WHERE
    CASE p_time_period
      WHEN 'weekly' THEN COALESCE(us.points_weekly, 0) > 0
      WHEN 'monthly' THEN COALESCE(us.points_monthly, 0) > 0
      WHEN 'all_time' THEN COALESCE(us.points_all_time, 0) > 0
      ELSE COALESCE(us.points_weekly, 0) > 0
    END;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Reset functions for weekly/monthly points
CREATE OR REPLACE FUNCTION reset_weekly_points()
RETURNS VOID AS $$
BEGIN
  UPDATE user_stats SET points_weekly = 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION reset_monthly_points()
RETURNS VOID AS $$
BEGIN
  UPDATE user_stats SET points_monthly = 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION award_leaderboard_points(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_global_leaderboard(TEXT, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_global_leaderboard(TEXT, TEXT, INTEGER) TO anon;
GRANT EXECUTE ON FUNCTION get_leaderboard_player_count(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_leaderboard_player_count(TEXT) TO anon;

-- ============================================================
-- 10. LEADERBOARD VIEW (includes all 4 sports)
-- ============================================================

DROP VIEW IF EXISTS leaderboard;
CREATE VIEW leaderboard AS
SELECT
  p.id,
  p.username,
  COALESCE(us.nba_total_solved, 0) as nba_total_solved,
  COALESCE(us.pl_total_solved, 0) as pl_total_solved,
  COALESCE(us.nfl_total_solved, 0) as nfl_total_solved,
  COALESCE(us.mlb_total_solved, 0) as mlb_total_solved,
  COALESCE(us.nba_total_solved, 0) + COALESCE(us.pl_total_solved, 0) +
  COALESCE(us.nfl_total_solved, 0) + COALESCE(us.mlb_total_solved, 0) as total_solved,
  COALESCE(us.nba_best_streak, 0) as nba_best_streak,
  COALESCE(us.pl_best_streak, 0) as pl_best_streak,
  COALESCE(us.nfl_best_streak, 0) as nfl_best_streak,
  COALESCE(us.mlb_best_streak, 0) as mlb_best_streak,
  ROW_NUMBER() OVER (
    ORDER BY (COALESCE(us.nba_total_solved, 0) + COALESCE(us.pl_total_solved, 0) +
              COALESCE(us.nfl_total_solved, 0) + COALESCE(us.mlb_total_solved, 0)) DESC
  ) as rank
FROM profiles p
LEFT JOIN user_stats us ON p.id = us.id
WHERE (COALESCE(us.nba_total_solved, 0) + COALESCE(us.pl_total_solved, 0) +
       COALESCE(us.nfl_total_solved, 0) + COALESCE(us.mlb_total_solved, 0)) > 0
ORDER BY total_solved DESC;

-- ============================================================
-- 11. CRON JOBS (Must be enabled in Supabase Dashboard)
-- ============================================================
--
-- The following cron jobs should be scheduled in Supabase:
--
-- 1. Weekly Points Reset (Every Monday at midnight UTC)
--    Name: reset-weekly-points
--    Schedule: 0 0 * * 1
--    Command: SELECT reset_weekly_points()
--
-- 2. Monthly Points Reset (1st of each month at midnight UTC)
--    Name: reset-monthly-points
--    Schedule: 0 0 1 * *
--    Command: SELECT reset_monthly_points()
--
-- 3. Expire Async Duels (Hourly - calls Edge Function)
--    Name: expire-async-duels
--    Schedule: 0 * * * *
--    Command: SELECT net.http_post(
--               url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/expire-duels',
--               headers := '{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb,
--               body := '{}'::jsonb
--             )
--
-- 4. Daily Reminder Notifications (11:00 AM UTC)
--    Name: daily-puzzle-reminder
--    Schedule: 0 11 * * *
--    Command: SELECT net.http_post(
--               url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-daily-reminder',
--               headers := '{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb,
--               body := '{}'::jsonb
--             )
--
-- To enable pg_cron:
-- 1. Go to Database > Extensions in Supabase Dashboard
-- 2. Enable pg_cron
-- 3. Go to Database > Cron Jobs
-- 4. Create jobs using the schedules above
--
-- ============================================================

-- ============================================================
-- 12. SEED DEFAULT DATA (if not exists)
-- ============================================================

-- Seed profile frames
INSERT INTO profile_frames (name, frame_style, unlock_level) VALUES
  ('Default', '{"borderColor": "#374151", "borderWidth": 3, "shadowColor": null}', 1),
  ('Bronze', '{"borderColor": "#CD7F32", "borderWidth": 3, "shadowColor": "#CD7F32", "shadowOpacity": 0.3}', 5),
  ('Silver', '{"borderColor": "#C0C0C0", "borderWidth": 3, "shadowColor": "#C0C0C0", "shadowOpacity": 0.4}', 10),
  ('Gold', '{"borderColor": "#FFD700", "borderWidth": 4, "shadowColor": "#FFD700", "shadowOpacity": 0.5}', 15),
  ('Platinum', '{"borderColor": "#E5E4E2", "borderWidth": 4, "shadowColor": "#E5E4E2", "shadowOpacity": 0.6}', 20),
  ('Diamond', '{"borderColor": "#B9F2FF", "borderWidth": 4, "shadowColor": "#B9F2FF", "shadowOpacity": 0.7}', 25),
  ('Legend', '{"borderColor": "#FF4500", "borderWidth": 5, "shadowColor": "#FF4500", "shadowOpacity": 0.8}', 30)
ON CONFLICT DO NOTHING;

-- Seed profile icons
INSERT INTO profile_icons (name, icon_url, unlock_type, unlock_level) VALUES
  ('Basketball', '🏀', 'default', NULL),
  ('Football', '⚽', 'default', NULL),
  ('Star', '⭐', 'default', NULL),
  ('Fire', '🔥', 'default', NULL),
  ('Trophy', '🏆', 'level', 5),
  ('Medal', '🥇', 'level', 10),
  ('Crown', '👑', 'level', 15),
  ('Lightning', '⚡', 'level', 20),
  ('Diamond', '💎', 'level', 25),
  ('Rocket', '🚀', 'level', 30)
ON CONFLICT DO NOTHING;

-- ============================================================
-- AUDIT COMPLETE
-- ============================================================
--
-- Summary of what this migration ensures:
--
-- Tables:
-- - profiles (username, country, push_token, last_active)
-- - user_stats (xp, level, streaks for 4 sports, points, customization)
-- - duels (with async support and result tracking)
-- - friends (friendships)
-- - friend_requests (pending requests)
-- - leagues & league_members
-- - achievements & user_achievements
-- - profile_icons & profile_frames
--
-- Indexes: Created on all frequently queried columns
-- RLS Policies: All tables have appropriate security
-- Functions: Leaderboard queries and point resets
-- Realtime: Enabled for duels and friend_requests
--
-- Required Cron Jobs (set up in Dashboard):
-- - Weekly/Monthly point resets
-- - Hourly async duel expiration
-- - Daily reminder notifications at 11 AM UTC
--
