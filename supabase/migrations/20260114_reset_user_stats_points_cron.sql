-- Reset Weekly and Monthly Points Cron Jobs for user_stats
-- This migration sets up pg_cron to reset points_weekly_* and points_monthly_* columns

-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Grant usage to postgres user
GRANT USAGE ON SCHEMA cron TO postgres;

-- Function to reset weekly points in user_stats (runs every Monday at 00:00 UTC)
CREATE OR REPLACE FUNCTION reset_user_stats_weekly_points()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE user_stats SET
    points_weekly = 0,
    points_weekly_nba = 0,
    points_weekly_pl = 0,
    points_weekly_nfl = 0,
    points_weekly_mlb = 0;

  RAISE NOTICE 'Reset weekly points for all users at %', NOW();
END;
$$;

-- Function to reset monthly points in user_stats (runs 1st of each month at 00:00 UTC)
CREATE OR REPLACE FUNCTION reset_user_stats_monthly_points()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE user_stats SET
    points_monthly = 0,
    points_monthly_nba = 0,
    points_monthly_pl = 0,
    points_monthly_nfl = 0,
    points_monthly_mlb = 0;

  RAISE NOTICE 'Reset monthly points for all users at %', NOW();
END;
$$;

-- Schedule weekly reset: Every Monday at 00:00 UTC
-- Cron format: minute hour day-of-month month day-of-week
-- day-of-week: 1 = Monday
SELECT cron.schedule(
  'reset-user-stats-weekly-points',
  '0 0 * * 1',  -- Monday at 00:00 UTC
  $$SELECT reset_user_stats_weekly_points()$$
);

-- Schedule monthly reset: 1st of each month at 00:00 UTC
SELECT cron.schedule(
  'reset-user-stats-monthly-points',
  '0 0 1 * *',  -- 1st of month at 00:00 UTC
  $$SELECT reset_user_stats_monthly_points()$$
);

-- Also reset league_members points (if not already scheduled)
-- Function to reset weekly points in league_members
CREATE OR REPLACE FUNCTION reset_league_weekly_points()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE league_members SET points_weekly = 0;
  RAISE NOTICE 'Reset weekly points for all league members at %', NOW();
END;
$$;

-- Function to reset monthly points in league_members
CREATE OR REPLACE FUNCTION reset_league_monthly_points()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE league_members SET points_monthly = 0;
  RAISE NOTICE 'Reset monthly points for all league members at %', NOW();
END;
$$;

-- Schedule league weekly reset (if not exists, will fail silently if already scheduled)
DO $$
BEGIN
  PERFORM cron.schedule(
    'reset-league-weekly-points',
    '0 0 * * 1',
    'SELECT reset_league_weekly_points()'
  );
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'League weekly reset job may already exist';
END;
$$;

-- Schedule league monthly reset (if not exists)
DO $$
BEGIN
  PERFORM cron.schedule(
    'reset-league-monthly-points',
    '0 0 1 * *',
    'SELECT reset_league_monthly_points()'
  );
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'League monthly reset job may already exist';
END;
$$;

-- To view all scheduled jobs:
-- SELECT * FROM cron.job;

-- To manually trigger a reset (for testing):
-- SELECT reset_user_stats_weekly_points();
-- SELECT reset_user_stats_monthly_points();

COMMENT ON FUNCTION reset_user_stats_weekly_points IS 'Resets all weekly point columns in user_stats to 0. Runs every Monday at 00:00 UTC.';
COMMENT ON FUNCTION reset_user_stats_monthly_points IS 'Resets all monthly point columns in user_stats to 0. Runs 1st of each month at 00:00 UTC.';
