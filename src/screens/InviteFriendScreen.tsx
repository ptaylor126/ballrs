import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Easing,
  Share,
  Alert,
  Image,
  ScrollView,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Duel, subscribeToDuel, unsubscribeFromDuel, cancelDuel } from '../lib/duelService';
import { getFriends, FriendWithProfile, sendFriendChallenge } from '../lib/friendsService';
import { sendChallengeNotification } from '../lib/notificationService';
import { useAuth } from '../contexts/AuthContext';
import { RealtimeChannel } from '@supabase/supabase-js';
import { getSportColor, Sport } from '../lib/theme';

// Sport icons
const sportIcons: Record<Sport, any> = {
  nba: require('../../assets/images/icon-basketball.png'),
  pl: require('../../assets/images/icon-soccer.png'),
  nfl: require('../../assets/images/icon-football.png'),
  mlb: require('../../assets/images/icon-baseball.png'),
};

const sportNames: Record<Sport, string> = {
  nba: 'NBA',
  pl: 'EPL',
  nfl: 'NFL',
  mlb: 'MLB',
};

interface Props {
  duel: Duel;
  sport: 'nba' | 'pl' | 'nfl' | 'mlb';
  onCancel: () => void;
  onOpponentJoined: (duel: Duel) => void;
}

export default function InviteFriendScreen({ duel, sport, onCancel, onOpponentJoined }: Props) {
  const { user } = useAuth();
  const channelRef = useRef<RealtimeChannel | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const [friends, setFriends] = useState<FriendWithProfile[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(true);
  const [selectedFriend, setSelectedFriend] = useState<FriendWithProfile | null>(null);
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [sendingChallenge, setSendingChallenge] = useState(false);
  const [myUsername, setMyUsername] = useState<string>('Someone');

  const sportColor = getSportColor(sport as Sport);

  // Fetch friends and my username on mount
  useEffect(() => {
    const loadData = async () => {
      if (!user) {
        setLoadingFriends(false);
        return;
      }

      // Load friends
      const friendsList = await getFriends(user.id);
      setFriends(friendsList);
      setLoadingFriends(false);

      // Load my username for notifications
      const { supabase } = await import('../lib/supabase');
      const { data: profile } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', user.id)
        .single();
      if (profile?.username) {
        setMyUsername(profile.username);
      }
    };
    loadData();
  }, [user]);

  useEffect(() => {
    // Start pulse animation
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();

    return () => pulse.stop();
  }, [pulseAnim]);

  useEffect(() => {
    // Subscribe to duel updates
    channelRef.current = subscribeToDuel(duel.id, (updatedDuel) => {
      if (updatedDuel.status === 'active' && updatedDuel.player2_id) {
        onOpponentJoined(updatedDuel);
      }
    });

    return () => {
      if (channelRef.current) {
        unsubscribeFromDuel(channelRef.current);
      }
    };
  }, [duel.id, onOpponentJoined]);

  const handleShare = async () => {
    const inviteCode = duel.invite_code;
    if (!inviteCode) return;

    try {
      await Share.share({
        message: `Think you can beat me at Ballrs trivia? Join my duel: ${inviteCode}\n\nballrs://duel/${inviteCode}`,
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to share invite');
    }
  };

  const handleCancel = async () => {
    await cancelDuel(duel.id);
    onCancel();
  };

  const handleFriendPress = (friend: FriendWithProfile) => {
    setSelectedFriend(friend);
    setConfirmModalVisible(true);
  };

  const handleConfirmChallenge = async () => {
    if (!selectedFriend || !user || !duel.invite_code) return;

    setSendingChallenge(true);

    // Send challenge via database (updates pending_challenge_id)
    const dbSuccess = await sendFriendChallenge(user.id, selectedFriend.friendUserId, duel.id);

    // Send push notification
    await sendChallengeNotification(
      selectedFriend.friendUserId,
      myUsername,
      sport,
      duel.invite_code
    );

    setSendingChallenge(false);
    setConfirmModalVisible(false);

    if (dbSuccess) {
      Alert.alert(
        'Challenge Sent!',
        `${selectedFriend.username} has been notified of your challenge.`
      );
    } else {
      Alert.alert(
        'Notification Sent',
        `${selectedFriend.username} has been notified. They can join with code: ${duel.invite_code}`
      );
    }
  };

  const handleCancelConfirm = () => {
    setSelectedFriend(null);
    setConfirmModalVisible(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Sport Icon */}
        <Animated.View style={[styles.iconContainer, { backgroundColor: sportColor, transform: [{ scale: pulseAnim }] }]}>
          <Image source={sportIcons[sport as Sport]} style={styles.sportIcon} />
        </Animated.View>

        <View style={[styles.sportBadge, { backgroundColor: sportColor }]}>
          <Image source={sportIcons[sport as Sport]} style={styles.sportBadgeIcon} resizeMode="contain" />
          <Text style={styles.sportBadgeText}>{sportNames[sport as Sport]}</Text>
        </View>
        <Text style={styles.title}>Challenge Friend</Text>

        {/* Invite Code Section */}
        <View style={styles.codeSection}>
          <Text style={styles.codeLabel}>YOUR INVITE CODE</Text>
          <View style={styles.codeBox}>
            <Text style={[styles.code, { color: sportColor }]}>
              {duel.invite_code || '------'}
            </Text>
          </View>
          <Text style={styles.codeHint}>Share this code with a friend</Text>
        </View>

        {/* Share Button */}
        <TouchableOpacity
          style={[styles.shareButton, { backgroundColor: sportColor }]}
          onPress={handleShare}
          activeOpacity={0.8}
        >
          <Text style={styles.shareButtonText}>Share Invite</Text>
        </TouchableOpacity>

        {/* Waiting Status */}
        <View style={styles.waitingContainer}>
          <ActivityIndicator size="small" color={sportColor} />
          <Text style={styles.waitingText}>Waiting for friend to join...</Text>
        </View>

        {/* How it works Card */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>How it works</Text>
          <Text style={styles.infoText}>
            Share the code with a friend or tap a friend below to send them a challenge notification.
          </Text>
        </View>

        {/* Friends List */}
        <View style={styles.friendsSection}>
          <Text style={styles.friendsSectionTitle}>CHALLENGE A FRIEND</Text>
          {loadingFriends ? (
            <ActivityIndicator size="small" color={sportColor} style={{ marginVertical: 20 }} />
          ) : friends.length === 0 ? (
            <View style={styles.noFriendsCard}>
              <Text style={styles.noFriendsText}>No friends yet</Text>
              <Text style={styles.noFriendsSubtext}>Add friends to challenge them directly</Text>
            </View>
          ) : (
            <View style={styles.friendsList}>
              {friends.map((friend) => (
                <TouchableOpacity
                  key={friend.id}
                  style={styles.friendCard}
                  onPress={() => handleFriendPress(friend)}
                  activeOpacity={0.8}
                >
                  <View style={styles.friendAvatar}>
                    <Text style={styles.friendAvatarText}>
                      {friend.username.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <Text style={styles.friendUsername}>{friend.username}</Text>
                  <Text style={styles.friendArrow}>→</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Cancel Button */}
        <TouchableOpacity style={styles.cancelButton} onPress={handleCancel} activeOpacity={0.8}>
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Confirm Challenge Modal */}
      <Modal
        visible={confirmModalVisible}
        transparent
        animationType="fade"
        onRequestClose={handleCancelConfirm}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={handleCancelConfirm}
        >
          <TouchableOpacity
            style={styles.modalContent}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={styles.modalTitle}>Challenge {selectedFriend?.username}?</Text>
            <Text style={styles.modalSubtitle}>
              They will receive a notification to join your {sportNames[sport as Sport]} trivia duel.
            </Text>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={handleCancelConfirm}
                disabled={sendingChallenge}
              >
                <Text style={styles.modalCancelText}>NO</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirmButton, { backgroundColor: sportColor }]}
                onPress={handleConfirmChallenge}
                disabled={sendingChallenge}
              >
                {sendingChallenge ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalConfirmText}>YES</Text>
                )}
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F2EB',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    padding: 24,
    paddingBottom: 120,
    alignItems: 'center',
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 3,
    borderColor: '#000000',
    shadowColor: '#000000',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  sportIcon: {
    width: 40,
    height: 40,
    tintColor: '#FFFFFF',
  },
  title: {
    fontSize: 24,
    fontFamily: 'DMSans_900Black',
    color: '#1A1A1A',
    marginTop: 12,
    marginBottom: 24,
  },
  sportBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#000000',
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  sportBadgeIcon: {
    width: 20,
    height: 20,
  },
  sportBadgeText: {
    fontSize: 14,
    fontFamily: 'DMSans_900Black',
    color: '#FFFFFF',
  },
  codeSection: {
    alignItems: 'center',
    marginBottom: 20,
    width: '100%',
  },
  codeLabel: {
    fontSize: 12,
    fontFamily: 'DMSans_900Black',
    color: '#888888',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  codeBox: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#000000',
    borderRadius: 8,
    paddingHorizontal: 32,
    paddingVertical: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  code: {
    fontSize: 32,
    fontFamily: 'DMSans_900Black',
    letterSpacing: 8,
  },
  codeHint: {
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
    color: '#888888',
    marginTop: 12,
  },
  shareButton: {
    paddingHorizontal: 48,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#000000',
    marginBottom: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  shareButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'DMSans_900Black',
  },
  waitingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  waitingText: {
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
    color: '#888888',
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    width: '100%',
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#000000',
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  infoTitle: {
    fontSize: 14,
    fontFamily: 'DMSans_900Black',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
    color: '#1A1A1A',
    lineHeight: 22,
  },
  cancelButton: {
    backgroundColor: '#F2C94C',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#000000',
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  cancelButtonText: {
    color: '#1A1A1A',
    fontSize: 12,
    fontFamily: 'DMSans_900Black',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  // Friends Section
  friendsSection: {
    width: '100%',
    marginBottom: 20,
  },
  friendsSectionTitle: {
    fontSize: 12,
    fontFamily: 'DMSans_900Black',
    color: '#888888',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  friendsList: {
    gap: 8,
  },
  friendCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#000000',
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  friendAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1A1A1A',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  friendAvatarText: {
    fontSize: 18,
    fontFamily: 'DMSans_900Black',
    color: '#FFFFFF',
  },
  friendUsername: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'DMSans_700Bold',
    color: '#1A1A1A',
  },
  friendArrow: {
    fontSize: 20,
    fontFamily: 'DMSans_700Bold',
    color: '#888888',
  },
  noFriendsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#000000',
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  noFriendsText: {
    fontSize: 16,
    fontFamily: 'DMSans_700Bold',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  noFriendsSubtext: {
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
    color: '#888888',
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#000000',
    padding: 24,
    margin: 24,
    width: '85%',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: 'DMSans_900Black',
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
    color: '#666666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  modalCancelButton: {
    flex: 1,
    backgroundColor: '#F2C94C',
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#000000',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  modalCancelText: {
    fontSize: 14,
    fontFamily: 'DMSans_900Black',
    color: '#1A1A1A',
  },
  modalConfirmButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#000000',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  modalConfirmText: {
    fontSize: 14,
    fontFamily: 'DMSans_900Black',
    color: '#FFFFFF',
  },
});
