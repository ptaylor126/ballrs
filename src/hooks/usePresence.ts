import { useState, useEffect } from 'react';
import { subscribeToPresence, getOnlineUsers } from '../lib/presenceService';

/**
 * Hook to subscribe to real-time presence updates
 * Returns a Set of online user IDs that updates in real-time
 */
export function usePresence(): Set<string> {
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(() => getOnlineUsers());

  useEffect(() => {
    // Subscribe to presence changes
    const unsubscribe = subscribeToPresence((users) => {
      setOnlineUsers(users);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return onlineUsers;
}

/**
 * Hook to check if a specific user is online
 * Returns true if the user is currently online
 */
export function useIsUserOnline(userId: string): boolean {
  const onlineUsers = usePresence();
  return onlineUsers.has(userId);
}

export default usePresence;
