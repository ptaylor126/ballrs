-- Profile Rewards: Icons and Frames
-- Run this in your Supabase SQL Editor

-- Create profile_icons table
CREATE TABLE IF NOT EXISTS profile_icons (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  icon_url TEXT NOT NULL, -- Can be emoji or image URL
  unlock_type TEXT NOT NULL CHECK (unlock_type IN ('level', 'achievement', 'default')),
  unlock_level INTEGER, -- Required if unlock_type = 'level'
  unlock_achievement_id UUID REFERENCES achievements(id), -- Required if unlock_type = 'achievement'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create profile_frames table
CREATE TABLE IF NOT EXISTS profile_frames (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
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

-- Seed profile frames (Default, Bronze, Silver, Gold, Platinum, Diamond, Legend)
INSERT INTO profile_frames (name, frame_style, unlock_level) VALUES
  ('Default', '{"borderColor": "#374151", "borderWidth": 3, "shadowColor": null}', 1),
  ('Bronze', '{"borderColor": "#CD7F32", "borderWidth": 3, "shadowColor": "#CD7F32", "shadowOpacity": 0.3}', 5),
  ('Silver', '{"borderColor": "#C0C0C0", "borderWidth": 3, "shadowColor": "#C0C0C0", "shadowOpacity": 0.4}', 10),
  ('Gold', '{"borderColor": "#FFD700", "borderWidth": 4, "shadowColor": "#FFD700", "shadowOpacity": 0.5}', 15),
  ('Platinum', '{"borderColor": "#E5E4E2", "borderWidth": 4, "shadowColor": "#E5E4E2", "shadowOpacity": 0.6, "gradient": ["#E5E4E2", "#A8A8A8"]}', 20),
  ('Diamond', '{"borderColor": "#B9F2FF", "borderWidth": 4, "shadowColor": "#B9F2FF", "shadowOpacity": 0.7, "gradient": ["#B9F2FF", "#7DF9FF", "#00BFFF"]}', 25),
  ('Legend', '{"borderColor": "#FF4500", "borderWidth": 5, "shadowColor": "#FF4500", "shadowOpacity": 0.8, "gradient": ["#FF4500", "#FFD700", "#FF4500"], "animated": true}', 30)
ON CONFLICT DO NOTHING;

-- Seed default profile icons (emojis for simplicity)
INSERT INTO profile_icons (name, icon_url, unlock_type, unlock_level) VALUES
  -- Default icons (level 1)
  ('Basketball', '🏀', 'default', NULL),
  ('Football', '⚽', 'default', NULL),
  ('Star', '⭐', 'default', NULL),
  ('Fire', '🔥', 'default', NULL),

  -- Level-based icons
  ('Trophy', '🏆', 'level', 5),
  ('Medal', '🥇', 'level', 10),
  ('Crown', '👑', 'level', 15),
  ('Lightning', '⚡', 'level', 20),
  ('Diamond', '💎', 'level', 25),
  ('Rocket', '🚀', 'level', 30)
ON CONFLICT DO NOTHING;

-- Add achievement-based icons (link to existing achievements)
-- First Victory achievement icon
INSERT INTO profile_icons (name, icon_url, unlock_type, unlock_achievement_id)
SELECT 'Champion', '🎯', 'achievement', id FROM achievements WHERE name = 'First Victory'
ON CONFLICT DO NOTHING;

-- Week Warrior achievement icon
INSERT INTO profile_icons (name, icon_url, unlock_type, unlock_achievement_id)
SELECT 'Streak Master', '🔥', 'achievement', id FROM achievements WHERE name = 'Week Warrior'
ON CONFLICT DO NOTHING;

-- Perfect Game achievement icon
INSERT INTO profile_icons (name, icon_url, unlock_type, unlock_achievement_id)
SELECT 'Perfection', '💯', 'achievement', id FROM achievements WHERE name = 'Perfect Game'
ON CONFLICT DO NOTHING;

-- Duel Champion achievement icon
INSERT INTO profile_icons (name, icon_url, unlock_type, unlock_achievement_id)
SELECT 'Duel Master', '⚔️', 'achievement', id FROM achievements WHERE name = 'Duel Champion'
ON CONFLICT DO NOTHING;
