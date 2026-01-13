-- Add DELETE policy for daily_puzzle_completions
-- Allows users to delete their own completion records (needed for testing)

DROP POLICY IF EXISTS "Users can delete own completions" ON daily_puzzle_completions;
CREATE POLICY "Users can delete own completions"
  ON daily_puzzle_completions
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
