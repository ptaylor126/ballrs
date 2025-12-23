import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
  Animated,
  Easing,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
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
import CluePuzzleScreen from './src/screens/CluePuzzleScreen';
import LoginScreen from './src/screens/LoginScreen';
import SignUpScreen from './src/screens/SignUpScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import SetUsernameScreen from './src/screens/SetUsernameScreen';
import LeaderboardScreen from './src/screens/LeaderboardScreen';
import WaitingForOpponentScreen from './src/screens/WaitingForOpponentScreen';
import DuelGameScreen from './src/screens/DuelGameScreen';
import InviteFriendScreen from './src/screens/InviteFriendScreen';
import ChallengeSetupScreen from './src/screens/ChallengeSetupScreen';
import LeaguesScreen from './src/screens/LeaguesScreen';
import LeagueDetailScreen from './src/screens/LeagueDetailScreen';
import AchievementsScreen from './src/screens/AchievementsScreen';
import CustomizeProfileScreen from './src/screens/CustomizeProfileScreen';
import FriendChallengeListener from './src/components/FriendChallengeListener';
import CreateLeagueModal from './src/components/CreateLeagueModal';
import JoinLeagueModal from './src/components/JoinLeagueModal';
import BottomNavBar, { TabName } from './src/components/BottomNavBar';
import DuelsScreen from './src/screens/DuelsScreen';
import { getProfile } from './src/lib/profilesService';
import { Duel, findWaitingDuel, createDuel, joinDuel, getIncomingChallenges } from './src/lib/duelService';
import { getCompletedSportsToday } from './src/lib/dailyPuzzleService';
import { LeagueWithMemberCount } from './src/lib/leaguesService';
import nbaTriviaData from './data/nba-trivia.json';
import plTriviaData from './data/pl-trivia.json';
import nflTriviaData from './data/nfl-trivia.json';
import mlbTriviaData from './data/mlb-trivia.json';
import { TriviaQuestion } from './src/lib/duelService';

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

type Screen = 'home' | 'nba' | 'pl' | 'nfl' | 'mlb' | 'nbaDaily' | 'plDaily' | 'nflDaily' | 'mlbDaily' | 'login' | 'signup' | 'profile' | 'setUsername' | 'leaderboard' | 'waitingForOpponent' | 'duelGame' | 'inviteFriend' | 'challengeSetup' | 'leagues' | 'leagueDetail' | 'achievements' | 'customizeProfile';

interface HomeScreenProps {
  onDailyPuzzle: (sport: Sport) => void;
  onDuel: (sport: Sport) => void;
  onChallenge: (sport: Sport) => void;
  onLogin: () => void;
  onSignUp: () => void;
  refreshKey?: number;
}

function HomeScreen({ onDailyPuzzle, onDuel, onChallenge, onLogin, onSignUp, refreshKey }: HomeScreenProps) {
  const { user, loading } = useAuth();
  const [xp, setXP] = useState(0);
  const [level, setLevel] = useState(1);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [completedToday, setCompletedToday] = useState<Set<Sport>>(new Set());

  // Animated XP bar
  const xpBarAnim = useRef(new Animated.Value(0)).current;

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
        }
      } else {
        setXP(0);
        setLevel(1);
        setStats(null);
      }
    };
    loadData();
  }, [user, refreshKey]);

  // Calculate total streak (sum of all current streaks)
  const getTotalStreak = () => {
    if (!stats) return 0;
    return (
      (stats.nba_current_streak || 0) +
      (stats.pl_current_streak || 0) +
      (stats.nfl_current_streak || 0) +
      (stats.mlb_current_streak || 0)
    );
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

  const sportCards: { sport: Sport; name: string }[] = [
    { sport: 'nba', name: 'NBA' },
    { sport: 'pl', name: 'EPL' },
    { sport: 'nfl', name: 'NFL' },
    { sport: 'mlb', name: 'MLB' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>BALLRS</Text>
          {!loading && !user ? (
            <View style={styles.authButtons}>
              <AnimatedButton style={styles.loginButton} onPress={onLogin}>
                <Text style={styles.loginButtonText}>LOG IN</Text>
              </AnimatedButton>
            </View>
          ) : (
            <AnimatedFireIcon totalStreak={totalStreak} />
          )}
        </View>

        {/* Level & XP Bar */}
        {user && (
          <View style={styles.levelSection}>
            <View style={styles.levelRow}>
              <Text style={styles.levelLabel}>LEVEL {level}</Text>
              <Text style={styles.xpLabel}>{xpIntoLevel}/{xpNeededForNext} XP</Text>
            </View>
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
        )}

        {/* Sport Grid */}
        <View style={styles.sportGrid}>
          {sportCards.map((card) => {
            const sportColor = getSportColor(card.sport);
            const isCompleted = completedToday.has(card.sport);

            return (
              <AnimatedCard key={card.sport} style={styles.sportCard}>
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
                    <Text style={styles.secondaryButtonText}>DUEL</Text>
                  </AnimatedButton>

                  <AnimatedButton
                    style={styles.secondaryButton}
                    onPress={() => onChallenge(card.sport)}
                  >
                    <Text style={styles.secondaryButtonText}>CHALLENGE</Text>
                  </AnimatedButton>
                </View>
              </AnimatedCard>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function AppContent() {
  const { user } = useAuth();
  const [currentScreen, setCurrentScreen] = useState<Screen>('home');
  const [activeTab, setActiveTab] = useState<TabName>('home');
  const [hasProfile, setHasProfile] = useState<boolean | null>(null);
  const [currentDuel, setCurrentDuel] = useState<Duel | null>(null);
  const [duelSport, setDuelSport] = useState<Sport>('nba');
  const [showCreateLeagueModal, setShowCreateLeagueModal] = useState(false);
  const [showJoinLeagueModal, setShowJoinLeagueModal] = useState(false);
  const [currentLeague, setCurrentLeague] = useState<LeagueWithMemberCount | null>(null);
  const [homeRefreshKey, setHomeRefreshKey] = useState(0);
  const [incomingChallengesCount, setIncomingChallengesCount] = useState(0);

  const refreshChallengesCount = useCallback(async () => {
    if (user) {
      const challenges = await getIncomingChallenges(user.id);
      setIncomingChallengesCount(challenges.length);
    } else {
      setIncomingChallengesCount(0);
    }
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
        const profile = await getProfile(user.id);
        setHasProfile(!!profile);
        if (!profile) {
          setCurrentScreen('setUsername');
        }
      } else {
        setHasProfile(null);
      }
    };
    checkProfile();
  }, [user]);

  const handleBack = () => {
    setCurrentDuel(null);
    setCurrentScreen('home');
    setHomeRefreshKey(prev => prev + 1);
  };

  const handleAuthSuccess = async () => {
    setCurrentScreen('home');
  };

  const handleUsernameSet = () => {
    setHasProfile(true);
    setCurrentScreen('home');
  };

  const getRandomTriviaQuestion = (sport: Sport): string => {
    let questions: TriviaQuestion[];
    switch (sport) {
      case 'nba':
        questions = nbaTriviaData as TriviaQuestion[];
        break;
      case 'pl':
        questions = plTriviaData as TriviaQuestion[];
        break;
      case 'nfl':
        questions = nflTriviaData as TriviaQuestion[];
        break;
      case 'mlb':
        questions = mlbTriviaData as TriviaQuestion[];
        break;
    }
    const randomIndex = Math.floor(Math.random() * questions.length);
    return questions[randomIndex].id;
  };

  const handleQuickDuel = async (sport: Sport) => {
    if (!user) {
      Alert.alert('Login Required', 'Please log in to play Trivia Duel', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Log In', onPress: () => setCurrentScreen('login') },
      ]);
      return;
    }

    setDuelSport(sport);

    const waitingDuel = await findWaitingDuel(sport, user.id);

    if (waitingDuel) {
      const joinedDuel = await joinDuel(waitingDuel.id, user.id);
      if (joinedDuel) {
        setCurrentDuel(joinedDuel);
        setCurrentScreen('duelGame');
      } else {
        Alert.alert('Error', 'Failed to join duel. Please try again.');
      }
    } else {
      const questionId = getRandomTriviaQuestion(sport);
      const newDuel = await createDuel(user.id, sport, questionId);
      if (newDuel) {
        setCurrentDuel(newDuel);
        setCurrentScreen('waitingForOpponent');
      } else {
        Alert.alert('Error', 'Failed to create duel. Please try again.');
      }
    }
  };

  const handleOpponentJoined = (duel: Duel) => {
    setCurrentDuel(duel);
    setCurrentScreen('duelGame');
  };

  const handleDuelComplete = () => {
    setCurrentDuel(null);
    setCurrentScreen('home');
  };

  const handleChallengeFriend = (sport: Sport) => {
    if (!user) {
      Alert.alert('Login Required', 'Please log in to challenge a friend', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Log In', onPress: () => setCurrentScreen('login') },
      ]);
      return;
    }

    setDuelSport(sport);
    setCurrentScreen('challengeSetup');
  };

  const handleDuelCreated = (duel: Duel) => {
    setCurrentDuel(duel);
    setCurrentScreen('inviteFriend');
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

    // If not logged in and trying to access profile, go to login
    if (tab === 'profile' && !user) {
      setCurrentScreen('login');
      return;
    }

    // Switch to the new tab and reset to main screen
    setActiveTab(tab);
    setCurrentScreen('home');
  };

  const hideNavBar = [
    'duelGame',
    'waitingForOpponent',
    'inviteFriend',
    'challengeSetup',
    'nbaDaily',
    'plDaily',
    'nflDaily',
    'mlbDaily',
    'login',
    'signup',
    'setUsername',
    'leagueDetail',
    'achievements',
    'customizeProfile',
    'leaderboard',
  ].includes(currentScreen);

  if (user && hasProfile === false) {
    return (
      <>
        <StatusBar style="dark" />
        <SetUsernameScreen
          onComplete={handleUsernameSet}
          onLogin={() => setCurrentScreen('login')}
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
            onDailyPuzzle={(sport) => setCurrentScreen(`${sport}Daily` as Screen)}
            onDuel={handleQuickDuel}
            onChallenge={handleChallengeFriend}
            onLogin={() => setCurrentScreen('login')}
            onSignUp={() => setCurrentScreen('signup')}
            refreshKey={homeRefreshKey}
          />
        )}
        {activeTab === 'duels' && currentScreen === 'home' && (
          <DuelsScreen
            onNavigateToDuel={(duel) => {
              setDuelSport(duel.sport);
              setCurrentDuel(duel);
              if (duel.status === 'waiting') {
                setCurrentScreen('waitingForOpponent');
              } else if (duel.status === 'active') {
                setCurrentScreen('duelGame');
              }
            }}
            onLogin={() => setCurrentScreen('login')}
            onQuickDuel={handleQuickDuel}
            onChallengeFriend={handleChallengeFriend}
          />
        )}
        {currentScreen === 'nbaDaily' && (
          <CluePuzzleScreen sport="nba" onBack={handleBack} />
        )}
        {currentScreen === 'plDaily' && (
          <CluePuzzleScreen sport="pl" onBack={handleBack} />
        )}
        {currentScreen === 'nflDaily' && (
          <CluePuzzleScreen sport="nfl" onBack={handleBack} />
        )}
        {currentScreen === 'mlbDaily' && (
          <CluePuzzleScreen sport="mlb" onBack={handleBack} />
        )}
        {currentScreen === 'login' && (
          <LoginScreen
            onBack={handleBack}
            onLoginSuccess={handleAuthSuccess}
            onGoToSignUp={() => setCurrentScreen('signup')}
          />
        )}
        {currentScreen === 'signup' && (
          <SignUpScreen
            onBack={handleBack}
            onSignUpSuccess={handleAuthSuccess}
            onGoToLogin={() => setCurrentScreen('login')}
          />
        )}
        {activeTab === 'profile' && currentScreen === 'home' && user && (
          <ProfileScreen
            onLogout={handleBack}
            onNavigateToAchievements={() => setCurrentScreen('achievements')}
            onNavigateToCustomize={() => setCurrentScreen('customizeProfile')}
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
            onLogin={() => setCurrentScreen('login')}
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
            onCancel={handleBack}
            onDuelCreated={handleDuelCreated}
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
      {!hideNavBar && (
        <BottomNavBar
          activeTab={activeTab}
          onTabPress={handleTabPress}
          duelsBadgeCount={incomingChallengesCount}
        />
      )}
    </View>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    DMSans_700Bold,
    DMSans_900Black,
  });

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.text} />
      </View>
    );
  }

  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
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
    paddingBottom: 24,
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
  authButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  loginButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#000000',
    backgroundColor: '#1ABC9C',
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: 'DMSans_900Black',
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
  // Level Section
  levelSection: {
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  levelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  levelLabel: {
    fontSize: 12,
    fontFamily: 'DMSans_500Medium',
    color: colors.text,
  },
  xpLabel: {
    fontSize: 12,
    fontFamily: 'DMSans_500Medium',
    color: colors.text,
  },
  xpBarOuter: {
    height: 16,
    backgroundColor: colors.surface,
    borderWidth: borders.button,
    borderColor: colors.border,
    borderRadius: 8,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
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
