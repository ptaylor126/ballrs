-- Update daily puzzle function to accept client's local date
-- This ensures puzzles reset at midnight local time for each user

CREATE OR REPLACE FUNCTION get_or_create_daily_puzzle(
  p_sport TEXT,
  p_total_players INTEGER,
  p_client_date DATE DEFAULT CURRENT_DATE
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
  v_today DATE := p_client_date;
  v_yesterday DATE := p_client_date - 1;
  v_player_index INTEGER;
  v_last_index INTEGER;
  v_last_date DATE;
BEGIN
  -- Validate sport
  IF p_sport NOT IN ('nba', 'pl', 'nfl', 'mlb') THEN
    RAISE EXCEPTION 'Invalid sport: %', p_sport;
  END IF;

  -- Try to get puzzle for client's date
  SELECT dp.player_index INTO v_player_index
  FROM daily_puzzles dp
  WHERE dp.date = v_today AND dp.sport = p_sport;

  -- If found, return it
  IF v_player_index IS NOT NULL THEN
    RETURN QUERY SELECT v_player_index, v_today;
    RETURN;
  END IF;

  -- No puzzle for this date - need to create one
  -- First try to get yesterday's index (relative to client date)
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
