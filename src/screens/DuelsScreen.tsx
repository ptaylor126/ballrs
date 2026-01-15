import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Pressable,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Image,
  Modal,
  Animated,
  PanResponder,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { colors, getSportColor, Sport, truncateUsername } from '../lib/theme';
import { supabase } from '../lib/supabase';
import { AnimatedButton, AnimatedCard } from '../components/AnimatedComponents';
import { usePresence } from '../hooks/usePresence';
import { soundService } from '../lib/soundService';

const ACCENT_COLOR = '#1ABC9C';
const DISABLED_BG = '#F9EECC';
const DISABLED_TEXT = '#AAAAAA';

// Icons
const swordsIcon = require('../../assets/images/icon-duel.png');
const crownIcon = require('../../assets/images/icon-crown.png');
const trophyIcon = require('../../assets/images/icon-trophy.png');

// Sport icons for selector
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

// Sport colors for the grid
const sportColors: Record<Sport, string> = {
  nba: '#E07A3D',  // Orange
  pl: '#A17FFF',   // Purple
  nfl: '#3BA978',  // Green
  mlb: '#7A93D2',  // Blue
};
import {
  Duel,
  DuelWithOpponent,
  DuelStats,
  getActiveDuels,
  getIncomingChallenges,
  getDuelHistory,
  getDuelStats,
  joinDuel,
  declineChallenge,
  joinDuelByInviteCode,
  cancelDuel,
  createInviteDuel,
  createAsyncDuel,
  markResultSeen,
} from '../lib/duelService';
import { getFriends, FriendWithProfile, sendFriendChallenge } from '../lib/friendsService';
import { sendChallengeNotification } from '../lib/notificationService';
import { selectQuestionsForDuel } from '../lib/questionSelectionService';
import nbaTriviaData from '../../data/nba-trivia.json';
import plTriviaData from '../../data/pl-trivia.json';
import nflTriviaData from '../../data/nfl-trivia.json';
import mlbTriviaData from '../../data/mlb-trivia.json';

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

const SCREEN_WIDTH = Dimensions.get('window').width;
const SWIPE_THRESHOLD = 100;

// Swipeable Duel Card Component
interface SwipeableDuelCardProps {
  duel: DuelWithOpponent;
  onPress: () => void;
  onCancelPress: () => void;
  onAnimatedCancel?: () => void;
}

function SwipeableDuelCard({ duel, onPress, onCancelPress, onAnimatedCancel }: SwipeableDuelCardProps) {
  const translateX = useRef(new Animated.Value(0)).current;
  const cardHeight = useRef(new Animated.Value(80)).current; // Start at full height
  const cardOpacity = useRef(new Animated.Value(1)).current;
  const [isSwiped, setIsSwiped] = useState(false);
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);

  // User has already played, waiting for opponent to play
  const isWaitingForOpponent = duel.status === 'waiting_for_p2';

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Disable swipe for waiting_for_p2 duels (can't cancel after playing)
        if (isWaitingForOpponent) return false;
        // Only respond to horizontal swipes with sufficient movement
        return Math.abs(gestureState.dx) > 5 && Math.abs(gestureState.dy) < 20;
      },
      onPanResponderGrant: () => {
        // Stop any running animations when gesture starts
        translateX.stopAnimation();
      },
      onPanResponderMove: (_, gestureState) => {
        // Only allow left swipe (negative dx)
        if (gestureState.dx < 0) {
          translateX.setValue(Math.max(gestureState.dx, -SWIPE_THRESHOLD - 20));
        } else if (!isSwiped) {
          // Allow slight right movement to reset
          translateX.setValue(Math.min(gestureState.dx, 0));
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx < -SWIPE_THRESHOLD / 2) {
          // Snap to reveal cancel button
          Animated.spring(translateX, {
            toValue: -SWIPE_THRESHOLD,
            useNativeDriver: true,
            friction: 8,
          }).start(() => setIsSwiped(true));
        } else {
          // Snap back to original position
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
            friction: 8,
          }).start(() => setIsSwiped(false));
        }
      },
      onPanResponderTerminationRequest: () => false, // Don't let scroll view take over
    })
  ).current;

  const resetSwipe = () => {
    Animated.spring(translateX, {
      toValue: 0,
      useNativeDriver: true,
      friction: 8,
    }).start(() => setIsSwiped(false));
  };

  const handleCardPress = () => {
    // Only allow swipe reset - don't navigate anywhere on tap
    if (isSwiped) {
      resetSwipe();
    }
    // Do nothing else - active duels should not be tappable to navigate
  };

  // Animate the card sliding out to the left and collapsing
  const animateCancelOut = (callback: () => void) => {
    setIsAnimatingOut(true);
    Animated.parallel([
      // Slide card off to the left
      Animated.timing(translateX, {
        toValue: -SCREEN_WIDTH,
        duration: 250,
        useNativeDriver: true,
      }),
      // Fade out
      Animated.timing(cardOpacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Collapse height after slide out
      Animated.timing(cardHeight, {
        toValue: 0,
        duration: 200,
        useNativeDriver: false,
      }).start(callback);
    });
  };

  const handleCancelPress = () => {
    // If we have an animated cancel handler, use the animation
    if (onAnimatedCancel) {
      animateCancelOut(onAnimatedCancel);
    } else {
      resetSwipe();
      onCancelPress();
    }
  };

  // Separate wrapper for height animation (non-native driver)
  // This prevents mixing native and non-native animated values
  return (
    <Animated.View
      style={[
        styles.swipeableContainerOuter,
        isAnimatingOut && { height: cardHeight, marginBottom: 0, overflow: 'hidden' },
      ]}
    >
      <Animated.View
        style={[
          styles.swipeableContainer,
          { opacity: cardOpacity },
        ]}
      >
        {/* Cancel Button (behind the card) */}
        <View style={styles.cancelButtonContainer}>
          <TouchableOpacity
            style={styles.swipeCancelButton}
            onPress={handleCancelPress}
          >
            <Text style={styles.swipeCancelButtonText}>CANCEL</Text>
          </TouchableOpacity>
        </View>

        {/* The Card */}
        {isWaitingForOpponent ? (
          // Completely non-interactive card for waiting_for_p2 duels
          <View style={styles.duelCardWrapper} pointerEvents="none">
            <View style={[styles.duelCard, styles.duelCardWaiting]}>
              <View style={[styles.sportBadge, { backgroundColor: '#CCCCCC' }]}>
                <Text style={styles.sportBadgeText}>{duel.sport.toUpperCase()}</Text>
              </View>
              <View style={styles.duelInfo}>
                <Text style={[styles.opponentName, styles.opponentNameWaiting]}>
                  {duel.opponent_username
                    ? `vs ${truncateUsername(duel.opponent_username)}`
                    : 'Waiting for opponent...'}
                </Text>
                <Text style={[styles.duelStatus, { color: '#999999' }]}>
                  Waiting for opponent
                </Text>
              </View>
            </View>
          </View>
        ) : (
          // Interactive card for other duels
          <Animated.View
            style={[
              styles.duelCardWrapper,
              { transform: [{ translateX }] },
            ]}
            {...panResponder.panHandlers}
          >
            <TouchableOpacity
              style={styles.duelCard}
              onPress={handleCardPress}
              activeOpacity={0.9}
            >
              <View style={[styles.sportBadge, { backgroundColor: getSportColor(duel.sport) }]}>
                <Text style={styles.sportBadgeText}>{duel.sport.toUpperCase()}</Text>
              </View>
              <View style={styles.duelInfo}>
                <Text style={styles.opponentName}>
                  {duel.opponent_username
                    ? `vs ${truncateUsername(duel.opponent_username)}`
                    : 'Waiting for opponent...'}
                </Text>
                <Text style={[styles.duelStatus, { color: getSportColor(duel.sport) }]}>
                  {duel.status === 'waiting' || duel.status === 'invite' ? 'Waiting' : 'In Progress'}
                </Text>
              </View>
            </TouchableOpacity>
          </Animated.View>
        )}
      </Animated.View>
    </Animated.View>
  );
}

// Swipeable Challenge Card Component (for declining incoming challenges)
interface SwipeableChallengeCardProps {
  duel: DuelWithOpponent;
  onPlay: () => void;
  onDecline: () => void;
  isProcessing?: boolean;
}

function SwipeableChallengeCard({ duel, onPlay, onDecline, isProcessing }: SwipeableChallengeCardProps) {
  const translateX = useRef(new Animated.Value(0)).current;
  const [isSwiped, setIsSwiped] = useState(false);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 5 && Math.abs(gestureState.dy) < 20;
      },
      onPanResponderGrant: () => {
        translateX.stopAnimation();
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dx < 0) {
          translateX.setValue(Math.max(gestureState.dx, -SWIPE_THRESHOLD - 20));
        } else if (!isSwiped) {
          translateX.setValue(Math.min(gestureState.dx, 0));
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx < -SWIPE_THRESHOLD / 2) {
          Animated.spring(translateX, {
            toValue: -SWIPE_THRESHOLD,
            useNativeDriver: true,
            friction: 8,
          }).start(() => setIsSwiped(true));
        } else {
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
            friction: 8,
          }).start(() => setIsSwiped(false));
        }
      },
      onPanResponderTerminationRequest: () => false,
    })
  ).current;

  const resetSwipe = () => {
    Animated.spring(translateX, {
      toValue: 0,
      useNativeDriver: true,
      friction: 8,
    }).start(() => setIsSwiped(false));
  };

  const handleCardPress = () => {
    if (isSwiped) {
      resetSwipe();
    } else {
      onPlay();
    }
  };

  return (
    <View style={styles.swipeableContainerOuter}>
      <View style={styles.swipeableContainer}>
        {/* Decline Button (behind the card) */}
        <View style={styles.declineButtonContainer}>
          <TouchableOpacity
            style={styles.swipeDeclineButton}
            onPress={onDecline}
          >
            <Text style={styles.swipeDeclineButtonText}>DECLINE</Text>
          </TouchableOpacity>
        </View>

        {/* The Card */}
        <Animated.View
          style={[
            styles.duelCardWrapper,
            { transform: [{ translateX }] },
          ]}
          {...panResponder.panHandlers}
        >
          <TouchableOpacity
            style={styles.playNowCard}
            onPress={handleCardPress}
            activeOpacity={0.8}
          >
            <View style={[styles.sportBadge, { backgroundColor: getSportColor(duel.sport) }]}>
              <Text style={styles.sportBadgeText}>{duel.sport.toUpperCase()}</Text>
            </View>
            <View style={styles.duelInfo}>
              <Text style={styles.opponentName}>
                vs {truncateUsername(duel.opponent_username) || 'Unknown'}
              </Text>
              <Text style={styles.playNowStatus}>Your turn!</Text>
            </View>
            {isProcessing ? (
              <ActivityIndicator size="small" color="#1A1A1A" />
            ) : (
              <View style={styles.playNowButton}>
                <Text style={styles.playNowButtonText}>PLAY</Text>
              </View>
            )}
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  );
}

interface Props {
  onNavigateToDuel: (duel: Duel) => void;
  onQuickDuel?: (sport: Sport) => void;
  onChallengeFriend?: (sport: Sport, questionCount: number) => void;
  onAsyncDuelCreated?: (duel: Duel) => void;
  autoStartDuelSport?: Sport | null;
  onClearAutoStartDuel?: () => void;
}

const QUESTION_COUNT_OPTIONS = [1, 5, 9];

const formatTime = (ms: number | null): string => {
  if (ms === null) return '--';
  const seconds = (ms / 1000).toFixed(1);
  return `${seconds}s`;
};

export default function DuelsScreen({ onNavigateToDuel, onQuickDuel, onChallengeFriend, onAsyncDuelCreated, autoStartDuelSport, onClearAutoStartDuel }: Props) {
  const { user } = useAuth();
  const onlineUserIds = usePresence();
  const [activeDuels, setActiveDuels] = useState<DuelWithOpponent[]>([]);
  const [incomingChallenges, setIncomingChallenges] = useState<DuelWithOpponent[]>([]);
  const [duelHistory, setDuelHistory] = useState<DuelWithOpponent[]>([]);
  const [stats, setStats] = useState<DuelStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [joiningCode, setJoiningCode] = useState(false);
  const [processingDuelId, setProcessingDuelId] = useState<string | null>(null);
  const [sportSelectorVisible, setSportSelectorVisible] = useState(false);
  const [sportSelectorAction, setSportSelectorAction] = useState<'quickDuel' | 'challenge'>('quickDuel');
  const [questionCountPickerVisible, setQuestionCountPickerVisible] = useState(false);
  const [selectedSport, setSelectedSport] = useState<Sport | null>(null);
  const [selectedQuestionCount, setSelectedQuestionCount] = useState(5);
  const [inputFocused, setInputFocused] = useState(false);
  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [duelToCancel, setDuelToCancel] = useState<DuelWithOpponent | null>(null);
  const [cancellingDuel, setCancellingDuel] = useState(false);
  const [showCancelToast, setShowCancelToast] = useState(false);
  // Decline challenge modal states
  const [declineModalVisible, setDeclineModalVisible] = useState(false);
  const [challengeToDecline, setChallengeToDecline] = useState<DuelWithOpponent | null>(null);
  const [decliningChallenge, setDecliningChallenge] = useState(false);
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastTranslateY = useRef(new Animated.Value(50)).current;
  const [startDuelModalVisible, setStartDuelModalVisible] = useState(false);
  const [startDuelSport, setStartDuelSport] = useState<Sport | null>(null);

  // Friend challenge states
  const [friends, setFriends] = useState<FriendWithProfile[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [selectedFriendForChallenge, setSelectedFriendForChallenge] = useState<FriendWithProfile | null>(null);
  const [confirmFriendModalVisible, setConfirmFriendModalVisible] = useState(false);
  const [sendingFriendChallenge, setSendingFriendChallenge] = useState(false);
  const [myUsername, setMyUsername] = useState<string>('Someone');

  // View results modal state
  const [resultsModalVisible, setResultsModalVisible] = useState(false);
  const [selectedDuelForResults, setSelectedDuelForResults] = useState<DuelWithOpponent | null>(null);

  // Auto-open Start Duel modal when navigating from home screen
  useEffect(() => {
    if (autoStartDuelSport) {
      setStartDuelSport(autoStartDuelSport);
      setStartDuelModalVisible(true);
      // Clear the auto-start parameter after consuming it
      onClearAutoStartDuel?.();
    }
  }, [autoStartDuelSport, onClearAutoStartDuel]);

  // Load friends and username when question count picker opens
  useEffect(() => {
    const loadFriendsAndUsername = async () => {
      if (!questionCountPickerVisible || !user) return;

      setLoadingFriends(true);
      const friendsList = await getFriends(user.id);
      setFriends(friendsList);
      setLoadingFriends(false);

      // Load my username for notifications
      const { data: profile } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', user.id)
        .single();
      if (profile?.username) {
        setMyUsername(profile.username);
      }
    };
    loadFriendsAndUsername();
  }, [questionCountPickerVisible, user]);

  const loadData = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      const [active, incoming, history, duelStats, profile] = await Promise.all([
        getActiveDuels(user.id),
        getIncomingChallenges(user.id),
        getDuelHistory(user.id, 20),
        getDuelStats(user.id),
        supabase.from('profiles').select('username').eq('id', user.id).single(),
      ]);

      setActiveDuels(active);
      setIncomingChallenges(incoming);
      setDuelHistory(history);
      setStats(duelStats);
      if (profile.data?.username) {
        setMyUsername(profile.data.username);
      }
    } catch (error) {
      console.error('Error loading duels data:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const handleJoinByCode = async () => {
    if (!user) return;

    if (!inviteCode.trim()) {
      Alert.alert('Error', 'Please enter an invite code');
      return;
    }

    setJoiningCode(true);
    const result = await joinDuelByInviteCode(inviteCode.trim(), user.id);
    setJoiningCode(false);

    if (result.success) {
      setInviteCode('');
      onNavigateToDuel(result.duel);
    } else {
      const errorMessages: Record<string, string> = {
        not_found: 'Invalid code. Please check and try again.',
        expired: 'This challenge has expired.',
        own_duel: "You can't join your own challenge!",
        already_joined: 'This challenge has already been accepted.',
        failed: 'Failed to join. Please try again.',
      };
      Alert.alert('Error', errorMessages[result.error] || 'Failed to join duel');
    }
  };

  const handleAcceptChallenge = async (duel: DuelWithOpponent) => {
    if (!user) return;

    setProcessingDuelId(duel.id);

    console.log('handleAcceptChallenge - duel:', {
      id: duel.id,
      status: duel.status,
      player1_id: duel.player1_id,
      player2_id: duel.player2_id,
      user_id: user.id,
      isAsyncFriendDuel: duel.player2_id === user.id,
    });

    // Check if this is an async friend duel (player2_id is set to this user)
    // Friend challenges have player2_id set from creation, regular invites don't
    if (duel.player2_id === user.id) {
      // This is an async friend duel - don't call joinDuel, just navigate
      console.log('Navigating to async friend duel');
      setProcessingDuelId(null);
      onNavigateToDuel(duel);
      return;
    }

    // Regular invite code duel - join and make active
    console.log('Joining regular invite duel');
    const joinedDuel = await joinDuel(duel.id, user.id);
    setProcessingDuelId(null);

    if (joinedDuel) {
      console.log('Joined duel:', { status: joinedDuel.status, player2_id: joinedDuel.player2_id });
      onNavigateToDuel(joinedDuel);
    } else {
      Alert.alert('Error', 'Failed to accept challenge. It may have expired.');
      loadData();
    }
  };

  // Show decline confirmation modal
  const showDeclineConfirmation = (duel: DuelWithOpponent) => {
    setChallengeToDecline(duel);
    setDeclineModalVisible(true);
  };

  // Confirm decline challenge with notification
  const handleConfirmDeclineChallenge = async () => {
    if (!challengeToDecline) return;

    setDecliningChallenge(true);
    const success = await declineChallenge(
      challengeToDecline.id,
      challengeToDecline.player1_id, // The challenger
      myUsername // The user declining
    );
    setDecliningChallenge(false);
    setDeclineModalVisible(false);

    if (success) {
      setIncomingChallenges((prev) => prev.filter((d) => d.id !== challengeToDecline.id));
      setChallengeToDecline(null);
    } else {
      Alert.alert('Error', 'Failed to decline challenge');
    }
  };

  const handleCancelDecline = () => {
    setDeclineModalVisible(false);
    setChallengeToDecline(null);
  };

  const handleActiveDuelPress = (duel: DuelWithOpponent) => {
    onNavigateToDuel(duel);
  };

  const handleViewResults = async (duel: DuelWithOpponent) => {
    setSelectedDuelForResults(duel);
    setResultsModalVisible(true);

    // Mark as seen if current user is player1 and hasn't seen it yet
    if (user && duel.player1_id === user.id && !duel.player1_seen_result) {
      await markResultSeen(duel.id);
      // Update local state to remove NEW badge
      setDuelHistory(prev =>
        prev.map(d => d.id === duel.id ? { ...d, player1_seen_result: true } : d)
      );
    }
  };

  const handleQuickDuelPress = () => {
    if (!user) return;
    setSportSelectorAction('quickDuel');
    setSportSelectorVisible(true);
  };

  const handleChallengeFriendPress = () => {
    if (!user) return;
    setSportSelectorAction('challenge');
    setSportSelectorVisible(true);
  };

  const handleSportSelect = (sport: Sport) => {
    setSportSelectorVisible(false);
    if (sportSelectorAction === 'quickDuel' && onQuickDuel) {
      onQuickDuel(sport);
    } else if (sportSelectorAction === 'challenge') {
      // Show question count picker for Challenge Friend
      setSelectedSport(sport);
      setSelectedQuestionCount(5); // Default to 5 questions
      setQuestionCountPickerVisible(true);
    }
  };

  const handleQuestionCountSelect = (count: number) => {
    setSelectedQuestionCount(count);
  };

  const handleConfirmChallenge = () => {
    if (selectedSport && onChallengeFriend) {
      setQuestionCountPickerVisible(false);
      onChallengeFriend(selectedSport, selectedQuestionCount);
      setSelectedSport(null);
    }
  };

  // Friend challenge handlers
  const handleFriendSelect = (friend: FriendWithProfile) => {
    console.log('Friend selected:', friend.username);
    // Close the question count modal first, then show confirm modal
    setQuestionCountPickerVisible(false);
    setSelectedFriendForChallenge(friend);
    setConfirmFriendModalVisible(true);
  };

  const handleCancelFriendConfirm = () => {
    console.log('[handleCancelFriendConfirm] Called - closing modal');
    setSelectedFriendForChallenge(null);
    setConfirmFriendModalVisible(false);
  };

  const handleConfirmFriendChallenge = async () => {
    console.log('[handleConfirmFriendChallenge] Called with:', {
      selectedFriendForChallenge: selectedFriendForChallenge?.username,
      friendUserId: selectedFriendForChallenge?.friendUserId,
      user: user?.id,
      selectedSport,
      selectedQuestionCount,
    });

    if (!selectedFriendForChallenge || !user || !selectedSport) {
      console.log('[handleConfirmFriendChallenge] Early return - missing:', {
        hasFriend: !!selectedFriendForChallenge,
        hasUser: !!user,
        hasSport: !!selectedSport,
      });
      return;
    }

    setSendingFriendChallenge(true);

    try {
      // Pre-generate ALL question IDs for the duel upfront using smart selection
      const questions = getTriviaQuestions(selectedSport);
      const questionIds = selectQuestionsForDuel(selectedSport, questions, selectedQuestionCount);
      const allQuestionIds = questionIds.join(',');

      // Create async duel for friend challenges - challenger plays first
      const duel = await createAsyncDuel(user.id, selectedFriendForChallenge.friendUserId, selectedSport, allQuestionIds, selectedQuestionCount);

      if (duel) {
        // Close modals
        setConfirmFriendModalVisible(false);
        setQuestionCountPickerVisible(false);
        setSelectedFriendForChallenge(null);
        setSelectedSport(null);

        // Navigate to async duel game to play immediately
        if (onAsyncDuelCreated) {
          onAsyncDuelCreated(duel);
        }
      } else {
        Alert.alert('Error', 'Failed to create challenge. Please try again.');
      }
    } catch (error) {
      console.error('Error creating friend challenge:', error);
      Alert.alert('Error', 'Failed to send challenge. Please try again.');
    }

    setSendingFriendChallenge(false);
  };

  const showCancelConfirmation = (duel: DuelWithOpponent) => {
    setDuelToCancel(duel);
    setCancelModalVisible(true);
  };

  // Direct animated cancel (without modal)
  const handleAnimatedCancel = async (duel: DuelWithOpponent) => {
    const success = await cancelDuel(duel.id);
    if (success) {
      setActiveDuels((prev) => prev.filter((d) => d.id !== duel.id));
      showToast();
    } else {
      Alert.alert('Error', 'Failed to cancel duel. Please try again.');
      loadData(); // Refresh to restore the card
    }
  };

  // Start Duel modal handlers
  const handleOpenStartDuelModal = () => {
    if (!user) return;
    setSportSelectorAction('quickDuel');
    setSportSelectorVisible(true);
  };

  const handlePlayStranger = () => {
    if (startDuelSport && onQuickDuel) {
      setStartDuelModalVisible(false);
      onQuickDuel(startDuelSport);
    }
  };

  const handleChallengeFriendFromModal = () => {
    if (startDuelSport) {
      setStartDuelModalVisible(false);
      setSelectedSport(startDuelSport);
      setSelectedQuestionCount(5);
      setQuestionCountPickerVisible(true);
    }
  };

  const handleCancelDuel = async () => {
    if (!duelToCancel) return;

    setCancellingDuel(true);
    const success = await cancelDuel(duelToCancel.id);
    setCancellingDuel(false);
    setCancelModalVisible(false);

    if (success) {
      setActiveDuels((prev) => prev.filter((d) => d.id !== duelToCancel.id));
      setDuelToCancel(null);
      showToast();
    } else {
      Alert.alert('Error', 'Failed to cancel duel. Please try again.');
    }
  };

  const showToast = () => {
    setShowCancelToast(true);
    // Reset values
    toastOpacity.setValue(0);
    toastTranslateY.setValue(50);

    Animated.sequence([
      // Slide up and fade in
      Animated.parallel([
        Animated.timing(toastOpacity, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.spring(toastTranslateY, {
          toValue: 0,
          friction: 8,
          tension: 80,
          useNativeDriver: true,
        }),
      ]),
      Animated.delay(2000),
      // Slide down and fade out
      Animated.parallel([
        Animated.timing(toastOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(toastTranslateY, {
          toValue: 50,
          duration: 200,
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => {
      setShowCancelToast(false);
    });
  };

  // Only show full loading screen if not auto-starting a duel modal
  if ((loading || !user) && !autoStartDuelSport && !startDuelModalVisible) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.title}>Duels</Text>
          <Text style={styles.subtitle}>Challenge friends and compete</Text>
        </View>
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
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        <View style={styles.header}>
          <Text style={styles.title}>Duels</Text>
          <Text style={styles.subtitle}>Challenge friends and compete</Text>
        </View>

        {/* Duel Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>WINS</Text>
            <Text style={styles.statValue}>{stats?.wins || 0}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>LOSSES</Text>
            <Text style={styles.statValue}>{stats?.losses || 0}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>WIN %</Text>
            <Text style={styles.statValue}>{stats?.winRate || 0}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>STREAK</Text>
            <Text style={styles.statValue}>{stats?.currentStreak || 0}</Text>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.actionButtons}>
          <AnimatedButton
            style={styles.actionButton}
            onPress={() => {
              soundService.playButtonClick();
              handleQuickDuelPress();
            }}
          >
            <Text style={styles.actionButtonText}>Quick Duel</Text>
          </AnimatedButton>
          <AnimatedButton
            style={styles.actionButton}
            onPress={() => {
              soundService.playButtonClick();
              handleChallengeFriendPress();
            }}
          >
            <Text style={styles.actionButtonText}>Challenge Friend</Text>
          </AnimatedButton>
        </View>

        {/* Active Duels Section - includes both your duels and incoming challenges */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitleInline}>ACTIVE DUELS</Text>
            {(activeDuels.length > 0 || incomingChallenges.length > 0) && (
              <Text style={styles.swipeHint}>← Swipe to {incomingChallenges.length > 0 ? 'decline' : 'cancel'}</Text>
            )}
          </View>
          {activeDuels.length === 0 && incomingChallenges.length === 0 ? (
            <View style={styles.emptyCard}>
              <Image source={swordsIcon} style={styles.emptyIcon} />
              <Text style={styles.emptyText}>No active duels</Text>
              <Text style={styles.emptySubtext}>Challenge a friend or start a quick duel</Text>
            </View>
          ) : (
            <>
              {/* Duels needing your action (incoming challenges) - shown first with highlight */}
              {incomingChallenges.map((duel) => (
                <SwipeableChallengeCard
                  key={duel.id}
                  duel={duel}
                  onPlay={() => handleAcceptChallenge(duel)}
                  onDecline={() => showDeclineConfirmation(duel)}
                  isProcessing={processingDuelId === duel.id}
                />
              ))}
              {/* Duels waiting for opponent */}
              {activeDuels.map((duel) => (
                <SwipeableDuelCard
                  key={duel.id}
                  duel={duel}
                  onPress={() => handleActiveDuelPress(duel)}
                  onCancelPress={() => showCancelConfirmation(duel)}
                  onAnimatedCancel={() => handleAnimatedCancel(duel)}
                />
              ))}
            </>
          )}
        </View>

        {/* Join by Code Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>JOIN BY CODE</Text>
          <View style={styles.codeRow}>
            <TextInput
              style={[styles.codeInput, inputFocused && styles.codeInputFocused]}
              placeholder="Enter invite code"
              placeholderTextColor="#999999"
              value={inviteCode}
              onChangeText={setInviteCode}
              onFocus={() => setInputFocused(true)}
              onBlur={() => setInputFocused(false)}
              autoCapitalize="characters"
              maxLength={6}
              selectionColor="#1ABC9C"
            />
            <TouchableOpacity
              style={[
                styles.joinButton,
                !inviteCode.trim() && styles.joinButtonDisabled,
              ]}
              onPress={handleJoinByCode}
              disabled={joiningCode || !inviteCode.trim()}
              activeOpacity={0.8}
            >
              {joiningCode ? (
                <ActivityIndicator size="small" color={inviteCode.trim() ? '#1A1A1A' : '#999999'} />
              ) : (
                <Text style={[
                  styles.joinButtonText,
                  !inviteCode.trim() && styles.joinButtonTextDisabled,
                ]}>JOIN</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Duel History Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitleInline}>DUEL HISTORY</Text>
            <Text style={styles.historyNote}>Last 48 hours</Text>
          </View>
          {duelHistory.length === 0 ? (
            <View style={styles.emptyCard}>
              <Image source={swordsIcon} style={styles.emptyIcon} />
              <Text style={styles.emptyText}>No duels completed yet</Text>
              <Text style={styles.emptySubtext}>Your wins and losses will appear here</Text>
            </View>
          ) : (
            duelHistory.map((duel) => {
              const isPlayer1 = duel.player1_id === user?.id;
              const won = duel.winner_id === user?.id;
              const tie = duel.winner_id === null;
              const myScore = isPlayer1 ? duel.player1_score : duel.player2_score;
              const theirScore = isPlayer1 ? duel.player2_score : duel.player1_score;
              const showNewBadge = isPlayer1 && !duel.player1_seen_result;

              return (
                <TouchableOpacity
                  key={duel.id}
                  style={styles.historyCard}
                  onPress={() => handleViewResults(duel)}
                  activeOpacity={0.7}
                >
                  {showNewBadge && (
                    <View style={styles.newBadge}>
                      <Text style={styles.newBadgeText}>NEW</Text>
                    </View>
                  )}
                  <View style={styles.historyLeft}>
                    <View style={[styles.sportBadge, { backgroundColor: getSportColor(duel.sport) }]}>
                      <Text style={styles.sportBadgeText}>{duel.sport === 'pl' ? 'EPL' : duel.sport.toUpperCase()}</Text>
                    </View>
                    <View style={styles.historyInfo}>
                      <Text
                        style={[
                          styles.historyResult,
                          { color: tie ? '#F5A623' : won ? '#3BA978' : '#E53935' },
                        ]}
                      >
                        {tie ? 'TIE' : won ? 'WIN' : 'LOSS'}
                      </Text>
                      <Text style={styles.historyOpponent}>
                        vs {truncateUsername(duel.opponent_username) || 'Unknown'}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.historyScores}>
                    <Text style={styles.scoreLabel}>You: {myScore ?? 0}</Text>
                    <Text style={styles.scoreLabel}>Them: {theirScore ?? 0}</Text>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* Sport Selector Modal */}
      <Modal
        visible={sportSelectorVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSportSelectorVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setSportSelectorVisible(false)}
        >
          <TouchableOpacity
            style={styles.modalContent}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={styles.modalTitle}>Select a sport category</Text>
            <View style={styles.sportGrid}>
              {(['nba', 'pl', 'nfl', 'mlb'] as Sport[]).map((sport) => (
                <TouchableOpacity
                  key={sport}
                  style={[styles.sportGridOption, { backgroundColor: sportColors[sport] }]}
                  onPress={() => {
                    soundService.playButtonClick();
                    handleSportSelect(sport);
                  }}
                  activeOpacity={0.7}
                >
                  <Image source={sportIcons[sport]} style={styles.sportGridIcon} resizeMode="contain" />
                  <Text style={styles.sportGridText}>{sportNames[sport]}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              style={styles.modalCancelButtonYellow}
              onPress={() => setSportSelectorVisible(false)}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Question Count Picker Modal */}
      <Modal
        visible={questionCountPickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setQuestionCountPickerVisible(false)}
      >
        <View style={styles.modalOverlay}>
          {/* Modal content */}
          <View style={styles.questionCountModalContent}>
            <Text style={styles.modalTitle}>How many questions?</Text>
            <Text style={styles.modalSubtitle}>
              {selectedSport && sportNames[selectedSport]} Trivia
            </Text>
            <View style={styles.questionCountOptions}>
              {QUESTION_COUNT_OPTIONS.map((count) => (
                <TouchableOpacity
                  key={count}
                  style={[
                    styles.questionCountOption,
                    selectedQuestionCount === count && styles.questionCountOptionSelected,
                  ]}
                  onPress={() => {
                    soundService.playButtonClick();
                    handleQuestionCountSelect(count);
                  }}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.questionCountText,
                      selectedQuestionCount === count && styles.questionCountTextSelected,
                    ]}
                  >
                    {count}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Friends Section */}
            <Text style={styles.friendsSectionLabel}>TAP A FRIEND TO CHALLENGE</Text>
            {loadingFriends ? (
              <ActivityIndicator size="small" color={ACCENT_COLOR} style={{ marginVertical: 16 }} />
            ) : friends.length === 0 ? (
              <Text style={styles.noFriendsHint}>No friends yet. Use the code below to invite someone!</Text>
            ) : (
              <ScrollView style={styles.friendsListContainer} showsVerticalScrollIndicator={false}>
                {friends.map((friend) => (
                  <TouchableOpacity
                    key={friend.id}
                    style={styles.friendOptionCard}
                    onPress={() => {
                      soundService.playButtonClick();
                      handleFriendSelect(friend);
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={styles.friendOptionAvatar}>
                      <Text style={styles.friendOptionAvatarText}>
                        {truncateUsername(friend.username).charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <Text style={styles.friendOptionUsername}>{truncateUsername(friend.username)}</Text>
                    <Text style={styles.friendOptionArrow}>→</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            {/* Divider */}
            <View style={styles.orDivider}>
              <View style={styles.orDividerLine} />
              <Text style={styles.orDividerText}>OR</Text>
              <View style={styles.orDividerLine} />
            </View>

            <AnimatedButton
              style={styles.confirmChallengeButton}
              onPress={() => {
                soundService.playButtonClick();
                handleConfirmChallenge();
              }}
            >
              <Text style={styles.confirmChallengeButtonText}>GET INVITE CODE</Text>
            </AnimatedButton>
            <TouchableOpacity
              style={styles.questionCountCancelButton}
              onPress={() => setQuestionCountPickerVisible(false)}
            >
              <Text style={styles.questionCountCancelText}>CANCEL</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Confirm Friend Challenge Modal */}
      <Modal
        visible={confirmFriendModalVisible}
        transparent
        animationType="fade"
        onRequestClose={handleCancelFriendConfirm}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={handleCancelFriendConfirm}
        >
          <Pressable
            style={styles.confirmFriendModalContent}
            onPress={() => {}} // Prevent tap from propagating to overlay
          >
            <Text style={styles.confirmFriendTitle}>
              Challenge {truncateUsername(selectedFriendForChallenge?.username)}?
            </Text>
            {selectedFriendForChallenge && onlineUserIds.has(selectedFriendForChallenge.friendUserId) ? (
              <View style={styles.onlineSubtitleContainer}>
                <View style={styles.onlineStatusRow}>
                  <View style={styles.onlineDotSmall} />
                  <Text style={styles.onlineStatusText}>
                    {truncateUsername(selectedFriendForChallenge.username)} is online
                  </Text>
                </View>
                <Text style={styles.confirmFriendSubtitleOnline}>
                  They might play right away!
                </Text>
              </View>
            ) : (
              <Text style={styles.confirmFriendSubtitle}>
                You'll both play on your own time.{'\n'}Winner announced when both finish.
              </Text>
            )}

            <View style={styles.confirmFriendButtons}>
              <TouchableOpacity
                style={styles.confirmFriendNoButton}
                onPress={() => {
                  soundService.playButtonClick();
                  handleCancelFriendConfirm();
                }}
                disabled={sendingFriendChallenge}
              >
                <Text style={styles.confirmFriendNoText}>NO</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmFriendYesButton}
                onPress={() => {
                  soundService.playButtonClick();
                  handleConfirmFriendChallenge();
                }}
                disabled={sendingFriendChallenge}
              >
                {sendingFriendChallenge ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.confirmFriendYesText}>YES</Text>
                )}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Cancel Duel Confirmation Modal */}
      <Modal
        visible={cancelModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCancelModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setCancelModalVisible(false)}
        >
          <TouchableOpacity
            style={styles.cancelModalContent}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={styles.cancelModalTitle}>
              Cancel this duel{duelToCancel?.opponent_username ? ` with ${truncateUsername(duelToCancel.opponent_username)}` : ''}?
            </Text>
            <Text style={styles.cancelModalSubtitle}>
              This action cannot be undone.
            </Text>
            <View style={styles.cancelModalButtons}>
              <TouchableOpacity
                style={styles.keepButton}
                onPress={() => setCancelModalVisible(false)}
                disabled={cancellingDuel}
              >
                <Text style={styles.keepButtonText}>Keep</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmCancelButton}
                onPress={handleCancelDuel}
                disabled={cancellingDuel}
              >
                {cancellingDuel ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.confirmCancelButtonText}>Yes, Cancel</Text>
                )}
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Decline Challenge Confirmation Modal */}
      <Modal
        visible={declineModalVisible}
        transparent
        animationType="fade"
        onRequestClose={handleCancelDecline}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={handleCancelDecline}
        >
          <TouchableOpacity
            style={styles.cancelModalContent}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={styles.cancelModalTitle}>
              Decline this challenge{challengeToDecline?.opponent_username ? ` from ${truncateUsername(challengeToDecline.opponent_username)}` : ''}?
            </Text>
            <Text style={styles.cancelModalSubtitle}>
              {challengeToDecline?.opponent_username || 'They'} will be notified.
            </Text>
            <View style={styles.cancelModalButtons}>
              <TouchableOpacity
                style={styles.keepButton}
                onPress={handleCancelDecline}
                disabled={decliningChallenge}
              >
                <Text style={styles.keepButtonText}>Keep</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmCancelButton}
                onPress={handleConfirmDeclineChallenge}
                disabled={decliningChallenge}
              >
                {decliningChallenge ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.confirmCancelButtonText}>Yes, Decline</Text>
                )}
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Start Duel Modal */}
      <Modal
        visible={startDuelModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setStartDuelModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setStartDuelModalVisible(false)}
        >
          <TouchableOpacity
            style={styles.startDuelModalContent}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            {/* Sport Badge */}
            {startDuelSport && (
              <View style={[styles.startDuelSportBadge, { backgroundColor: getSportColor(startDuelSport) }]}>
                <Image source={sportIcons[startDuelSport]} style={styles.startDuelSportIcon} resizeMode="contain" />
                <Text style={styles.startDuelSportText}>{sportNames[startDuelSport]}</Text>
              </View>
            )}

            <Text style={styles.startDuelTitle}>Start Duel</Text>
            <Text style={styles.startDuelSubtitle}>How do you want to play?</Text>

            <View style={styles.startDuelOptions}>
              <TouchableOpacity
                style={[styles.startDuelOption, { backgroundColor: ACCENT_COLOR }]}
                onPress={handlePlayStranger}
                activeOpacity={0.8}
              >
                <Text style={styles.startDuelOptionText}>Quick Duel</Text>
                <Text style={styles.startDuelOptionSubtext}>Get matched instantly</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.startDuelOption, { backgroundColor: '#F2C94C' }]}
                onPress={handleChallengeFriendFromModal}
                activeOpacity={0.8}
              >
                <Text style={[styles.startDuelOptionText, { color: '#1A1A1A' }]}>Challenge a Friend</Text>
                <Text style={[styles.startDuelOptionSubtext, { color: '#1A1A1A' }]}>Send an invite code</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.startDuelCloseButton}
              onPress={() => setStartDuelModalVisible(false)}
            >
              <Text style={styles.startDuelCloseText}>Cancel</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Duel Results Modal */}
      <Modal
        visible={resultsModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setResultsModalVisible(false)}
      >
        <View style={styles.resultsModalOverlay}>
          <View style={styles.resultsModalContent}>
            {selectedDuelForResults && (() => {
              const isPlayer1 = selectedDuelForResults.player1_id === user?.id;
              const won = selectedDuelForResults.winner_id === user?.id;
              const tie = selectedDuelForResults.winner_id === null;
              const myScore = isPlayer1 ? selectedDuelForResults.player1_score : selectedDuelForResults.player2_score;
              const theirScore = isPlayer1 ? selectedDuelForResults.player2_score : selectedDuelForResults.player1_score;
              const totalQuestions = selectedDuelForResults.question_count || Math.max(myScore ?? 0, theirScore ?? 0, 1);
              const opponentLost = !won && !tie;

              return (
                <>
                  {/* Sport Badge */}
                  <View style={[styles.resultsSportBadge, { backgroundColor: getSportColor(selectedDuelForResults.sport) }]}>
                    <Image source={sportIcons[selectedDuelForResults.sport as Sport]} style={styles.resultsSportIcon} resizeMode="contain" />
                    <Text style={styles.resultsSportText}>{sportNames[selectedDuelForResults.sport as Sport]}</Text>
                  </View>

                  {/* Header */}
                  <Text style={styles.resultsHeader}>DUEL COMPLETE</Text>

                  {/* Players Card */}
                  <View style={styles.resultsPlayersCard}>
                    {/* Your Row */}
                    <View style={styles.resultsPlayerRow}>
                      <View style={[styles.resultsAvatar, won && styles.resultsAvatarWinner]}>
                        <Text style={styles.resultsAvatarText}>Y</Text>
                      </View>
                      <View style={styles.resultsNameContainer}>
                        <Text style={[styles.resultsPlayerName, won && styles.resultsPlayerNameWinner]}>
                          You
                        </Text>
                        {won && (
                          <Image source={crownIcon} style={styles.resultsCrownIcon} resizeMode="contain" />
                        )}
                      </View>
                      <Text style={[styles.resultsPlayerScoreText, won && styles.resultsPlayerScoreWinner]}>
                        {myScore ?? 0}/{totalQuestions}
                      </Text>
                    </View>

                    {/* Opponent Row */}
                    <View style={styles.resultsPlayerRow}>
                      <View style={[styles.resultsAvatar, opponentLost && styles.resultsAvatarWinner]}>
                        <Text style={styles.resultsAvatarText}>
                          {selectedDuelForResults.opponent_username?.charAt(0).toUpperCase() || 'O'}
                        </Text>
                      </View>
                      <View style={styles.resultsNameContainer}>
                        <Text style={[styles.resultsPlayerName, opponentLost && styles.resultsPlayerNameWinner]}>
                          {truncateUsername(selectedDuelForResults.opponent_username) || 'Opponent'}
                        </Text>
                        {opponentLost && (
                          <Image source={crownIcon} style={styles.resultsCrownIcon} resizeMode="contain" />
                        )}
                      </View>
                      <Text style={[styles.resultsPlayerScoreText, opponentLost && styles.resultsPlayerScoreWinner]}>
                        {theirScore ?? 0}/{totalQuestions}
                      </Text>
                    </View>
                  </View>

                  {/* Result Message */}
                  <View style={styles.resultsMessageContainer}>
                    <Text style={[
                      styles.resultsMessage,
                      won && styles.resultsMessageWin,
                      opponentLost && styles.resultsMessageLose,
                      tie && styles.resultsMessageTie,
                    ]}>
                      {tie ? "IT'S A TIE!" : won ? 'YOU WIN! ' : 'Better luck next time!'}
                    </Text>
                    {won && (
                      <Image source={trophyIcon} style={styles.resultsWinIcon} resizeMode="contain" />
                    )}
                  </View>

                  {/* Close Button */}
                  <TouchableOpacity
                    style={styles.resultsCloseButton}
                    onPress={() => setResultsModalVisible(false)}
                  >
                    <Text style={styles.resultsCloseButtonText}>DONE</Text>
                  </TouchableOpacity>
                </>
              );
            })()}
          </View>
        </View>
      </Modal>

      {/* Toast Notification */}
      {showCancelToast && (
        <Animated.View
          style={[
            styles.toast,
            {
              opacity: toastOpacity,
              transform: [{ translateY: toastTranslateY }],
            },
          ]}
        >
          <Text style={styles.toastCheckmark}>✓</Text>
          <Text style={styles.toastText}>Duel cancelled</Text>
        </Animated.View>
      )}
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
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 170, // Account for AdBanner + BottomNavBar
  },
  header: {
    padding: 24,
    paddingTop: 16,
    paddingBottom: 16,
  },
  title: {
    fontSize: 28,
    fontFamily: 'DMSans_900Black',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
    color: '#666666',
  },
  // Stats Row
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    gap: 12,
    marginBottom: 24,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#000000',
    padding: 12,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  statLabel: {
    fontSize: 12,
    fontFamily: 'DMSans_400Regular',
    color: '#888888',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 24,
    fontFamily: 'DMSans_900Black',
    color: '#1A1A1A',
  },
  // Loading & Login
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginPrompt: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 100,
  },
  loginIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  loginIcon: {
    fontSize: 32,
    fontFamily: 'DMSans_900Black',
    color: ACCENT_COLOR,
  },
  loginText: {
    fontSize: 16,
    fontFamily: 'DMSans_500Medium',
    color: '#666666',
    marginBottom: 24,
  },
  loginButton: {
    backgroundColor: ACCENT_COLOR,
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
  loginButtonText: {
    fontSize: 12,
    fontFamily: 'DMSans_900Black',
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  // Sections
  section: {
    paddingLeft: 24,
    paddingRight: 26, // Extra 2px for shadow offset
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: 'DMSans_900Black',
    color: '#888888',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  sectionTitleInline: {
    fontSize: 12,
    fontFamily: 'DMSans_900Black',
    color: '#888888',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  // Empty Cards
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#000000',
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  emptyIcon: {
    width: 48,
    height: 48,
    tintColor: '#CCCCCC',
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 16,
    fontFamily: 'DMSans_700Bold',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
    color: '#888888',
    textAlign: 'center',
  },
  // Play Now Card (incoming challenges)
  playNowCard: {
    backgroundColor: '#F2C94C',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#000000',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  playNowStatus: {
    fontSize: 13,
    fontFamily: 'DMSans_700Bold',
    color: '#1A1A1A',
  },
  playNowButton: {
    backgroundColor: '#1A1A1A',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#000000',
  },
  playNowButtonText: {
    fontSize: 12,
    fontFamily: 'DMSans_900Black',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  // Duel Cards
  duelCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#000000',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  duelCardWaiting: {
    backgroundColor: '#F5F5F5',
    borderColor: '#CCCCCC',
    shadowOpacity: 0.3,
  },
  opponentNameWaiting: {
    color: '#888888',
  },
  sportBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#000000',
    marginRight: 12,
  },
  sportBadgeText: {
    fontSize: 11,
    fontFamily: 'DMSans_900Black',
    color: '#FFFFFF',
  },
  duelInfo: {
    flex: 1,
  },
  opponentName: {
    fontSize: 16,
    fontFamily: 'DMSans_700Bold',
    color: '#1A1A1A',
    marginBottom: 2,
  },
  duelStatus: {
    fontSize: 13,
    fontFamily: 'DMSans_600SemiBold',
  },
  arrowIcon: {
    fontSize: 20,
    color: '#888888',
    fontFamily: 'DMSans_700Bold',
  },
  // Challenge Cards
  challengeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#000000',
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  challengeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  challengeInfo: {
    flex: 1,
  },
  challengerName: {
    fontSize: 16,
    fontFamily: 'DMSans_700Bold',
    color: '#1A1A1A',
    marginBottom: 2,
  },
  challengeSport: {
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
    color: '#666666',
  },
  challengeActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  declineButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#000000',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  declineButtonText: {
    fontSize: 12,
    fontFamily: 'DMSans_900Black',
    color: '#666666',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  acceptButton: {
    paddingHorizontal: 20,
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
  acceptButtonText: {
    fontSize: 12,
    fontFamily: 'DMSans_900Black',
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  // Join by Code
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  codeInput: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    fontFamily: 'DMSans_700Bold',
    color: '#1A1A1A',
    textAlign: 'center',
    borderWidth: 2,
    borderColor: '#000000',
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  codeInputFocused: {
    borderColor: '#1ABC9C',
  },
  joinButton: {
    backgroundColor: '#F2C94C',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  joinButtonDisabled: {
    backgroundColor: '#F9EECC',
    shadowOpacity: 0.4,
  },
  joinButtonText: {
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
    color: '#1A1A1A',
    textTransform: 'uppercase',
  },
  joinButtonTextDisabled: {
    color: '#AAAAAA',
  },
  // History Cards
  historyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#000000',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  historyLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  historyInfo: {
    flex: 1,
  },
  historyResult: {
    fontSize: 14,
    fontFamily: 'DMSans_900Black',
    marginBottom: 2,
  },
  historyOpponent: {
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
    color: '#666666',
  },
  historyScores: {
    alignItems: 'flex-end',
  },
  scoreLabel: {
    fontSize: 12,
    fontFamily: 'DMSans_600SemiBold',
    color: '#666666',
  },
  // NEW Badge for unseen results
  newBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#F2C94C',
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#1A1A1A',
    paddingHorizontal: 6,
    paddingVertical: 2,
    zIndex: 1,
    shadowColor: '#1A1A1A',
    shadowOffset: { width: 1, height: 1 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  newBadgeText: {
    fontSize: 10,
    fontFamily: 'DMSans_900Black',
    color: '#1A1A1A',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  historyNote: {
    fontSize: 11,
    fontFamily: 'DMSans_400Regular',
    color: '#999999',
  },
  // Action Buttons
  actionButtons: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    gap: 12,
    marginBottom: 24,
  },
  actionButton: {
    flex: 1,
    backgroundColor: ACCENT_COLOR,
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
  actionButtonText: {
    fontSize: 12,
    fontFamily: 'DMSans_900Black',
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlayTouchable: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#000000',
    padding: 24,
    margin: 24,
    width: '85%',
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'DMSans_900Black',
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 20,
  },
  sportOptions: {
    gap: 12,
  },
  sportOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#000000',
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  sportOptionIcon: {
    width: 32,
    height: 32,
    marginRight: 12,
  },
  sportOptionText: {
    fontSize: 14,
    fontFamily: 'DMSans_900Black',
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  // 2x2 Grid Sport Selector
  sportGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
  },
  sportGridOption: {
    width: '45%',
    borderWidth: 2,
    borderColor: '#000000',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  sportGridIcon: {
    width: 40,
    height: 40,
    marginBottom: 8,
  },
  sportGridText: {
    fontSize: 16,
    fontFamily: 'DMSans_900Black',
    color: '#FFFFFF',
  },
  modalCancelButton: {
    marginTop: 16,
    backgroundColor: '#F2C94C',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#000000',
    alignItems: 'center',
    alignSelf: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  modalCancelButtonYellow: {
    marginTop: 16,
    backgroundColor: '#F2C94C',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#000000',
    alignItems: 'center',
    alignSelf: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  modalCancelText: {
    fontSize: 12,
    fontFamily: 'DMSans_900Black',
    color: '#1A1A1A',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  modalSubtitle: {
    fontSize: 14,
    fontFamily: 'DMSans_500Medium',
    color: '#666666',
    textAlign: 'center',
    marginBottom: 20,
  },
  questionCountOptions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 24,
  },
  questionCountOption: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  questionCountOptionSelected: {
    backgroundColor: '#1A1A1A',
  },
  questionCountText: {
    fontSize: 20,
    fontFamily: 'DMSans_900Black',
    color: '#1A1A1A',
  },
  questionCountTextSelected: {
    color: '#FFFFFF',
  },
  confirmChallengeButton: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#000000',
    alignItems: 'center',
    backgroundColor: ACCENT_COLOR,
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  confirmChallengeButtonText: {
    fontSize: 14,
    fontFamily: 'DMSans_900Black',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  questionCountCancelButton: {
    marginTop: 12,
    backgroundColor: '#F2C94C',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#000000',
    alignItems: 'center',
    alignSelf: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  questionCountCancelText: {
    fontSize: 12,
    fontFamily: 'DMSans_900Black',
    color: '#1A1A1A',
    letterSpacing: 0.5,
  },
  questionCountModalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#000000',
    padding: 24,
    margin: 24,
    width: '85%',
    maxHeight: '80%',
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 5,
  },
  friendsSectionLabel: {
    fontSize: 12,
    fontFamily: 'DMSans_900Black',
    color: '#888888',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 16,
    marginBottom: 12,
    textAlign: 'center',
  },
  noFriendsHint: {
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
    color: '#888888',
    textAlign: 'center',
    marginBottom: 16,
  },
  friendsScrollView: {
    maxHeight: 180,
    marginBottom: 8,
  },
  friendsListContainer: {
    maxHeight: 220,
    marginBottom: 8,
  },
  friendOptionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#000000',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  friendOptionAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1A1A1A',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  friendOptionAvatarText: {
    fontSize: 16,
    fontFamily: 'DMSans_900Black',
    color: '#FFFFFF',
  },
  friendOptionUsername: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'DMSans_700Bold',
    color: '#1A1A1A',
  },
  friendOptionArrow: {
    fontSize: 18,
    fontFamily: 'DMSans_700Bold',
    color: '#1ABC9C',
  },
  orDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
  },
  orDividerLine: {
    flex: 1,
    height: 2,
    backgroundColor: '#E0E0E0',
  },
  orDividerText: {
    marginHorizontal: 16,
    fontSize: 12,
    fontFamily: 'DMSans_700Bold',
    color: '#888888',
  },
  // Confirm Friend Modal
  confirmFriendModalContent: {
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
  confirmFriendTitle: {
    fontSize: 20,
    fontFamily: 'DMSans_900Black',
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 8,
  },
  confirmFriendSubtitle: {
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
    color: '#666666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  onlineSubtitleContainer: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 4,
  },
  onlineStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  onlineDotSmall: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22C55E',
  },
  onlineStatusText: {
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
    color: '#15803D',
  },
  confirmFriendSubtitleOnline: {
    fontSize: 13,
    fontFamily: 'DMSans_500Medium',
    color: '#15803D',
    textAlign: 'center',
  },
  confirmFriendButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  confirmFriendNoButton: {
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
  confirmFriendNoText: {
    fontSize: 14,
    fontFamily: 'DMSans_900Black',
    color: '#1A1A1A',
  },
  confirmFriendYesButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#000000',
    backgroundColor: '#1ABC9C',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  confirmFriendYesText: {
    fontSize: 14,
    fontFamily: 'DMSans_900Black',
    color: '#FFFFFF',
  },
  // Section header with hint
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  swipeHint: {
    fontSize: 11,
    fontFamily: 'DMSans_400Regular',
    color: '#999999',
  },
  // Swipeable Card
  swipeableContainerOuter: {
    marginBottom: 12,
  },
  swipeableContainer: {
    position: 'relative',
    borderRadius: 8,
  },
  cancelButtonContainer: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 12, // Account for marginBottom
    width: SWIPE_THRESHOLD + 4, // Extra space for shadow
    justifyContent: 'center',
    alignItems: 'center',
    paddingRight: 4, // Space for shadow
  },
  swipeCancelButton: {
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
  swipeCancelButtonText: {
    fontSize: 11,
    fontFamily: 'DMSans_900Black',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  declineButtonContainer: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 12, // Account for marginBottom
    width: SWIPE_THRESHOLD + 4, // Extra space for shadow
    justifyContent: 'center',
    alignItems: 'center',
    paddingRight: 4, // Space for shadow
  },
  swipeDeclineButton: {
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
  swipeDeclineButtonText: {
    fontSize: 11,
    fontFamily: 'DMSans_900Black',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  duelCardWrapper: {
    backgroundColor: '#F5F2EB',
  },
  // Cancel Modal
  cancelModalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#000000',
    padding: 24,
    margin: 24,
    width: '85%',
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  cancelModalTitle: {
    fontSize: 18,
    fontFamily: 'DMSans_900Black',
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 8,
  },
  cancelModalSubtitle: {
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
    color: '#666666',
    textAlign: 'center',
    marginBottom: 24,
  },
  cancelModalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  keepButton: {
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
  keepButtonText: {
    fontSize: 12,
    fontFamily: 'DMSans_900Black',
    color: '#1A1A1A',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  confirmCancelButton: {
    flex: 1,
    backgroundColor: '#E53935',
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
  confirmCancelButtonText: {
    fontSize: 12,
    fontFamily: 'DMSans_900Black',
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  // Toast
  toast: {
    position: 'absolute',
    bottom: 20, // Just above nav bar
    left: 24,
    right: 24,
    backgroundColor: '#F2C94C',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#000000',
    paddingVertical: 16,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  toastCheckmark: {
    fontSize: 18,
    fontWeight: '900',
    color: '#1A1A1A',
  },
  toastText: {
    fontSize: 15,
    fontFamily: 'DMSans_900Black',
    color: '#1A1A1A',
    letterSpacing: 0.3,
  },
  // Start Duel Modal
  startDuelModalContent: {
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
  startDuelSportBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#000000',
    marginBottom: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  startDuelSportIcon: {
    width: 24,
    height: 24,
  },
  startDuelSportText: {
    fontSize: 14,
    fontFamily: 'DMSans_900Black',
    color: '#FFFFFF',
  },
  startDuelTitle: {
    fontSize: 24,
    fontFamily: 'DMSans_900Black',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  startDuelSubtitle: {
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
    color: '#888888',
    marginBottom: 20,
  },
  startDuelOptions: {
    width: '100%',
    gap: 12,
  },
  startDuelOption: {
    width: '100%',
    paddingVertical: 16,
    paddingHorizontal: 20,
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
  startDuelOptionText: {
    fontSize: 16,
    fontFamily: 'DMSans_900Black',
    color: '#FFFFFF',
  },
  startDuelOptionSubtext: {
    fontSize: 12,
    fontFamily: 'DMSans_400Regular',
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  startDuelCloseButton: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  startDuelCloseText: {
    fontSize: 14,
    fontFamily: 'DMSans_600SemiBold',
    color: '#888888',
  },
  // Results Modal (matches DuelGameScreen)
  resultsModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  resultsModalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#000000',
    padding: 24,
    alignItems: 'center',
    width: '90%',
    maxWidth: 340,
    shadowColor: '#000000',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  resultsSportBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#000000',
    marginBottom: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  resultsSportIcon: {
    width: 20,
    height: 20,
  },
  resultsSportText: {
    fontSize: 14,
    fontFamily: 'DMSans_900Black',
    color: '#FFFFFF',
  },
  resultsHeader: {
    fontSize: 12,
    fontFamily: 'DMSans_700Bold',
    color: '#888888',
    letterSpacing: 2,
    marginBottom: 16,
  },
  resultsPlayersCard: {
    width: '100%',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#000000',
    padding: 12,
    marginBottom: 16,
  },
  resultsPlayerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  resultsAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1A1A1A',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 2,
    borderColor: '#000000',
  },
  resultsAvatarWinner: {
    backgroundColor: '#1ABC9C',
  },
  resultsAvatarText: {
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
    color: '#FFFFFF',
  },
  resultsNameContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  resultsPlayerName: {
    fontSize: 16,
    fontFamily: 'DMSans_600SemiBold',
    color: '#666666',
  },
  resultsPlayerNameWinner: {
    fontFamily: 'DMSans_700Bold',
    color: '#1A1A1A',
  },
  resultsCrownIcon: {
    width: 20,
    height: 20,
    marginLeft: 6,
  },
  resultsPlayerScoreText: {
    fontSize: 18,
    fontFamily: 'DMSans_700Bold',
    color: '#888888',
  },
  resultsPlayerScoreWinner: {
    color: '#1ABC9C',
  },
  resultsMessageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
  },
  resultsMessage: {
    fontSize: 22,
    fontFamily: 'DMSans_900Black',
    textAlign: 'center',
  },
  resultsMessageWin: {
    color: '#1ABC9C',
  },
  resultsMessageLose: {
    color: '#666666',
  },
  resultsMessageTie: {
    color: '#F2C94C',
  },
  resultsWinIcon: {
    width: 28,
    height: 28,
  },
  resultsCloseButton: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 48,
    borderWidth: 2,
    borderColor: '#1A1A1A',
    shadowColor: '#1A1A1A',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  resultsCloseButtonText: {
    fontSize: 14,
    fontFamily: 'DMSans_900Black',
    color: '#FFFFFF',
  },
});
