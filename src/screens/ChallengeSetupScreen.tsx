import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { Duel, createInviteDuel } from '../lib/duelService';
import { getFriends, sendFriendChallenge, FriendWithProfile } from '../lib/friendsService';
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
  sport: 'nba' | 'pl' | 'nfl' | 'mlb';
  questionCount?: number;
  onCancel: () => void;
  onDuelCreated: (duel: Duel, challengedFriendId?: string) => void;
  getRandomQuestionId: (sport: 'nba' | 'pl' | 'nfl' | 'mlb') => string;
}

export default function ChallengeSetupScreen({
  sport,
  questionCount = 1,
  onCancel,
  onDuelCreated,
  getRandomQuestionId,
}: Props) {
  const { user } = useAuth();
  const [friends, setFriends] = useState<FriendWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingDuel, setCreatingDuel] = useState(false);

  const sportColor = getSportColor(sport as Sport);

  useEffect(() => {
    const loadFriends = async () => {
      if (!user) return;
      setLoading(true);
      const friendsList = await getFriends(user.id);
      setFriends(friendsList);
      setLoading(false);
    };

    loadFriends();
  }, [user]);

  const handleChallengeFriend = async (friend: FriendWithProfile) => {
    if (!user || creatingDuel) return;

    setCreatingDuel(true);
    const questionId = getRandomQuestionId(sport);
    const duel = await createInviteDuel(user.id, sport, questionId, questionCount);

    if (duel) {
      // Send challenge notification to friend via realtime
      await sendFriendChallenge(user.id, friend.friendUserId, duel.id);
      onDuelCreated(duel, friend.friendUserId);
    } else {
      Alert.alert('Error', 'Failed to create challenge. Please try again.');
      setCreatingDuel(false);
    }
  };

  const handleShareCode = async () => {
    if (!user || creatingDuel) return;

    setCreatingDuel(true);
    const questionId = getRandomQuestionId(sport);
    const duel = await createInviteDuel(user.id, sport, questionId, questionCount);

    if (duel) {
      onDuelCreated(duel);
    } else {
      Alert.alert('Error', 'Failed to create challenge. Please try again.');
      setCreatingDuel(false);
    }
  };

  const renderFriendItem = ({ item }: { item: FriendWithProfile }) => (
    <TouchableOpacity
      style={styles.friendItem}
      onPress={() => handleChallengeFriend(item)}
      disabled={creatingDuel}
      activeOpacity={0.8}
    >
      <View style={[styles.friendAvatar, { backgroundColor: sportColor }]}>
        <Text style={styles.friendAvatarText}>
          {item.username.charAt(0).toUpperCase()}
        </Text>
      </View>
      <View style={styles.friendInfo}>
        <Text style={styles.friendName}>{item.username}</Text>
        <Text style={styles.friendHint}>Tap to challenge</Text>
      </View>
      <View style={[styles.challengeArrow, { backgroundColor: sportColor }]}>
        <Text style={styles.challengeArrowText}>→</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onCancel} activeOpacity={0.8}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>

        <View style={[styles.sportBadge, { backgroundColor: sportColor }]}>
          <Image source={sportIcons[sport as Sport]} style={styles.sportBadgeIcon} resizeMode="contain" />
          <Text style={styles.sportBadgeText}>{sportNames[sport as Sport]}</Text>
        </View>

        <Text style={styles.title}>Challenge Friend</Text>
      </View>

      <View style={styles.content}>
        {/* Get Invite Code Button */}
        <TouchableOpacity
          style={styles.shareCodeButton}
          onPress={handleShareCode}
          disabled={creatingDuel}
          activeOpacity={0.8}
        >
          {creatingDuel ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Text style={styles.shareCodeText}>Get Invite Code</Text>
              <Text style={styles.shareCodeHint}>Share a code with anyone</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Friends Section */}
        <View style={styles.friendsSection}>
          <Text style={styles.sectionTitle}>YOUR FRIENDS</Text>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={sportColor} />
            </View>
          ) : friends.length === 0 ? (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIconContainer}>
                <Text style={styles.emptyIcon}>👥</Text>
              </View>
              <Text style={styles.emptyText}>No friends yet</Text>
              <Text style={styles.emptySubtext}>
                Play duels with invite codes to add friends!
              </Text>
            </View>
          ) : (
            <FlatList
              data={friends}
              renderItem={renderFriendItem}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.friendsList}
              showsVerticalScrollIndicator={false}
            />
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F2EB',
  },
  header: {
    padding: 16,
    paddingBottom: 8,
    alignItems: 'center',
  },
  backButton: {
    position: 'absolute',
    left: 16,
    top: 16,
    backgroundColor: '#F2C94C',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#000000',
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  backButtonText: {
    color: '#1A1A1A',
    fontSize: 12,
    fontFamily: 'DMSans_900Black',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 24,
    fontFamily: 'DMSans_900Black',
    color: '#1A1A1A',
    textAlign: 'center',
    marginTop: 8,
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
    marginTop: 72,
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
  content: {
    flex: 1,
    padding: 16,
  },
  shareCodeButton: {
    backgroundColor: '#1ABC9C',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#000000',
    marginBottom: 24,
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  shareCodeText: {
    fontSize: 16,
    fontFamily: 'DMSans_900Black',
    color: '#FFFFFF',
  },
  shareCodeHint: {
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
    color: '#FFFFFF',
    opacity: 0.8,
    marginTop: 4,
  },
  friendsSection: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: 'DMSans_900Black',
    color: '#888888',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 32,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#000000',
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  emptyIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F5F2EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyIcon: {
    fontSize: 28,
  },
  emptyText: {
    fontSize: 16,
    fontFamily: 'DMSans_900Black',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
    color: '#888888',
    textAlign: 'center',
  },
  friendsList: {
    paddingBottom: 24,
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: '#000000',
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  friendAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 2,
    borderColor: '#000000',
  },
  friendAvatarText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontFamily: 'DMSans_900Black',
  },
  friendInfo: {
    flex: 1,
  },
  friendName: {
    fontSize: 16,
    fontFamily: 'DMSans_700Bold',
    color: '#1A1A1A',
  },
  friendHint: {
    fontSize: 12,
    fontFamily: 'DMSans_400Regular',
    color: '#888888',
    marginTop: 2,
  },
  challengeArrow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#000000',
  },
  challengeArrowText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'DMSans_900Black',
  },
});
