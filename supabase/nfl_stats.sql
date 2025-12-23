-- Add NFL stats columns to user_stats table
ALTER TABLE user_stats
ADD COLUMN IF NOT EXISTS nfl_current_streak integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS nfl_best_streak integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS nfl_total_solved integer DEFAULT 0;

-- Update the leaderboard view to include NFL stats
DROP VIEW IF EXISTS leaderboard;

CREATE VIEW leaderboard AS
SELECT
  p.id,
  p.username,
  COALESCE(us.nba_total_solved, 0) as nba_total_solved,
  COALESCE(us.pl_total_solved, 0) as pl_total_solved,
  COALESCE(us.nfl_total_solved, 0) as nfl_total_solved,
  COALESCE(us.nba_total_solved, 0) + COALESCE(us.pl_total_solved, 0) + COALESCE(us.nfl_total_solved, 0) as total_solved,
  COALESCE(us.nba_best_streak, 0) as nba_best_streak,
  COALESCE(us.pl_best_streak, 0) as pl_best_streak,
  COALESCE(us.nfl_best_streak, 0) as nfl_best_streak,
  ROW_NUMBER() OVER (
    ORDER BY (COALESCE(us.nba_total_solved, 0) + COALESCE(us.pl_total_solved, 0) + COALESCE(us.nfl_total_solved, 0)) DESC
  ) as rank
FROM profiles p
LEFT JOIN user_stats us ON p.id = us.id
WHERE (COALESCE(us.nba_total_solved, 0) + COALESCE(us.pl_total_solved, 0) + COALESCE(us.nfl_total_solved, 0)) > 0
ORDER BY total_solved DESC;

-- Update the duels table to support NFL sport
-- First check if the constraint exists and update it
DO $$
BEGIN
    -- Try to drop the existing constraint if it exists
    BEGIN
        ALTER TABLE duels DROP CONSTRAINT IF EXISTS duels_sport_check;
    EXCEPTION WHEN undefined_object THEN
        NULL;
    END;
END $$;

-- Add the new constraint allowing NFL
ALTER TABLE duels ADD CONSTRAINT duels_sport_check
CHECK (sport IN ('nba', 'pl', 'nfl'));

-- Update the leagues table to support NFL sport
DO $$
BEGIN
    BEGIN
        ALTER TABLE leagues DROP CONSTRAINT IF EXISTS leagues_sport_check;
    EXCEPTION WHEN undefined_object THEN
        NULL;
    END;
END $$;

ALTER TABLE leagues ADD CONSTRAINT leagues_sport_check
CHECK (sport IN ('nba', 'pl', 'nfl', 'all'));
