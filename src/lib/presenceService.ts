import { supabase } from './supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

// Presence state type
interface PresenceState {
  user_id: string;
  online_at: string;
}

// Store the presence channel globally
let presenceChannel: RealtimeChannel | null = null;
let currentUserId: string | null = null;

// Set of online user IDs (updated in real-time)
let onlineUsers: Set<string> = new Set();

// Callbacks for presence changes
type PresenceCallback = (onlineUserIds: Set<string>) => void;
const presenceCallbacks: Set<PresenceCallback> = new Set();

/**
 * Join the presence channel to broadcast online status
 */
export async function joinPresence(userId: string): Promise<void> {
  // If already joined with same user, skip
  if (presenceChannel && currentUserId === userId) {
    return;
  }

  // Leave existing channel if different user
  if (presenceChannel) {
    await leavePresence();
  }

  currentUserId = userId;

  // Create and subscribe to the presence channel
  presenceChannel = supabase.channel('online-users', {
    config: {
      presence: {
        key: userId,
      },
    },
  });

  presenceChannel
    .on('presence', { event: 'sync' }, () => {
      // Get all currently present users
      const state = presenceChannel?.presenceState() || {};
      onlineUsers = new Set(Object.keys(state));
      notifyCallbacks();
    })
    .on('presence', { event: 'join' }, ({ key }) => {
      onlineUsers.add(key);
      notifyCallbacks();
    })
    .on('presence', { event: 'leave' }, ({ key }) => {
      onlineUsers.delete(key);
      notifyCallbacks();
    })
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        // Track this user's presence
        await presenceChannel?.track({
          user_id: userId,
          online_at: new Date().toISOString(),
        });
      }
    });
}

/**
 * Leave the presence channel (call when app goes to background)
 */
export async function leavePresence(): Promise<void> {
  if (presenceChannel) {
    try {
      await presenceChannel.untrack();
    } catch (error) {
      console.log('Error untracking presence:', error);
    }
    try {
      await supabase.removeChannel(presenceChannel);
    } catch (error) {
      console.log('Error removing presence channel:', error);
    }
    presenceChannel = null;
    currentUserId = null;
    onlineUsers.clear();
    notifyCallbacks();
  }
}

/**
 * Check if a specific user is online
 */
export function isUserOnlinePresence(userId: string): boolean {
  return onlineUsers.has(userId);
}

/**
 * Get the set of online user IDs
 */
export function getOnlineUsers(): Set<string> {
  return new Set(onlineUsers);
}

/**
 * Subscribe to presence changes
 * Returns an unsubscribe function
 */
export function subscribeToPresence(callback: PresenceCallback): () => void {
  presenceCallbacks.add(callback);

  // Immediately call with current state
  callback(getOnlineUsers());

  return () => {
    presenceCallbacks.delete(callback);
  };
}

/**
 * Notify all callbacks of presence changes
 */
function notifyCallbacks(): void {
  const currentOnline = getOnlineUsers();
  presenceCallbacks.forEach(callback => {
    try {
      callback(currentOnline);
    } catch (error) {
      console.error('Error in presence callback:', error);
    }
  });
}

/**
 * Get the current presence channel (for debugging)
 */
export function getPresenceChannel(): RealtimeChannel | null {
  return presenceChannel;
}
