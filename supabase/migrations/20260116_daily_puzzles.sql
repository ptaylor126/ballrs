-- Daily Puzzles table for sequential player rotation
-- Ensures all players are shown before any repeats

CREATE TABLE IF NOT EXISTS daily_puzzles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  sport TEXT NOT NULL CHECK (sport IN ('nba', 'pl', 'nfl', 'mlb')),
  player_index INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(date, sport)
);

-- Index for fast lookups by date and sport
CREATE INDEX IF NOT EXISTS idx_daily_puzzles_date_sport
  ON daily_puzzles(date, sport);

-- Enable RLS
ALTER TABLE daily_puzzles ENABLE ROW LEVEL SECURITY;

-- Anyone can read daily puzzles (needed for all users to get today's player)
CREATE POLICY "Anyone can read daily puzzles"
  ON daily_puzzles
  FOR SELECT
  TO authenticated
  USING (true);

-- Also allow anon users to read (for users not logged in yet)
CREATE POLICY "Anon can read daily puzzles"
  ON daily_puzzles
  FOR SELECT
  TO anon
  USING (true);

-- Function to get or create today's daily puzzle
-- Uses SECURITY DEFINER to bypass RLS for inserts
CREATE OR REPLACE FUNCTION get_or_create_daily_puzzle(
  p_sport TEXT,
  p_total_players INTEGER
)
RETURNS TABLE (
  player_index INTEGER,
  puzzle_date DATE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today DATE := CURRENT_DATE;
  v_yesterday DATE := CURRENT_DATE - 1;
  v_player_index INTEGER;
  v_last_index INTEGER;
  v_last_date DATE;
BEGIN
  -- Validate sport
  IF p_sport NOT IN ('nba', 'pl', 'nfl', 'mlb') THEN
    RAISE EXCEPTION 'Invalid sport: %', p_sport;
  END IF;

  -- Try to get today's puzzle
  SELECT dp.player_index INTO v_player_index
  FROM daily_puzzles dp
  WHERE dp.date = v_today AND dp.sport = p_sport;

  -- If found, return it
  IF v_player_index IS NOT NULL THEN
    RETURN QUERY SELECT v_player_index, v_today;
    RETURN;
  END IF;

  -- No puzzle for today - need to create one
  -- First try to get yesterday's index
  SELECT dp.player_index INTO v_last_index
  FROM daily_puzzles dp
  WHERE dp.date = v_yesterday AND dp.sport = p_sport;

  IF v_last_index IS NOT NULL THEN
    -- Continue from yesterday
    v_player_index := (v_last_index + 1) % p_total_players;
  ELSE
    -- No yesterday entry - check for any previous entry
    SELECT dp.player_index, dp.date INTO v_last_index, v_last_date
    FROM daily_puzzles dp
    WHERE dp.sport = p_sport
    ORDER BY dp.date DESC
    LIMIT 1;

    IF v_last_index IS NOT NULL THEN
      -- Continue from last known entry
      v_player_index := (v_last_index + 1) % p_total_players;
    ELSE
      -- First ever puzzle for this sport
      v_player_index := 0;
    END IF;
  END IF;

  -- Insert new puzzle (handle race condition with ON CONFLICT)
  INSERT INTO daily_puzzles (date, sport, player_index)
  VALUES (v_today, p_sport, v_player_index)
  ON CONFLICT (date, sport) DO NOTHING;

  -- Fetch the actual value (in case of race condition)
  SELECT dp.player_index INTO v_player_index
  FROM daily_puzzles dp
  WHERE dp.date = v_today AND dp.sport = p_sport;

  RETURN QUERY SELECT v_player_index, v_today;
END;
$$;
