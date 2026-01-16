import { supabase } from './supabase';

export interface LeagueInvite {
  id: string;
  league_id: string;
  inviter_id: string;
  invitee_id: string;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
  responded_at: string | null;
}

export interface LeagueInviteWithDetails extends LeagueInvite {
  league_name: string;
  league_invite_code: string;
  inviter_username: string;
}

// Send a league invite to a friend
export async function sendLeagueInvite(
  leagueId: string,
  inviterId: string,
  inviteeId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Check if invite already exists
    const { data: existing } = await supabase
      .from('league_invites')
      .select('id, status')
      .eq('league_id', leagueId)
      .eq('invitee_id', inviteeId)
      .single();

    if (existing) {
      if (existing.status === 'pending') {
        return { success: false, error: 'already_invited' };
      }
      // If previously declined, allow re-invite by updating
      if (existing.status === 'declined') {
        const { error } = await supabase
          .from('league_invites')
          .update({ status: 'pending', responded_at: null, created_at: new Date().toISOString() })
          .eq('id', existing.id);

        if (error) {
          console.error('Error re-inviting:', error);
          return { success: false, error: 'failed' };
        }
        return { success: true };
      }
      // Already accepted - they're already a member
      return { success: false, error: 'already_member' };
    }

    // Check if user is already a member
    const { data: membership } = await supabase
      .from('league_members')
      .select('id')
      .eq('league_id', leagueId)
      .eq('user_id', inviteeId)
      .single();

    if (membership) {
      return { success: false, error: 'already_member' };
    }

    // Create new invite
    const { error } = await supabase
      .from('league_invites')
      .insert({
        league_id: leagueId,
        inviter_id: inviterId,
        invitee_id: inviteeId,
        status: 'pending',
      });

    if (error) {
      console.error('Error sending league invite:', error);
      return { success: false, error: 'failed' };
    }

    return { success: true };
  } catch (err) {
    console.error('Error in sendLeagueInvite:', err);
    return { success: false, error: 'failed' };
  }
}

// Get pending league invites for a user
export async function getPendingLeagueInvites(userId: string): Promise<LeagueInviteWithDetails[]> {
  try {
    const { data, error } = await supabase
      .from('league_invites')
      .select('*')
      .eq('invitee_id', userId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching league invites:', error);
      return [];
    }

    if (!data || data.length === 0) {
      return [];
    }

    // Fetch league and inviter details
    const leagueIds = [...new Set(data.map(i => i.league_id))];
    const inviterIds = [...new Set(data.map(i => i.inviter_id))];

    const [leaguesResult, profilesResult] = await Promise.all([
      supabase.from('leagues').select('id, name, invite_code').in('id', leagueIds),
      supabase.from('profiles').select('id, username').in('id', inviterIds),
    ]);

    const leaguesMap = new Map(
      (leaguesResult.data || []).map(l => [l.id, l])
    );
    const profilesMap = new Map(
      (profilesResult.data || []).map(p => [p.id, p])
    );

    return data.map(invite => {
      const league = leaguesMap.get(invite.league_id);
      const inviter = profilesMap.get(invite.inviter_id);
      return {
        ...invite,
        league_name: league?.name || 'Unknown League',
        league_invite_code: league?.invite_code || '',
        inviter_username: inviter?.username || 'Unknown',
      };
    });
  } catch (err) {
    console.error('Error in getPendingLeagueInvites:', err);
    return [];
  }
}

// Get count of pending league invites
export async function getPendingLeagueInvitesCount(userId: string): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('league_invites')
      .select('*', { count: 'exact', head: true })
      .eq('invitee_id', userId)
      .eq('status', 'pending');

    if (error) {
      console.error('Error fetching invite count:', error);
      return 0;
    }

    return count || 0;
  } catch (err) {
    console.error('Error in getPendingLeagueInvitesCount:', err);
    return 0;
  }
}

// Accept a league invite
export async function acceptLeagueInvite(inviteId: string, userId: string): Promise<boolean> {
  try {
    // Get the invite details
    const { data: invite, error: fetchError } = await supabase
      .from('league_invites')
      .select('league_id')
      .eq('id', inviteId)
      .eq('invitee_id', userId)
      .single();

    if (fetchError || !invite) {
      console.error('Error fetching invite:', fetchError);
      return false;
    }

    // Add user to league
    const { error: memberError } = await supabase
      .from('league_members')
      .insert({
        league_id: invite.league_id,
        user_id: userId,
      });

    if (memberError) {
      // Check if already a member (might have joined via code)
      if (memberError.code === '23505') {
        // Already a member, just update invite status
      } else {
        console.error('Error adding to league:', memberError);
        return false;
      }
    }

    // Update invite status
    const { error: updateError } = await supabase
      .from('league_invites')
      .update({ status: 'accepted', responded_at: new Date().toISOString() })
      .eq('id', inviteId);

    if (updateError) {
      console.error('Error updating invite:', updateError);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Error in acceptLeagueInvite:', err);
    return false;
  }
}

// Decline a league invite
export async function declineLeagueInvite(inviteId: string, userId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('league_invites')
      .update({ status: 'declined', responded_at: new Date().toISOString() })
      .eq('id', inviteId)
      .eq('invitee_id', userId);

    if (error) {
      console.error('Error declining invite:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Error in declineLeagueInvite:', err);
    return false;
  }
}
