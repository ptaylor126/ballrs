import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { getFriends, FriendWithProfile } from '../lib/friendsService';
import { sendLeagueInvite } from '../lib/leagueInvitesService';
import { colors, borders, borderRadius, typography, spacing, shadows } from '../lib/theme';
import UserProfileIcon from './UserProfileIcon';

interface Props {
  visible: boolean;
  onClose: () => void;
  leagueId: string;
  leagueName: string;
}

export default function InviteToLeagueModal({ visible, onClose, leagueId, leagueName }: Props) {
  const { user } = useAuth();
  const [friends, setFriends] = useState<FriendWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [invitingFriendId, setInvitingFriendId] = useState<string | null>(null);
  const [invitedFriends, setInvitedFriends] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (visible && user) {
      loadFriends();
      // Reset invited friends when modal opens
      setInvitedFriends(new Set());
    }
  }, [visible, user]);

  const loadFriends = async () => {
    if (!user) return;
    setLoading(true);
    const friendsList = await getFriends(user.id);
    setFriends(friendsList);
    setLoading(false);
  };

  const handleInviteFriend = async (friend: FriendWithProfile) => {
    if (!user) return;

    setInvitingFriendId(friend.friendUserId);

    const result = await sendLeagueInvite(leagueId, user.id, friend.friendUserId);

    if (result.success) {
      setInvitedFriends(prev => new Set(prev).add(friend.friendUserId));
    } else if (result.error === 'already_invited') {
      // Mark as already invited
      setInvitedFriends(prev => new Set(prev).add(friend.friendUserId));
    } else if (result.error === 'already_member') {
      // Already a member - could show a message but for now just mark as invited
      setInvitedFriends(prev => new Set(prev).add(friend.friendUserId));
    }

    setInvitingFriendId(null);
  };

  const renderFriendItem = ({ item }: { item: FriendWithProfile }) => {
    const isInvited = invitedFriends.has(item.friendUserId);
    const isInviting = invitingFriendId === item.friendUserId;

    return (
      <View style={styles.friendItem}>
        <UserProfileIcon
          iconUrl={item.icon_url}
          size={40}
          fallbackText={item.username}
        />
        <Text style={styles.friendName} numberOfLines={1}>
          {item.username}
        </Text>
        {isInvited ? (
          <View style={styles.invitedBadge}>
            <Text style={styles.invitedBadgeText}>INVITED</Text>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.inviteButton}
            onPress={() => handleInviteFriend(item)}
            disabled={isInviting || invitingFriendId !== null}
            activeOpacity={0.8}
          >
            {isInviting ? (
              <ActivityIndicator size="small" color="#1A1A1A" />
            ) : (
              <Text style={styles.inviteButtonText}>INVITE</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContent}>
          <Text style={styles.title}>Invite Friends</Text>
          <Text style={styles.subtitle}>
            Invite your friends to join "{leagueName}"
          </Text>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : friends.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No friends yet</Text>
              <Text style={styles.emptySubtext}>
                Add friends to invite them to your league
              </Text>
            </View>
          ) : (
            <FlatList
              data={friends}
              keyExtractor={(item) => item.friendUserId}
              renderItem={renderFriendItem}
              style={styles.friendsList}
              showsVerticalScrollIndicator={false}
            />
          )}

          <TouchableOpacity
            style={styles.doneButton}
            onPress={onClose}
          >
            <Text style={styles.doneButtonText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.card,
    borderWidth: borders.card,
    borderColor: colors.border,
    padding: spacing.lg,
    width: '100%',
    maxWidth: 360,
    maxHeight: '80%',
    ...shadows.card,
  },
  title: {
    fontSize: 24,
    fontFamily: 'DMSans_900Black',
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: 'DMSans_500Medium',
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    fontFamily: 'DMSans_700Bold',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  emptySubtext: {
    fontSize: 14,
    fontFamily: 'DMSans_500Medium',
    color: colors.textSecondary,
    textAlign: 'center',
  },
  friendsList: {
    maxHeight: 300,
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingRight: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E8',
  },
  friendName: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'DMSans_600SemiBold',
    color: colors.text,
    marginLeft: 12,
  },
  inviteButton: {
    backgroundColor: '#F2C94C',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#000000',
    minWidth: 80,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  inviteButtonText: {
    fontSize: 12,
    fontFamily: 'DMSans_900Black',
    color: '#1A1A1A',
  },
  invitedBadge: {
    backgroundColor: '#E8E8E8',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#CCCCCC',
    minWidth: 80,
    alignItems: 'center',
  },
  invitedBadgeText: {
    fontSize: 12,
    fontFamily: 'DMSans_700Bold',
    color: '#888888',
  },
  doneButton: {
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  doneButtonText: {
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
    color: colors.textSecondary,
  },
});
