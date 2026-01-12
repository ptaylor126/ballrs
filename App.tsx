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
import { fetchUserStats, UserStats } from './src/lib/statsService';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import ErrorBoundary from './src/components/ErrorBoundary';
import OnboardingScreen from './src/screens/OnboardingScreen';
import CluePuzzleScreen from './src/screens/CluePuzzleScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import SetUsernameScreen from './src/screens/SetUsernameScreen';
import CountryPickerScreen from './src/screens/CountryPickerScreen';
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
import { joinPresence, leavePresence } from './src/lib/presenceService';
import { Duel, findWaitingDuel, createDuel, joinDuel, getIncomingChallenges, getPendingAsyncChallengesCount, createInviteDuel, createAsyncDuel } from './src/lib/duelService';
import { getPendingFriendRequestsCount, subscribeToFriendRequests, unsubscribeFromFriendRequests } from './src/lib/friendsService';
import { addNotificationListeners, updateStreakReminderFromStats } from './src/lib/notificationService';
import { getDuelById } from './src/lib/duelService';
import { getCompletedSportsToday } from './src/lib/dailyPuzzleService';
import { LeagueWithMemberCount } from './src/lib/leaguesService';
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

type Screen = 'home' | 'nba' | 'pl' | 'nfl' | 'mlb' | 'nbaDaily' | 'plDaily' | 'nflDaily' | 'mlbDaily' | 'profile' | 'setUsername' | 'selectCountry' | 'leaderboard' | 'waitingForOpponent' | 'duelGame' | 'asyncDuelGame' | 'inviteFriend' | 'challengeSetup' | 'leagues' | 'leagueDetail' | 'achievements' | 'customizeProfile' | 'linkEmail';

interface HomeScreenProps {
  onDailyPuzzle: (sport: Sport) => void;
  onDuel: (sport: Sport) => void;
  onProfilePress: () => void;
  refreshKey?: number;
}

function HomeScreen({ onDailyPuzzle, onDuel, onProfilePress, refreshKey }: HomeScreenProps) {
  const { user, loading: authLoading } = useAuth();
  const [xp, setXP] = useState(0);
  const [level, setLevel] = useState(1);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [completedToday, setCompletedToday] = useState<Set<Sport>>(new Set());
  const [showLevelModal, setShowLevelModal] = useState(false);

  // Animated XP bar
  const xpBarAnim = useRef(new Animated.Value(0)).current;

  // Staggered card entrance animations
  const cardAnims = useRef(
    [0, 1, 2, 3].map(() => ({
      opacity: new Animated.Value(0),
      translateY: new Animated.Value(15),
    }))
  ).current;

  useEffect(() => {
    const loadData = async () => {
      // Always load completion status (works for logged out users too via AsyncStorage)
      const completed = await getCompletedSportsToday();
      setCompletedToday(completed);

      if (user) {
        const [xpData, userStats] = await Promise.all([
          getUserXP(user.id),
          fetchUserStats(user.id),
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
      } else {
        setXP(0);
        setLevel(1);
        setStats(null);
      }
    };
    loadData();
  }, [user, refreshKey]);

  // Get daily streak (consecutive days played)
  const getTotalStreak = () => {
    if (!stats) return 0;
    return stats.daily_streak || 0;
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

  // Trigger staggered card entrance animation on mount
  useEffect(() => {
    const animations = cardAnims.map((anim, index) =>
      Animated.parallel([
        Animated.timing(anim.opacity, {
          toValue: 1,
          duration: 300,
          delay: index * 100,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(anim.translateY, {
          toValue: 0,
          duration: 300,
          delay: index * 100,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    Animated.parallel(animations).start();
  }, []);

  const sportCards: { sport: Sport; name: string }[] = [
    { sport: 'nba', name: 'NBA' },
    { sport: 'pl', name: 'EPL' },
    { sport: 'nfl', name: 'NFL' },
    { sport: 'mlb', name: 'MLB' },
  ];

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
          <View style={styles.headerAvatarContainer}>
            {Platform.OS === 'android' && <View style={styles.headerAvatarShadow} />}
            <TouchableOpacity style={styles.headerAvatar} onPress={onProfilePress} activeOpacity={0.7}>
              <Image source={require('./assets/images/icon-profile.png')} style={styles.headerAvatarIcon} resizeMode="contain" />
            </TouchableOpacity>
          </View>
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
              {Platform.OS === 'android' && <View style={styles.levelBadgeShadow} />}
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
            <Text style={styles.xpLabel}>{xpIntoLevel}/{xpNeededForNext} XP</Text>
            <View style={styles.xpBarOuterContainer}>
              {Platform.OS === 'android' && <View style={styles.xpBarShadow} />}
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

        {/* Sport Grid */}
        <View style={styles.sportGrid}>
          {sportCards.map((card, index) => {
            const sportColor = getSportColor(card.sport);
            const isCompleted = completedToday.has(card.sport);

            return (
              <Animated.View
                key={card.sport}
                style={{
                  width: '47%',
                  opacity: cardAnims[index].opacity,
                  transform: [{ translateY: cardAnims[index].translateY }],
                }}
              >
                <AnimatedCard style={[styles.sportCard, { width: '100%' }]}>
                {/* Status Indicator - Top Right */}
                <View style={styles.statusIndicator}>
                  {isCompleted ? (
                    <AnimatedCheckmark visible={isCompleted}>
                      <Image source={checkIcon} style={[styles.checkIcon, { tintColor: sportColor }]} />
                    </AnimatedCheckmark>
                  ) : (
                    <View style={[styles.statusDot, { backgroundColor: sportColor }]} />
                  )}
                </View>

                {/* Sport Icon - Centered */}
                <View style={styles.sportIconContainer}>
                  <Image source={sportIcons[card.sport]} style={styles.sportIcon} />
                </View>

                {/* Sport Name - Centered */}
                <View style={styles.sportNameContainer}>
                  <Text style={styles.sportName}>{card.name}</Text>
                </View>

                {/* Buttons */}
                <View style={styles.buttonGroup}>
                  <AnimatedButton
                    style={[styles.dailyButton, { backgroundColor: sportColor }]}
                    onPress={() => onDailyPuzzle(card.sport)}
                  >
                    <Text style={styles.dailyButtonText}>DAILY</Text>
                  </AnimatedButton>

                  <AnimatedButton
                    style={styles.secondaryButton}
                    onPress={() => onDuel(card.sport)}
                  >
                    <Text style={styles.secondaryButtonText}>TRIVIA DUEL</Text>
                  </AnimatedButton>
                </View>
                </AnimatedCard>
              </Animated.View>
            );
          })}
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
  const { user, loading: authLoading, signInAnonymously } = useAuth();
  const [currentScreen, setCurrentScreen] = useState<Screen>('home');
  const [activeTab, setActiveTab] = useState<TabName>('home');
  const [hasProfile, setHasProfile] = useState<boolean | null>(null);
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState<boolean | null>(null);
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
      if (hasSeenOnboarding && !authLoading && !user) {
        console.log('Auto signing in anonymously...');
        setAuthError(null);
        const { error } = await signInAnonymously();
        if (error) {
          console.error('Anonymous sign in error:', error);
          setAuthError(error.message || 'Failed to sign in. Please check if anonymous auth is enabled in Supabase.');
          Alert.alert(
            'Sign In Error',
            'Could not sign in anonymously. Please make sure Anonymous auth is enabled in your Supabase dashboard (Authentication → Providers → Anonymous).',
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
        setHasProfile(!!profile);
        if (!profile) {
          setCurrentScreen('setUsername');
        }
        // Update last_active for online status tracking
        updateLastActive(user.id);
      } else {
        setHasProfile(null);
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

  const handleAuthSuccess = async () => {
    setCurrentScreen('home');
  };

  const handleUsernameSet = () => {
    setHasProfile(true);
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

  // Only hide nav bar during active gameplay (duel game) and auth flows
  const hideNavBar = [
    'duelGame',
    'asyncDuelGame',
    'setUsername',
    'selectCountry',
    'linkEmail',
  ].includes(currentScreen);

  // Show ads on all screens except active duel game and auth flows
  const showAdBanner = ![
    'duelGame',
    'asyncDuelGame',
    'setUsername',
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
            refreshKey={homeRefreshKey}
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
        {currentScreen === 'selectCountry' && (
          <CountryPickerScreen
            onComplete={handleCountrySelected}
            onSkip={handleCountrySelected}
          />
        )}
        {currentScreen === 'leaderboard' && (
          <LeaderboardScreen onBack={handleBack} />
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
    paddingBottom: 170, // Account for AdBanner (60) + BottomNavBar (~100 with safe area)
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
    position: 'relative',
    width: 44,
    height: 44,
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 2, height: 2 },
        shadowOpacity: 1,
        shadowRadius: 0,
      },
      android: {},
    }),
  },
  headerAvatarShadow: {
    position: 'absolute',
    top: 2,
    left: 2,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#000000',
    zIndex: 0,
  },
  headerAvatar: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#000000',
    zIndex: 1,
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
    position: 'relative',
    marginBottom: 6,
    paddingRight: 4,
    paddingBottom: 4,
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 1, height: 1 },
        shadowOpacity: 1,
        shadowRadius: 0,
      },
      android: {},
    }),
  },
  levelBadgeShadow: {
    position: 'absolute',
    top: 1,
    left: 1,
    right: -1,
    bottom: -1,
    backgroundColor: '#000000',
    borderRadius: 8,
    zIndex: 0,
  },
  combinedLevelBadge: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#000000',
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    zIndex: 1,
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
    position: 'relative',
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 2, height: 2 },
        shadowOpacity: 1,
        shadowRadius: 0,
      },
      android: {},
    }),
  },
  xpBarShadow: {
    position: 'absolute',
    top: 2,
    left: 2,
    right: -2,
    height: 16,
    backgroundColor: '#000000',
    borderRadius: 8,
  },
  xpBarOuter: {
    position: 'relative',
    zIndex: 1,
    height: 16,
    backgroundColor: '#E8E8E8',
    borderWidth: 2,
    borderColor: '#000000',
    borderRadius: 8,
    overflow: 'hidden',
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
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 24,
    gap: 16,
    justifyContent: 'space-between',
  },
  sportCard: {
    width: '47%',
    backgroundColor: colors.surface,
    borderWidth: borders.card,
    borderColor: colors.border,
    borderRadius: borderRadius.card,
    padding: 20,
    position: 'relative',
    ...shadows.card,
  },
  statusIndicator: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 1,
  },
  sportIconContainer: {
    alignItems: 'center',
    marginBottom: 12,
  },
  sportIcon: {
    width: 40,
    height: 40,
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
  sportNameContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  sportName: {
    fontSize: 24,
    fontFamily: 'DMSans_900Black',
    color: colors.text,
    textAlign: 'center',
  },
  buttonGroup: {
    gap: 8,
  },
  dailyButton: {
    width: '100%',
    height: 36,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
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
    fontSize: 12,
    fontFamily: 'DMSans_900Black',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  secondaryButton: {
    width: '100%',
    height: 36,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
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
    fontSize: 12,
    fontFamily: 'DMSans_900Black',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  });
