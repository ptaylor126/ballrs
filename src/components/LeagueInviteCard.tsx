import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { LeagueInviteWithDetails, acceptLeagueInvite, declineLeagueInvite } from '../lib/leagueInvitesService';
import { useAuth } from '../contexts/AuthContext';
import { colors, spacing } from '../lib/theme';

interface Props {
  invite: LeagueInviteWithDetails;
  onResponded: () => void;
}

export default function LeagueInviteCard({ invite, onResponded }: Props) {
  const { user } = useAuth();
  const [isAccepting, setIsAccepting] = useState(false);
  const [isDeclining, setIsDeclining] = useState(false);

  const handleAccept = async () => {
    if (!user) return;
    setIsAccepting(true);
    const success = await acceptLeagueInvite(invite.id, user.id);
    setIsAccepting(false);
    if (success) {
      onResponded();
    }
  };

  const handleDecline = async () => {
    if (!user) return;
    setIsDeclining(true);
    const success = await declineLeagueInvite(invite.id, user.id);
    setIsDeclining(false);
    if (success) {
      onResponded();
    }
  };

  const isProcessing = isAccepting || isDeclining;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.inviteLabel}>LEAGUE INVITE</Text>
      </View>
      <View style={styles.content}>
        <Text style={styles.leagueName} numberOfLines={1}>
          {invite.league_name}
        </Text>
        <Text style={styles.inviterText}>
          from {invite.inviter_username}
        </Text>
        <View style={styles.buttons}>
          <TouchableOpacity
            style={styles.declineButton}
            onPress={handleDecline}
            disabled={isProcessing}
          >
            {isDeclining ? (
              <ActivityIndicator size="small" color="#666666" />
            ) : (
              <Text style={styles.declineButtonText}>Decline</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.acceptButton}
            onPress={handleAccept}
            disabled={isProcessing}
          >
            {isAccepting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.acceptButtonText}>Join</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#000000',
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  header: {
    backgroundColor: '#1ABC9C',
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  inviteLabel: {
    fontSize: 10,
    fontFamily: 'DMSans_900Black',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  content: {
    padding: 12,
  },
  leagueName: {
    fontSize: 18,
    fontFamily: 'DMSans_700Bold',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  inviterText: {
    fontSize: 13,
    fontFamily: 'DMSans_500Medium',
    color: '#666666',
    marginBottom: 12,
  },
  buttons: {
    flexDirection: 'row',
    gap: 8,
  },
  declineButton: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#CCCCCC',
    alignItems: 'center',
  },
  declineButtonText: {
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
    color: '#666666',
  },
  acceptButton: {
    flex: 1,
    backgroundColor: '#1ABC9C',
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#000000',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  acceptButtonText: {
    fontSize: 14,
    fontFamily: 'DMSans_900Black',
    color: '#FFFFFF',
  },
});
