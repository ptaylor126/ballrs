-- Fix RLS policy to allow player2 to decline challenges
-- The issue is that player2 cannot update the duel status to 'declined'

-- Drop the existing update policy if it exists
DROP POLICY IF EXISTS "Users can update their own duels" ON duels;
DROP POLICY IF EXISTS "Players can update their duels" ON duels;

-- Create a new policy that allows both player1 and player2 to update duels
CREATE POLICY "Players can update their duels"
ON duels
FOR UPDATE
USING (
  auth.uid() = player1_id OR auth.uid() = player2_id
)
WITH CHECK (
  auth.uid() = player1_id OR auth.uid() = player2_id
);

-- Also ensure there's a SELECT policy for both players
DROP POLICY IF EXISTS "Users can view their own duels" ON duels;
DROP POLICY IF EXISTS "Players can view their duels" ON duels;

CREATE POLICY "Players can view their duels"
ON duels
FOR SELECT
USING (
  auth.uid() = player1_id OR auth.uid() = player2_id
);
