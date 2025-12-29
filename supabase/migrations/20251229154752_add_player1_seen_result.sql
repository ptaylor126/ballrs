-- Add column to track whether Player 1 has seen the duel result
-- Player 2 sees results immediately after completing, so they don't need this

ALTER TABLE duels ADD COLUMN IF NOT EXISTS player1_seen_result BOOLEAN DEFAULT false;

-- Set existing completed duels as seen (so they don't all show as NEW)
UPDATE duels SET player1_seen_result = true WHERE status = 'completed';

-- Create index for querying unseen results
CREATE INDEX IF NOT EXISTS idx_duels_player1_unseen ON duels(player1_id, player1_seen_result)
WHERE status = 'completed' AND player1_seen_result = false;
