-- Daily Puzzle Completions table for tracking solve times
-- Allows speed stats and percentile calculations

-- Create the table
CREATE TABLE IF NOT EXISTS daily_puzzle_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sport TEXT NOT NULL CHECK (sport IN ('nba', 'pl', 'nfl', 'mlb')),
  puzzle_date DATE NOT NULL,
  completion_time_seconds DECIMAL(10, 1) NOT NULL,
  clues_used INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure one completion per user per puzzle per day
  UNIQUE(user_id, sport, puzzle_date)
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_puzzle_completions_date_sport
  ON daily_puzzle_completions(puzzle_date, sport);
CREATE INDEX IF NOT EXISTS idx_puzzle_completions_user
  ON daily_puzzle_completions(user_id);

-- Enable RLS
ALTER TABLE daily_puzzle_completions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can insert their own completions
CREATE POLICY "Users can insert own completions"
  ON daily_puzzle_completions
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can read all completions (needed for percentile calculations)
CREATE POLICY "Users can read all completions"
  ON daily_puzzle_completions
  FOR SELECT
  TO authenticated
  USING (true);

-- Users can update their own completions (in case of re-solve, though shouldn't happen)
CREATE POLICY "Users can update own completions"
  ON daily_puzzle_completions
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Function to calculate percentile for a completion time
-- Returns the percentile (0-100) where lower is better
-- e.g., 10 means top 10% (faster than 90% of players)
CREATE OR REPLACE FUNCTION get_completion_percentile(
  p_puzzle_date DATE,
  p_sport TEXT,
  p_completion_time DECIMAL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  total_completions INTEGER;
  slower_completions INTEGER;
  percentile_value DECIMAL;
BEGIN
  -- Count total completions for this puzzle
  SELECT COUNT(*) INTO total_completions
  FROM daily_puzzle_completions
  WHERE puzzle_date = p_puzzle_date AND sport = p_sport;

  -- If no completions yet, return NULL (first solver)
  IF total_completions = 0 THEN
    RETURN NULL;
  END IF;

  -- Count how many completions are slower (higher time)
  SELECT COUNT(*) INTO slower_completions
  FROM daily_puzzle_completions
  WHERE puzzle_date = p_puzzle_date
    AND sport = p_sport
    AND completion_time_seconds > p_completion_time;

  -- Calculate percentile (what percentage of people you beat)
  -- Then convert to "top X%" format
  percentile_value := (slower_completions::DECIMAL / total_completions::DECIMAL) * 100;

  -- Round to nearest 10%
  -- Top 10% = beat 90%+ of people = percentile_value >= 90
  -- We want to return 10 for top 10%, 20 for top 20%, etc.
  RETURN GREATEST(10, CEIL((100 - percentile_value) / 10) * 10)::INTEGER;
END;
$$;

-- Function to get completion stats including percentile
CREATE OR REPLACE FUNCTION get_puzzle_completion_stats(
  p_user_id UUID,
  p_puzzle_date DATE,
  p_sport TEXT
)
RETURNS TABLE (
  completion_time_seconds DECIMAL,
  clues_used INTEGER,
  percentile INTEGER,
  total_completions INTEGER,
  is_first_solver BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_completion_time DECIMAL;
  v_clues_used INTEGER;
  v_total INTEGER;
  v_percentile INTEGER;
  v_first_completion_id UUID;
BEGIN
  -- Get user's completion
  SELECT c.completion_time_seconds, c.clues_used, c.id
  INTO v_completion_time, v_clues_used, v_first_completion_id
  FROM daily_puzzle_completions c
  WHERE c.user_id = p_user_id
    AND c.puzzle_date = p_puzzle_date
    AND c.sport = p_sport;

  -- If no completion found, return empty
  IF v_completion_time IS NULL THEN
    RETURN;
  END IF;

  -- Get total completions
  SELECT COUNT(*) INTO v_total
  FROM daily_puzzle_completions
  WHERE puzzle_date = p_puzzle_date AND sport = p_sport;

  -- Check if user was first solver
  SELECT id INTO v_first_completion_id
  FROM daily_puzzle_completions
  WHERE puzzle_date = p_puzzle_date AND sport = p_sport
  ORDER BY created_at ASC
  LIMIT 1;

  -- Calculate percentile
  v_percentile := get_completion_percentile(p_puzzle_date, p_sport, v_completion_time);

  RETURN QUERY SELECT
    v_completion_time,
    v_clues_used,
    v_percentile,
    v_total,
    (v_first_completion_id = (
      SELECT c.id FROM daily_puzzle_completions c
      WHERE c.user_id = p_user_id
        AND c.puzzle_date = p_puzzle_date
        AND c.sport = p_sport
    ));
END;
$$;
