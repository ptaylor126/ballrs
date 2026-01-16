-- Fix duplicate profile frames and add unique constraint
-- This migration removes duplicates and ensures proper frame colors

-- First, clear all foreign key references in user_stats
UPDATE user_stats SET selected_frame_id = NULL WHERE selected_frame_id IS NOT NULL;

-- Now delete all existing frames (we'll re-insert the correct ones)
DELETE FROM profile_frames;

-- Re-insert frames with correct colors (no duplicates)
INSERT INTO profile_frames (name, frame_style, unlock_level) VALUES
  ('Default', '{"borderColor": "#6B7280", "borderWidth": 3}', 1),
  ('Bronze', '{"borderColor": "#CD7F32", "borderWidth": 3, "shadowColor": "#CD7F32", "shadowOpacity": 0.3}', 1),
  ('Silver', '{"borderColor": "#C0C0C0", "borderWidth": 3, "shadowColor": "#C0C0C0", "shadowOpacity": 0.4}', 10),
  ('Gold', '{"borderColor": "#FFD700", "borderWidth": 4, "shadowColor": "#FFD700", "shadowOpacity": 0.5}', 15),
  ('Platinum', '{"borderColor": "#E5E4E2", "borderWidth": 4, "shadowColor": "#A8D8EA", "shadowOpacity": 0.6}', 20),
  ('Diamond', '{"borderColor": "#00CED1", "borderWidth": 4, "shadowColor": "#00CED1", "shadowOpacity": 0.7}', 25);

-- Add unique constraint on name to prevent future duplicates (if it doesn't already exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profile_frames_name_unique'
  ) THEN
    ALTER TABLE profile_frames ADD CONSTRAINT profile_frames_name_unique UNIQUE (name);
  END IF;
END $$;

-- Set all users to the Default frame
UPDATE user_stats
SET selected_frame_id = (SELECT id FROM profile_frames WHERE name = 'Default')
WHERE selected_frame_id IS NULL;
