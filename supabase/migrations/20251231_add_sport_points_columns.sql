-- Add sport-specific points columns to user_stats
-- This allows filtering the leaderboard by sport

-- Weekly points by sport
ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS points_weekly_nba INTEGER DEFAULT 0;
ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS points_weekly_pl INTEGER DEFAULT 0;
ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS points_weekly_nfl INTEGER DEFAULT 0;
ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS points_weekly_mlb INTEGER DEFAULT 0;

-- Monthly points by sport
ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS points_monthly_nba INTEGER DEFAULT 0;
ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS points_monthly_pl INTEGER DEFAULT 0;
ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS points_monthly_nfl INTEGER DEFAULT 0;
ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS points_monthly_mlb INTEGER DEFAULT 0;

-- All-time points by sport
ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS points_all_time_nba INTEGER DEFAULT 0;
ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS points_all_time_pl INTEGER DEFAULT 0;
ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS points_all_time_nfl INTEGER DEFAULT 0;
ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS points_all_time_mlb INTEGER DEFAULT 0;

-- Create indexes for efficient leaderboard queries
CREATE INDEX IF NOT EXISTS idx_user_stats_points_weekly_nba ON user_stats(points_weekly_nba DESC) WHERE points_weekly_nba > 0;
CREATE INDEX IF NOT EXISTS idx_user_stats_points_weekly_pl ON user_stats(points_weekly_pl DESC) WHERE points_weekly_pl > 0;
CREATE INDEX IF NOT EXISTS idx_user_stats_points_weekly_nfl ON user_stats(points_weekly_nfl DESC) WHERE points_weekly_nfl > 0;
CREATE INDEX IF NOT EXISTS idx_user_stats_points_weekly_mlb ON user_stats(points_weekly_mlb DESC) WHERE points_weekly_mlb > 0;

CREATE INDEX IF NOT EXISTS idx_user_stats_points_monthly_nba ON user_stats(points_monthly_nba DESC) WHERE points_monthly_nba > 0;
CREATE INDEX IF NOT EXISTS idx_user_stats_points_monthly_pl ON user_stats(points_monthly_pl DESC) WHERE points_monthly_pl > 0;
CREATE INDEX IF NOT EXISTS idx_user_stats_points_monthly_nfl ON user_stats(points_monthly_nfl DESC) WHERE points_monthly_nfl > 0;
CREATE INDEX IF NOT EXISTS idx_user_stats_points_monthly_mlb ON user_stats(points_monthly_mlb DESC) WHERE points_monthly_mlb > 0;

CREATE INDEX IF NOT EXISTS idx_user_stats_points_all_time_nba ON user_stats(points_all_time_nba DESC) WHERE points_all_time_nba > 0;
CREATE INDEX IF NOT EXISTS idx_user_stats_points_all_time_pl ON user_stats(points_all_time_pl DESC) WHERE points_all_time_pl > 0;
CREATE INDEX IF NOT EXISTS idx_user_stats_points_all_time_nfl ON user_stats(points_all_time_nfl DESC) WHERE points_all_time_nfl > 0;
CREATE INDEX IF NOT EXISTS idx_user_stats_points_all_time_mlb ON user_stats(points_all_time_mlb DESC) WHERE points_all_time_mlb > 0;
