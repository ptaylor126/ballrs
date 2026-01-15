-- Add duel_wins column to user_stats table
ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS duel_wins INTEGER DEFAULT 0;
ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS duels_played INTEGER DEFAULT 0;
