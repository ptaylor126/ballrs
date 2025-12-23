import { supabase } from './supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

export interface UserProfile {
  id: string;
  username: string;
}

export interface Friend {
  id: string;
  user_id: string;
  friend_id: string;
  created_at: string;
  pending_challenge_id: string | null;
  // Joined profile data
  friend_username?: string;
}

export interface FriendWithProfile {
  id: string;
  friendUserId: string;
  username: string;
  createdAt: string;
  pendingChallengeId: string | null;
}

// Check if error is "table not found" - friends table may not exist yet
function isTableNotFound(error: any): boolean {
  return error?.code === 'PGRST205' || error?.message?.includes('Could not find the table');
}

// Get all friends for a user with their profile info
export async function getFriends(userId: string): Promise<FriendWithProfile[]> {
  // Get friends where user is either user_id or friend_id
  const { data: friendships, error } = await supabase
    .from('friends')
    .select('*')
    .or(`user_id.eq.${userId},friend_id.eq.${userId}`);

  if (error) {
    if (!isTableNotFound(error)) {
      console.error('Error fetching friends:', error);
    }
    return [];
  }

  if (!friendships || friendships.length === 0) {
    return [];
  }

  // Get the friend's user IDs (the other person in each friendship)
  const friendUserIds = friendships.map(f =>
    f.user_id === userId ? f.friend_id : f.user_id
  );

  // Fetch profiles for all friends
  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('id, username')
    .in('id', friendUserIds);

  if (profileError) {
    console.error('Error fetching friend profiles:', profileError);
    return [];
  }

  // Map friendships to FriendWithProfile
  const profileMap = new Map(profiles?.map(p => [p.id, p.username]) || []);

  return friendships.map(f => {
    const friendUserId = f.user_id === userId ? f.friend_id : f.user_id;
    return {
      id: f.id,
      friendUserId,
      username: profileMap.get(friendUserId) || 'Unknown',
      createdAt: f.created_at,
      pendingChallengeId: f.pending_challenge_id,
    };
  }).sort((a, b) => a.username.localeCompare(b.username));
}

// Check if two users are already friends
export async function areFriends(userId1: string, userId2: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('friends')
    .select('id')
    .or(`and(user_id.eq.${userId1},friend_id.eq.${userId2}),and(user_id.eq.${userId2},friend_id.eq.${userId1})`)
    .limit(1);

  if (error) {
    if (!isTableNotFound(error)) {
      console.error('Error checking friendship:', error);
    }
    return false;
  }

  return (data?.length || 0) > 0;
}

// Add a friend (creates mutual friendship)
export async function addFriend(userId: string, friendId: string): Promise<boolean> {
  // Check if already friends
  const alreadyFriends = await areFriends(userId, friendId);
  if (alreadyFriends) {
    return true; // Already friends
  }

  // Add friendship (one direction is enough with our query logic)
  const { error } = await supabase
    .from('friends')
    .insert({
      user_id: userId,
      friend_id: friendId,
    });

  if (error) {
    if (!isTableNotFound(error)) {
      console.error('Error adding friend:', error);
    }
    return false;
  }

  return true;
}

// Remove a friend
export async function removeFriend(userId: string, friendId: string): Promise<boolean> {
  const { error } = await supabase
    .from('friends')
    .delete()
    .or(`and(user_id.eq.${userId},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${userId})`);

  if (error) {
    if (!isTableNotFound(error)) {
      console.error('Error removing friend:', error);
    }
    return false;
  }

  return true;
}

// Search users by username (for adding friends)
export async function searchUsersByUsername(
  query: string,
  currentUserId: string
): Promise<UserProfile[]> {
  if (!query.trim()) return [];

  const { data, error } = await supabase
    .from('profiles')
    .select('id, username')
    .ilike('username', `%${query}%`)
    .neq('id', currentUserId)
    .limit(10);

  if (error) {
    console.error('Error searching users:', error);
    return [];
  }

  return data || [];
}

// Get user by exact username
export async function getUserByUsername(username: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username')
    .ilike('username', username)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Not found
    }
    console.error('Error getting user:', error);
    return null;
  }

  return data;
}

// Set a pending challenge for a friend (notifies them via realtime)
export async function sendFriendChallenge(
  userId: string,
  friendId: string,
  duelId: string
): Promise<boolean> {
  // Find the friendship record
  const { data: friendship, error: findError } = await supabase
    .from('friends')
    .select('id')
    .or(`and(user_id.eq.${userId},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${userId})`)
    .single();

  if (findError || !friendship) {
    if (findError && !isTableNotFound(findError)) {
      console.error('Error finding friendship:', findError);
    }
    return false;
  }

  // Update the friendship with the pending challenge
  const { error } = await supabase
    .from('friends')
    .update({ pending_challenge_id: duelId })
    .eq('id', friendship.id);

  if (error) {
    if (!isTableNotFound(error)) {
      console.error('Error sending friend challenge:', error);
    }
    return false;
  }

  return true;
}

// Clear a pending challenge
export async function clearPendingChallenge(friendshipId: string): Promise<boolean> {
  const { error } = await supabase
    .from('friends')
    .update({ pending_challenge_id: null })
    .eq('id', friendshipId);

  if (error) {
    if (!isTableNotFound(error)) {
      console.error('Error clearing pending challenge:', error);
    }
    return false;
  }

  return true;
}

// Subscribe to friend challenges (when someone challenges you)
export function subscribeToFriendChallenges(
  userId: string,
  onChallenge: (friendshipId: string, duelId: string, challengerUsername: string) => void
): RealtimeChannel {
  const channel = supabase
    .channel(`friend-challenges:${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'friends',
        filter: `friend_id=eq.${userId}`,
      },
      async (payload) => {
        const newData = payload.new as Friend;
        if (newData.pending_challenge_id) {
          // Get the challenger's username
          const { data: profile } = await supabase
            .from('profiles')
            .select('username')
            .eq('id', newData.user_id)
            .single();

          onChallenge(
            newData.id,
            newData.pending_challenge_id,
            profile?.username || 'A friend'
          );
        }
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'friends',
        filter: `user_id=eq.${userId}`,
      },
      async (payload) => {
        const newData = payload.new as Friend;
        if (newData.pending_challenge_id) {
          // Get the challenger's username
          const { data: profile } = await supabase
            .from('profiles')
            .select('username')
            .eq('id', newData.friend_id)
            .single();

          onChallenge(
            newData.id,
            newData.pending_challenge_id,
            profile?.username || 'A friend'
          );
        }
      }
    )
    .subscribe();

  return channel;
}

// Unsubscribe from friend challenges
export function unsubscribeFromFriendChallenges(channel: RealtimeChannel) {
  supabase.removeChannel(channel);
}
