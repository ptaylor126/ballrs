import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  Animated,
  PanResponder,
  Dimensions,
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
  createAsyncDuel,
  Duel,
} from '../lib/duelService';
import { selectQuestionsForDuel } from '../lib/questionSelectionService';
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
import UserActionsModal from '../components/UserActionsModal';
import ReportUserModal from '../components/ReportUserModal';
import { soundService } from '../lib/soundService';
import { inviteFriends } from '../lib/inviteService';
import { blockUser } from '../lib/blockService';

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
const searchIcon = require('../../assets/images/icon-search.png');
const inviteIcon = require('../../assets/images/icon-friends.png');

const SCREEN_WIDTH = Dimensions.get('window').width;
const SWIPE_THRESHOLD = 100;

// Swipeable Friend Card Component
interface SwipeableFriendCardProps {
  friend: FriendWithOnlineStatus;
  isOnline: boolean;
  onChallenge: () => void;
  onRemove: () => void;
  onActions: () => void;
}

function SwipeableFriendCard({ friend, isOnline, onChallenge, onRemove, onActions }: SwipeableFriendCardProps) {
  const translateX = useRef(new Animated.Value(0)).current;
  const [isSwipeOpen, setIsSwipeOpen] = useState(false);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only respond to horizontal swipes
        return Math.abs(gestureState.dx) > 10 && Math.abs(gestureState.dy) < 20;
      },
      onPanResponderMove: (_, gestureState) => {
        // Only allow swipe left (negative dx)
        if (gestureState.dx < 0) {
          translateX.setValue(Math.max(gestureState.dx, -SWIPE_THRESHOLD));
        } else if (isSwipeOpen) {
          // Allow swipe right to close
          translateX.setValue(Math.max(-SWIPE_THRESHOLD + gestureState.dx, 0) - SWIPE_THRESHOLD);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx < -40 && !isSwipeOpen) {
          // Swipe left - open delete button
          Animated.spring(translateX, {
            toValue: -SWIPE_THRESHOLD,
            useNativeDriver: true,
            tension: 100,
            friction: 10,
          }).start();
          setIsSwipeOpen(true);
        } else {
          // Swipe right or insufficient swipe - close
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
            tension: 100,
            friction: 10,
          }).start();
          setIsSwipeOpen(false);
        }
      },
    })
  ).current;

  const handleRemove = () => {
    // Just call onRemove - it will show the confirmation alert
    // Don't close the swipe until confirmed
    onRemove();
  };

  const closeSwipe = () => {
    Animated.spring(translateX, {
      toValue: 0,
      useNativeDriver: true,
      tension: 100,
      friction: 10,
    }).start();
    setIsSwipeOpen(false);
  };

  return (
    <View style={styles.swipeContainer}>
      {/* Swipeable card */}
      <Animated.View
        {...panResponder.panHandlers}
        style={[
          styles.friendCardSwipeable,
          { transform: [{ translateX }] },
        ]}
      >
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
        <TouchableOpacity
          style={styles.actionsButton}
          onPress={() => {
            soundService.playButtonClick();
            onActions();
          }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={styles.actionsButtonText}>...</Text>
        </TouchableOpacity>
        <AnimatedButton
          style={styles.challengeButton}
          onPress={() => {
            soundService.playButtonClick();
            onChallenge();
          }}
        >
          <Text style={styles.challengeButtonText}>CHALLENGE</Text>
        </AnimatedButton>
      </Animated.View>

      {/* Delete button - rendered on top, only visible when swiped */}
      {isSwipeOpen && (
        <View style={styles.deleteButtonContainer}>
          <TouchableOpacity style={styles.deleteButton} onPress={handleRemove}>
            <Text style={styles.deleteButtonText}>REMOVE</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

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
  const [selectedQuestionCount, setSelectedQuestionCount] = useState<number | null>(5); // Default to 5
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

  // Remove friend confirmation modal state
  const [showRemoveConfirmModal, setShowRemoveConfirmModal] = useState(false);
  const [friendToRemove, setFriendToRemove] = useState<{ id: string; username: string } | null>(null);
  const [removingFriend, setRemovingFriend] = useState(false);

  // Invite friends state
  const [inviting, setInviting] = useState(false);

  // Block/Report state
  const [showUserActionsModal, setShowUserActionsModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [userToAction, setUserToAction] = useState<{ id: string; username: string } | null>(null);


  // Real-time online status using presence hook
  const onlineUserIds = usePresence();

  const loadData = useCallback(async () => {
    if (!user) return;

    try {
      const [friendsData, requestsData, sentRequestsData] = await Promise.all([
        getFriendsWithOnlineStatus(user.id),
        getPendingFriendRequests(user.id),
        getSentFriendRequests(user.id),
      ]);
      setFriends(friendsData);
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

  const handleRemoveFriend = (friendId: string, username: string) => {
    if (!user) return;
    setFriendToRemove({ id: friendId, username });
    setShowRemoveConfirmModal(true);
  };

  const confirmRemoveFriend = async () => {
    if (!user || !friendToRemove) return;

    setRemovingFriend(true);
    try {
      const success = await removeFriend(user.id, friendToRemove.id);
      if (success) {
        setShowRemoveConfirmModal(false);
        setFriendToRemove(null);
        loadData();
      }
    } catch (error) {
      console.error('Error removing friend:', error);
    } finally {
      setRemovingFriend(false);
    }
  };

  const cancelRemoveFriend = () => {
    setShowRemoveConfirmModal(false);
    setFriendToRemove(null);
  };

  // Block/Report handlers
  const handleOpenUserActions = (userId: string, username: string) => {
    setUserToAction({ id: userId, username });
    setShowUserActionsModal(true);
  };

  const handleBlockUser = async () => {
    if (!user || !userToAction) return;

    // Close the actions modal first
    setShowUserActionsModal(false);

    // Store reference before potentially clearing
    const targetUser = userToAction;

    Alert.alert(
      'Block User',
      `Are you sure you want to block ${targetUser.username}? They won't be able to send you friend requests or challenge you to duels.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => setUserToAction(null),
        },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            const result = await blockUser(user.id, targetUser.id);
            if (result.success) {
              Alert.alert('Blocked', `${targetUser.username} has been blocked.`);
              loadData(); // Refresh to remove blocked user from friends
            } else {
              Alert.alert('Error', 'Failed to block user. Please try again.');
            }
            setUserToAction(null);
          },
        },
      ]
    );
  };

  const handleReportUser = () => {
    console.log('[FriendsScreen] handleReportUser called, userToAction:', userToAction);
    setShowUserActionsModal(false);
    setShowReportModal(true);
    console.log('[FriendsScreen] showReportModal set to true');
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

  const handleQuestionCountSelect = (questionCount: number) => {
    setSelectedQuestionCount(questionCount);
  };

  const handleStartDuel = async () => {
    if (!user || !selectedFriend || !selectedSport || !selectedQuestionCount) return;

    setCreatingChallenge(true);
    try {
      // Pre-generate ALL question IDs for the duel upfront using smart selection
      const questions = getTriviaQuestions(selectedSport);
      const questionIds = selectQuestionsForDuel(selectedSport, questions, selectedQuestionCount);
      const allQuestionIds = questionIds.join(',');

      // Create the async duel with selected question count
      const duel = await createAsyncDuel(
        user.id,
        selectedFriend.friendUserId,
        selectedSport,
        allQuestionIds,
        selectedQuestionCount
      );

      if (duel) {
        const opponentUsername = truncateUsername(selectedFriend.username);
        setShowQuestionCountModal(false);
        setSelectedFriend(null);
        setSelectedSport(null);
        setSelectedQuestionCount(5); // Reset to default

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
    setSelectedQuestionCount(5); // Reset to default
    setShowSportModal(true); // Go back to sport selection
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

  const handleInviteFriends = async () => {
    setInviting(true);
    try {
      await inviteFriends();
    } finally {
      setInviting(false);
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

        {/* Invite Friends Card */}
        <View style={styles.section}>
          <AnimatedCard
            style={styles.inviteCard}
            onPress={() => {
              soundService.playButtonClick();
              handleInviteFriends();
            }}
            disabled={inviting}
          >
            <View style={styles.inviteIconContainer}>
              <Image source={inviteIcon} style={styles.inviteIcon} resizeMode="contain" />
            </View>
            <View style={styles.inviteContent}>
              <Text style={styles.inviteTitle}>Invite Friends</Text>
              <Text style={styles.inviteSubtitle}>
                Challenge your friends to see who really knows ball
              </Text>
            </View>
            <View style={styles.inviteArrow}>
              <Text style={styles.inviteArrowText}>&gt;</Text>
            </View>
          </AnimatedCard>
        </View>

        {/* Search Section - Add Friends */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Add Friends</Text>
          <View style={styles.searchContainer}>
            <Image source={searchIcon} style={styles.searchIcon} resizeMode="contain" />
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
                    onPress={() => {
                      soundService.playButtonClick();
                      handleAddFriend(result.id, truncateUsername(result.username));
                    }}
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
                    onPress={() => {
                      soundService.playButtonClick();
                      handleDeclineRequest(request);
                    }}
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
                    onPress={() => {
                      soundService.playButtonClick();
                      handleAcceptRequest(request);
                    }}
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
                <View style={[styles.requestInfo, { gap: 10, flex: 1, marginBottom: 0 }]}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                      {request.receiverUsername.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={[styles.sentRequestInfo, { marginLeft: 0 }]}>
                    <Text style={[styles.requestUsername, { marginLeft: 0 }]} numberOfLines={1}>{request.receiverUsername}</Text>
                    <Text style={styles.pendingLabel}>Pending</Text>
                  </View>
                </View>
                <AnimatedButton
                  style={styles.cancelRequestButton}
                  onPress={() => {
                    soundService.playButtonClick();
                    handleCancelRequest(request);
                  }}
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
          <View style={styles.friendsSectionHeader}>
            <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>
              Your Friends {friends.length > 0 && `(${friends.length})`}
            </Text>
            {friends.length > 0 && (
              <Text style={styles.swipeHint}>Swipe left to remove</Text>
            )}
          </View>

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
                <SwipeableFriendCard
                  key={friend.id}
                  friend={friend}
                  isOnline={isOnline}
                  onChallenge={() => handleChallengePress(friend)}
                  onRemove={() => handleRemoveFriend(friend.friendUserId, friend.username)}
                  onActions={() => handleOpenUserActions(friend.friendUserId, friend.username)}
                />
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
                    onPress={() => {
                      soundService.playButtonClick();
                      handleSportSelect(sport);
                    }}
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
                  {truncateUsername(selectedFriend.username)} is online
                </Text>
              </View>
            ) : (
              <Text style={styles.modalSubtitle}>
                You'll both play on your own time.{'\n'}Winner announced when both finish.
              </Text>
            )}

            <View style={styles.questionCountOptions}>
              <TouchableOpacity
                style={[
                  styles.questionCountOption,
                  selectedQuestionCount === 1 && styles.questionCountOptionHighlighted
                ]}
                onPress={() => {
                  soundService.playButtonClick();
                  handleQuestionCountSelect(1);
                }}
                disabled={creatingChallenge}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.questionCountNumber,
                  selectedQuestionCount === 1 && styles.questionCountNumberHighlighted
                ]}>1</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.questionCountOption,
                  selectedQuestionCount === 5 && styles.questionCountOptionHighlighted
                ]}
                onPress={() => {
                  soundService.playButtonClick();
                  handleQuestionCountSelect(5);
                }}
                disabled={creatingChallenge}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.questionCountNumber,
                  selectedQuestionCount === 5 && styles.questionCountNumberHighlighted
                ]}>5</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.questionCountOption,
                  selectedQuestionCount === 9 && styles.questionCountOptionHighlighted
                ]}
                onPress={() => {
                  soundService.playButtonClick();
                  handleQuestionCountSelect(9);
                }}
                disabled={creatingChallenge}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.questionCountNumber,
                  selectedQuestionCount === 9 && styles.questionCountNumberHighlighted
                ]}>9</Text>
              </TouchableOpacity>
            </View>

            {/* START Button */}
            <AnimatedButton
              style={[
                styles.startDuelButton,
                creatingChallenge && styles.startDuelButtonDisabled
              ]}
              onPress={() => {
                soundService.playButtonClick();
                handleStartDuel();
              }}
              disabled={creatingChallenge || !selectedQuestionCount}
            >
              {creatingChallenge ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.startDuelButtonText}>START</Text>
              )}
            </AnimatedButton>

            <AnimatedButton
              style={styles.backButton}
              onPress={handleCancelQuestionCount}
              disabled={creatingChallenge}
            >
              <Text style={styles.backButtonText}>Back</Text>
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

      {/* Remove Friend Confirmation Modal */}
      <Modal
        visible={showRemoveConfirmModal}
        transparent
        animationType="fade"
        onRequestClose={cancelRemoveFriend}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.removeConfirmModalContent}>
            <Text style={styles.removeConfirmTitle}>Remove Friend</Text>
            <Text style={styles.removeConfirmSubtitle}>
              Are you sure you want to remove {friendToRemove?.username || 'this friend'}?
            </Text>
            <View style={styles.removeConfirmButtons}>
              <AnimatedButton
                style={styles.removeConfirmCancelButton}
                onPress={cancelRemoveFriend}
                disabled={removingFriend}
              >
                <Text style={styles.removeConfirmCancelText}>CANCEL</Text>
              </AnimatedButton>
              <AnimatedButton
                style={styles.removeConfirmRemoveButton}
                onPress={confirmRemoveFriend}
                disabled={removingFriend}
              >
                {removingFriend ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.removeConfirmRemoveText}>REMOVE</Text>
                )}
              </AnimatedButton>
            </View>
          </View>
        </View>
      </Modal>

      {/* User Actions Modal (Block/Report) */}
      <UserActionsModal
        visible={showUserActionsModal}
        onClose={() => {
          setShowUserActionsModal(false);
          setUserToAction(null);
        }}
        username={userToAction?.username || ''}
        onBlock={handleBlockUser}
        onReport={handleReportUser}
      />

      {/* Report User Modal */}
      {userToAction && (
        <ReportUserModal
          visible={showReportModal}
          onClose={() => {
            setShowReportModal(false);
            setUserToAction(null);
          }}
          userId={userToAction.id}
          username={userToAction.username}
          reporterId={user?.id || ''}
        />
      )}
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
  searchIcon: {
    width: 20,
    height: 20,
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
  friendsSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  swipeHint: {
    fontSize: 12,
    fontFamily: 'DMSans_400Regular',
    color: colors.textSecondary,
  },
  swipeContainer: {
    marginBottom: 12,
    position: 'relative',
  },
  deleteButtonContainer: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: SWIPE_THRESHOLD + 40,
    justifyContent: 'center',
    alignItems: 'center',
    paddingLeft: 44,
    paddingRight: 8,
  },
  deleteButton: {
    backgroundColor: '#E53935',
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#000000',
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  deleteButtonText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontFamily: 'DMSans_900Black',
    letterSpacing: 0.5,
  },
  friendCardSwipeable: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderWidth: borders.card,
    borderColor: colors.border,
    borderRadius: borderRadius.card,
    padding: 12,
    ...shadows.card,
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
  actionsButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 8,
  },
  actionsButtonText: {
    fontSize: 20,
    fontFamily: 'DMSans_700Bold',
    color: colors.textSecondary,
    letterSpacing: 2,
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
    gap: 8,
  },
  onlineDotSmall: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#22C55E',
  },
  modalSubtitleOnline: {
    fontSize: 14,
    fontFamily: 'DMSans_600SemiBold',
    color: '#15803D',
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
    backgroundColor: '#F2C94C',
    paddingVertical: 12,
    borderRadius: borderRadius.button,
    borderWidth: borders.button,
    borderColor: colors.border,
    alignItems: 'center',
    marginTop: 16,
    ...shadows.button,
  },
  cancelButtonText: {
    color: '#1A1A1A',
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
  },
  // Start Duel button
  startDuelButton: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: borderRadius.button,
    borderWidth: borders.button,
    borderColor: colors.border,
    alignItems: 'center',
    marginTop: 8,
    ...shadows.button,
  },
  startDuelButtonDisabled: {
    opacity: 0.7,
  },
  startDuelButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'DMSans_900Black',
    letterSpacing: 1,
  },
  // Back button (yellow, secondary)
  backButton: {
    backgroundColor: '#F2C94C',
    paddingVertical: 12,
    borderRadius: borderRadius.button,
    borderWidth: borders.button,
    borderColor: colors.border,
    alignItems: 'center',
    marginTop: 12,
    ...shadows.button,
  },
  backButtonText: {
    color: '#1A1A1A',
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
  },
  // Friend Request styles
  requestCard: {
    flexDirection: 'column',
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
    marginBottom: 12,
  },
  requestUsername: {
    fontSize: 16,
    fontFamily: 'DMSans_700Bold',
    color: colors.text,
    marginLeft: 12,
  },
  requestButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  acceptButton: {
    flex: 1,
    backgroundColor: '#1ABC9C',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    ...shadows.button,
  },
  acceptButtonText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontFamily: 'DMSans_900Black',
    letterSpacing: 0.5,
  },
  declineButton: {
    flex: 1,
    backgroundColor: '#F2C94C',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
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
    flex: 1,
    marginLeft: -4,
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
  // Remove Friend Confirmation Modal
  removeConfirmModalContent: {
    backgroundColor: colors.surface,
    borderWidth: borders.card,
    borderColor: colors.border,
    borderRadius: borderRadius.card,
    padding: 24,
    width: '100%',
    maxWidth: 320,
    alignItems: 'center',
    ...shadows.card,
  },
  removeConfirmTitle: {
    fontSize: 22,
    fontFamily: 'DMSans_900Black',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  removeConfirmSubtitle: {
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  removeConfirmButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  removeConfirmCancelButton: {
    flex: 1,
    backgroundColor: '#F2C94C',
    paddingVertical: 14,
    borderRadius: borderRadius.button,
    borderWidth: borders.button,
    borderColor: colors.border,
    alignItems: 'center',
    ...shadows.button,
  },
  removeConfirmCancelText: {
    color: '#1A1A1A',
    fontSize: 13,
    fontFamily: 'DMSans_900Black',
    letterSpacing: 0.5,
  },
  removeConfirmRemoveButton: {
    flex: 1,
    backgroundColor: '#E53935',
    paddingVertical: 14,
    borderRadius: borderRadius.button,
    borderWidth: borders.button,
    borderColor: colors.border,
    alignItems: 'center',
    ...shadows.button,
  },
  removeConfirmRemoveText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: 'DMSans_900Black',
    letterSpacing: 0.5,
  },
  // Invite Friends Card
  inviteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F8F5',
    borderWidth: borders.card,
    borderColor: colors.border,
    borderRadius: borderRadius.card,
    padding: 16,
    ...shadows.card,
  },
  inviteIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.border,
  },
  inviteIcon: {
    width: 24,
    height: 24,
    tintColor: '#FFFFFF',
  },
  inviteContent: {
    flex: 1,
    marginLeft: 14,
    marginRight: 8,
  },
  inviteTitle: {
    fontSize: 17,
    fontFamily: 'DMSans_700Bold',
    color: colors.text,
    marginBottom: 2,
  },
  inviteSubtitle: {
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
    color: colors.textSecondary,
  },
  inviteArrow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.border,
  },
  inviteArrowText: {
    fontSize: 16,
    fontFamily: 'DMSans_900Black',
    color: '#FFFFFF',
  },
});
