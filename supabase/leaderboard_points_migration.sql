-- Leaderboard Points Migration
-- Points-based leaderboard with weekly, monthly, and all-time tracking

-- Add points columns to user_stats table
ALTER TABLE user_stats
ADD COLUMN IF NOT EXISTS points_weekly INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS points_monthly INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS points_all_time INTEGER DEFAULT 0;

-- Create indexes for efficient leaderboard queries
CREATE INDEX IF NOT EXISTS idx_user_stats_points_weekly ON user_stats(points_weekly DESC);
CREATE INDEX IF NOT EXISTS idx_user_stats_points_monthly ON user_stats(points_monthly DESC);
CREATE INDEX IF NOT EXISTS idx_user_stats_points_all_time ON user_stats(points_all_time DESC);

-- Function to award points (called from app)
CREATE OR REPLACE FUNCTION award_leaderboard_points(
  p_user_id UUID,
  p_points INTEGER
)
RETURNS VOID AS $$
BEGIN
  -- Update all three point totals
  UPDATE user_stats
  SET
    points_weekly = points_weekly + p_points,
    points_monthly = points_monthly + p_points,
    points_all_time = points_all_time + p_points
  WHERE user_id = p_user_id;

  -- If no row exists, insert one
  IF NOT FOUND THEN
    INSERT INTO user_stats (user_id, points_weekly, points_monthly, points_all_time)
    VALUES (p_user_id, p_points, p_points, p_points);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get global leaderboard
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
      COALESCE(uc.selected_icon, NULL) as avatar,
      CASE p_time_period
        WHEN 'weekly' THEN COALESCE(us.points_weekly, 0)
        WHEN 'monthly' THEN COALESCE(us.points_monthly, 0)
        WHEN 'all_time' THEN COALESCE(us.points_all_time, 0)
        ELSE COALESCE(us.points_weekly, 0)
      END as points
    FROM profiles p
    LEFT JOIN user_stats us ON p.id = us.user_id
    LEFT JOIN user_customization uc ON p.id = uc.user_id
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

-- Function to get total player count for a time period
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

-- Reset weekly points (run every Monday at 00:00 UTC)
CREATE OR REPLACE FUNCTION reset_weekly_points()
RETURNS VOID AS $$
BEGIN
  UPDATE user_stats SET points_weekly = 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Reset monthly points (run 1st of each month at 00:00 UTC)
CREATE OR REPLACE FUNCTION reset_monthly_points()
RETURNS VOID AS $$
BEGIN
  UPDATE user_stats SET points_monthly = 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Schedule the reset jobs using pg_cron (if enabled)
-- Note: Run these manually in SQL Editor if pg_cron is available

-- Weekly reset: Every Monday at midnight UTC
-- SELECT cron.schedule('reset-weekly-points', '0 0 * * 1', 'SELECT reset_weekly_points()');

-- Monthly reset: 1st of each month at midnight UTC
-- SELECT cron.schedule('reset-monthly-points', '0 0 1 * *', 'SELECT reset_monthly_points()');

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION award_leaderboard_points(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_global_leaderboard(TEXT, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_global_leaderboard(TEXT, TEXT, INTEGER) TO anon;
GRANT EXECUTE ON FUNCTION get_leaderboard_player_count(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_leaderboard_player_count(TEXT) TO anon;
