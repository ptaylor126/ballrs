-- Profile Rewards: Icons and Frames
-- Run this in your Supabase SQL Editor

-- Create profile_icons table
CREATE TABLE IF NOT EXISTS profile_icons (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  icon_url TEXT NOT NULL, -- Image key name (e.g., 'basketball', 'fire')
  unlock_type TEXT NOT NULL CHECK (unlock_type IN ('level', 'achievement', 'default')),
  unlock_level INTEGER, -- Required if unlock_type = 'level'
  unlock_achievement_id UUID REFERENCES achievements(id), -- Required if unlock_type = 'achievement'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create profile_frames table
CREATE TABLE IF NOT EXISTS profile_frames (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  frame_style JSONB NOT NULL, -- Contains border color, width, gradient, etc.
  unlock_level INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add selected icon and frame to user_stats
ALTER TABLE user_stats
ADD COLUMN IF NOT EXISTS selected_icon_id UUID REFERENCES profile_icons(id),
ADD COLUMN IF NOT EXISTS selected_frame_id UUID REFERENCES profile_frames(id);

-- Enable RLS
ALTER TABLE profile_icons ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_frames ENABLE ROW LEVEL SECURITY;

-- Everyone can read icons and frames
CREATE POLICY "Anyone can read profile icons" ON profile_icons
  FOR SELECT USING (true);

CREATE POLICY "Anyone can read profile frames" ON profile_frames
  FOR SELECT USING (true);

-- Seed profile frames (Default, Bronze, Silver, Gold, Platinum, Diamond)
-- Frame colors:
--   Default: Gray (#6B7280)
--   Bronze: Bronze/copper (#CD7F32)
--   Silver: Silver (#C0C0C0)
--   Gold: Gold (#FFD700)
--   Platinum: Light blue (#E5E4E2 / #A8D8EA)
--   Diamond: Cyan (#00CED1)
INSERT INTO profile_frames (name, frame_style, unlock_level) VALUES
  ('Default', '{"borderColor": "#6B7280", "borderWidth": 3}', 1),
  ('Bronze', '{"borderColor": "#CD7F32", "borderWidth": 3, "shadowColor": "#CD7F32", "shadowOpacity": 0.3}', 1),
  ('Silver', '{"borderColor": "#C0C0C0", "borderWidth": 3, "shadowColor": "#C0C0C0", "shadowOpacity": 0.4}', 10),
  ('Gold', '{"borderColor": "#FFD700", "borderWidth": 4, "shadowColor": "#FFD700", "shadowOpacity": 0.5}', 15),
  ('Platinum', '{"borderColor": "#E5E4E2", "borderWidth": 4, "shadowColor": "#A8D8EA", "shadowOpacity": 0.6}', 20),
  ('Diamond', '{"borderColor": "#00CED1", "borderWidth": 4, "shadowColor": "#00CED1", "shadowOpacity": 0.7}', 25)
ON CONFLICT (name) DO UPDATE SET
  frame_style = EXCLUDED.frame_style,
  unlock_level = EXCLUDED.unlock_level;

-- Seed profile icons
-- icon_url is the key used in the app to load the image file
INSERT INTO profile_icons (name, icon_url, unlock_type, unlock_level) VALUES
  -- Default icons (unlocked from start)
  ('Basketball', 'basketball', 'default', NULL),
  ('Soccer', 'soccer', 'default', NULL),
  ('Football', 'football', 'default', NULL),
  ('Baseball', 'baseball', 'default', NULL),
  ('Star', 'star', 'default', NULL),

  -- Level 10 unlock icons
  ('Sunglasses', 'sunglasses', 'level', 10),
  ('Heart', 'heart', 'level', 10),

  -- Level 15 unlock icons
  ('Ghost', 'ghost', 'level', 15),
  ('Cactus', 'cactus', 'level', 15),

  -- Level 20 unlock icons
  ('Pizza', 'pizza', 'level', 20),
  ('Donut', 'donut', 'level', 20),

  -- Level 25 unlock icons
  ('Unicorn', 'unicorn', 'level', 25),
  ('Alien', 'alien', 'level', 25),

  -- Level 30 unlock icons
  ('Robot', 'robot', 'level', 30),
  ('Ninja', 'ninja', 'level', 30)
ON CONFLICT (name) DO UPDATE SET
  icon_url = EXCLUDED.icon_url,
  unlock_type = EXCLUDED.unlock_type,
  unlock_level = EXCLUDED.unlock_level;
