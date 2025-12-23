import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
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
import { useAuth } from '../contexts/AuthContext';
import { colors, getSportColor, Sport } from '../lib/theme';
import { AnimatedButton, AnimatedCard } from '../components/AnimatedComponents';

const ACCENT_COLOR = '#1ABC9C';
const DISABLED_BG = '#E8E8E8';
const DISABLED_TEXT = '#999999';

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
  pl: 'Premier League',
  nfl: 'NFL',
  mlb: 'MLB',
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
} from '../lib/duelService';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SWIPE_THRESHOLD = 88;

// Swipeable Duel Card Component
interface SwipeableDuelCardProps {
  duel: DuelWithOpponent;
  onPress: () => void;
  onCancelPress: () => void;
}

function SwipeableDuelCard({ duel, onPress, onCancelPress }: SwipeableDuelCardProps) {
  const translateX = useRef(new Animated.Value(0)).current;
  const [isSwiped, setIsSwiped] = useState(false);

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

  const handleCancelPress = () => {
    resetSwipe();
    onCancelPress();
  };

  return (
    <View style={styles.swipeableContainer}>
      {/* Cancel Button (behind the card) */}
      <View style={styles.cancelButtonContainer}>
        <TouchableOpacity
          style={styles.swipeCancelButton}
          onPress={handleCancelPress}
        >
          <Text style={styles.swipeCancelButtonText}>Cancel</Text>
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
              {duel.status === 'waiting'
                ? 'Waiting for opponent...'
                : `vs ${duel.opponent_username || 'Unknown'}`}
            </Text>
            <Text style={[styles.duelStatus, { color: getSportColor(duel.sport) }]}>
              {duel.status === 'waiting' ? 'Waiting' : 'In Progress'}
            </Text>
          </View>
          <Text style={styles.arrowIcon}>→</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

interface Props {
  onNavigateToDuel: (duel: Duel) => void;
  onLogin: () => void;
  onQuickDuel?: (sport: Sport) => void;
  onChallengeFriend?: (sport: Sport, questionCount: number) => void;
}

const QUESTION_COUNT_OPTIONS = [1, 3, 7, 10];

const formatTime = (ms: number | null): string => {
  if (ms === null) return '--';
  const seconds = (ms / 1000).toFixed(1);
  return `${seconds}s`;
};

export default function DuelsScreen({ onNavigateToDuel, onLogin, onQuickDuel, onChallengeFriend }: Props) {
  const { user } = useAuth();
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
  const [selectedQuestionCount, setSelectedQuestionCount] = useState(3);
  const [inputFocused, setInputFocused] = useState(false);
  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [duelToCancel, setDuelToCancel] = useState<DuelWithOpponent | null>(null);
  const [cancellingDuel, setCancellingDuel] = useState(false);
  const [showCancelToast, setShowCancelToast] = useState(false);
  const toastOpacity = useRef(new Animated.Value(0)).current;

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
    if (!user) {
      onLogin();
      return;
    }

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
    if (!user) {
      onLogin();
      return;
    }
    setSportSelectorAction('quickDuel');
    setSportSelectorVisible(true);
  };

  const handleChallengeFriendPress = () => {
    if (!user) {
      onLogin();
      return;
    }
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
      setSelectedQuestionCount(3); // Default to 3 questions
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

  const showCancelConfirmation = (duel: DuelWithOpponent) => {
    setDuelToCancel(duel);
    setCancelModalVisible(true);
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
    Animated.sequence([
      Animated.timing(toastOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.delay(2000),
      Animated.timing(toastOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShowCancelToast(false);
    });
  };

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Duels</Text>
          <Text style={styles.subtitle}>Challenge friends and compete</Text>
        </View>
        <View style={styles.loginPrompt}>
          <View style={styles.loginIconCircle}>
            <Text style={styles.loginIcon}>D</Text>
          </View>
          <Text style={styles.loginText}>Log in to view your duels</Text>
          <AnimatedButton style={styles.loginButton} onPress={onLogin}>
            <Text style={styles.loginButtonText}>Log In</Text>
          </AnimatedButton>
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
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
    <SafeAreaView style={styles.container}>
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
            <Text style={styles.statValue}>{stats?.winRate || 0}%</Text>
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
                      {duel.opponent_username || 'Someone'} challenged you!
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
          <View style={styles.codeCard}>
            <TextInput
              style={[styles.codeInput, inputFocused && styles.codeInputFocused]}
              placeholder="Enter invite code"
              placeholderTextColor="#F2C94C"
              value={inviteCode}
              onChangeText={setInviteCode}
              onFocus={() => setInputFocused(true)}
              onBlur={() => setInputFocused(false)}
              autoCapitalize="characters"
              maxLength={6}
            />
            <AnimatedButton
              style={[
                styles.joinButton,
                !inviteCode.trim() && styles.joinButtonDisabled,
              ]}
              onPress={handleJoinByCode}
              disabled={joiningCode || !inviteCode.trim()}
            >
              {joiningCode ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={[
                  styles.joinButtonText,
                  !inviteCode.trim() && styles.joinButtonTextDisabled,
                ]}>JOIN</Text>
              )}
            </AnimatedButton>
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
                        vs {duel.opponent_username || 'Unknown'}
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
            <View style={styles.sportOptions}>
              {(['nba', 'pl', 'nfl', 'mlb'] as Sport[]).map((sport) => (
                <TouchableOpacity
                  key={sport}
                  style={[styles.sportOption, { backgroundColor: getSportColor(sport) }]}
                  onPress={() => handleSportSelect(sport)}
                  activeOpacity={0.8}
                >
                  <Image source={sportIcons[sport]} style={styles.sportOptionIcon} />
                  <Text style={styles.sportOptionText}>{sportNames[sport]}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              style={styles.modalCancelButton}
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
            style={styles.modalContent}
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
            <AnimatedButton
              style={[styles.confirmChallengeButton, { backgroundColor: selectedSport ? getSportColor(selectedSport) : ACCENT_COLOR }]}
              onPress={handleConfirmChallenge}
            >
              <Text style={styles.confirmChallengeButtonText}>Create Challenge</Text>
            </AnimatedButton>
            <TouchableOpacity
              style={styles.modalCancelButton}
              onPress={() => setQuestionCountPickerVisible(false)}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
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
              Cancel this duel{duelToCancel?.opponent_username ? ` with ${duelToCancel.opponent_username}` : ''}?
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

      {/* Toast Notification */}
      {showCancelToast && (
        <Animated.View style={[styles.toast, { opacity: toastOpacity }]}>
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
    paddingBottom: 24,
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
    marginBottom: 12,
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
  codeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#000000',
    paddingVertical: 16,
    paddingLeft: 16,
    paddingRight: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  codeInput: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    fontFamily: 'DMSans_700Bold',
    color: '#1A1A1A',
    textAlign: 'center',
    borderWidth: 2,
    borderColor: '#000000',
  },
  codeInputFocused: {
    borderColor: '#1ABC9C',
  },
  joinButton: {
    backgroundColor: '#F2C94C',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 16,
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
    backgroundColor: '#E8E8E8',
  },
  joinButtonText: {
    fontSize: 14,
    fontFamily: 'DMSans_900Black',
    color: '#1A1A1A',
  },
  joinButtonTextDisabled: {
    color: '#999999',
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
    tintColor: '#FFFFFF',
    marginRight: 12,
  },
  sportOptionText: {
    fontSize: 14,
    fontFamily: 'DMSans_900Black',
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
    backgroundColor: ACCENT_COLOR,
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
  confirmChallengeButtonText: {
    fontSize: 12,
    fontFamily: 'DMSans_900Black',
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
    overflow: 'hidden',
    borderRadius: 8,
  },
  cancelButtonContainer: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: SWIPE_THRESHOLD,
    justifyContent: 'center',
    alignItems: 'center',
    paddingLeft: 8,
  },
  swipeCancelButton: {
    backgroundColor: '#E53935',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
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
    textTransform: 'uppercase',
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
    bottom: 16,
    left: 24,
    right: 24,
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#000000',
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  toastText: {
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
    color: '#FFFFFF',
  },
});
