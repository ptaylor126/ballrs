import { supabase } from './supabase';

// Types
export interface BlockedUser {
  id: string;
  blockedId: string;
  username: string;
  createdAt: string;
}

/**
 * Check if either user has blocked the other
 * Returns true if there's a block in either direction
 * Returns false if table doesn't exist or on error (fail-open for friend requests)
 */
export async function isBlocked(userId1: string, userId2: string): Promise<boolean> {
  console.log('[isBlocked] Checking block status between:', userId1, 'and', userId2);

  try {
    const { data, error } = await supabase
      .from('blocked_users')
      .select('id')
      .or(`and(blocker_id.eq.${userId1},blocked_id.eq.${userId2}),and(blocker_id.eq.${userId2},blocked_id.eq.${userId1})`)
      .limit(1);

    console.log('[isBlocked] Query result - data:', data, 'error:', error);

    if (error) {
      // If table doesn't exist or any error, fail-open (allow the action)
      console.log('[isBlocked] Error checking block status (failing open):', error.message);
      return false;
    }

    const blocked = (data?.length ?? 0) > 0;
    console.log('[isBlocked] Result:', blocked);
    return blocked;
  } catch (err) {
    console.log('[isBlocked] Exception (failing open):', err);
    return false;
  }
}

/**
 * Block a user
 * Also removes friendship and cancels pending interactions
 */
export async function blockUser(
  blockerId: string,
  blockedId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Insert into blocked_users
    const { error: blockError } = await supabase
      .from('blocked_users')
      .insert({
        blocker_id: blockerId,
        blocked_id: blockedId,
      });

    if (blockError) {
      // Check if already blocked (unique constraint violation)
      if (blockError.code === '23505') {
        return { success: false, error: 'already_blocked' };
      }
      console.error('Error blocking user:', blockError);
      return { success: false, error: 'block_failed' };
    }

    // 2. Remove friendship if exists (both directions)
    const { error: friendError1 } = await supabase
      .from('friends')
      .delete()
      .eq('user_id', blockerId)
      .eq('friend_id', blockedId);

    const { error: friendError2 } = await supabase
      .from('friends')
      .delete()
      .eq('user_id', blockedId)
      .eq('friend_id', blockerId);

    if (friendError1) console.log('Note: Error removing friendship (1):', friendError1);
    if (friendError2) console.log('Note: Error removing friendship (2):', friendError2);

    // 3. Cancel pending friend requests between them
    const { error: requestError } = await supabase
      .from('friend_requests')
      .delete()
      .or(`and(sender_id.eq.${blockerId},receiver_id.eq.${blockedId}),and(sender_id.eq.${blockedId},receiver_id.eq.${blockerId})`)
      .eq('status', 'pending');

    if (requestError) console.log('Note: Error cancelling friend requests:', requestError);

    // 4. Cancel pending duels between them
    const { error: duelError } = await supabase
      .from('duels')
      .update({ status: 'cancelled' })
      .or(`and(player1_id.eq.${blockerId},player2_id.eq.${blockedId}),and(player1_id.eq.${blockedId},player2_id.eq.${blockerId})`)
      .in('status', ['waiting', 'active', 'invite', 'waiting_for_p2']);

    if (duelError) console.log('Note: Error cancelling duels:', duelError);

    return { success: true };
  } catch (err) {
    console.error('Exception blocking user:', err);
    return { success: false, error: 'unexpected_error' };
  }
}

/**
 * Unblock a user
 * Does not restore friendship - they would need to send a new friend request
 */
export async function unblockUser(blockerId: string, blockedId: string): Promise<boolean> {
  const { error } = await supabase
    .from('blocked_users')
    .delete()
    .eq('blocker_id', blockerId)
    .eq('blocked_id', blockedId);

  if (error) {
    console.error('Error unblocking user:', error);
    return false;
  }

  return true;
}

/**
 * Get list of users blocked by the current user
 */
export async function getBlockedUsers(userId: string): Promise<BlockedUser[]> {
  const { data, error } = await supabase
    .from('blocked_users')
    .select(`
      id,
      blocked_id,
      created_at,
      profiles:blocked_id (username)
    `)
    .eq('blocker_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching blocked users:', error);
    return [];
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    blockedId: row.blocked_id,
    username: row.profiles?.username || 'Unknown',
    createdAt: row.created_at,
  }));
}

/**
 * Get IDs of all users blocked by or blocking the given user
 * Useful for filtering search results
 */
export async function getBlockedUserIds(userId: string): Promise<string[]> {
  // Get users this user has blocked
  const { data: blockedByMe, error: error1 } = await supabase
    .from('blocked_users')
    .select('blocked_id')
    .eq('blocker_id', userId);

  // Get users who have blocked this user
  const { data: blockedMe, error: error2 } = await supabase
    .from('blocked_users')
    .select('blocker_id')
    .eq('blocked_id', userId);

  if (error1) console.error('Error fetching blocked by me:', error1);
  if (error2) console.error('Error fetching blocked me:', error2);

  const blockedIds = new Set<string>();

  (blockedByMe || []).forEach((row: any) => blockedIds.add(row.blocked_id));
  (blockedMe || []).forEach((row: any) => blockedIds.add(row.blocker_id));

  return Array.from(blockedIds);
}
