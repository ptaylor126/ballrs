import { useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import {
  subscribeToFriendChallenges,
  unsubscribeFromFriendChallenges,
  clearPendingChallenge,
} from '../lib/friendsService';
import { getDuel, Duel } from '../lib/duelService';
import { RealtimeChannel } from '@supabase/supabase-js';

interface Props {
  onAcceptChallenge: (duel: Duel) => void;
}

export default function FriendChallengeListener({ onAcceptChallenge }: Props) {
  const { user } = useAuth();
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!user) return;

    channelRef.current = subscribeToFriendChallenges(
      user.id,
      async (friendshipId, duelId, challengerUsername) => {
        // Get the duel to check if it's still valid
        const duel = await getDuel(duelId);

        if (!duel || duel.status !== 'invite') {
          // Duel is no longer available, clear the pending challenge
          await clearPendingChallenge(friendshipId);
          return;
        }

        // Show alert to user
        Alert.alert(
          'Friend Challenge!',
          `${challengerUsername} has challenged you to a ${duel.sport === 'nba' ? 'NBA' : 'Premier League'} duel!`,
          [
            {
              text: 'Decline',
              style: 'cancel',
              onPress: async () => {
                await clearPendingChallenge(friendshipId);
              },
            },
            {
              text: 'Accept',
              onPress: async () => {
                await clearPendingChallenge(friendshipId);
                onAcceptChallenge(duel);
              },
            },
          ]
        );
      }
    );

    return () => {
      if (channelRef.current) {
        unsubscribeFromFriendChallenges(channelRef.current);
      }
    };
  }, [user, onAcceptChallenge]);

  // This component doesn't render anything
  return null;
}
