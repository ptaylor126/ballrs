-- League invites table for in-app league invitations
CREATE TABLE IF NOT EXISTS league_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  inviter_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  invitee_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  UNIQUE(league_id, invitee_id)
);

-- RLS policies
ALTER TABLE league_invites ENABLE ROW LEVEL SECURITY;

-- Users can view invites they sent or received
CREATE POLICY "Users can view their invites" ON league_invites
  FOR SELECT USING (inviter_id = auth.uid() OR invitee_id = auth.uid());

-- Users can create invites (as inviter)
CREATE POLICY "Users can create invites" ON league_invites
  FOR INSERT WITH CHECK (inviter_id = auth.uid());

-- Users can update invites they received (to accept/decline)
CREATE POLICY "Users can respond to invites" ON league_invites
  FOR UPDATE USING (invitee_id = auth.uid());

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_league_invites_invitee ON league_invites(invitee_id, status);
CREATE INDEX IF NOT EXISTS idx_league_invites_league ON league_invites(league_id);
