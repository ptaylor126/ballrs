import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
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

const ACCENT_COLOR = '#1ABC9C';
const DISABLED_BG = '#F9EECC';
const DISABLED_TEXT = '#AAAAAA';

// Icons
const swordsIcon = require('../../assets/images/icon-duel.png');

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
} from '../lib/duelService';
import { getFriends, FriendWithProfile, sendFriendChallenge } from '../lib/friendsService';
import { sendChallengeNotification } from '../lib/notificationService';
import { getSmartQuestionId } from '../lib/questionSelectionService';
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
  const cardHeight = useRef(new Animated.Value(1)).current;
  const cardOpacity = useRef(new Animated.Value(1)).current;
  const [isSwiped, setIsSwiped] = useState(false);
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only respond to horizontal swipes
        return Math.abs(gestureState.dx) > 10 && Math.abs(gestureState.dy) < 10;
      },
      onPanResponderMove: (_, gestureState) => {
        // Only allow left swipe (negative dx)
        if (gestureState.dx < 0) {
          translateX.setValue(Math.max(gestureState.dx, -SWIPE_THRESHOLD - 20));
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx < -SWIPE_THRESHOLD / 2) {
          // Snap to reveal cancel button
          Animated.spring(translateX, {
            toValue: -SWIPE_THRESHOLD,
            useNativeDriver: true,
            friction: 8,
          }).start();
          setIsSwiped(true);
        } else {
          // Snap back to original position
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
            friction: 8,
          }).start();
          setIsSwiped(false);
        }
      },
    })
  ).current;

  const resetSwipe = () => {
    Animated.spring(translateX, {
      toValue: 0,
      useNativeDriver: true,
      friction: 8,
    }).start();
    setIsSwiped(false);
  };

  const handleCardPress = () => {
    if (isSwiped) {
      resetSwipe();
    } else {
      onPress();
    }
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

  const heightInterpolate = cardHeight.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 80], // Approximate card height including margin
  });

  return (
    <Animated.View
      style={[
        styles.swipeableContainer,
        isAnimatingOut && { height: heightInterpolate, marginBottom: 0 },
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
              {duel.status === 'waiting' || duel.status === 'invite'
                ? 'Waiting for opponent...'
                : `vs ${truncateUsername(duel.opponent_username) || 'Unknown'}`}
            </Text>
            <Text style={[styles.duelStatus, { color: getSportColor(duel.sport) }]}>
              {duel.status === 'waiting' || duel.status === 'invite' ? 'Waiting' : 'In Progress'}
            </Text>
          </View>
          <Text style={styles.arrowIcon}>→</Text>
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
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
      const [active, incoming, history, duelStats] = await Promise.all([
        getActiveDuels(user.id),
        getIncomingChallenges(user.id),
        getDuelHistory(user.id, 20),
        getDuelStats(user.id),
      ]);

      setActiveDuels(active);
      setIncomingChallenges(incoming);
      setDuelHistory(history);
      setStats(duelStats);
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

    // Check if this is an async friend duel (already has player2_id and challenger completed)
    if (duel.player2_id === user.id && duel.player1_completed_at) {
      // This is an async duel - don't call joinDuel, just navigate
      setProcessingDuelId(null);
      onNavigateToDuel(duel);
      return;
    }

    // Regular invite duel - join and make active
    const joinedDuel = await joinDuel(duel.id, user.id);
    setProcessingDuelId(null);

    if (joinedDuel) {
      onNavigateToDuel(joinedDuel);
    } else {
      Alert.alert('Error', 'Failed to accept challenge. It may have expired.');
      loadData();
    }
  };

  const handleDeclineChallenge = async (duel: DuelWithOpponent) => {
    setProcessingDuelId(duel.id);
    const success = await declineChallenge(duel.id);
    setProcessingDuelId(null);

    if (success) {
      setIncomingChallenges((prev) => prev.filter((d) => d.id !== duel.id));
    } else {
      Alert.alert('Error', 'Failed to decline challenge');
    }
  };

  const handleActiveDuelPress = (duel: DuelWithOpponent) => {
    onNavigateToDuel(duel);
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
    setSelectedFriendForChallenge(friend);
    setConfirmFriendModalVisible(true);
  };

  const handleCancelFriendConfirm = () => {
    setSelectedFriendForChallenge(null);
    setConfirmFriendModalVisible(false);
  };

  const handleConfirmFriendChallenge = async () => {
    if (!selectedFriendForChallenge || !user || !selectedSport) return;

    setSendingFriendChallenge(true);

    try {
      // Get a random question ID for the duel
      const questions = getTriviaQuestions(selectedSport);
      const questionId = getSmartQuestionId(selectedSport, questions);

      // Create async duel for friend challenges - challenger plays first
      const duel = await createAsyncDuel(user.id, selectedFriendForChallenge.friendUserId, selectedSport, questionId, selectedQuestionCount);

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
            onPress={handleQuickDuelPress}
          >
            <Text style={styles.actionButtonText}>Quick Duel</Text>
          </AnimatedButton>
          <AnimatedButton
            style={styles.actionButton}
            onPress={handleChallengeFriendPress}
          >
            <Text style={styles.actionButtonText}>Challenge Friend</Text>
          </AnimatedButton>
        </View>

        {/* Active Duels Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>ACTIVE DUELS</Text>
            {activeDuels.length > 0 && (
              <Text style={styles.swipeHint}>← Swipe to cancel</Text>
            )}
          </View>
          {activeDuels.length === 0 ? (
            <View style={styles.emptyCard}>
              <Image source={swordsIcon} style={styles.emptyIcon} />
              <Text style={styles.emptyText}>No active duels</Text>
              <Text style={styles.emptySubtext}>Challenge a friend or start a quick duel</Text>
            </View>
          ) : (
            activeDuels.map((duel) => (
              <SwipeableDuelCard
                key={duel.id}
                duel={duel}
                onPress={() => handleActiveDuelPress(duel)}
                onCancelPress={() => showCancelConfirmation(duel)}
                onAnimatedCancel={() => handleAnimatedCancel(duel)}
              />
            ))
          )}
        </View>

        {/* Incoming Challenges Section */}
        {incomingChallenges.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>INCOMING CHALLENGES</Text>
            {incomingChallenges.map((duel) => (
              <View key={duel.id} style={styles.challengeCard}>
                <View style={styles.challengeHeader}>
                  <View style={[styles.sportBadge, { backgroundColor: getSportColor(duel.sport) }]}>
                    <Text style={styles.sportBadgeText}>{duel.sport.toUpperCase()}</Text>
                  </View>
                  <View style={styles.challengeInfo}>
                    <Text style={styles.challengerName}>
                      {truncateUsername(duel.opponent_username) || 'Someone'} challenged you!
                    </Text>
                    <Text style={styles.challengeSport}>
                      {duel.sport.toUpperCase()} Trivia
                    </Text>
                  </View>
                </View>
                <View style={styles.challengeActions}>
                  {processingDuelId === duel.id ? (
                    <ActivityIndicator size="small" color="#A17FFF" />
                  ) : (
                    <>
                      <AnimatedButton
                        style={styles.declineButton}
                        onPress={() => handleDeclineChallenge(duel)}
                      >
                        <Text style={styles.declineButtonText}>Decline</Text>
                      </AnimatedButton>
                      <AnimatedButton
                        style={[styles.acceptButton, { backgroundColor: getSportColor(duel.sport) }]}
                        onPress={() => handleAcceptChallenge(duel)}
                      >
                        <Text style={styles.acceptButtonText}>Accept</Text>
                      </AnimatedButton>
                    </>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}

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
          <Text style={styles.sectionTitle}>DUEL HISTORY</Text>
          {duelHistory.length === 0 ? (
            <View style={styles.emptyCard}>
              <Image source={swordsIcon} style={styles.emptyIcon} />
              <Text style={styles.emptyText}>No duels completed yet</Text>
              <Text style={styles.emptySubtext}>Your wins and losses will appear here</Text>
            </View>
          ) : (
            duelHistory.map((duel) => {
              const isPlayer1 = duel.player1_id === user.id;
              const won = duel.winner_id === user.id;
              const tie = duel.winner_id === null;
              const myTime = isPlayer1 ? duel.player1_answer_time : duel.player2_answer_time;
              const theirTime = isPlayer1 ? duel.player2_answer_time : duel.player1_answer_time;

              return (
                <View key={duel.id} style={styles.historyCard}>
                  <View style={styles.historyLeft}>
                    <View style={[styles.sportBadge, { backgroundColor: getSportColor(duel.sport) }]}>
                      <Text style={styles.sportBadgeText}>{duel.sport.toUpperCase()}</Text>
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
                  <View style={styles.historyTimes}>
                    <Text style={styles.timeLabel}>You: {formatTime(myTime)}</Text>
                    <Text style={styles.timeLabel}>Them: {formatTime(theirTime)}</Text>
                  </View>
                </View>
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
                  onPress={() => handleSportSelect(sport)}
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
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setQuestionCountPickerVisible(false)}
        >
          <TouchableOpacity
            style={styles.questionCountModalContent}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
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
                  onPress={() => handleQuestionCountSelect(count)}
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
              <ScrollView style={styles.friendsScrollView} showsVerticalScrollIndicator={false}>
                {friends.map((friend) => (
                  <TouchableOpacity
                    key={friend.id}
                    style={styles.friendOptionCard}
                    onPress={() => handleFriendSelect(friend)}
                    activeOpacity={0.8}
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
              onPress={handleConfirmChallenge}
            >
              <Text style={styles.confirmChallengeButtonText}>GET INVITE CODE</Text>
            </AnimatedButton>
            <TouchableOpacity
              style={styles.questionCountCancelButton}
              onPress={() => setQuestionCountPickerVisible(false)}
            >
              <Text style={styles.questionCountCancelText}>CANCEL</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Confirm Friend Challenge Modal */}
      <Modal
        visible={confirmFriendModalVisible}
        transparent
        animationType="fade"
        onRequestClose={handleCancelFriendConfirm}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={handleCancelFriendConfirm}
        >
          <TouchableOpacity
            style={styles.confirmFriendModalContent}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={styles.confirmFriendTitle}>
              Challenge {truncateUsername(selectedFriendForChallenge?.username)}?
            </Text>
            {selectedFriendForChallenge && onlineUserIds.has(selectedFriendForChallenge.friendUserId) ? (
              <View style={styles.onlineSubtitleContainer}>
                <View style={styles.onlineDotSmall} />
                <Text style={styles.confirmFriendSubtitleOnline}>
                  {truncateUsername(selectedFriendForChallenge.username)} is online —{'\n'}they might play right away!
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
                onPress={handleCancelFriendConfirm}
                disabled={sendingFriendChallenge}
              >
                <Text style={styles.confirmFriendNoText}>NO</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmFriendYesButton}
                onPress={handleConfirmFriendChallenge}
                disabled={sendingFriendChallenge}
              >
                {sendingFriendChallenge ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.confirmFriendYesText}>YES</Text>
                )}
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
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
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: 'DMSans_900Black',
    color: '#888888',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
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
  historyTimes: {
    alignItems: 'flex-end',
  },
  timeLabel: {
    fontSize: 12,
    fontFamily: 'DMSans_400Regular',
    color: '#888888',
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
    elevation: 2,
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
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
  confirmFriendSubtitleOnline: {
    fontSize: 14,
    fontFamily: 'DMSans_600SemiBold',
    color: '#15803D',
    textAlign: 'center',
    lineHeight: 20,
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
  },
  swipeHint: {
    fontSize: 11,
    fontFamily: 'DMSans_400Regular',
    color: '#999999',
  },
  // Swipeable Card
  swipeableContainer: {
    marginBottom: 12,
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
    bottom: 135, // Just above ad banner + nav bar
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
});
