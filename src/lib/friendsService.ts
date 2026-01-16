import { supabase } from './supabase';
import { RealtimeChannel } from '@supabase/supabase-js';
import { sendFriendRequestNotification, sendFriendAcceptedNotification } from './notificationService';
import { isBlocked } from './blockService';

// Helper to verify the current user matches the provided userId
async function verifyAuthUser(expectedUserId: string): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id === expectedUserId;
}

export interface UserProfile {
  id: string;
  username: string;
  icon_url: string | null;
}

// Friend Request types
export interface FriendRequest {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
}

export interface FriendRequestWithProfile extends FriendRequest {
  senderUsername: string;
  receiverUsername: string;
  senderIconUrl: string | null;
  receiverIconUrl: string | null;
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
  icon_url: string | null;
}

// Extended interface with online status
export interface FriendWithOnlineStatus extends FriendWithProfile {
  lastActive: string | null;
  isOnline: boolean;
  country: string | null;
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

  // Fetch user_stats to get selected_icon_id for each friend
  const { data: statsData } = await supabase
    .from('user_stats')
    .select('id, selected_icon_id')
    .in('id', friendUserIds);

  // Get icon_urls for friends with selected icons
  const iconIds = (statsData || [])
    .map((s: any) => s.selected_icon_id)
    .filter((id): id is string => id != null);

  let iconsMap = new Map<string, string>();
  if (iconIds.length > 0) {
    const { data: iconsData } = await supabase
      .from('profile_icons')
      .select('id, icon_url')
      .in('id', iconIds);

    if (iconsData) {
      iconsMap = new Map(iconsData.map((i: any) => [i.id, i.icon_url]));
    }
  }

  // Create a map of user_id to icon_url
  const userIconMap = new Map<string, string>();
  (statsData || []).forEach((s: any) => {
    if (s.selected_icon_id && iconsMap.has(s.selected_icon_id)) {
      userIconMap.set(s.id, iconsMap.get(s.selected_icon_id)!);
    }
  });

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
      icon_url: userIconMap.get(friendUserId) || null,
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
  // Security: Verify the userId matches the authenticated user
  const isAuthorized = await verifyAuthUser(userId);
  if (!isAuthorized) {
    console.error('Unauthorized: User ID does not match authenticated user');
    return false;
  }

  // Delete friendship in both directions
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

  if (!data || data.length === 0) return [];

  // Get icon_urls for search results
  const userIds = data.map((u: any) => u.id);
  const { data: statsData } = await supabase
    .from('user_stats')
    .select('id, selected_icon_id')
    .in('id', userIds);

  const iconIds = (statsData || [])
    .map((s: any) => s.selected_icon_id)
    .filter((id): id is string => id != null);

  let iconsMap = new Map<string, string>();
  if (iconIds.length > 0) {
    const { data: iconsData } = await supabase
      .from('profile_icons')
      .select('id, icon_url')
      .in('id', iconIds);

    if (iconsData) {
      iconsMap = new Map(iconsData.map((i: any) => [i.id, i.icon_url]));
    }
  }

  const userIconMap = new Map<string, string>();
  (statsData || []).forEach((s: any) => {
    if (s.selected_icon_id && iconsMap.has(s.selected_icon_id)) {
      userIconMap.set(s.id, iconsMap.get(s.selected_icon_id)!);
    }
  });

  return data.map((u: any) => ({
    ...u,
    icon_url: userIconMap.get(u.id) || null,
  }));
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

  if (!data) return null;

  // Get icon_url for this user
  const { data: statsData } = await supabase
    .from('user_stats')
    .select('selected_icon_id')
    .eq('id', data.id)
    .single();

  let icon_url = null;
  if (statsData?.selected_icon_id) {
    const { data: iconData } = await supabase
      .from('profile_icons')
      .select('icon_url')
      .eq('id', statsData.selected_icon_id)
      .single();
    icon_url = iconData?.icon_url || null;
  }

  return { ...data, icon_url };
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

// ============================================
// ONLINE STATUS FUNCTIONS
// ============================================

// Check if a user is online (active within last 5 minutes)
export function isUserOnline(lastActive: string | null): boolean {
  if (!lastActive) return false;

  const lastActiveTime = new Date(lastActive).getTime();
  const now = Date.now();
  const fiveMinutesMs = 5 * 60 * 1000;

  return (now - lastActiveTime) < fiveMinutesMs;
}

// ============================================
// FRIEND REQUEST FUNCTIONS
// ============================================

// Send a friend request
export async function sendFriendRequest(senderId: string, receiverId: string): Promise<{ success: boolean; error?: string }> {
  // Check if already friends
  const alreadyFriends = await areFriends(senderId, receiverId);
  if (alreadyFriends) {
    return { success: false, error: 'already_friends' };
  }

  // Check if either user has blocked the other
  const blocked = await isBlocked(senderId, receiverId);
  if (blocked) {
    return { success: false, error: 'cannot_send_request' };
  }

  // Check if any request already exists (either direction, any status)
  const { data: existingRequests, error: checkError } = await supabase
    .from('friend_requests')
    .select('id, status, sender_id')
    .or(`and(sender_id.eq.${senderId},receiver_id.eq.${receiverId}),and(sender_id.eq.${receiverId},receiver_id.eq.${senderId})`);

  if (checkError && !isTableNotFound(checkError)) {
    console.error('Error checking existing request:', checkError);
    return { success: false, error: 'check_failed' };
  }

  if (existingRequests && existingRequests.length > 0) {
    // Check for pending request from them to us (auto-accept)
    const pendingFromThem = existingRequests.find(r => r.status === 'pending' && r.sender_id === receiverId);
    if (pendingFromThem) {
      const accepted = await acceptFriendRequest(pendingFromThem.id, senderId);
      return accepted ? { success: true } : { success: false, error: 'accept_failed' };
    }

    // Check for pending request from us to them
    const pendingFromUs = existingRequests.find(r => r.status === 'pending' && r.sender_id === senderId);
    if (pendingFromUs) {
      return { success: false, error: 'already_pending' };
    }

    // Check for declined request - update it back to pending
    const declinedRequest = existingRequests.find(r => r.status === 'declined');
    if (declinedRequest) {
      const { error: updateError } = await supabase
        .from('friend_requests')
        .update({ status: 'pending', sender_id: senderId, receiver_id: receiverId })
        .eq('id', declinedRequest.id);

      if (updateError) {
        console.error('Error updating declined request:', updateError);
        return { success: false, error: 'update_failed' };
      }
      return { success: true };
    }

    // If there are existing requests but none are pending or declined, they might be stale 'accepted' records
    // Clean them up and allow a new request
    const staleRequests = existingRequests.filter(r => r.status === 'accepted');
    if (staleRequests.length > 0) {
      // Delete stale accepted requests (friendship should exist in friends table, not here)
      await supabase
        .from('friend_requests')
        .delete()
        .in('id', staleRequests.map(r => r.id));
      // Continue to create a new request below
    } else {
      // Unknown state - shouldn't happen
      return { success: false, error: 'already_friends' };
    }
  }

  // Create the friend request
  const { data: newRequest, error } = await supabase
    .from('friend_requests')
    .insert({
      sender_id: senderId,
      receiver_id: receiverId,
      status: 'pending',
    })
    .select('id')
    .single();

  if (error) {
    if (!isTableNotFound(error)) {
      console.error('Error sending friend request:', error);
    }
    return { success: false, error: 'insert_failed' };
  }

  // Send notification to the receiver
  if (newRequest) {
    try {
      // Get sender's username
      const { data: senderProfile } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', senderId)
        .single();

      const senderUsername = senderProfile?.username || 'Someone';

      // Send notification asynchronously (don't block on it)
      sendFriendRequestNotification(
        receiverId,
        senderUsername,
        newRequest.id,
        senderId
      ).catch(err => console.log('Failed to send friend request notification:', err));
    } catch (notifError) {
      console.log('Error preparing friend request notification:', notifError);
    }
  }

  return { success: true };
}

// Get pending friend requests received by user
export async function getPendingFriendRequests(userId: string): Promise<FriendRequestWithProfile[]> {
  const { data: requests, error } = await supabase
    .from('friend_requests')
    .select('*')
    .eq('receiver_id', userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) {
    if (!isTableNotFound(error)) {
      console.error('Error fetching friend requests:', error);
    }
    return [];
  }

  if (!requests || requests.length === 0) {
    return [];
  }

  // Get sender profiles
  const senderIds = requests.map(r => r.sender_id);
  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('id, username')
    .in('id', senderIds);

  if (profileError) {
    console.error('Error fetching sender profiles:', profileError);
    return [];
  }

  // Get icon_urls for senders
  const { data: statsData } = await supabase
    .from('user_stats')
    .select('id, selected_icon_id')
    .in('id', senderIds);

  const iconIds = (statsData || [])
    .map((s: any) => s.selected_icon_id)
    .filter((id): id is string => id != null);

  let iconsMap = new Map<string, string>();
  if (iconIds.length > 0) {
    const { data: iconsData } = await supabase
      .from('profile_icons')
      .select('id, icon_url')
      .in('id', iconIds);

    if (iconsData) {
      iconsMap = new Map(iconsData.map((i: any) => [i.id, i.icon_url]));
    }
  }

  const userIconMap = new Map<string, string>();
  (statsData || []).forEach((s: any) => {
    if (s.selected_icon_id && iconsMap.has(s.selected_icon_id)) {
      userIconMap.set(s.id, iconsMap.get(s.selected_icon_id)!);
    }
  });

  const profileMap = new Map(profiles?.map(p => [p.id, p.username]) || []);

  return requests.map(r => ({
    ...r,
    senderUsername: profileMap.get(r.sender_id) || 'Unknown',
    receiverUsername: '', // Not needed for received requests
    senderIconUrl: userIconMap.get(r.sender_id) || null,
    receiverIconUrl: null,
  }));
}

// Get count of pending friend requests
export async function getPendingFriendRequestsCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('friend_requests')
    .select('*', { count: 'exact', head: true })
    .eq('receiver_id', userId)
    .eq('status', 'pending');

  if (error) {
    if (!isTableNotFound(error)) {
      console.error('Error counting friend requests:', error);
    }
    return 0;
  }

  return count || 0;
}

// Accept a friend request
export async function acceptFriendRequest(requestId: string, receiverId: string): Promise<boolean> {
  // Security: Verify the receiverId matches the authenticated user
  const isAuthorized = await verifyAuthUser(receiverId);
  if (!isAuthorized) {
    console.error('Unauthorized: User ID does not match authenticated user');
    return false;
  }

  // Get the request to find the sender
  const { data: request, error: fetchError } = await supabase
    .from('friend_requests')
    .select('sender_id, receiver_id')
    .eq('id', requestId)
    .eq('receiver_id', receiverId)
    .single();

  if (fetchError || !request) {
    console.error('Error fetching friend request:', fetchError);
    return false;
  }

  // Update request status to accepted
  const { error: updateError } = await supabase
    .from('friend_requests')
    .update({ status: 'accepted' })
    .eq('id', requestId);

  if (updateError) {
    console.error('Error updating friend request:', updateError);
    return false;
  }

  // Create the friendship
  const friendshipCreated = await addFriend(request.sender_id, request.receiver_id);
  if (!friendshipCreated) {
    console.error('Error creating friendship');
    return false;
  }

  // Send notification to the original sender that their request was accepted
  try {
    // Get accepter's username (the receiver)
    const { data: accepterProfile } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', receiverId)
      .single();

    const accepterUsername = accepterProfile?.username || 'Someone';

    // Send notification asynchronously (don't block on it)
    sendFriendAcceptedNotification(
      request.sender_id,
      accepterUsername,
      receiverId
    ).catch(err => console.log('Failed to send friend accepted notification:', err));
  } catch (notifError) {
    console.log('Error preparing friend accepted notification:', notifError);
  }

  return true;
}

// Decline a friend request
export async function declineFriendRequest(requestId: string, receiverId: string): Promise<boolean> {
  // Security: Verify the receiverId matches the authenticated user
  const isAuthorized = await verifyAuthUser(receiverId);
  if (!isAuthorized) {
    console.error('Unauthorized: User ID does not match authenticated user');
    return false;
  }

  const { error } = await supabase
    .from('friend_requests')
    .delete()
    .eq('id', requestId)
    .eq('receiver_id', receiverId);

  if (error) {
    console.error('Error declining friend request:', error);
    return false;
  }

  return true;
}

// Get outgoing (sent) friend requests
export async function getSentFriendRequests(userId: string): Promise<FriendRequestWithProfile[]> {
  const { data: requests, error } = await supabase
    .from('friend_requests')
    .select('*')
    .eq('sender_id', userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) {
    if (!isTableNotFound(error)) {
      console.error('Error fetching sent friend requests:', error);
    }
    return [];
  }

  if (!requests || requests.length === 0) {
    return [];
  }

  // Get receiver profiles
  const receiverIds = requests.map(r => r.receiver_id);
  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('id, username')
    .in('id', receiverIds);

  if (profileError) {
    console.error('Error fetching receiver profiles:', profileError);
    return [];
  }

  // Get icon_urls for receivers
  const { data: statsData } = await supabase
    .from('user_stats')
    .select('id, selected_icon_id')
    .in('id', receiverIds);

  const iconIds = (statsData || [])
    .map((s: any) => s.selected_icon_id)
    .filter((id): id is string => id != null);

  let iconsMap = new Map<string, string>();
  if (iconIds.length > 0) {
    const { data: iconsData } = await supabase
      .from('profile_icons')
      .select('id, icon_url')
      .in('id', iconIds);

    if (iconsData) {
      iconsMap = new Map(iconsData.map((i: any) => [i.id, i.icon_url]));
    }
  }

  const userIconMap = new Map<string, string>();
  (statsData || []).forEach((s: any) => {
    if (s.selected_icon_id && iconsMap.has(s.selected_icon_id)) {
      userIconMap.set(s.id, iconsMap.get(s.selected_icon_id)!);
    }
  });

  const profileMap = new Map(profiles?.map(p => [p.id, p.username]) || []);

  return requests.map(r => ({
    ...r,
    senderUsername: '', // Not needed for sent requests
    receiverUsername: profileMap.get(r.receiver_id) || 'Unknown',
    senderIconUrl: null,
    receiverIconUrl: userIconMap.get(r.receiver_id) || null,
  }));
}

// Cancel a sent friend request
export async function cancelFriendRequest(requestId: string, senderId: string): Promise<boolean> {
  const { error } = await supabase
    .from('friend_requests')
    .delete()
    .eq('id', requestId)
    .eq('sender_id', senderId);

  if (error) {
    console.error('Error canceling friend request:', error);
    return false;
  }

  return true;
}

// Check if there's a pending request between two users
export async function hasPendingRequest(userId1: string, userId2: string): Promise<{ pending: boolean; sentByMe: boolean }> {
  const { data, error } = await supabase
    .from('friend_requests')
    .select('sender_id')
    .or(`and(sender_id.eq.${userId1},receiver_id.eq.${userId2}),and(sender_id.eq.${userId2},receiver_id.eq.${userId1})`)
    .eq('status', 'pending')
    .maybeSingle();

  if (error || !data) {
    return { pending: false, sentByMe: false };
  }

  return { pending: true, sentByMe: data.sender_id === userId1 };
}

// Subscribe to friend requests (for real-time badge updates)
export function subscribeToFriendRequests(
  userId: string,
  onRequestReceived: (count: number) => void
): RealtimeChannel {
  const channel = supabase
    .channel(`friend-requests:${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'friend_requests',
        filter: `receiver_id=eq.${userId}`,
      },
      async () => {
        // Re-fetch count when any change happens
        const count = await getPendingFriendRequestsCount(userId);
        onRequestReceived(count);
      }
    )
    .subscribe();

  return channel;
}

// Unsubscribe from friend requests
export function unsubscribeFromFriendRequests(channel: RealtimeChannel) {
  supabase.removeChannel(channel);
}

// Get friends with online status and country
export async function getFriendsWithOnlineStatus(userId: string): Promise<FriendWithOnlineStatus[]> {
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

  // Fetch profiles with last_active and country for all friends
  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('id, username, last_active, country')
    .in('id', friendUserIds);

  if (profileError) {
    console.error('Error fetching friend profiles:', profileError);
    return [];
  }

  // Fetch user_stats to get selected_icon_id for each friend
  const { data: statsData } = await supabase
    .from('user_stats')
    .select('id, selected_icon_id')
    .in('id', friendUserIds);

  // Get icon_urls for friends with selected icons
  const iconIds = (statsData || [])
    .map((s: any) => s.selected_icon_id)
    .filter((id): id is string => id != null);

  let iconsMap = new Map<string, string>();
  if (iconIds.length > 0) {
    const { data: iconsData } = await supabase
      .from('profile_icons')
      .select('id, icon_url')
      .in('id', iconIds);

    if (iconsData) {
      iconsMap = new Map(iconsData.map((i: any) => [i.id, i.icon_url]));
    }
  }

  // Create a map of user_id to icon_url
  const userIconMap = new Map<string, string>();
  (statsData || []).forEach((s: any) => {
    if (s.selected_icon_id && iconsMap.has(s.selected_icon_id)) {
      userIconMap.set(s.id, iconsMap.get(s.selected_icon_id)!);
    }
  });

  // Map friendships to FriendWithOnlineStatus
  const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

  return friendships.map(f => {
    const friendUserId = f.user_id === userId ? f.friend_id : f.user_id;
    const profile = profileMap.get(friendUserId);
    const lastActive = profile?.last_active || null;

    return {
      id: f.id,
      friendUserId,
      username: profile?.username || 'Unknown',
      createdAt: f.created_at,
      pendingChallengeId: f.pending_challenge_id,
      icon_url: userIconMap.get(friendUserId) || null,
      lastActive,
      isOnline: isUserOnline(lastActive),
      country: profile?.country || null,
    };
  }).sort((a, b) => {
    // Sort online users first, then alphabetically
    if (a.isOnline !== b.isOnline) {
      return a.isOnline ? -1 : 1;
    }
    return a.username.localeCompare(b.username);
  });
}
