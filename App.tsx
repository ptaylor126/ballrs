import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
  Animated,
  Easing,
  AppState,
  AppStateStatus,
  Platform,
  Share,
} from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { setupGlobalErrorHandlers, logStartupError } from './src/lib/startupLogger';

// Set up global error handlers as early as possible to catch startup crashes
try {
  setupGlobalErrorHandlers();
} catch (error) {
  console.warn('Failed to setup global error handlers:', error);
}

// Keep native splash screen visible until we're ready
// Wrapped in try-catch to prevent Android crashes if native module isn't ready
try {
  SplashScreen.preventAutoHideAsync();
} catch (error) {
  console.warn('SplashScreen.preventAutoHideAsync() failed:', error);
  logStartupError(error instanceof Error ? error : new Error(String(error)), 'startup');
}
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  AnimatedButton,
  AnimatedCard,
  AnimatedCheckmark,
  PulsingIcon,
} from './src/components/AnimatedComponents';
import {
  useFonts,
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
  DMSans_700Bold,
  DMSans_900Black,
} from '@expo-google-fonts/dm-sans';
import { colors, shadows, getSportColor, getSportName, getSportEmoji, Sport, borders, borderRadius } from './src/lib/theme';
import { getUserXP, getXPProgressInLevel, getXPForLevel } from './src/lib/xpService';
import { fetchUserStats, UserStats, getStreak } from './src/lib/statsService';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import ErrorBoundary from './src/components/ErrorBoundary';
import OnboardingScreen from './src/screens/OnboardingScreen';
import CluePuzzleScreen from './src/screens/CluePuzzleScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import SetUsernameScreen from './src/screens/SetUsernameScreen';
import CountryPickerScreen from './src/screens/CountryPickerScreen';
import SportsPickerScreen from './src/screens/SportsPickerScreen';
import LeaderboardScreen from './src/screens/LeaderboardScreen';
import WaitingForOpponentScreen from './src/screens/WaitingForOpponentScreen';
import DuelGameScreen from './src/screens/DuelGameScreen';
import InviteFriendScreen from './src/screens/InviteFriendScreen';
import ChallengeSetupScreen from './src/screens/ChallengeSetupScreen';
import LeaguesScreen from './src/screens/LeaguesScreen';
import LeagueDetailScreen from './src/screens/LeagueDetailScreen';
import AchievementsScreen from './src/screens/AchievementsScreen';
import CustomizeProfileScreen from './src/screens/CustomizeProfileScreen';
import LinkEmailScreen from './src/screens/LinkEmailScreen';
import FriendsScreen from './src/screens/FriendsScreen';
import FriendChallengeListener from './src/components/FriendChallengeListener';
import AdBanner from './src/components/AdBanner';
import CreateLeagueModal from './src/components/CreateLeagueModal';
import JoinLeagueModal from './src/components/JoinLeagueModal';
import BottomNavBar, { TabName } from './src/components/BottomNavBar';
import LevelProgressionModal from './src/components/LevelProgressionModal';
import DuelsScreen from './src/screens/DuelsScreen';
import AnimatedSplashScreen from './src/screens/AnimatedSplashScreen';
import { getProfile, updateLastActive } from './src/lib/profilesService';
import { getUserPreferences, getDefaultSports } from './src/lib/userPreferencesService';
import { joinPresence, leavePresence } from './src/lib/presenceService';
import { Duel, DuelWithOpponent, findWaitingDuel, createDuel, joinDuel, getIncomingChallenges, getActiveDuels, getPendingAsyncChallengesCount, createInviteDuel, createAsyncDuel } from './src/lib/duelService';
import { getPendingFriendRequestsCount, subscribeToFriendRequests, unsubscribeFromFriendRequests } from './src/lib/friendsService';
import { addNotificationListeners, updateStreakReminderFromStats } from './src/lib/notificationService';
import { getDuelById } from './src/lib/duelService';
import { getCompletedSportsToday } from './src/lib/dailyPuzzleService';
import { LeagueWithMemberCount, getUserLeagues, getLeagueLeaderboard, LeagueMember } from './src/lib/leaguesService';
import { getGlobalLeaderboard, LeaderboardEntry } from './src/lib/pointsService';
import nbaTriviaData from './data/nba-trivia.json';
import plTriviaData from './data/pl-trivia.json';
import nflTriviaData from './data/nfl-trivia.json';
import mlbTriviaData from './data/mlb-trivia.json';
import { TriviaQuestion } from './src/lib/duelService';
import { getSmartQuestionId, resetDuelSession, selectQuestionsForDuel } from './src/lib/questionSelectionService';
import { soundService } from './src/lib/soundService';

const ONBOARDING_KEY = '@ballrs_onboarding_complete';

// Get level title based on level number
function getLevelTitle(level: number): string {
  if (level >= 100) return 'Hall of Famer';
  if (level >= 50) return 'Legend';
  if (level >= 40) return 'Master';
  if (level >= 30) return 'Expert';
  if (level >= 20) return 'Veteran';
  if (level >= 10) return 'Pro';
  if (level >= 5) return 'Rising Star';
  return 'Rookie';
}

// Sport icon images
const sportIcons = {
  nba: require('./assets/images/icon-basketball.png'),
  pl: require('./assets/images/icon-soccer.png'),
  nfl: require('./assets/images/icon-football.png'),
  mlb: require('./assets/images/icon-baseball.png'),
};

// Fire icon for streak display
const fireIcon = require('./assets/images/icon-fire.png');

// Animated fire icon with bounce-in on load
function AnimatedFireIcon({ totalStreak }: { totalStreak: number }) {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const countAnim = useRef(new Animated.Value(0)).current;
  const [displayCount, setDisplayCount] = useState(0);

  useEffect(() => {
    // Bounce in the fire icon
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 5,
      tension: 100,
      useNativeDriver: true,
    }).start();

    // Count up the streak number
    const listener = countAnim.addListener(({ value }) => {
      setDisplayCount(Math.round(value));
    });

    Animated.timing(countAnim, {
      toValue: totalStreak,
      duration: 600,
      easing: Easing.out(Easing.ease),
      useNativeDriver: false,
    }).start();

    return () => countAnim.removeListener(listener);
  }, [totalStreak]);

  return (
    <View style={styles.streakBox}>
      <Animated.Image
        source={fireIcon}
        style={[styles.fireIcon, { transform: [{ scale: scaleAnim }] }]}
        resizeMode="contain"
      />
      <Text style={styles.streakNumber}>{displayCount}</Text>
    </View>
  );
}

// Check icon for completed sports
const checkIcon = require('./assets/images/icon-check.png');

type Screen = 'home' | 'nba' | 'pl' | 'nfl' | 'mlb' | 'nbaDaily' | 'plDaily' | 'nflDaily' | 'mlbDaily' | 'profile' | 'setUsername' | 'selectSports' | 'selectCountry' | 'leaderboard' | 'waitingForOpponent' | 'duelGame' | 'asyncDuelGame' | 'inviteFriend' | 'challengeSetup' | 'leagues' | 'leagueDetail' | 'achievements' | 'customizeProfile' | 'linkEmail';

// Constants for AsyncStorage keys
const SELECTED_SPORT_TAB_KEY = '@ballrs_selected_sport_tab';

// Helper to get ordinal suffix (1st, 2nd, 3rd, etc.)
function getOrdinalSuffix(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// League with user position info
interface LeagueWithPosition extends LeagueWithMemberCount {
  userPosition: number;
  userPoints: number;
  totalMembers: number;
}

interface HomeScreenProps {
  onDailyPuzzle: (sport: Sport) => void;
  onDuel: (sport: Sport) => void;
  onProfilePress: () => void;
  onNavigateToDuel: (duel: DuelWithOpponent) => void;
  onNavigateToLeague: (league: LeagueWithMemberCount) => void;
  refreshKey?: number;
  selectedSports?: Sport[] | null;
}

function HomeScreen({ onDailyPuzzle, onDuel, onProfilePress, onNavigateToDuel, onNavigateToLeague, refreshKey, selectedSports }: HomeScreenProps) {
  const { user, loading: authLoading } = useAuth();
  const [xp, setXP] = useState(0);
  const [level, setLevel] = useState(1);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [completedToday, setCompletedToday] = useState<Set<Sport>>(new Set());
  const [showLevelModal, setShowLevelModal] = useState(false);

  // New state for tab-based design
  const [selectedSportTab, setSelectedSportTab] = useState<Sport | null>(null);
  const [activeDuels, setActiveDuels] = useState<DuelWithOpponent[]>([]);
  const [incomingChallenges, setIncomingChallenges] = useState<DuelWithOpponent[]>([]);
  const [userLeagues, setUserLeagues] = useState<LeagueWithPosition[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [tabIndicatorAnim] = useState(new Animated.Value(0));

  // Animated XP bar
  const xpBarAnim = useRef(new Animated.Value(0)).current;

  // Card entrance animation
  const cardAnim = useRef({
    opacity: new Animated.Value(0),
    translateY: new Animated.Value(15),
  }).current;

  // All available sports
  const allSportCards: { sport: Sport; name: string }[] = [
    { sport: 'nba', name: 'NBA' },
    { sport: 'pl', name: 'EPL' },
    { sport: 'nfl', name: 'NFL' },
    { sport: 'mlb', name: 'MLB' },
  ];

  // Filter to only show selected sports (default to all if not specified)
  const sportTabs = selectedSports && selectedSports.length > 0
    ? allSportCards.filter(card => selectedSports.includes(card.sport))
    : allSportCards;

  // Load saved tab from AsyncStorage on mount
  useEffect(() => {
    const loadSavedTab = async () => {
      try {
        const savedTab = await AsyncStorage.getItem(SELECTED_SPORT_TAB_KEY);
        if (savedTab && sportTabs.some(t => t.sport === savedTab)) {
          setSelectedSportTab(savedTab as Sport);
        } else if (sportTabs.length > 0) {
          setSelectedSportTab(sportTabs[0].sport);
        }
      } catch (error) {
        console.error('Error loading saved sport tab:', error);
        if (sportTabs.length > 0) {
          setSelectedSportTab(sportTabs[0].sport);
        }
      }
    };
    loadSavedTab();
  }, [sportTabs.length]);

  // Handle tab change with persistence
  const handleTabChange = async (sport: Sport) => {
    setSelectedSportTab(sport);
    try {
      await AsyncStorage.setItem(SELECTED_SPORT_TAB_KEY, sport);
    } catch (error) {
      console.error('Error saving sport tab:', error);
    }

    // Animate tab indicator
    const tabIndex = sportTabs.findIndex(t => t.sport === sport);
    Animated.spring(tabIndicatorAnim, {
      toValue: tabIndex,
      friction: 8,
      tension: 100,
      useNativeDriver: true,
    }).start();
  };

  // Fetch leaderboard when selected sport changes
  useEffect(() => {
    const fetchLeaderboard = async () => {
      if (!selectedSportTab) return;
      // If only 1 sport selected, use that. Otherwise use selected tab.
      const sportFilter = sportTabs.length === 1 ? sportTabs[0].sport : selectedSportTab;
      const data = await getGlobalLeaderboard('weekly', sportFilter, 5);
      setLeaderboard(data);
    };
    fetchLeaderboard();
  }, [selectedSportTab, sportTabs.length]);

  useEffect(() => {
    const loadData = async () => {
      // Always load completion status (works for logged out users too via AsyncStorage)
      const completed = await getCompletedSportsToday();
      setCompletedToday(completed);

      if (user) {
        const [xpData, userStats, duels, challenges, leagues] = await Promise.all([
          getUserXP(user.id),
          fetchUserStats(user.id),
          getActiveDuels(user.id),
          getIncomingChallenges(user.id),
          getUserLeagues(user.id),
        ]);
        if (xpData) {
          setXP(xpData.xp);
          setLevel(xpData.level);
        }
        if (userStats) {
          setStats(userStats);
          // Schedule streak reminder notification for 8pm if user hasn't played today
          updateStreakReminderFromStats(user.id);
        }
        setActiveDuels(duels);
        setIncomingChallenges(challenges);

        // Get user positions in each league
        const leaguesWithPositions: LeagueWithPosition[] = [];
        for (const league of leagues) {
          const members = await getLeagueLeaderboard(league.id, 'all_time');
          const userIndex = members.findIndex(m => m.user_id === user.id);
          const userMember = members.find(m => m.user_id === user.id);
          leaguesWithPositions.push({
            ...league,
            userPosition: userIndex >= 0 ? userIndex + 1 : 0,
            userPoints: userMember?.points_all_time || 0,
            totalMembers: members.length,
          });
        }
        setUserLeagues(leaguesWithPositions.slice(0, 3)); // Max 3 leagues shown
      } else {
        setXP(0);
        setLevel(1);
        setStats(null);
        setActiveDuels([]);
        setIncomingChallenges([]);
        setUserLeagues([]);
      }
    };
    loadData();
  }, [user, refreshKey]);

  // Get daily streak (consecutive days played)
  const getTotalStreak = () => {
    if (!stats) return 0;
    return stats.daily_streak || 0;
  };

  // Get sport-specific streak
  const getSportStreak = (sport: Sport) => {
    if (!stats) return 0;
    return getStreak(stats, sport);
  };

  const progress = getXPProgressInLevel(xp);
  const nextLevelXP = getXPForLevel(level + 1);
  const currentLevelXP = getXPForLevel(level);
  const xpIntoLevel = xp - currentLevelXP;
  const xpNeededForNext = nextLevelXP - currentLevelXP;

  const totalStreak = getTotalStreak();

  // Animate XP bar when progress changes
  useEffect(() => {
    Animated.timing(xpBarAnim, {
      toValue: progress.percentage,
      duration: 500,
      easing: Easing.out(Easing.ease),
      useNativeDriver: false,
    }).start();
  }, [progress.percentage]);

  const xpBarWidth = xpBarAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  // Trigger card entrance animation on mount
  useEffect(() => {
    Animated.parallel([
      Animated.timing(cardAnim.opacity, {
        toValue: 1,
        duration: 300,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(cardAnim.translateY, {
        toValue: 0,
        duration: 300,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // Combine active duels and incoming challenges for display
  const allActiveDuels = [...activeDuels, ...incomingChallenges];

  // Get status label for duel card
  const getDuelStatusLabel = (duel: DuelWithOpponent): string => {
    if (duel.status === 'invite' && duel.player2_id === user?.id) {
      return 'New Challenge';
    }
    if (duel.status === 'waiting' || duel.status === 'invite') {
      return 'Waiting';
    }
    if (duel.status === 'waiting_for_p2') {
      return 'Waiting';
    }
    return 'Your Turn';
  };

  // Handle invite friends share
  const handleInviteFriends = async () => {
    try {
      await Share.share({
        message: 'Challenge me on Ballrs! Download the app and test your sports knowledge.',
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  // Selected sport info
  const selectedSportInfo = sportTabs.find(s => s.sport === selectedSportTab);
  const sportColor = selectedSportTab ? getSportColor(selectedSportTab) : colors.primary;
  const isCompleted = selectedSportTab ? completedToday.has(selectedSportTab) : false;
  const sportStreak = selectedSportTab ? getSportStreak(selectedSportTab) : 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>BALLRS</Text>
          <TouchableOpacity style={styles.headerAvatar} onPress={onProfilePress} activeOpacity={0.7}>
            <Image source={require('./assets/images/icon-profile.png')} style={styles.headerAvatarIcon} resizeMode="contain" />
          </TouchableOpacity>
        </View>

        {/* Level & XP Bar */}
        {authLoading && (
          <View style={styles.levelSection}>
            <View style={[styles.combinedLevelBadge, { backgroundColor: '#E8E8E8' }]}>
              <ActivityIndicator size="small" color="#888" style={{ marginHorizontal: 16, marginVertical: 6 }} />
            </View>
          </View>
        )}
        {!authLoading && !user && (
          <View style={styles.levelSection}>
            <View style={[styles.combinedLevelBadge, { backgroundColor: '#FFE0E0' }]}>
              <Text style={[styles.levelBadgeText, { paddingHorizontal: 12, paddingVertical: 6, color: '#E53935' }]}>
                Not signed in - check console
              </Text>
            </View>
          </View>
        )}
        {user && (
          <View style={styles.levelSection}>
            <View style={styles.levelBadgeContainer}>
              <TouchableOpacity
                style={styles.combinedLevelBadge}
                onPress={() => setShowLevelModal(true)}
                activeOpacity={0.8}
              >
                <View style={styles.levelSection_left}>
                  <Text style={styles.levelBadgeText}>LEVEL {level}</Text>
                </View>
                <View style={styles.levelDivider} />
                <View style={styles.levelSection_middle}>
                  <Text style={styles.levelTitleText}>{getLevelTitle(level)}</Text>
                </View>
                <View style={styles.levelDivider} />
                <View style={styles.levelSection_right}>
                  <Image source={fireIcon} style={styles.levelFireIcon} resizeMode="contain" />
                  <Text style={styles.levelStreakText}>{totalStreak}</Text>
                </View>
              </TouchableOpacity>
            </View>
            <Text style={styles.xpLabel}>{xp.toLocaleString()}/{nextLevelXP.toLocaleString()} XP</Text>
            <View style={styles.xpBarOuterContainer}>
              <View style={styles.xpBarOuter}>
                <Animated.View style={[styles.xpBarFillContainer, { width: xpBarWidth }]}>
                  <LinearGradient
                    colors={[colors.xpGradientStart, colors.xpGradientEnd]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.xpBarFill}
                  />
                </Animated.View>
              </View>
            </View>
          </View>
        )}

        {/* Sport Tabs - only show if 2+ sports selected */}
        {sportTabs.length >= 2 && selectedSportTab && (
          <View style={styles.sportTabsContainer}>
            {sportTabs.map((tab) => {
              const tabColor = getSportColor(tab.sport);
              const isActive = tab.sport === selectedSportTab;
              return (
                <TouchableOpacity
                  key={tab.sport}
                  style={[
                    styles.sportTab,
                    isActive && { backgroundColor: tabColor },
                  ]}
                  onPress={() => handleTabChange(tab.sport)}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.sportTabText,
                    isActive && styles.sportTabTextActive,
                  ]}>
                    {tab.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Single Sport Card */}
        {selectedSportTab && selectedSportInfo && (
          <View style={styles.sportGrid}>
            <Animated.View
              style={{
                width: '100%',
                opacity: cardAnim.opacity,
                transform: [{ translateY: cardAnim.translateY }],
              }}
            >
              <AnimatedCard style={styles.singleSportCard}>
                {/* Status indicator in top right */}
                {isCompleted ? (
                  <View style={styles.statusIndicatorTopRight}>
                    <Image source={checkIcon} style={[styles.completedIconTopRight, { tintColor: sportColor }]} />
                  </View>
                ) : (
                  <View style={[styles.statusIndicatorTopRight, styles.notPlayedDotTopRight, { backgroundColor: sportColor }]} />
                )}
                {/* Top section - Icon, Name, and Status */}
                <View style={styles.singleSportHeader}>
                  <View style={[styles.singleSportIconContainer, { backgroundColor: sportColor }]}>
                    <Image source={sportIcons[selectedSportTab]} style={styles.singleSportIcon} />
                  </View>
                  <View style={styles.singleSportInfo}>
                    <Text style={styles.singleSportName}>{selectedSportInfo.name}</Text>
                    {sportStreak > 0 && (
                      <View style={styles.sportStreakBadge}>
                        <Image source={fireIcon} style={styles.sportStreakIcon} resizeMode="contain" />
                        <Text style={styles.sportStreakText}>{sportStreak} day streak</Text>
                      </View>
                    )}
                  </View>
                </View>

                {/* Bottom section - Buttons */}
                <View style={styles.singleSportButtons}>
                  <AnimatedButton
                    style={[styles.singleDailyButton, { backgroundColor: sportColor }]}
                    onPress={() => onDailyPuzzle(selectedSportTab)}
                  >
                    <Text style={styles.singleDailyButtonText}>DAILY</Text>
                  </AnimatedButton>

                  <AnimatedButton
                    style={styles.singleDuelButton}
                    onPress={() => onDuel(selectedSportTab)}
                  >
                    <Text style={styles.singleDuelButtonText}>DUEL</Text>
                  </AnimatedButton>
                </View>
              </AnimatedCard>
            </Animated.View>
          </View>
        )}

        {/* Active Duels Section - only show when there are active duels */}
        {user && allActiveDuels.length > 0 && (
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Active Duels</Text>
              <Text style={styles.countText}>({allActiveDuels.length})</Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.duelsScrollContent}
            >
              {allActiveDuels.map((duel) => {
                const duelColor = getSportColor(duel.sport);
                const statusLabel = getDuelStatusLabel(duel);
                const isNewChallenge = statusLabel === 'New Challenge';
                return (
                  <TouchableOpacity
                    key={duel.id}
                    style={styles.duelCard}
                    onPress={() => onNavigateToDuel(duel)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.duelCardTop}>
                      <View style={[styles.duelSportIcon, { backgroundColor: duelColor }]}>
                        <Image source={sportIcons[duel.sport]} style={styles.duelSportIconImage} />
                      </View>
                      <View style={[
                        styles.duelStatusBadge,
                        isNewChallenge && styles.duelStatusBadgeNew,
                      ]}>
                        <Text style={[
                          styles.duelStatusText,
                          isNewChallenge && styles.duelStatusTextNew,
                        ]}>
                          {statusLabel}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.duelOpponentName} numberOfLines={1}>
                      {duel.opponent_username || 'Waiting...'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Leaderboard Section */}
        {user && leaderboard.length > 0 && (
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                {sportTabs.length === 1 ? sportTabs[0].name : sportTabs.find(t => t.sport === selectedSportTab)?.name || 'NBA'} Leaderboard
              </Text>
              <Text style={styles.countText}>(Weekly)</Text>
            </View>
            <View style={styles.leaderboardList}>
              {leaderboard.map((entry, index) => (
                <View key={entry.user_id} style={[
                  styles.leaderboardRow,
                  index === leaderboard.length - 1 && { borderBottomWidth: 0 },
                ]}>
                  <View style={[
                    styles.leaderboardRank,
                    index === 0 && styles.leaderboardRankFirst,
                    index === 1 && styles.leaderboardRankSecond,
                    index === 2 && styles.leaderboardRankThird,
                  ]}>
                    <Text style={[
                      styles.leaderboardRankText,
                      index < 3 && styles.leaderboardRankTextTop3,
                    ]}>
                      {entry.rank}
                    </Text>
                  </View>
                  <Text style={[
                    styles.leaderboardUsername,
                    entry.user_id === user.id && styles.leaderboardUsernameMe,
                  ]} numberOfLines={1}>
                    {entry.username}{entry.user_id === user.id ? ' (You)' : ''}
                  </Text>
                  <Text style={styles.leaderboardPoints}>{entry.points} pts</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* League Standings Section */}
        {user && (
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>Your Leagues</Text>
            {userLeagues.length > 0 ? (
              <View style={styles.leaguesList}>
                {userLeagues.map((league) => (
                  <TouchableOpacity
                    key={league.id}
                    style={styles.leagueRow}
                    onPress={() => onNavigateToLeague(league)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.leagueInfo}>
                      <Text style={styles.leagueName} numberOfLines={1}>{league.name}</Text>
                      <Text style={styles.leaguePosition}>
                        {getOrdinalSuffix(league.userPosition)} of {league.totalMembers}
                      </Text>
                    </View>
                    <View style={styles.leaguePoints}>
                      <Text style={styles.leaguePointsText}>{league.userPoints} pts</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <View style={styles.emptyStateContainer}>
                <Text style={styles.emptyStateText}>No leagues yet</Text>
                <AnimatedButton
                  style={styles.emptyStateButton}
                  onPress={() => {}}
                >
                  <Text style={styles.emptyStateButtonText}>Join or Create League</Text>
                </AnimatedButton>
              </View>
            )}
          </View>
        )}

        {/* Invite Friends Card */}
        <View style={styles.inviteFriendsCard}>
          <Text style={styles.inviteFriendsTitle}>Invite Friends</Text>
          <Text style={styles.inviteFriendsText}>Challenge friends to duels and compete together!</Text>
          <AnimatedButton
            style={styles.inviteFriendsButton}
            onPress={handleInviteFriends}
          >
            <Text style={styles.inviteFriendsButtonText}>SHARE</Text>
          </AnimatedButton>
        </View>
      </ScrollView>

      {/* Level Progression Modal */}
      <LevelProgressionModal
        visible={showLevelModal}
        onClose={() => setShowLevelModal(false)}
        currentLevel={level}
        currentXP={xp}
      />
    </SafeAreaView>
  );
}

function AppContent() {
  const { user, loading: authLoading, signInAnonymously, signOut } = useAuth();
  const [currentScreen, setCurrentScreen] = useState<Screen>('home');
  const [activeTab, setActiveTab] = useState<TabName>('home');
  const [hasProfile, setHasProfile] = useState<boolean | null>(null);
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState<boolean | null>(null);
  // Ref to prevent auto sign-in during account deletion (state updates are batched)
  const isDeletingAccountRef = useRef(false);
  // Ref to track if we just completed onboarding (to prevent reset loop)
  const justCompletedOnboardingRef = useRef(false);
  const [currentDuel, setCurrentDuel] = useState<Duel | null>(null);
  const [duelSport, setDuelSport] = useState<Sport>('nba');
  const [duelQuestionCount, setDuelQuestionCount] = useState<number>(1);
  const [showCreateLeagueModal, setShowCreateLeagueModal] = useState(false);
  const [showJoinLeagueModal, setShowJoinLeagueModal] = useState(false);
  const [currentLeague, setCurrentLeague] = useState<LeagueWithMemberCount | null>(null);
  const [homeRefreshKey, setHomeRefreshKey] = useState(0);
  const [incomingChallengesCount, setIncomingChallengesCount] = useState(0);
  const [pendingAsyncChallengesCount, setPendingAsyncChallengesCount] = useState(0);
  const [pendingFriendRequestsCount, setPendingFriendRequestsCount] = useState(0);
  const [showAnimatedSplash, setShowAnimatedSplash] = useState(true);
  const [autoStartDuelSport, setAutoStartDuelSport] = useState<Sport | null>(null);
  const [isAsyncDuel, setIsAsyncDuel] = useState(false);
  const [isAsyncChallenger, setIsAsyncChallenger] = useState(false);
  const [selectedSports, setSelectedSports] = useState<Sport[] | null>(null);

  // Initialize sound service
  useEffect(() => {
    soundService.initialize();
  }, []);

  // Check if onboarding has been completed
  useEffect(() => {
    const checkOnboarding = async () => {
      try {
        // DEBUG: Uncomment to force onboarding on every app start
        // await AsyncStorage.removeItem(ONBOARDING_KEY);

        const seen = await AsyncStorage.getItem(ONBOARDING_KEY);
        console.log('Onboarding check:', { seen, hasSeenOnboarding: seen === 'true' });
        setHasSeenOnboarding(seen === 'true');
      } catch (error) {
        // If error reading, assume onboarding completed to not block users
        console.error('Error checking onboarding:', error);
        setHasSeenOnboarding(true);
      }
    };
    checkOnboarding();
  }, []);

  const handleOnboardingComplete = () => {
    // Reset deletion flag so auto sign-in works after onboarding
    isDeletingAccountRef.current = false;
    // Mark that we just completed onboarding (to prevent reset loop in checkProfile)
    justCompletedOnboardingRef.current = true;
    setHasSeenOnboarding(true);
    // Splash already played during onboarding, don't show again
    setShowAnimatedSplash(false);
  };

  const handleReplayOnboarding = async () => {
    // Clear the AsyncStorage key so onboarding will show on next app launch too
    await AsyncStorage.removeItem(ONBOARDING_KEY);
    setHasSeenOnboarding(false);
    setShowAnimatedSplash(true); // Show splash animation before onboarding
  };

  const [authError, setAuthError] = useState<string | null>(null);

  // Debug auth state
  useEffect(() => {
    console.log('Auth state:', { hasSeenOnboarding, authLoading, user: user?.id, isAnonymous: user?.is_anonymous });
  }, [hasSeenOnboarding, authLoading, user]);

  // Auto sign in anonymously when onboarding is complete and no user exists
  useEffect(() => {
    const autoSignIn = async () => {
      // Don't auto sign-in if we're in the middle of deleting an account
      if (isDeletingAccountRef.current) {
        console.log('Skipping auto sign-in - account deletion in progress');
        return;
      }
      if (hasSeenOnboarding && !authLoading && !user) {
        console.log('Auto signing in anonymously...');
        setAuthError(null);
        const { error } = await signInAnonymously();
        if (error) {
          console.error('Anonymous sign in error:', error);
          setAuthError(error.message || 'Failed to sign in.');
          Alert.alert(
            'Sign In Error',
            `Could not create account: ${error.message}\n\nPlease try again.`,
            [{ text: 'OK' }]
          );
        } else {
          console.log('Anonymous sign in successful!');
        }
      }
    };
    autoSignIn();
  }, [hasSeenOnboarding, authLoading, user, signInAnonymously]);

  const refreshChallengesCount = useCallback(async () => {
    if (user) {
      const [challenges, asyncCount, friendRequestsCount] = await Promise.all([
        getIncomingChallenges(user.id),
        getPendingAsyncChallengesCount(user.id),
        getPendingFriendRequestsCount(user.id),
      ]);
      setIncomingChallengesCount(challenges.length);
      setPendingAsyncChallengesCount(asyncCount);
      setPendingFriendRequestsCount(friendRequestsCount);
    } else {
      setIncomingChallengesCount(0);
      setPendingAsyncChallengesCount(0);
      setPendingFriendRequestsCount(0);
    }
  }, [user]);

  // Subscribe to real-time friend request updates
  useEffect(() => {
    if (!user) return;

    const channel = subscribeToFriendRequests(user.id, (count) => {
      setPendingFriendRequestsCount(count);
    });

    return () => {
      unsubscribeFromFriendRequests(channel);
    };
  }, [user]);

  useEffect(() => {
    refreshChallengesCount();
    const interval = setInterval(refreshChallengesCount, 30000);
    return () => clearInterval(interval);
  }, [refreshChallengesCount]);

  useEffect(() => {
    if (homeRefreshKey > 0) {
      refreshChallengesCount();
    }
  }, [homeRefreshKey, refreshChallengesCount]);

  useEffect(() => {
    const checkProfile = async () => {
      if (user) {
        console.log('checkProfile: checking for user', user.id, 'isAnonymous:', user.is_anonymous);
        const profile = await getProfile(user.id);
        console.log('checkProfile: profile result', { userId: user.id, hasProfile: !!profile, profile });

        // Check if profile has a real username (not the default user_XXXXXXXX pattern from DB trigger)
        const hasRealUsername = !!(profile?.username && !profile.username.startsWith('user_'));
        setHasProfile(hasRealUsername);

        if (!hasRealUsername) {
          // Check if this is a fresh anonymous user who should see onboarding
          // Skip this check if we just completed onboarding (to prevent infinite loop)
          if (user.is_anonymous && !justCompletedOnboardingRef.current) {
            const preferences = await getUserPreferences(user.id);
            if (!preferences) {
              console.log('checkProfile: fresh anonymous user detected, resetting to onboarding');
              // Sign out this stale user and reset onboarding
              // A new anonymous user will be created after onboarding completes
              await signOut();
              await AsyncStorage.removeItem(ONBOARDING_KEY);
              setHasSeenOnboarding(false);
              setHasProfile(null);
              setShowAnimatedSplash(true);
              return;
            }
          }
          setCurrentScreen('setUsername');
        }

        // Update last_active for online status tracking
        updateLastActive(user.id);

        // Load user's sport preferences (only if not already set from onboarding)
        const preferences = await getUserPreferences(user.id);
        console.log('checkProfile: loaded preferences', preferences);
        if (preferences) {
          console.log('checkProfile: setting sports from DB', preferences.selected_sports);
          setSelectedSports(preferences.selected_sports);
        } else {
          // Default to all sports for existing users without preferences
          console.log('checkProfile: no preferences found, defaulting to all sports');
          setSelectedSports(getDefaultSports());
        }
      } else {
        setHasProfile(null);
        setSelectedSports(null);
      }
    };
    checkProfile();
  }, [user]);

  // Manage presence for real-time online status
  useEffect(() => {
    if (!user) {
      leavePresence();
      return;
    }

    // Join presence when user is logged in
    joinPresence(user.id);

    // Handle app state changes (foreground/background)
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        // App came to foreground - rejoin presence
        joinPresence(user.id);
        updateLastActive(user.id);
      } else if (nextAppState === 'background' || nextAppState === 'inactive') {
        // App went to background - leave presence
        leavePresence();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
      leavePresence();
    };
  }, [user]);

  // Handle notification taps - navigate to duel results when async duel is completed
  useEffect(() => {
    const cleanup = addNotificationListeners(
      // On notification received (while app is open)
      undefined,
      // On notification tap
      async (response) => {
        const data = response.notification.request.content.data;
        console.log('Notification tapped:', data);

        // Handle duel_complete notification (new format)
        if (data?.type === 'duel_complete' && data?.duelId) {
          const duel = await getDuelById(data.duelId as string);
          if (duel) {
            setCurrentDuel(duel);
            setIsAsyncDuel(true);
            setIsAsyncChallenger(duel.player1_id === user?.id);
            setCurrentScreen('asyncDuelGame');
          }
        }
        // Handle duel_challenge notification (new format)
        else if (data?.type === 'duel_challenge' && data?.duelId) {
          const duel = await getDuelById(data.duelId as string);
          if (duel) {
            setCurrentDuel(duel);
            setIsAsyncDuel(true);
            setIsAsyncChallenger(false); // Recipient is player2
            setCurrentScreen('asyncDuelGame');
          }
        }
        // Legacy: async_duel_completed
        else if (data?.type === 'async_duel_completed' && data?.duelId) {
          const duel = await getDuelById(data.duelId as string);
          if (duel) {
            setCurrentDuel(duel);
            setIsAsyncDuel(true);
            setIsAsyncChallenger(duel.player1_id === user?.id);
            setCurrentScreen('asyncDuelGame');
          }
        }
        // Legacy: challenge with invite code
        else if (data?.type === 'challenge' && data?.inviteCode) {
          setActiveTab('duels');
          setCurrentScreen('home');
        }
        // Handle friend request notification
        else if (data?.type === 'friend_request') {
          setActiveTab('friends');
          setCurrentScreen('home');
        }
        // Handle friend accepted notification
        else if (data?.type === 'friend_accepted') {
          setActiveTab('friends');
          setCurrentScreen('home');
        }
      }
    );

    return cleanup;
  }, [user]);

  const handleBack = () => {
    setCurrentDuel(null);
    setActiveTab('home');
    setCurrentScreen('home');
    setHomeRefreshKey(prev => prev + 1);
  };

  // Handler for account deletion - resets to fresh state
  const handleAccountDeleted = async () => {
    // Set flag to prevent auto sign-in race condition
    isDeletingAccountRef.current = true;
    // Clear onboarding flag so new user sees onboarding
    await AsyncStorage.removeItem(ONBOARDING_KEY);
    setHasSeenOnboarding(false);
    setHasProfile(null);
    setShowAnimatedSplash(true);
  };

  const handleAuthSuccess = async () => {
    setCurrentScreen('home');
  };

  const handleUsernameSet = () => {
    // Clear the onboarding ref since user has now set up their profile
    justCompletedOnboardingRef.current = false;
    setHasProfile(true);
    setCurrentScreen('selectSports');
  };

  // Handler for when user completes sports selection
  const handleSportsSelected = (sports: Sport[]) => {
    console.log('handleSportsSelected: setting sports to', sports);
    setSelectedSports(sports);
    setCurrentScreen('selectCountry');
  };

  // Handler for when user signs in with existing account
  const handleSignInComplete = () => {
    setHasProfile(true);
    setCurrentScreen('home');
  };

  const handleCountrySelected = () => {
    setCurrentScreen('home');
  };

  // Helper function to get trivia questions for a sport
  const getTriviaQuestions = (sport: Sport): TriviaQuestion[] => {
    switch (sport) {
      case 'nba':
        return nbaTriviaData as TriviaQuestion[];
      case 'pl':
        return plTriviaData as TriviaQuestion[];
      case 'nfl':
        return nflTriviaData as TriviaQuestion[];
      case 'mlb':
        return mlbTriviaData as TriviaQuestion[];
    }
  };

  // Smart question selection that avoids repeats within session,
  // consecutive same categories, and consecutive same teams
  const getRandomTriviaQuestion = (sport: Sport): string => {
    const questions = getTriviaQuestions(sport);
    return getSmartQuestionId(sport, questions);
  };

  // Navigate to Duels screen and auto-open the Start Duel modal
  const handleNavigateToDuels = (sport: Sport) => {
    setAutoStartDuelSport(sport);
    setActiveTab('duels');
    setCurrentScreen('home');
  };

  // Clear autoStartDuelSport after it's been consumed
  const clearAutoStartDuel = () => {
    setAutoStartDuelSport(null);
  };

  const handleQuickDuel = async (sport: Sport) => {
    if (!user) return;

    const QUICK_DUEL_QUESTIONS = 5;

    try {
      setDuelSport(sport);
      // Reset duel session for fresh question selection
      resetDuelSession(sport);

      const waitingDuel = await findWaitingDuel(sport, user.id, QUICK_DUEL_QUESTIONS);

      if (waitingDuel) {
        const joinedDuel = await joinDuel(waitingDuel.id, user.id);
        if (joinedDuel) {
          setCurrentDuel(joinedDuel);
          // Use async mode for quick duels (same as friend challenges)
          setIsAsyncDuel(true);
          setIsAsyncChallenger(false); // Joining player is not the challenger
          setCurrentScreen('asyncDuelGame');
        } else {
          Alert.alert('Error', 'Failed to join duel. Please try again.');
        }
      } else {
        // Generate 5 unique question IDs for quick duel
        const questionIds: string[] = [];
        for (let i = 0; i < QUICK_DUEL_QUESTIONS; i++) {
          questionIds.push(getRandomTriviaQuestion(sport));
        }
        const questionIdsString = questionIds.join(',');
        const newDuel = await createDuel(user.id, sport, questionIdsString, QUICK_DUEL_QUESTIONS);
        if (newDuel) {
          setCurrentDuel(newDuel);
          setCurrentScreen('waitingForOpponent');
        } else {
          Alert.alert('Error', 'Failed to create duel. Please try again.');
        }
      }
    } catch (error) {
      console.error('Error in handleQuickDuel:', error);
      Alert.alert('Error', 'Something went wrong. Please try again.');
    }
  };

  const handleOpponentJoined = (duel: Duel) => {
    setCurrentDuel(duel);
    // Use async mode for quick duels (same as friend challenges)
    setIsAsyncDuel(true);
    setIsAsyncChallenger(true); // Creator is the challenger
    setCurrentScreen('asyncDuelGame');
  };

  const handleDuelComplete = () => {
    setCurrentDuel(null);
    setActiveTab('home');
    setCurrentScreen('home');
  };

  const handleChallengeFriend = async (sport: Sport, questionCount: number = 1) => {
    if (!user) return;

    try {
      setDuelSport(sport);
      setDuelQuestionCount(questionCount);

      // Pre-generate ALL question IDs for the duel upfront using smart selection
      const questions = getTriviaQuestions(sport);
      const questionIds = selectQuestionsForDuel(sport, questions, questionCount);
      const allQuestionIds = questionIds.join(',');

      const duel = await createInviteDuel(user.id, sport, allQuestionIds, questionCount);

      if (duel) {
        setCurrentDuel(duel);
        setCurrentScreen('inviteFriend');
      } else {
        Alert.alert('Error', 'Failed to create duel. Please try again.');
      }
    } catch (error) {
      console.error('Error in handleChallengeFriend:', error);
      Alert.alert('Error', 'Something went wrong. Please try again.');
    }
  };

  const handleDuelCreated = (duel: Duel) => {
    setCurrentDuel(duel);
    setCurrentScreen('inviteFriend');
  };

  const handleAsyncDuelCreated = (duel: Duel) => {
    setCurrentDuel(duel);
    setIsAsyncDuel(true);
    setIsAsyncChallenger(true);
    setCurrentScreen('asyncDuelGame');
  };

  const handleAsyncRematch = async (opponentId: string, sport: Sport, questionCount: number) => {
    if (!user) return;

    try {
      // Generate new questions for the rematch
      const questions = getTriviaQuestions(sport);
      const questionIds = selectQuestionsForDuel(sport, questions, questionCount);
      const allQuestionIds = questionIds.join(',');

      // Create new async duel with isRematch=true for custom notification
      const duel = await createAsyncDuel(
        user.id,
        opponentId,
        sport,
        allQuestionIds,
        questionCount,
        true // isRematch - sends "wants a rematch!" notification
      );

      if (duel) {
        setCurrentDuel(duel);
        setDuelSport(sport);
        setIsAsyncDuel(true);
        setIsAsyncChallenger(true);
        setCurrentScreen('asyncDuelGame');
      } else {
        Alert.alert('Error', 'Failed to create rematch. Please try again.');
      }
    } catch (error) {
      console.error('Error in handleAsyncRematch:', error);
      Alert.alert('Error', 'Something went wrong. Please try again.');
    }
  };

  const handleAcceptFriendChallenge = async (duel: Duel) => {
    if (!user) return;

    const joinedDuel = await joinDuel(duel.id, user.id);
    if (joinedDuel) {
      setDuelSport(joinedDuel.sport);
      setCurrentDuel(joinedDuel);
      setCurrentScreen('duelGame');
    } else {
      Alert.alert('Error', 'Could not join the duel. It may have expired.');
    }
  };

  const handleTabPress = (tab: TabName) => {
    // If tapping the already active tab, do nothing (could scroll to top in future)
    if (tab === activeTab && currentScreen === 'home') {
      return;
    }

    // Switch to the new tab and reset to main screen
    setActiveTab(tab);
    setCurrentScreen('home');
  };

  // Only hide nav bar during active gameplay (duel game) and auth/onboarding flows
  const hideNavBar = [
    'duelGame',
    'asyncDuelGame',
    'setUsername',
    'selectSports',
    'selectCountry',
    'linkEmail',
  ].includes(currentScreen);

  // Show ads on all screens except active duel game and auth/onboarding flows
  const showAdBanner = ![
    'duelGame',
    'asyncDuelGame',
    'setUsername',
    'selectSports',
    'selectCountry',
    'linkEmail',
  ].includes(currentScreen);

  // Keep native splash visible while checking onboarding status
  if (hasSeenOnboarding === null) {
    return null;
  }

  // Show onboarding for first-time users (with splash overlay during transition)
  if (!hasSeenOnboarding) {
    return (
      <>
        <StatusBar style="dark" />
        {/* Onboarding renders underneath */}
        <OnboardingScreen onComplete={handleOnboardingComplete} />
        {/* Splash renders on top and fades out to reveal onboarding */}
        {showAnimatedSplash && (
          <AnimatedSplashScreen onAnimationComplete={() => setShowAnimatedSplash(false)} />
        )}
      </>
    );
  }

  // Show animated splash for returning users
  if (showAnimatedSplash) {
    return (
      <>
        <StatusBar style="dark" />
        <AnimatedSplashScreen onAnimationComplete={() => setShowAnimatedSplash(false)} />
      </>
    );
  }

  // Wait for auth to complete before showing anything
  // This ensures we don't flash the main content while auth is in progress
  if (authLoading) {
    return null;
  }

  // If no user yet (auth completed but user is null), wait for auto sign-in to complete
  // This happens right after onboarding when signInAnonymously is being called
  if (!user && hasSeenOnboarding) {
    return null;
  }

  // Wait for profile check to complete before rendering
  if (user && hasProfile === null) {
    return null;
  }

  if (user && hasProfile === false) {
    return (
      <>
        <StatusBar style="dark" />
        <SetUsernameScreen
          onComplete={handleUsernameSet}
          onSignInComplete={handleSignInComplete}
          onReplayOnboarding={handleReplayOnboarding}
        />
      </>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style="dark" />
      <View style={{ flex: 1 }}>
        {currentScreen === 'home' && activeTab === 'home' && (
          <HomeScreen
            onDailyPuzzle={(sport) => {
              soundService.playButtonClick();
              setCurrentScreen(`${sport}Daily` as Screen);
            }}
            onDuel={(sport) => {
              soundService.playButtonClick();
              handleNavigateToDuels(sport);
            }}
            onProfilePress={() => setCurrentScreen('profile')}
            onNavigateToDuel={(duel) => {
              setDuelSport(duel.sport);
              setCurrentDuel(duel);
              if (duel.status === 'invite' && duel.player2_id === user?.id) {
                setIsAsyncDuel(true);
                setIsAsyncChallenger(false);
                setCurrentScreen('asyncDuelGame');
              } else if (duel.status === 'waiting') {
                setCurrentScreen('waitingForOpponent');
              } else if (duel.status === 'active') {
                setCurrentScreen('duelGame');
              } else if (duel.status === 'invite') {
                setCurrentScreen('duelGame');
              }
            }}
            onNavigateToLeague={(league) => {
              setCurrentLeague(league);
              setCurrentScreen('leagueDetail');
            }}
            refreshKey={homeRefreshKey}
            selectedSports={selectedSports}
          />
        )}
        {activeTab === 'duels' && currentScreen === 'home' && (
          <DuelsScreen
            onNavigateToDuel={(duel) => {
              console.log('App.tsx onNavigateToDuel:', {
                status: duel.status,
                player2_id: duel.player2_id,
                user_id: user?.id,
                isAsyncCondition: duel.status === 'invite' && duel.player2_id === user?.id,
              });
              setDuelSport(duel.sport);
              setCurrentDuel(duel);
              // Check if this is an async friend duel (opponent needs to play)
              // Friend challenges have player2_id set to the specific friend
              if (duel.status === 'invite' && duel.player2_id === user?.id) {
                console.log('Routing to asyncDuelGame');
                setIsAsyncDuel(true);
                setIsAsyncChallenger(false);
                setCurrentScreen('asyncDuelGame');
              } else if (duel.status === 'waiting') {
                console.log('Routing to waitingForOpponent');
                setCurrentScreen('waitingForOpponent');
              } else if (duel.status === 'active') {
                console.log('Routing to duelGame (active)');
                setCurrentScreen('duelGame');
              } else if (duel.status === 'invite') {
                console.log('Routing to duelGame (invite)');
                // Regular invite code duel - join then play
                setCurrentScreen('duelGame');
              }
            }}
            onQuickDuel={handleQuickDuel}
            onChallengeFriend={handleChallengeFriend}
            onAsyncDuelCreated={handleAsyncDuelCreated}
            autoStartDuelSport={autoStartDuelSport}
            onClearAutoStartDuel={clearAutoStartDuel}
          />
        )}
        {currentScreen === 'nbaDaily' && (
          <CluePuzzleScreen sport="nba" onBack={handleBack} onLinkEmail={() => setCurrentScreen('linkEmail')} />
        )}
        {currentScreen === 'plDaily' && (
          <CluePuzzleScreen sport="pl" onBack={handleBack} onLinkEmail={() => setCurrentScreen('linkEmail')} />
        )}
        {currentScreen === 'nflDaily' && (
          <CluePuzzleScreen sport="nfl" onBack={handleBack} onLinkEmail={() => setCurrentScreen('linkEmail')} />
        )}
        {currentScreen === 'mlbDaily' && (
          <CluePuzzleScreen sport="mlb" onBack={handleBack} onLinkEmail={() => setCurrentScreen('linkEmail')} />
        )}
        {activeTab === 'friends' && currentScreen === 'home' && (
          <FriendsScreen
            onNavigateToAsyncDuel={(duel, isChallenger) => {
              setCurrentDuel(duel);
              setDuelSport(duel.sport as Sport);
              setIsAsyncDuel(true);
              setIsAsyncChallenger(isChallenger);
              setCurrentScreen('asyncDuelGame');
            }}
          />
        )}
        {currentScreen === 'profile' && user && (
          <ProfileScreen
            onLogout={handleBack}
            onAccountDeleted={handleAccountDeleted}
            onNavigateToAchievements={() => setCurrentScreen('achievements')}
            onNavigateToCustomize={() => setCurrentScreen('customizeProfile')}
            onReplayOnboarding={handleReplayOnboarding}
            onLinkEmail={() => setCurrentScreen('linkEmail')}
          />
        )}
        {currentScreen === 'linkEmail' && (
          <LinkEmailScreen
            onBack={() => setCurrentScreen('profile')}
            onSuccess={() => setCurrentScreen('profile')}
          />
        )}
        {currentScreen === 'achievements' && (
          <AchievementsScreen onBack={() => setCurrentScreen('home')} />
        )}
        {currentScreen === 'customizeProfile' && (
          <CustomizeProfileScreen onBack={() => setCurrentScreen('home')} />
        )}
        {currentScreen === 'setUsername' && (
          <SetUsernameScreen
            onComplete={handleUsernameSet}
            onSignInComplete={handleSignInComplete}
            onReplayOnboarding={handleReplayOnboarding}
          />
        )}
        {currentScreen === 'selectSports' && (
          <SportsPickerScreen
            onComplete={handleSportsSelected}
            isOnboarding={true}
          />
        )}
        {currentScreen === 'selectCountry' && (
          <CountryPickerScreen
            onComplete={handleCountrySelected}
            onSkip={handleCountrySelected}
          />
        )}
        {currentScreen === 'leaderboard' && (
          <LeaderboardScreen onBack={handleBack} selectedSports={selectedSports || undefined} />
        )}
        {currentScreen === 'waitingForOpponent' && currentDuel && (
          <WaitingForOpponentScreen
            duel={currentDuel}
            sport={duelSport}
            onCancel={handleBack}
            onOpponentJoined={handleOpponentJoined}
          />
        )}
        {currentScreen === 'duelGame' && currentDuel && (
          <DuelGameScreen
            duel={currentDuel}
            onBack={handleBack}
            onComplete={handleDuelComplete}
            onPlayAgain={handleQuickDuel}
            getRandomQuestionId={getRandomTriviaQuestion}
          />
        )}
        {currentScreen === 'asyncDuelGame' && currentDuel && (
          <DuelGameScreen
            key={`async-${currentDuel.id}`}
            duel={currentDuel}
            onBack={() => {
              setIsAsyncDuel(false);
              setIsAsyncChallenger(false);
              handleBack();
            }}
            onComplete={handleDuelComplete}
            onPlayAgain={handleQuickDuel}
            getRandomQuestionId={getRandomTriviaQuestion}
            isAsyncMode={true}
            isChallenger={isAsyncChallenger}
            onRematch={handleAsyncRematch}
          />
        )}
        {currentScreen === 'inviteFriend' && currentDuel && (
          <InviteFriendScreen
            duel={currentDuel}
            sport={duelSport}
            onCancel={handleBack}
            onOpponentJoined={handleOpponentJoined}
          />
        )}
        {currentScreen === 'challengeSetup' && (
          <ChallengeSetupScreen
            sport={duelSport}
            questionCount={duelQuestionCount}
            onCancel={handleBack}
            onDuelCreated={handleDuelCreated}
            onAsyncDuelCreated={handleAsyncDuelCreated}
            getRandomQuestionId={getRandomTriviaQuestion}
          />
        )}
        {activeTab === 'leagues' && currentScreen === 'home' && (
          <LeaguesScreen
            onCreateLeague={() => setShowCreateLeagueModal(true)}
            onJoinLeague={() => setShowJoinLeagueModal(true)}
            onViewLeague={(league) => {
              setCurrentLeague(league);
              setCurrentScreen('leagueDetail');
            }}
            selectedSports={selectedSports || undefined}
          />
        )}
        {currentScreen === 'leagueDetail' && currentLeague && (
          <LeagueDetailScreen
            league={currentLeague}
            onBack={() => setCurrentScreen('home')}
            onLeaveLeague={() => setCurrentScreen('home')}
          />
        )}
        <CreateLeagueModal
          visible={showCreateLeagueModal}
          onClose={() => setShowCreateLeagueModal(false)}
          onLeagueCreated={() => {
            setShowCreateLeagueModal(false);
          }}
        />
        <JoinLeagueModal
          visible={showJoinLeagueModal}
          onClose={() => setShowJoinLeagueModal(false)}
          onLeagueJoined={() => {
            setShowJoinLeagueModal(false);
          }}
        />
        <FriendChallengeListener onAcceptChallenge={handleAcceptFriendChallenge} />
      </View>
      {/* Ad Banner - shown on Home, Leagues, Profile, Waiting, Leaderboard screens */}
      {showAdBanner && <AdBanner />}
      {!hideNavBar && (
        <BottomNavBar
          activeTab={activeTab}
          onTabPress={handleTabPress}
          duelsBadgeCount={incomingChallengesCount + pendingAsyncChallengesCount}
          friendsBadgeCount={pendingFriendRequestsCount}
        />
      )}
      </View>
  );
}

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    DMSans_700Bold,
    DMSans_900Black,
  });
  const [initError, setInitError] = useState<string | null>(null);

  // Log font loading errors
  useEffect(() => {
    if (fontError) {
      console.error('Font loading error:', fontError);
      logStartupError(fontError, 'startup');
      setInitError(`Font loading failed: ${fontError.message}`);
    }
  }, [fontError]);

  // Keep native splash visible while fonts are loading
  if (!fontsLoaded && !fontError) {
    return null;
  }

  // Show error screen if initialization failed
  if (initError) {
    return (
      <SafeAreaProvider>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: '#F5F2EB' }}>
          <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 12, color: '#1A1A1A' }}>
            App Initialization Error
          </Text>
          <Text style={{ fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 20 }}>
            {initError}
          </Text>
          <Text style={{ fontSize: 12, color: '#999', textAlign: 'center' }}>
            Platform: {Platform.OS}
          </Text>
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
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
    flexGrow: 1,
    paddingBottom: 100, // Account for AdBanner + BottomNavBar
  },
  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 16,
  },
  title: {
    fontSize: 28,
    fontFamily: 'DMSans_900Black',
    color: colors.text,
  },
  // Streak Box
  streakBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#000000',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  fireIcon: {
    width: 20,
    height: 22,
  },
  streakNumber: {
    fontSize: 16,
    fontFamily: 'DMSans_900Black',
    color: '#1A1A1A',
  },
  // Header Profile Avatar
  headerAvatarContainer: {
    width: 40,
    height: 40,
  },
  headerAvatarShadow: {
    // Not used - keeping for backwards compatibility
    display: 'none',
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#000000',
    shadowColor: '#000000',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  headerAvatarIcon: {
    width: 20,
    height: 20,
    tintColor: '#FFFFFF',
  },
  // Level Section
  levelSection: {
    paddingLeft: 24,
    paddingRight: 26, // Extra 2px for shadow
    paddingBottom: 2, // Extra space for XP bar shadow
    marginBottom: 22,
  },
  levelBadgeContainer: {
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  levelBadgeShadow: {
    // Not used - keeping for backwards compatibility
    display: 'none',
  },
  combinedLevelBadge: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#000000',
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  levelSection_left: {
    backgroundColor: '#F2C94C',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderTopLeftRadius: 6,
    borderBottomLeftRadius: 6,
  },
  levelDivider: {
    width: 2,
    backgroundColor: '#000000',
  },
  levelSection_middle: {
    backgroundColor: '#F5F2EB',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  levelSection_right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F5F2EB',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderTopRightRadius: 6,
    borderBottomRightRadius: 6,
  },
  levelFireIcon: {
    width: 16,
    height: 18,
  },
  levelStreakText: {
    fontSize: 14,
    fontFamily: 'DMSans_900Black',
    color: '#1A1A1A',
  },
  levelBadgeText: {
    fontSize: 14,
    fontFamily: 'DMSans_900Black',
    color: '#1A1A1A',
  },
  levelTitleText: {
    fontSize: 14,
    fontFamily: 'DMSans_900Black',
    color: '#1A1A1A',
  },
  xpLabel: {
    fontSize: 12,
    fontFamily: 'DMSans_900Black',
    color: '#1A1A1A',
    textAlign: 'right',
    marginTop: -10,
    marginBottom: 6,
  },
  xpBarOuterContainer: {
    // Container for XP bar
  },
  xpBarShadow: {
    // Not used - keeping for backwards compatibility
    display: 'none',
  },
  xpBarOuter: {
    height: 16,
    backgroundColor: '#E8E8E8',
    borderWidth: 2,
    borderColor: '#000000',
    borderRadius: 8,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  xpBarFillContainer: {
    height: '100%',
    overflow: 'hidden',
    borderRadius: 6,
  },
  xpBarFill: {
    flex: 1,
    borderRadius: 6,
  },
  // Sport Grid
  sportGrid: {
    flexDirection: 'column',
    paddingHorizontal: 24,
    gap: 12,
  },
  sportCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderWidth: borders.card,
    borderColor: colors.border,
    borderRadius: borderRadius.card,
    overflow: 'hidden',
    ...shadows.card,
  },
  sportIconContainer: {
    width: 80,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  sportIcon: {
    width: 48,
    height: 48,
  },
  sportCardContent: {
    flex: 1,
    padding: 16,
    paddingLeft: 8,
    justifyContent: 'center',
  },
  sportCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sportName: {
    fontSize: 20,
    fontFamily: 'DMSans_900Black',
    color: colors.text,
  },
  statusIndicator: {
    marginLeft: 8,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  checkIcon: {
    width: 24,
    height: 24,
  },
  buttonGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  dailyButton: {
    flex: 1,
    height: 40,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#1A1A1A',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  dailyButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: 'DMSans_900Black',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  secondaryButton: {
    flex: 1,
    height: 40,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#1A1A1A',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  secondaryButtonText: {
    color: '#1A1A1A',
    fontSize: 13,
    fontFamily: 'DMSans_900Black',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  // Sport Tabs
  sportTabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    gap: 8,
    marginBottom: 16,
  },
  sportTab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#000000',
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
    alignItems: 'center',
  },
  sportTabText: {
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
    color: '#1A1A1A',
  },
  sportTabTextActive: {
    color: '#FFFFFF',
  },
  // Single Sport Card (larger)
  singleSportCard: {
    backgroundColor: colors.surface,
    borderWidth: borders.card,
    borderColor: colors.border,
    borderRadius: borderRadius.card,
    padding: 20,
    ...shadows.card,
  },
  singleSportHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  singleSportIconContainer: {
    width: 72,
    height: 72,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 16,
    marginRight: 16,
  },
  singleSportIcon: {
    width: 48,
    height: 48,
  },
  singleSportInfo: {
    flex: 1,
  },
  singleSportName: {
    fontSize: 24,
    fontFamily: 'DMSans_900Black',
    color: colors.text,
    marginBottom: 4,
  },
  streakAndStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sportStreakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sportStreakIcon: {
    width: 14,
    height: 16,
  },
  sportStreakText: {
    fontSize: 13,
    fontFamily: 'DMSans_600SemiBold',
    color: '#666',
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  completedIcon: {
    width: 16,
    height: 16,
  },
  completedText: {
    fontSize: 13,
    fontFamily: 'DMSans_600SemiBold',
  },
  notPlayedDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusIndicatorTopRight: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 1,
  },
  notPlayedDotTopRight: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  completedIconTopRight: {
    width: 20,
    height: 20,
  },
  singleSportButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  singleDailyButton: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#1A1A1A',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  singleDailyButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: 'DMSans_900Black',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  singleDuelButton: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#1A1A1A',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  singleDuelButtonText: {
    color: '#1A1A1A',
    fontSize: 15,
    fontFamily: 'DMSans_900Black',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  // Section Container
  sectionContainer: {
    paddingHorizontal: 24,
    marginTop: 24,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'nowrap',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'DMSans_700Bold',
    color: colors.text,
  },
  countText: {
    marginLeft: 6,
    fontSize: 18,
    fontFamily: 'DMSans_500Medium',
    color: '#888',
  },
  // Active Duels
  duelsScrollContent: {
    paddingRight: 24,
    paddingTop: 2,
    paddingBottom: 6,
    gap: 12,
  },
  duelCard: {
    width: 150,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#000000',
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  duelCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  duelSportIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  duelSportIconImage: {
    width: 20,
    height: 20,
  },
  duelStatusBadge: {
    backgroundColor: '#E8E8E8',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  duelStatusBadgeNew: {
    backgroundColor: '#E8F5E9',
  },
  duelStatusText: {
    fontSize: 10,
    fontFamily: 'DMSans_600SemiBold',
    color: '#666',
  },
  duelStatusTextNew: {
    color: '#2E7D32',
  },
  duelOpponentName: {
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
    color: colors.text,
  },
  // Empty State
  emptyStateContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  emptyStateText: {
    fontSize: 14,
    fontFamily: 'DMSans_500Medium',
    color: '#888',
    marginBottom: 12,
  },
  emptyStateButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: colors.primary,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#000000',
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  emptyStateButtonText: {
    fontSize: 13,
    fontFamily: 'DMSans_700Bold',
    color: '#FFFFFF',
  },
  // Leaderboard
  leaderboardList: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#000000',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  leaderboardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E8',
  },
  leaderboardRank: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  leaderboardRankFirst: {
    backgroundColor: '#FFD700',
  },
  leaderboardRankSecond: {
    backgroundColor: '#C0C0C0',
  },
  leaderboardRankThird: {
    backgroundColor: '#CD7F32',
  },
  leaderboardRankText: {
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
    color: '#666',
  },
  leaderboardRankTextTop3: {
    color: '#FFFFFF',
    fontFamily: 'DMSans_900Black',
  },
  leaderboardUsername: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'DMSans_600SemiBold',
    color: colors.text,
  },
  leaderboardUsernameMe: {
    fontFamily: 'DMSans_700Bold',
    color: colors.primary,
  },
  leaderboardPoints: {
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
    color: '#666',
  },
  // League Standings
  leaguesList: {
    marginTop: 12,
    gap: 8,
  },
  leagueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#000000',
    borderRadius: 12,
    padding: 14,
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  leagueInfo: {
    flex: 1,
  },
  leagueName: {
    fontSize: 15,
    fontFamily: 'DMSans_700Bold',
    color: colors.text,
  },
  leaguePosition: {
    fontSize: 13,
    fontFamily: 'DMSans_500Medium',
    color: '#666',
    marginTop: 2,
  },
  leaguePoints: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#F5F2EB',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  leaguePointsText: {
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
    color: colors.text,
  },
  // Invite Friends Card
  inviteFriendsCard: {
    marginHorizontal: 24,
    marginTop: 24,
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#000000',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  inviteFriendsTitle: {
    fontSize: 18,
    fontFamily: 'DMSans_700Bold',
    color: colors.text,
    marginBottom: 6,
  },
  inviteFriendsText: {
    fontSize: 14,
    fontFamily: 'DMSans_500Medium',
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
  },
  inviteFriendsButton: {
    paddingHorizontal: 32,
    paddingVertical: 12,
    backgroundColor: colors.primary,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#000000',
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  inviteFriendsButtonText: {
    fontSize: 14,
    fontFamily: 'DMSans_900Black',
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  });
