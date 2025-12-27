import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Image,
  RefreshControl,
  Modal,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { colors, shadows, borders, borderRadius, getSportColor, getSportName, Sport, truncateUsername } from '../lib/theme';
import { AnimatedButton, AnimatedCard } from '../components/AnimatedComponents';
import {
  getFriendsWithOnlineStatus,
  FriendWithOnlineStatus,
  searchUsersByUsername,
  addFriend,
  removeFriend,
  UserProfile,
  sendFriendRequest,
  getPendingFriendRequests,
  getSentFriendRequests,
  acceptFriendRequest,
  declineFriendRequest,
  cancelFriendRequest,
  FriendRequestWithProfile,
  hasPendingRequest,
  areFriends,
} from '../lib/friendsService';
import {
  getPendingAsyncChallenges,
  DuelWithOpponent,
  getTimeRemaining,
  createAsyncDuel,
  Duel,
} from '../lib/duelService';
import { getSmartQuestionId, resetDuelSession } from '../lib/questionSelectionService';
import { countryCodeToFlag } from '../lib/countryUtils';
import nbaTriviaData from '../../data/nba-trivia.json';
import plTriviaData from '../../data/pl-trivia.json';
import nflTriviaData from '../../data/nfl-trivia.json';
import mlbTriviaData from '../../data/mlb-trivia.json';
import {
  shouldShowNotificationPrompt,
  dismissNotificationPrompt,
  requestAndSaveNotifications,
} from '../lib/notificationService';
import { usePresence } from '../hooks/usePresence';
import NotificationPromptModal from '../components/NotificationPromptModal';

// Get trivia questions by sport
const getTriviaQuestions = (sport: Sport): any[] => {
  switch (sport) {
    case 'nba': return nbaTriviaData as any[];
    case 'pl': return plTriviaData as any[];
    case 'nfl': return nflTriviaData as any[];
    case 'mlb': return mlbTriviaData as any[];
    default: return nbaTriviaData as any[];
  }
};

// Icons
const friendsIcon = require('../../assets/images/icon-friends.png');

// Sport icons for challenges
const sportIcons: Record<Sport, any> = {
  nba: require('../../assets/images/icon-basketball.png'),
  pl: require('../../assets/images/icon-soccer.png'),
  nfl: require('../../assets/images/icon-football.png'),
  mlb: require('../../assets/images/icon-baseball.png'),
};

interface FriendsScreenProps {
  onNavigateToAsyncDuel: (duel: Duel, isChallenger: boolean) => void;
}

export default function FriendsScreen({ onNavigateToAsyncDuel }: FriendsScreenProps) {
  const { user } = useAuth();
  const [friends, setFriends] = useState<FriendWithOnlineStatus[]>([]);
  const [pendingChallenges, setPendingChallenges] = useState<DuelWithOpponent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [searching, setSearching] = useState(false);
  const [addingFriend, setAddingFriend] = useState<string | null>(null);
  const [showSportModal, setShowSportModal] = useState(false);
  const [showQuestionCountModal, setShowQuestionCountModal] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState<FriendWithOnlineStatus | null>(null);
  const [selectedSport, setSelectedSport] = useState<Sport | null>(null);
  const [creatingChallenge, setCreatingChallenge] = useState(false);

  // Friend request state
  const [friendRequests, setFriendRequests] = useState<FriendRequestWithProfile[]>([]);
  const [sentRequests, setSentRequests] = useState<FriendRequestWithProfile[]>([]);
  const [showRequestSentModal, setShowRequestSentModal] = useState(false);
  const [sentRequestUsername, setSentRequestUsername] = useState('');
  const [processingRequest, setProcessingRequest] = useState<string | null>(null);
  const [pendingRequestUserIds, setPendingRequestUserIds] = useState<Set<string>>(new Set());

  // Notification prompt state
  const [showNotificationPrompt, setShowNotificationPrompt] = useState(false);
  const [pendingDuelNavigation, setPendingDuelNavigation] = useState<{ duel: Duel; isChallenger: boolean; opponentUsername: string } | null>(null);
  const [requestingNotifications, setRequestingNotifications] = useState(false);

  // Real-time online status using presence hook
  const onlineUserIds = usePresence();

  const loadData = useCallback(async () => {
    if (!user) return;

    try {
      const [friendsData, challengesData, requestsData, sentRequestsData] = await Promise.all([
        getFriendsWithOnlineStatus(user.id),
        getPendingAsyncChallenges(user.id),
        getPendingFriendRequests(user.id),
        getSentFriendRequests(user.id),
      ]);
      setFriends(friendsData);
      setPendingChallenges(challengesData);
      setFriendRequests(requestsData);
      setSentRequests(sentRequestsData);
      // Update pendingRequestUserIds from sent requests
      setPendingRequestUserIds(new Set(sentRequestsData.map(r => r.receiver_id)));
    } catch (error) {
      console.error('Error loading friends data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const results = await searchUsersByUsername(query, user?.id || '');
      // Filter out users who are already friends
      const friendIds = new Set(friends.map(f => f.friendUserId));
      setSearchResults(results.filter(r => !friendIds.has(r.id)));
    } catch (error) {
      console.error('Error searching users:', error);
    } finally {
      setSearching(false);
    }
  };

  const handleAddFriend = async (friendId: string, username: string) => {
    if (!user) return;

    setAddingFriend(friendId);
    try {
      const result = await sendFriendRequest(user.id, friendId);
      if (result.success) {
        setSentRequestUsername(username);
        setShowRequestSentModal(true);
        setSearchQuery('');
        setSearchResults([]);
        // Track that we've sent a request to this user
        setPendingRequestUserIds(prev => new Set(prev).add(friendId));
        loadData();
      } else if (result.error === 'already_friends') {
        Alert.alert('Already Friends', 'You are already friends with this user.');
      } else if (result.error === 'already_pending') {
        Alert.alert('Request Pending', 'You already have a pending friend request with this user.');
      } else {
        Alert.alert('Error', 'Could not send friend request. Please try again.');
      }
    } catch (error) {
      console.error('Error sending friend request:', error);
      Alert.alert('Error', 'Could not send friend request. Please try again.');
    } finally {
      setAddingFriend(null);
    }
  };

  const handleAcceptRequest = async (request: FriendRequestWithProfile) => {
    if (!user) return;

    setProcessingRequest(request.id);
    try {
      const success = await acceptFriendRequest(request.id, user.id);
      if (success) {
        loadData();
      } else {
        Alert.alert('Error', 'Could not accept friend request. Please try again.');
      }
    } catch (error) {
      console.error('Error accepting friend request:', error);
      Alert.alert('Error', 'Could not accept friend request. Please try again.');
    } finally {
      setProcessingRequest(null);
    }
  };

  const handleDeclineRequest = async (request: FriendRequestWithProfile) => {
    if (!user) return;

    setProcessingRequest(request.id);
    try {
      const success = await declineFriendRequest(request.id, user.id);
      if (success) {
        loadData();
      } else {
        Alert.alert('Error', 'Could not decline friend request. Please try again.');
      }
    } catch (error) {
      console.error('Error declining friend request:', error);
      Alert.alert('Error', 'Could not decline friend request. Please try again.');
    } finally {
      setProcessingRequest(null);
    }
  };

  const handleCancelRequest = async (request: FriendRequestWithProfile) => {
    if (!user) return;

    setProcessingRequest(request.id);
    try {
      const success = await cancelFriendRequest(request.id, user.id);
      if (success) {
        // Remove from pending user IDs
        setPendingRequestUserIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(request.receiver_id);
          return newSet;
        });
        loadData();
      } else {
        Alert.alert('Error', 'Could not cancel friend request. Please try again.');
      }
    } catch (error) {
      console.error('Error canceling friend request:', error);
      Alert.alert('Error', 'Could not cancel friend request. Please try again.');
    } finally {
      setProcessingRequest(null);
    }
  };

  const handleRemoveFriend = async (friendId: string) => {
    if (!user) return;

    Alert.alert(
      'Remove Friend',
      'Are you sure you want to remove this friend?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              const success = await removeFriend(user.id, friendId);
              if (success) {
                loadData();
              }
            } catch (error) {
              console.error('Error removing friend:', error);
            }
          },
        },
      ]
    );
  };

  const handleChallengePress = (friend: FriendWithOnlineStatus) => {
    setSelectedFriend(friend);
    setShowSportModal(true);
  };

  const handleSportSelect = (sport: Sport) => {
    if (!user || !selectedFriend) return;
    setSelectedSport(sport);
    setShowSportModal(false);
    setShowQuestionCountModal(true);
  };

  const handleQuestionCountSelect = async (questionCount: number) => {
    if (!user || !selectedFriend || !selectedSport) return;

    setCreatingChallenge(true);
    try {
      // Reset question session for this sport
      resetDuelSession(selectedSport);

      // Get a question for the duel
      const questions = getTriviaQuestions(selectedSport);
      const questionId = getSmartQuestionId(selectedSport, questions);

      // Create the async duel with selected question count
      const duel = await createAsyncDuel(
        user.id,
        selectedFriend.friendUserId,
        selectedSport,
        questionId,
        questionCount
      );

      if (duel) {
        const opponentUsername = truncateUsername(selectedFriend.username);
        setShowQuestionCountModal(false);
        setSelectedFriend(null);
        setSelectedSport(null);

        // Check if we should show notification prompt
        const showPrompt = await shouldShowNotificationPrompt();
        if (showPrompt) {
          // Store the pending navigation and show prompt
          setPendingDuelNavigation({ duel, isChallenger: true, opponentUsername });
          setShowNotificationPrompt(true);
        } else {
          // Navigate directly to the duel screen as challenger
          onNavigateToAsyncDuel(duel, true);
        }
      } else {
        Alert.alert('Error', 'Could not create challenge. Please try again.');
      }
    } catch (error) {
      console.error('Error creating challenge:', error);
      Alert.alert('Error', 'Could not create challenge. Please try again.');
    } finally {
      setCreatingChallenge(false);
    }
  };

  const handleCancelQuestionCount = () => {
    setShowQuestionCountModal(false);
    setSelectedSport(null);
    setShowSportModal(true); // Go back to sport selection
  };

  const handlePlayChallenge = (challenge: DuelWithOpponent) => {
    onNavigateToAsyncDuel(challenge, false);
  };

  const handleEnableNotifications = async () => {
    if (!user || !pendingDuelNavigation) return;

    setRequestingNotifications(true);
    await requestAndSaveNotifications(user.id);
    setRequestingNotifications(false);

    setShowNotificationPrompt(false);
    onNavigateToAsyncDuel(pendingDuelNavigation.duel, pendingDuelNavigation.isChallenger);
    setPendingDuelNavigation(null);
  };

  const handleDismissNotifications = async () => {
    await dismissNotificationPrompt();
    setShowNotificationPrompt(false);

    if (pendingDuelNavigation) {
      onNavigateToAsyncDuel(pendingDuelNavigation.duel, pendingDuelNavigation.isChallenger);
      setPendingDuelNavigation(null);
    }
  };

  if (loading || !user) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Friends</Text>
        </View>

        {/* Pending Challenges Section */}
        {pendingChallenges.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Pending Challenges</Text>
            {pendingChallenges.map((challenge) => {
              const timeRemaining = getTimeRemaining(challenge.expires_at);
              const sportColor = getSportColor(challenge.sport as Sport);

              return (
                <AnimatedCard key={challenge.id} style={styles.challengeCard}>
                  <View style={styles.challengeHeader}>
                    <View style={[styles.sportBadge, { backgroundColor: sportColor }]}>
                      <Image
                        source={sportIcons[challenge.sport as Sport]}
                        style={styles.sportBadgeIcon}
                        resizeMode="contain"
                      />
                    </View>
                    <View style={styles.challengeInfo}>
                      <Text style={styles.challengerName}>
                        {challenge.opponent_username || 'Unknown'}
                      </Text>
                      <Text style={styles.challengeSport}>
                        {getSportName(challenge.sport as Sport)} Trivia
                      </Text>
                    </View>
                    <View style={styles.timeRemaining}>
                      <Text style={styles.timeRemainingText}>
                        {timeRemaining.expired
                          ? 'Expired'
                          : `${timeRemaining.hours}h ${timeRemaining.minutes}m left`}
                      </Text>
                    </View>
                  </View>
                  <AnimatedButton
                    style={[styles.playButton, { backgroundColor: sportColor }]}
                    onPress={() => handlePlayChallenge(challenge)}
                  >
                    <Text style={styles.playButtonText}>PLAY NOW</Text>
                  </AnimatedButton>
                </AnimatedCard>
              );
            })}
          </View>
        )}

        {/* Search Section - Add Friends */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Add Friends</Text>
          <View style={styles.searchContainer}>
            <Text style={styles.searchIconText}>🔍</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Search by username..."
              placeholderTextColor="#888888"
              value={searchQuery}
              onChangeText={handleSearch}
              autoCapitalize="none"
              autoCorrect={false}
              selectionColor="#1ABC9C"
            />
            {searching && (
              <ActivityIndicator size="small" color={colors.primary} />
            )}
          </View>

          {/* Search Results */}
          {searchResults.length > 0 && (
            <View style={styles.searchResults}>
              {searchResults.map((result) => (
                <View key={result.id} style={styles.searchResultItem}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                      {truncateUsername(result.username).charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <Text style={styles.searchResultUsername}>{truncateUsername(result.username)}</Text>
                  <AnimatedButton
                    style={[
                      styles.addButton,
                      pendingRequestUserIds.has(result.id) && styles.pendingButton,
                    ]}
                    onPress={() => handleAddFriend(result.id, truncateUsername(result.username))}
                    disabled={addingFriend === result.id || pendingRequestUserIds.has(result.id)}
                  >
                    {addingFriend === result.id ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : pendingRequestUserIds.has(result.id) ? (
                      <Text style={styles.pendingButtonText}>SENT</Text>
                    ) : (
                      <Text style={styles.addButtonText}>ADD</Text>
                    )}
                  </AnimatedButton>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Friend Requests Section - Incoming */}
        {friendRequests.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Friend Requests ({friendRequests.length})</Text>
            {friendRequests.map((request) => (
              <AnimatedCard key={request.id} style={styles.requestCard}>
                <View style={styles.requestInfo}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                      {request.senderUsername.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <Text style={styles.requestUsername}>{request.senderUsername}</Text>
                </View>
                <View style={styles.requestButtons}>
                  <AnimatedButton
                    style={styles.declineButton}
                    onPress={() => handleDeclineRequest(request)}
                    disabled={processingRequest === request.id}
                  >
                    {processingRequest === request.id ? (
                      <ActivityIndicator size="small" color="#1A1A1A" />
                    ) : (
                      <Text style={styles.declineButtonText}>DECLINE</Text>
                    )}
                  </AnimatedButton>
                  <AnimatedButton
                    style={styles.acceptButton}
                    onPress={() => handleAcceptRequest(request)}
                    disabled={processingRequest === request.id}
                  >
                    {processingRequest === request.id ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.acceptButtonText}>ACCEPT</Text>
                    )}
                  </AnimatedButton>
                </View>
              </AnimatedCard>
            ))}
          </View>
        )}

        {/* Sent Requests Section - Outgoing */}
        {sentRequests.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Sent Requests ({sentRequests.length})</Text>
            {sentRequests.map((request) => (
              <AnimatedCard key={request.id} style={styles.sentRequestCard}>
                <View style={styles.requestInfo}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                      {request.receiverUsername.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.sentRequestInfo}>
                    <Text style={styles.requestUsername}>{request.receiverUsername}</Text>
                    <Text style={styles.pendingLabel}>Pending</Text>
                  </View>
                </View>
                <AnimatedButton
                  style={styles.cancelRequestButton}
                  onPress={() => handleCancelRequest(request)}
                  disabled={processingRequest === request.id}
                >
                  {processingRequest === request.id ? (
                    <ActivityIndicator size="small" color="#1A1A1A" />
                  ) : (
                    <Text style={styles.cancelRequestButtonText}>CANCEL</Text>
                  )}
                </AnimatedButton>
              </AnimatedCard>
            ))}
          </View>
        )}

        {/* Friends List */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Your Friends {friends.length > 0 && `(${friends.length})`}
          </Text>

          {friends.length === 0 ? (
            <View style={styles.emptyFriends}>
              <Text style={styles.emptyFriendsText}>
                No friends yet. Search for users above to add friends!
              </Text>
            </View>
          ) : (
            friends.map((friend) => {
              const isOnline = onlineUserIds.has(friend.friendUserId);
              return (
                <AnimatedCard key={friend.id} style={styles.friendCard}>
                  <View style={styles.friendInfo}>
                    <View style={styles.avatarContainer}>
                      <View style={styles.avatar}>
                        <Text style={styles.avatarText}>
                          {truncateUsername(friend.username).charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.onlineIndicator,
                          { backgroundColor: isOnline ? '#22C55E' : '#9CA3AF' },
                        ]}
                      />
                    </View>
                    <View style={styles.friendDetails}>
                      <View style={styles.friendNameRow}>
                        <Text style={styles.friendName}>{truncateUsername(friend.username)}</Text>
                        {friend.country && (
                          <Text style={styles.countryFlag}>
                            {countryCodeToFlag(friend.country)}
                          </Text>
                        )}
                      </View>
                      <Text style={[
                        styles.friendStatus,
                        isOnline && styles.friendStatusOnline
                      ]}>
                        {isOnline ? 'Online' : 'Offline'}
                      </Text>
                    </View>
                  </View>
                  <AnimatedButton
                    style={styles.challengeButton}
                    onPress={() => handleChallengePress(friend)}
                  >
                    <Text style={styles.challengeButtonText}>CHALLENGE</Text>
                  </AnimatedButton>
                </AnimatedCard>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* Sport Selection Modal */}
      <Modal
        visible={showSportModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowSportModal(false);
          setSelectedFriend(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Choose a Sport</Text>
            <Text style={styles.modalSubtitle}>
              Challenge {truncateUsername(selectedFriend?.username)} to a trivia duel
            </Text>

            <View style={styles.sportGrid}>
              {(['nba', 'pl', 'nfl', 'mlb'] as Sport[]).map((sport) => {
                const sportColor = getSportColor(sport);
                return (
                  <TouchableOpacity
                    key={sport}
                    style={[styles.sportOption, { backgroundColor: sportColor }]}
                    onPress={() => handleSportSelect(sport)}
                    activeOpacity={0.7}
                  >
                    <Image
                      source={sportIcons[sport]}
                      style={styles.sportOptionImage}
                      resizeMode="contain"
                    />
                    <Text style={styles.sportOptionText}>
                      {sport === 'pl' ? 'EPL' : getSportName(sport).split(' ')[0]}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <AnimatedButton
              style={styles.cancelButton}
              onPress={() => {
                setShowSportModal(false);
                setSelectedFriend(null);
              }}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </AnimatedButton>
          </View>
        </View>
      </Modal>

      {/* Question Count Modal */}
      <Modal
        visible={showQuestionCountModal}
        transparent
        animationType="fade"
        onRequestClose={handleCancelQuestionCount}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>How many questions?</Text>
            {selectedFriend && onlineUserIds.has(selectedFriend.friendUserId) ? (
              <View style={styles.onlineSubtitleContainer}>
                <View style={styles.onlineDotSmall} />
                <Text style={styles.modalSubtitleOnline}>
                  {truncateUsername(selectedFriend.username)} is online —{'\n'}they might play right away!
                </Text>
              </View>
            ) : (
              <Text style={styles.modalSubtitle}>
                You'll both play on your own time.{'\n'}Winner announced when both finish.
              </Text>
            )}

            <View style={styles.questionCountOptions}>
              <TouchableOpacity
                style={styles.questionCountOption}
                onPress={() => handleQuestionCountSelect(1)}
                disabled={creatingChallenge}
                activeOpacity={0.7}
              >
                <Text style={styles.questionCountNumber}>1</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.questionCountOption, styles.questionCountOptionHighlighted]}
                onPress={() => handleQuestionCountSelect(5)}
                disabled={creatingChallenge}
                activeOpacity={0.7}
              >
                <Text style={[styles.questionCountNumber, styles.questionCountNumberHighlighted]}>5</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.questionCountOption}
                onPress={() => handleQuestionCountSelect(9)}
                disabled={creatingChallenge}
                activeOpacity={0.7}
              >
                <Text style={styles.questionCountNumber}>9</Text>
              </TouchableOpacity>
            </View>

            {creatingChallenge && (
              <View style={styles.creatingContainer}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.creatingText}>Creating challenge...</Text>
              </View>
            )}

            <AnimatedButton
              style={styles.cancelButton}
              onPress={handleCancelQuestionCount}
              disabled={creatingChallenge}
            >
              <Text style={styles.cancelButtonText}>Back</Text>
            </AnimatedButton>
          </View>
        </View>
      </Modal>

      {/* Friend Request Sent Modal */}
      <Modal
        visible={showRequestSentModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowRequestSentModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.requestSentModalContent}>
            <Text style={styles.requestSentIcon}>✓</Text>
            <Text style={styles.requestSentTitle}>Friend Request Sent!</Text>
            <Text style={styles.requestSentSubtitle}>
              {sentRequestUsername} will be notified and can accept or decline.
            </Text>
            <AnimatedButton
              style={styles.requestSentOkButton}
              onPress={() => setShowRequestSentModal(false)}
            >
              <Text style={styles.requestSentOkText}>OK</Text>
            </AnimatedButton>
          </View>
        </View>
      </Modal>

      {/* Notification Prompt Modal */}
      <NotificationPromptModal
        visible={showNotificationPrompt}
        opponentUsername={pendingDuelNavigation?.opponentUsername || 'your friend'}
        loading={requestingNotifications}
        onEnable={handleEnableNotifications}
        onDismiss={handleDismissNotifications}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    tintColor: '#CCCCCC',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 24,
    fontFamily: 'DMSans_900Black',
    color: colors.text,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    fontFamily: 'DMSans_400Regular',
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  loginButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: borderRadius.button,
    borderWidth: borders.button,
    borderColor: colors.border,
    ...shadows.button,
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'DMSans_900Black',
    letterSpacing: 0.5,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 16,
  },
  title: {
    fontSize: 28,
    fontFamily: 'DMSans_900Black',
    color: colors.text,
  },
  section: {
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'DMSans_700Bold',
    color: colors.text,
    marginBottom: 12,
  },
  // Pending Challenges
  challengeCard: {
    backgroundColor: '#FFF9E6',
    borderWidth: borders.card,
    borderColor: colors.border,
    borderRadius: borderRadius.card,
    padding: 16,
    marginBottom: 12,
    ...shadows.card,
  },
  challengeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sportBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.border,
  },
  sportBadgeIcon: {
    width: 22,
    height: 22,
    tintColor: '#FFFFFF',
  },
  challengeInfo: {
    flex: 1,
    marginLeft: 12,
  },
  challengerName: {
    fontSize: 16,
    fontFamily: 'DMSans_700Bold',
    color: colors.text,
  },
  challengeSport: {
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
    color: colors.textSecondary,
  },
  timeRemaining: {
    backgroundColor: '#F2C94C',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  timeRemainingText: {
    fontSize: 11,
    fontFamily: 'DMSans_700Bold',
    color: colors.text,
  },
  playButton: {
    paddingVertical: 12,
    borderRadius: borderRadius.button,
    borderWidth: borders.button,
    borderColor: colors.border,
    alignItems: 'center',
    ...shadows.button,
  },
  playButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: 'DMSans_900Black',
    letterSpacing: 0.5,
  },
  // Search
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: borders.card,
    borderColor: colors.border,
    borderRadius: borderRadius.card,
    paddingHorizontal: 16,
    paddingVertical: 12,
    ...shadows.card,
  },
  searchIconText: {
    fontSize: 18,
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'DMSans_400Regular',
    color: colors.text,
  },
  searchResults: {
    marginTop: 12,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: borders.card,
    borderColor: colors.border,
    borderRadius: borderRadius.card,
    padding: 12,
    marginBottom: 8,
    ...shadows.card,
  },
  searchResultUsername: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'DMSans_600SemiBold',
    color: colors.text,
    marginLeft: 12,
  },
  addButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: 'DMSans_700Bold',
  },
  // Friends List
  emptyFriends: {
    backgroundColor: colors.surface,
    borderWidth: borders.card,
    borderColor: colors.border,
    borderRadius: borderRadius.card,
    padding: 24,
    alignItems: 'center',
    ...shadows.card,
  },
  emptyFriendsText: {
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
    color: colors.textSecondary,
    textAlign: 'center',
  },
  friendCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderWidth: borders.card,
    borderColor: colors.border,
    borderRadius: borderRadius.card,
    padding: 12,
    marginBottom: 12,
    ...shadows.card,
  },
  friendInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1A1A1A',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.border,
  },
  avatarText: {
    fontSize: 18,
    fontFamily: 'DMSans_700Bold',
    color: '#FFFFFF',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  friendDetails: {
    marginLeft: 12,
    flex: 1,
  },
  friendNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  friendName: {
    fontSize: 16,
    fontFamily: 'DMSans_700Bold',
    color: colors.text,
  },
  countryFlag: {
    fontSize: 16,
  },
  friendStatus: {
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
    color: '#9CA3AF',
  },
  friendStatusOnline: {
    color: '#22C55E',
  },
  challengeButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    ...shadows.button,
  },
  challengeButtonText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontFamily: 'DMSans_900Black',
    letterSpacing: 0.5,
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderWidth: borders.card,
    borderColor: colors.border,
    borderRadius: borderRadius.card,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    ...shadows.card,
  },
  modalTitle: {
    fontSize: 22,
    fontFamily: 'DMSans_900Black',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
  },
  onlineSubtitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  onlineDotSmall: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#22C55E',
    marginRight: 8,
  },
  modalSubtitleOnline: {
    fontSize: 14,
    fontFamily: 'DMSans_600SemiBold',
    color: '#15803D',
    textAlign: 'center',
  },
  sportGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
  },
  sportOption: {
    width: '45%',
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: borderRadius.card,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  sportOptionImage: {
    width: 40,
    height: 40,
    marginBottom: 8,
  },
  sportOptionText: {
    fontSize: 16,
    fontFamily: 'DMSans_900Black',
    color: '#FFFFFF',
  },
  creatingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    gap: 8,
  },
  creatingText: {
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
    color: colors.textSecondary,
  },
  // Question count modal styles
  questionCountOptions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 16,
  },
  questionCountOption: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#000000',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
    alignItems: 'center',
    minWidth: 90,
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  questionCountOptionHighlighted: {
    backgroundColor: colors.primary,
    borderColor: '#000000',
  },
  questionCountNumber: {
    fontSize: 28,
    fontFamily: 'DMSans_900Black',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  questionCountNumberHighlighted: {
    color: '#FFFFFF',
  },
  questionCountLabel: {
    fontSize: 11,
    fontFamily: 'DMSans_600SemiBold',
    color: '#888888',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  questionCountLabelHighlighted: {
    color: '#FFFFFF',
  },
  cancelButton: {
    backgroundColor: '#F0F0F0',
    paddingVertical: 12,
    borderRadius: borderRadius.button,
    borderWidth: borders.button,
    borderColor: colors.border,
    alignItems: 'center',
    marginTop: 16,
  },
  cancelButtonText: {
    color: colors.text,
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
  },
  // Friend Request styles
  requestCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF9E6',
    borderWidth: borders.card,
    borderColor: colors.border,
    borderRadius: borderRadius.card,
    padding: 12,
    marginBottom: 12,
    ...shadows.card,
  },
  requestInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  requestUsername: {
    fontSize: 16,
    fontFamily: 'DMSans_700Bold',
    color: colors.text,
    marginLeft: 12,
  },
  requestButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  acceptButton: {
    backgroundColor: '#1ABC9C',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    ...shadows.button,
  },
  acceptButtonText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontFamily: 'DMSans_900Black',
    letterSpacing: 0.5,
  },
  declineButton: {
    backgroundColor: '#F2C94C',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    ...shadows.button,
  },
  declineButtonText: {
    color: '#1A1A1A',
    fontSize: 11,
    fontFamily: 'DMSans_900Black',
    letterSpacing: 0.5,
  },
  pendingButton: {
    backgroundColor: '#9E9E9E',
  },
  pendingButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: 'DMSans_700Bold',
  },
  // Sent Request styles
  sentRequestCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderWidth: borders.card,
    borderColor: colors.border,
    borderRadius: borderRadius.card,
    padding: 12,
    marginBottom: 12,
    ...shadows.card,
  },
  sentRequestInfo: {
    marginLeft: 12,
    flex: 1,
  },
  pendingLabel: {
    fontSize: 12,
    fontFamily: 'DMSans_400Regular',
    color: colors.textSecondary,
    marginTop: 2,
  },
  cancelRequestButton: {
    backgroundColor: '#F0F0F0',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    ...shadows.button,
  },
  cancelRequestButtonText: {
    color: '#1A1A1A',
    fontSize: 11,
    fontFamily: 'DMSans_900Black',
    letterSpacing: 0.5,
  },
  // Request Sent Modal
  requestSentModalContent: {
    backgroundColor: colors.surface,
    borderWidth: borders.card,
    borderColor: colors.border,
    borderRadius: borderRadius.card,
    padding: 24,
    width: '100%',
    maxWidth: 300,
    alignItems: 'center',
    ...shadows.card,
  },
  requestSentIcon: {
    fontSize: 48,
    color: '#1ABC9C',
    marginBottom: 12,
  },
  requestSentTitle: {
    fontSize: 22,
    fontFamily: 'DMSans_900Black',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  requestSentSubtitle: {
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
  },
  requestSentOkButton: {
    backgroundColor: '#1ABC9C',
    paddingHorizontal: 48,
    paddingVertical: 14,
    borderRadius: borderRadius.button,
    borderWidth: borders.button,
    borderColor: colors.border,
    ...shadows.button,
  },
  requestSentOkText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'DMSans_900Black',
    letterSpacing: 0.5,
  },
});
