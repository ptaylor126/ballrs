import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  Animated,
  Share,
  Alert,
  Image,
  Easing,
  LayoutChangeEvent,
  Keyboard,
  Dimensions,
  InteractionManager,
  AppState,
  AppStateStatus,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import ConfettiCannon from 'react-native-confetti-cannon';
import { colors, shadows, getSportColor, Sport, borders, borderRadius } from '../lib/theme';
import { AnimatedButton } from '../components/AnimatedComponents';
import { useAuth } from '../contexts/AuthContext';
import { awardXP, calculateLevel, XPAwardResult } from '../lib/xpService';
import { awardPuzzlePoints } from '../lib/pointsService';
import { awardLeaguePoints } from '../lib/leaguesService';
import { fetchUserStats, getPlayStreak, getWinStreak, UserStats, updateStatsAfterWin, updateStatsAfterLoss } from '../lib/statsService';
import XPEarnedModal from '../components/XPEarnedModal';
import LevelUpModal from '../components/LevelUpModal';
import JerseyReveal, { getFullTeamName } from '../components/JerseyReveal';
import LinkEmailPromptModal from '../components/LinkEmailPromptModal';
import nbaPlayersData from '../../data/nba-players-clues.json';
import plPlayersData from '../../data/pl-players-clues.json';
import nflPlayersData from '../../data/nfl-players-clues.json';
import mlbPlayersData from '../../data/mlb-players-clues.json';

// All players for autocomplete
import nbaAllPlayers from '../../data/nba-all-players.json';
import plAllPlayers from '../../data/pl-all-players.json';
import nflAllPlayers from '../../data/nfl-all-players.json';
import mlbAllPlayers from '../../data/mlb-all-players.json';

// Sport icon images for badge
const sportIcons: Record<Sport, any> = {
  nba: require('../../assets/images/icon-basketball.png'),
  pl: require('../../assets/images/icon-soccer.png'),
  nfl: require('../../assets/images/icon-football.png'),
  mlb: require('../../assets/images/icon-baseball.png'),
};

// Streak icons
const fireIcon = require('../../assets/images/icon-fire.png');
const lightningIcon = require('../../assets/images/icon-lightning.png');

interface CluePlayer {
  id: number;
  name: string;
  team: string;
  position: string;
  clues: string[];
  jerseyNumber?: number | string;
}

interface AutocompletePlayer {
  id: number;
  name: string;
  team: string;
}

interface Props {
  sport: Sport;
  onBack: () => void;
  onLinkEmail?: () => void;
}

const getStorageKey = (sport: string) => `ballrs_clue_puzzle_state_${sport}`;
const getStreakKey = (sport: string) => `ballrs_clue_puzzle_streak_${sport}`;
const MAX_GUESSES = 6;
const TIMER_DURATION = 10; // seconds per clue

interface GameState {
  date: string;
  mysteryPlayerId: number;
  currentClueIndex: number;
  wrongGuesses: number;
  solved: boolean;
  pointsEarned: number;
  gaveUp?: boolean;
}

interface StreakState {
  currentStreak: number;
  lastPlayedDate: string;
}

// Helper to calculate daily streak (only increments once per day)
async function calculateDailyStreak(sport: string): Promise<number> {
  const today = getTodayString();
  const streakStored = await AsyncStorage.getItem(getStreakKey(sport));
  let newStreak = 1;

  if (streakStored) {
    const streakState: StreakState = JSON.parse(streakStored);
    const lastDate = new Date(streakState.lastPlayedDate);
    const todayDate = new Date(today);
    const diffTime = todayDate.getTime() - lastDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      // Next day - increment streak
      newStreak = streakState.currentStreak + 1;
    } else if (diffDays === 0) {
      // Same day - keep same streak
      newStreak = streakState.currentStreak;
    }
    // More than 1 day - reset to 1 (default)
  }

  // Save the new streak state
  const newStreakState: StreakState = { currentStreak: newStreak, lastPlayedDate: today };
  await AsyncStorage.setItem(getStreakKey(sport), JSON.stringify(newStreakState));

  return newStreak;
}

function getTodayString(): string {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
}

function getDailyPlayer(players: CluePlayer[], sport: string): CluePlayer {
  const dateString = getTodayString();
  let hash = 99999;
  const seedString = dateString + sport;
  for (let i = 0; i < seedString.length; i++) {
    const char = seedString.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  const index = Math.abs(hash) % players.length;
  return players[index];
}

function getPlayersForSport(sport: Sport): CluePlayer[] {
  switch (sport) {
    case 'nba':
      return nbaPlayersData.players;
    case 'pl':
      return plPlayersData.players;
    case 'nfl':
      return nflPlayersData.players;
    case 'mlb':
      return mlbPlayersData.players;
  }
}

function getAllPlayersForSport(sport: Sport): AutocompletePlayer[] {
  switch (sport) {
    case 'nba':
      return nbaAllPlayers.players;
    case 'pl':
      return plAllPlayers.players;
    case 'nfl':
      return nflAllPlayers.players;
    case 'mlb':
      return mlbAllPlayers.players;
  }
}

// Validate that all mystery players are in the searchable list
// This prevents the bug where a mystery player can't be found in autocomplete
function validateMysteryPlayersAreSearchable(sport: Sport): void {
  const mysteryPlayers = getPlayersForSport(sport);
  const searchablePlayers = getAllPlayersForSport(sport);
  const searchableNames = new Set(searchablePlayers.map(p => p.name.toLowerCase()));

  const missingPlayers = mysteryPlayers.filter(
    mp => !searchableNames.has(mp.name.toLowerCase())
  );

  if (missingPlayers.length > 0) {
    console.error(
      `[${sport.toUpperCase()}] DATA INTEGRITY ERROR: ${missingPlayers.length} mystery player(s) not in searchable list:`,
      missingPlayers.map(p => p.name).join(', '),
      '\nFix: Add these players to data/*-all-players.json'
    );
  }
}

function getSportNameLocal(sport: Sport): string {
  switch (sport) {
    case 'nba': return 'NBA';
    case 'pl': return 'Premier League';
    case 'nfl': return 'NFL';
    case 'mlb': return 'MLB';
  }
}

// Key for storing when the link email prompt was last dismissed
const LINK_EMAIL_PROMPT_KEY = 'ballrs_link_email_prompt_dismissed';

export default function CluePuzzleScreen({ sport, onBack, onLinkEmail }: Props) {
  const { user, hasLinkedEmail } = useAuth();
  const [players] = useState<CluePlayer[]>(getPlayersForSport(sport));
  const [allPlayers] = useState<AutocompletePlayer[]>(getAllPlayersForSport(sport));
  const sportColor = getSportColor(sport);
  const sportName = getSportNameLocal(sport);
  const [mysteryPlayer, setMysteryPlayer] = useState<CluePlayer | null>(null);
  const [currentClueIndex, setCurrentClueIndex] = useState(0);
  const [guess, setGuess] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [wrongGuesses, setWrongGuesses] = useState(0);
  const [solved, setSolved] = useState(false);
  const [gaveUp, setGaveUp] = useState(false);
  const [pointsEarned, setPointsEarned] = useState(0);
  const [showWrongMessage, setShowWrongMessage] = useState(false);
  const [wrongToastMessage, setWrongToastMessage] = useState('');
  const [showNotInPuzzleMessage, setShowNotInPuzzleMessage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [streak, setStreak] = useState(0);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [shakeAnim] = useState(new Animated.Value(0));
  const [celebrateAnim] = useState(new Animated.Value(0));
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // XP and confetti state
  const [showXPModal, setShowXPModal] = useState(false);
  const [xpResult, setXpResult] = useState<XPAwardResult | null>(null);
  const [xpEarned, setXpEarned] = useState(0);
  const [showConfetti, setShowConfetti] = useState(false);

  // Timer state
  const [timeRemaining, setTimeRemaining] = useState(TIMER_DURATION);
  const [timerPaused, setTimerPaused] = useState(false);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const timerPulseAnim = useRef(new Animated.Value(1)).current;
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  // Level up modal state
  const [showLevelUpModal, setShowLevelUpModal] = useState(false);

  // Link email prompt state
  const [showLinkEmailPrompt, setShowLinkEmailPrompt] = useState(false);

  // Check if we should show the link email prompt after leveling up
  const checkAndShowLinkEmailPrompt = async () => {
    // Don't show if already linked email
    if (hasLinkedEmail) return;

    // Only show on level up
    if (!xpResult) return;
    const previousLevel = calculateLevel(xpResult.previousXP);
    const newLevel = calculateLevel(xpResult.newXP);
    const didLevelUp = newLevel > previousLevel;

    if (!didLevelUp) return;

    // Check if dismissed within last 7 days
    try {
      const dismissedAt = await AsyncStorage.getItem(LINK_EMAIL_PROMPT_KEY);
      if (dismissedAt) {
        const dismissedDate = new Date(dismissedAt);
        const now = new Date();
        const daysSinceDismissed = (now.getTime() - dismissedDate.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceDismissed < 7) {
          return; // Don't show again within 7 days
        }
      }
    } catch (err) {
      console.error('Error checking link email prompt:', err);
    }

    // Show the prompt after a short delay
    setTimeout(() => {
      setShowLinkEmailPrompt(true);
    }, 500);
  };

  const handleLinkEmailPromptDismiss = async () => {
    setShowLinkEmailPrompt(false);
    // Store dismissal timestamp
    try {
      await AsyncStorage.setItem(LINK_EMAIL_PROMPT_KEY, new Date().toISOString());
    } catch (err) {
      console.error('Error saving link email prompt dismissal:', err);
    }
  };

  const confettiRef = useRef<any>(null);
  const scrollViewRef = useRef<any>(null);
  const [cluesContainerY, setCluesContainerY] = useState(0);
  const [inputContainerY, setInputContainerY] = useState(0);
  const [inputFocused, setInputFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);

  // Pulse animation for "Need Another Clue" button
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.02,
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

  // Handle timer expiry
  const handleTimerExpiry = useCallback(() => {
    if (solved || gaveUp || loading) return;

    // Haptic feedback
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

    if (currentClueIndex < 5) {
      // Clues 1-5: Auto-advance to next clue (no guess used)
      const newIndex = currentClueIndex + 1;
      setCurrentClueIndex(newIndex);
      setTimeRemaining(TIMER_DURATION);
      saveGameState(newIndex, wrongGuesses, false, 0);

      // Scroll to show new clue
      setTimeout(() => {
        if (scrollViewRef.current) {
          const clueHeight = 90;
          const targetY = cluesContainerY + (newIndex * clueHeight);
          scrollViewRef.current.scrollToPosition(0, targetY, true);
        }
      }, 150);
    } else {
      // Clue 6: Time's up! - Reveal answer (same as Give Up)
      setGaveUp(true);
      setTimeRemaining(0);
      saveGameState(currentClueIndex, wrongGuesses, false, 0, false, true);

      // Update stats (loss - but play streak continues)
      if (user && userStats) {
        // Award league points (0 for loss)
        awardLeaguePoints(user.id, sport, MAX_GUESSES, false);

        // Calculate daily streak (play streak continues even on loss)
        calculateDailyStreak(sport).then((dailyStreak) => {
          updateStatsAfterLoss(user.id, sport, userStats, dailyStreak).then((updatedStats) => {
            if (updatedStats) {
              setUserStats(updatedStats);
            }
          });
        });
      }
    }
  }, [solved, gaveUp, loading, currentClueIndex, wrongGuesses, cluesContainerY, user, userStats, sport]);

  // Timer countdown effect
  useEffect(() => {
    // Don't run timer if game is over or loading
    if (solved || gaveUp || loading || timerPaused) {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      return;
    }

    timerIntervalRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          // Timer expired
          clearInterval(timerIntervalRef.current!);
          timerIntervalRef.current = null;
          // Use setTimeout to avoid state update during render
          setTimeout(() => handleTimerExpiry(), 0);
          return 0;
        }

        // Haptic at 3 second warning
        if (prev === 4) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }

        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    };
  }, [solved, gaveUp, loading, timerPaused, currentClueIndex, handleTimerExpiry]);

  // Reset timer when clue changes
  useEffect(() => {
    if (!solved && !gaveUp && !loading) {
      setTimeRemaining(TIMER_DURATION);
    }
  }, [currentClueIndex, solved, gaveUp, loading]);

  // Timer pulse animation for final 3 seconds
  useEffect(() => {
    if (timeRemaining <= 3 && timeRemaining > 0 && !solved && !gaveUp) {
      Animated.sequence([
        Animated.timing(timerPulseAnim, {
          toValue: 1.15,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(timerPulseAnim, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [timeRemaining, solved, gaveUp, timerPulseAnim]);

  // App state listener - pause timer when app goes to background
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (appStateRef.current.match(/active/) && nextAppState.match(/inactive|background/)) {
        // App going to background - pause timer
        setTimerPaused(true);
      } else if (appStateRef.current.match(/inactive|background/) && nextAppState === 'active') {
        // App coming to foreground - resume timer
        setTimerPaused(false);
      }
      appStateRef.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, []);

  // Get timer color based on time remaining
  const getTimerColor = () => {
    if (timeRemaining > 5) return '#1ABC9C'; // Teal
    if (timeRemaining > 2) return '#F2C94C'; // Yellow
    return '#DC2626'; // Red
  };

  const potentialPoints = Math.max(0, 6 - currentClueIndex);
  const revealedClues = mysteryPlayer?.clues.slice(0, currentClueIndex + 1) || [];
  const isLastClue = currentClueIndex >= 5;
  const gameOver = solved || gaveUp;

  useEffect(() => {
    // Validate data integrity on mount (development aid)
    if (__DEV__) {
      validateMysteryPlayersAreSearchable(sport);
    }
    loadGameState();
  }, []);

  async function loadGameState() {
    try {
      const player = getDailyPlayer(players, sport);
      setMysteryPlayer(player);

      const stored = await AsyncStorage.getItem(getStorageKey(sport));
      if (stored) {
        const state: GameState = JSON.parse(stored);
        const today = getTodayString();

        if (state.date === today && state.mysteryPlayerId === player.id) {
          setCurrentClueIndex(state.currentClueIndex);
          setWrongGuesses(state.wrongGuesses);
          setSolved(state.solved);
          setGaveUp(state.gaveUp || false);
          setPointsEarned(state.pointsEarned);
        }
      }

      const streakStored = await AsyncStorage.getItem(getStreakKey(sport));
      if (streakStored) {
        const streakState: StreakState = JSON.parse(streakStored);
        setStreak(streakState.currentStreak);
      }

      // Fetch user stats for logged-in users
      if (user) {
        const stats = await fetchUserStats(user.id);
        if (stats) {
          setUserStats(stats);
        }
      }
    } catch (error) {
      console.error('Error loading game state:', error);
    } finally {
      setLoading(false);
    }
  }

  async function saveGameState(
    clueIndex: number,
    wrong: number,
    isSolved: boolean,
    points: number,
    updateStreak: boolean = false,
    didGiveUp: boolean = false
  ) {
    if (!mysteryPlayer) return;
    try {
      const state: GameState = {
        date: getTodayString(),
        mysteryPlayerId: mysteryPlayer.id,
        currentClueIndex: clueIndex,
        wrongGuesses: wrong,
        solved: isSolved,
        pointsEarned: points,
        gaveUp: didGiveUp,
      };
      await AsyncStorage.setItem(getStorageKey(sport), JSON.stringify(state));

      if (updateStreak && isSolved) {
        const today = getTodayString();
        const streakStored = await AsyncStorage.getItem(getStreakKey(sport));
        let newStreak = 1;

        if (streakStored) {
          const streakState: StreakState = JSON.parse(streakStored);
          const lastDate = new Date(streakState.lastPlayedDate);
          const todayDate = new Date(today);
          const diffTime = todayDate.getTime() - lastDate.getTime();
          const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

          if (diffDays === 1) {
            newStreak = streakState.currentStreak + 1;
          } else if (diffDays === 0) {
            newStreak = streakState.currentStreak;
          }
        }

        const newStreakState: StreakState = {
          currentStreak: newStreak,
          lastPlayedDate: today,
        };
        await AsyncStorage.setItem(getStreakKey(sport), JSON.stringify(newStreakState));
        setStreak(newStreak);
      }
    } catch (error) {
      console.error('Error saving game state:', error);
    }
  }

  function triggerShake() {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  }

  function triggerCelebration() {
    Animated.sequence([
      Animated.timing(celebrateAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.timing(celebrateAnim, { toValue: 0.8, duration: 200, useNativeDriver: true }),
      Animated.timing(celebrateAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
  }

  function handleSelectPlayer(selectedPlayer: AutocompletePlayer) {
    if (!mysteryPlayer || solved || gaveUp) return;

    // Light haptic feedback for any guess submission
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Check if player is in the mystery pool (clue players)
    const isInMysteryPool = players.some(p =>
      p.name.toLowerCase() === selectedPlayer.name.toLowerCase()
    );

    // Check if the selected player matches the mystery player
    const isCorrect = mysteryPlayer.name.toLowerCase() === selectedPlayer.name.toLowerCase();

    if (isCorrect) {
      // Success haptic for correct guess
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const points = potentialPoints;
      setSolved(true);
      setPointsEarned(points);
      setGuess('');
      setShowSuggestions(false);
      triggerCelebration();
      saveGameState(currentClueIndex, wrongGuesses, true, points, true);

      // Scroll to center the jersey card on screen
      const screenHeight = Dimensions.get('window').height;
      const cardTopY = 80;
      const cardHeight = 350;
      const cardCenterY = cardTopY + (cardHeight / 2);
      const scrollY = Math.max(0, cardCenterY - (screenHeight / 2) + 50);
      scrollViewRef.current?.scrollToPosition(0, scrollY, true);

      // Delay confetti to let UI render first
      setTimeout(() => setShowConfetti(true), 300);

      // TODO: INTERSTITIAL AD TRIGGER POINT
      // Show interstitial ad after puzzle completion (before showing results)
      // Example with AdMob:
      // import { InterstitialAd, AdEventType } from 'react-native-google-mobile-ads';
      // const interstitial = InterstitialAd.createForAdRequest(INTERSTITIAL_AD_UNIT_ID);
      // interstitial.show();

      // Award XP (points earned = XP earned in clue puzzle)
      // Defer database operations to prevent UI freeze
      if (user) {
        const xpAmount = points * 10; // 10 XP per point earned
        setXpEarned(xpAmount);

        // Award leaderboard points (6 points for 1 clue, down to 1 point for 6 clues)
        const cluesUsed = currentClueIndex + 1;
        awardPuzzlePoints(user.id, cluesUsed);

        // Award league points
        awardLeaguePoints(user.id, sport, cluesUsed, true);

        InteractionManager.runAfterInteractions(() => {
          awardXP(user.id, xpAmount).then((result) => {
            if (result) {
              setXpResult(result);
              // Show XP modal after confetti finishes (delay 1.5s)
              setTimeout(() => {
                setShowXPModal(true);
              }, 1500);
            }
          }).catch((err) => {
            console.error('Error awarding XP:', err);
          });

          // Update stats with daily streak (only increments once per day)
          if (userStats) {
            calculateDailyStreak(sport).then((dailyStreak) => {
              updateStatsAfterWin(user.id, sport, userStats, dailyStreak).then((updatedStats) => {
                if (updatedStats) {
                  setUserStats(updatedStats);
                }
              }).catch((err) => {
                console.error('Error updating stats:', err);
              });
            });
          }
        });
      }
    } else {
      // Wrong guess - either not in mystery pool or wrong player
      const newWrongGuesses = wrongGuesses + 1;
      setWrongGuesses(newWrongGuesses);
      setGuess('');
      setShowSuggestions(false);
      triggerShake();

      const remaining = MAX_GUESSES - newWrongGuesses;

      if (remaining <= 0) {
        // Out of guesses - game over
        setWrongToastMessage('Out of guesses!');
        setShowWrongMessage(true);
        setGaveUp(true);
        saveGameState(currentClueIndex, newWrongGuesses, false, 0, false, true);

        // Update stats (loss - but play streak continues)
        if (user && userStats) {
          // Award league points (0 for loss)
          awardLeaguePoints(user.id, sport, MAX_GUESSES, false);

          // Calculate daily streak (play streak continues even on loss)
          calculateDailyStreak(sport).then((dailyStreak) => {
            updateStatsAfterLoss(user.id, sport, userStats, dailyStreak).then((updatedStats) => {
              if (updatedStats) {
                setUserStats(updatedStats);
              }
            }).catch((err) => {
              console.error('Error updating stats after loss:', err);
            });
          });
        }

        setTimeout(() => setShowWrongMessage(false), 2500);
      } else {
        // Still have guesses left
        setWrongToastMessage(`Wrong! ${remaining} guess${remaining !== 1 ? 'es' : ''} left`);
        setShowWrongMessage(true);
        saveGameState(currentClueIndex, newWrongGuesses, false, 0);

        setTimeout(() => setShowWrongMessage(false), 2000);
      }
    }
  }

  // Scroll to show the latest clue
  const scrollToClues = () => {
    // Small delay to allow the new clue to render
    setTimeout(() => {
      if (scrollViewRef.current) {
        // Calculate approximate position: cluesContainerY + (clue height * number of clues)
        // Each clue card is approximately 80px tall with margins
        const clueHeight = 90;
        const targetY = cluesContainerY + (currentClueIndex * clueHeight);
        scrollViewRef.current.scrollToPosition(0, targetY, true);
      }
    }, 100);
  };

  function handleNextClue() {
    if (currentClueIndex < 5 && !solved) {
      // Light haptic for revealing another clue
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      const newIndex = currentClueIndex + 1;
      setCurrentClueIndex(newIndex);
      setShowWrongMessage(false);
      saveGameState(newIndex, wrongGuesses, false, 0);

      // Auto-scroll to show the new clue
      setTimeout(() => {
        if (scrollViewRef.current) {
          const clueHeight = 90;
          const targetY = cluesContainerY + (newIndex * clueHeight);
          scrollViewRef.current.scrollToPosition(0, targetY, true);
        }
      }, 150);
    }
  }

  function handleGiveUp() {
    // Warning haptic for giving up
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

    setGaveUp(true);
    setSolved(false);
    setPointsEarned(0);
    saveGameState(currentClueIndex, wrongGuesses, false, 0, false, true);

    // Scroll to center the jersey card on screen
    setTimeout(() => {
      const screenHeight = Dimensions.get('window').height;
      // The result card with jersey is roughly 350px tall, starts ~80px from top
      // To center it: scroll so card center aligns with screen center
      const cardTopY = 80;
      const cardHeight = 350;
      const cardCenterY = cardTopY + (cardHeight / 2);
      const scrollY = Math.max(0, cardCenterY - (screenHeight / 2) + 50);
      scrollViewRef.current?.scrollToPosition(0, scrollY, true);
    }, 100);

    // Update stats (play streak continues even on give up)
    if (user && userStats) {
      // Award league points (0 for give up)
      awardLeaguePoints(user.id, sport, MAX_GUESSES, false);

      // Calculate daily streak (play streak continues even on give up)
      calculateDailyStreak(sport).then((dailyStreak) => {
        updateStatsAfterLoss(user.id, sport, userStats, dailyStreak).then((updatedStats) => {
          if (updatedStats) {
            setUserStats(updatedStats);
          }
        }).catch((err) => {
          console.error('Error updating stats after loss:', err);
        });
      });
    }
  }

  function getShareText(): string {
    let squares = '';

    if (solved) {
      for (let i = 0; i < currentClueIndex; i++) {
        squares += '⬛';
      }
      squares += '🟩';
    } else {
      for (let i = 0; i <= currentClueIndex; i++) {
        squares += '⬛';
      }
    }

    const clueText = solved
      ? `Guessed in ${currentClueIndex + 1} ${currentClueIndex === 0 ? 'clue' : 'clues'}!`
      : 'Failed to guess';

    const playStreakValue = userStats ? getPlayStreak(userStats, sport) : streak;
    const winStreakValue = solved ? (userStats ? getWinStreak(userStats, sport) : streak) : 0;

    return `Ballrs ${sportName}
${squares}
${clueText}
${pointsEarned > 0 ? `+${pointsEarned} points\n` : ''}🔥 ${playStreakValue} ⚡ ${winStreakValue}`;
  }

  // Handle input focus - KeyboardAwareScrollView handles scrolling automatically
  const handleInputFocus = () => {
    setInputFocused(true);
  };

  // Handle keyboard dismiss
  const handleInputBlur = () => {
    setInputFocused(false);
  };

  async function handleShare() {
    try {
      await Share.share({
        message: getShareText(),
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to share');
    }
  }

  const filteredPlayers = guess.trim().length > 0
    ? allPlayers.filter(p =>
        p.name.toLowerCase().includes(guess.toLowerCase())
      ).slice(0, 8)
    : [];

  if (loading || !mysteryPlayer) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const showAnswer = gaveUp && !solved;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <KeyboardAwareScrollView
        ref={scrollViewRef}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        enableOnAndroid={true}
        extraScrollHeight={0}
        enableAutomaticScroll={true}
      >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTopRow}>
              <TouchableOpacity style={styles.backButton} onPress={onBack}>
                <Text style={styles.backButtonText}>← Back</Text>
              </TouchableOpacity>
            </View>
            <View style={[styles.sportBadge, { backgroundColor: sportColor }]}>
              <Image source={sportIcons[sport]} style={styles.sportBadgeIcon} resizeMode="contain" />
              <Text style={styles.sportBadgeText}>{sport === 'pl' ? 'EPL' : sport.toUpperCase()}</Text>
            </View>
            <Text style={styles.title}>Daily Puzzle</Text>
            <Text style={styles.subtitle}>Guess the {sportName} player</Text>
          </View>

          {/* Stats Row */}
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>CLUE</Text>
              <Text style={styles.statValue}>{currentClueIndex + 1}/6</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>WORTH</Text>
              <Text style={[styles.statValue, { color: sportColor }]}>
                {solved ? pointsEarned : potentialPoints} pts
              </Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>WRONG</Text>
              <Text style={[styles.statValue, styles.wrongValue]}>{wrongGuesses}</Text>
            </View>
          </View>

          {/* Success - Combined Result Card */}
          {solved && (
            <View style={styles.resultCard}>
              {/* Jersey with bounce animation */}
              <View style={styles.jerseySection}>
                <JerseyReveal
                  playerName={mysteryPlayer.name}
                  jerseyNumber={mysteryPlayer.jerseyNumber || '?'}
                  teamName={mysteryPlayer.team}
                  sport={sport}
                  isCorrect={true}
                  showPlayerInfo={false}
                  embedded={true}
                />
              </View>

              {/* Player Info */}
              <Text style={styles.resultPlayerName}>{mysteryPlayer.name}</Text>
              <Text style={styles.resultTeamName}>
                {getFullTeamName(sport, mysteryPlayer.team)}
              </Text>

              {/* Divider */}
              <View style={styles.resultDivider} />

              {/* Points Badge */}
              <View style={[styles.resultPointsBadge, { backgroundColor: sportColor }]}>
                <Text style={styles.resultPointsText}>+{pointsEarned} points</Text>
              </View>

              {/* Stats */}
              <Text style={styles.resultStats}>
                Solved on clue {currentClueIndex + 1} with {wrongGuesses} wrong {wrongGuesses === 1 ? 'guess' : 'guesses'}
              </Text>

              {/* Streaks */}
              <View style={styles.resultStreaksContainer}>
                <View style={styles.resultStreakRow}>
                  <Image source={fireIcon} style={styles.streakIconFire} />
                  <Text style={styles.resultStreakText}>
                    {userStats ? getPlayStreak(userStats, sport) : streak}
                  </Text>
                </View>
                <View style={styles.resultStreakRow}>
                  <Image source={lightningIcon} style={styles.streakIconLightning} />
                  <Text style={styles.resultStreakText}>
                    {userStats ? getWinStreak(userStats, sport) : streak}
                  </Text>
                </View>
              </View>

              {/* Share Button */}
              <AnimatedButton style={styles.resultShareButton} onPress={handleShare}>
                <Text style={styles.resultShareButtonText}>SHARE RESULT</Text>
              </AnimatedButton>
            </View>
          )}

          {/* Game Over - Combined Result Card (Failed) */}
          {showAnswer && (
            <View style={styles.resultCard}>
              {/* Jersey with bounce animation */}
              <View style={styles.jerseySection}>
                <JerseyReveal
                  playerName={mysteryPlayer.name}
                  jerseyNumber={mysteryPlayer.jerseyNumber || '?'}
                  teamName={mysteryPlayer.team}
                  sport={sport}
                  isCorrect={false}
                  showPlayerInfo={false}
                  embedded={true}
                />
              </View>

              {/* Player Info */}
              <Text style={styles.resultPlayerName}>{mysteryPlayer.name}</Text>
              <Text style={styles.resultTeamName}>
                {getFullTeamName(sport, mysteryPlayer.team)}
              </Text>

              {/* Divider */}
              <View style={styles.resultDivider} />

              {/* Failed Message */}
              <Text style={styles.resultFailedText}>Better luck tomorrow!</Text>

              {/* Streaks - Play streak continues, Win streak resets */}
              <View style={styles.resultStreaksContainer}>
                <View style={styles.resultStreakRow}>
                  <Image source={fireIcon} style={styles.streakIconFire} />
                  <Text style={styles.resultStreakText}>
                    {userStats ? getPlayStreak(userStats, sport) : streak}
                  </Text>
                </View>
                <View style={styles.resultStreakRow}>
                  <Image source={lightningIcon} style={styles.streakIconLightning} />
                  <Text style={styles.resultStreakText}>0</Text>
                </View>
              </View>

              {/* Share Button */}
              <AnimatedButton style={styles.resultShareButton} onPress={handleShare}>
                <Text style={styles.resultShareButtonText}>SHARE RESULT</Text>
              </AnimatedButton>
            </View>
          )}

          {/* Clues Stack */}
          <View
            style={styles.cluesContainer}
            onLayout={(event: LayoutChangeEvent) => {
              setCluesContainerY(event.nativeEvent.layout.y);
            }}
          >
            <Text style={styles.cluesTitle}>CLUES</Text>
            {revealedClues.map((clue, index) => (
              <View
                key={index}
                style={[
                  styles.clueCard,
                  { backgroundColor: sportColor },
                ]}
              >
                <View style={styles.clueNumberBadge}>
                  <Text style={styles.clueNumberText}>{index + 1}</Text>
                </View>
                <View style={styles.clueContent}>
                  <Text style={styles.clueText}>{clue}</Text>
                  <View style={styles.cluePointsBadge}>
                    <Text style={styles.cluePointsText}>
                      {6 - index} {6 - index === 1 ? 'pt' : 'pts'}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </View>

          {/* Input (only show if not solved and not game over) */}
          {!solved && !showAnswer && (
            <View
              style={styles.inputWrapper}
              onLayout={(e: LayoutChangeEvent) => setInputContainerY(e.nativeEvent.layout.y)}
            >
              <View style={styles.inputRow}>
                <TextInput
                  ref={inputRef}
                  style={[styles.input, inputFocused && styles.inputFocused]}
                  value={guess}
                  onChangeText={(text) => {
                    setGuess(text);
                    setShowSuggestions(text.trim().length > 0);
                  }}
                  onFocus={handleInputFocus}
                  onBlur={handleInputBlur}
                  placeholder="Type player name..."
                  placeholderTextColor="#888888"
                  autoCapitalize="words"
                  autoCorrect={false}
                  selectionColor="#1ABC9C"
                />
                {/* Circular Timer */}
                <Animated.View
                  style={[
                    styles.timerCircle,
                    {
                      borderColor: getTimerColor(),
                      transform: [{ scale: timerPulseAnim }],
                    },
                  ]}
                >
                  <Text style={[styles.timerText, { color: getTimerColor() }]}>
                    {timeRemaining}
                  </Text>
                </Animated.View>
              </View>
              {showSuggestions && filteredPlayers.length > 0 && (
                <View style={styles.suggestionsContainer}>
                  {filteredPlayers.map((player, index) => (
                    <TouchableOpacity
                      key={`${player.id}-${index}`}
                      style={styles.suggestionItem}
                      onPress={() => handleSelectPlayer(player)}
                    >
                      <Text style={styles.suggestionName}>{player.name}</Text>
                      <Text style={styles.suggestionTeam}>{player.team}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* Next Clue Button */}
          {!solved && !isLastClue && (
            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
              <TouchableOpacity
                style={styles.nextClueButton}
                onPress={handleNextClue}
              >
                <Text style={styles.nextClueButtonText}>
                  Need Another Clue? (-1 point)
                </Text>
              </TouchableOpacity>
            </Animated.View>
          )}

          {/* Give Up Button */}
          {!solved && !showAnswer && isLastClue && (
            <TouchableOpacity
              style={styles.giveUpButton}
              onPress={handleGiveUp}
            >
              <Text style={styles.giveUpButtonText}>Give Up</Text>
            </TouchableOpacity>
          )}

      </KeyboardAwareScrollView>

      {/* Confetti */}
      {showConfetti && (
        <ConfettiCannon
          ref={confettiRef}
          count={50}
          origin={{ x: -10, y: 0 }}
          autoStart={true}
          fadeOut={true}
          fallSpeed={2000}
          explosionSpeed={250}
          colors={[sportColor, '#FFD700', '#4ECDC4']}
          onAnimationEnd={() => setShowConfetti(false)}
        />
      )}

      {/* XP Earned Modal */}
      {xpResult && (
        <XPEarnedModal
          visible={showXPModal}
          xpEarned={xpEarned}
          previousXP={xpResult.previousXP}
          newXP={xpResult.newXP}
          previousLevel={calculateLevel(xpResult.previousXP)}
          newLevel={calculateLevel(xpResult.newXP)}
          onClose={() => {
            setShowXPModal(false);
            // Show Level Up modal if user leveled up
            if (xpResult.leveledUp) {
              setTimeout(() => setShowLevelUpModal(true), 300);
            } else {
              checkAndShowLinkEmailPrompt();
            }
          }}
          sportColor={sportColor}
        />
      )}

      {/* Level Up Modal */}
      {xpResult && (
        <LevelUpModal
          visible={showLevelUpModal}
          newLevel={calculateLevel(xpResult.newXP)}
          previousLevel={calculateLevel(xpResult.previousXP)}
          onClose={() => {
            setShowLevelUpModal(false);
            checkAndShowLinkEmailPrompt();
          }}
        />
      )}

      {/* Wrong Guess Toast */}
      {showWrongMessage && (
        <View style={styles.wrongToast}>
          <Text style={styles.wrongToastText}>{wrongToastMessage}</Text>
        </View>
      )}

      {/* Link Email Prompt Modal */}
      <LinkEmailPromptModal
        visible={showLinkEmailPrompt}
        onLinkEmail={() => {
          setShowLinkEmailPrompt(false);
          if (onLinkEmail) {
            onLinkEmail();
          }
        }}
        onMaybeLater={handleLinkEmailPromptDismiss}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: colors.text,
    fontSize: 18,
    fontFamily: 'DMSans_500Medium',
  },
  header: {
    marginBottom: 24,
    alignItems: 'center',
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    width: '100%',
    marginBottom: 16,
  },
  backButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#F2C94C',
    borderWidth: 2,
    borderColor: '#000000',
    borderRadius: 16,
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
  resetButton: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#000000',
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  resetButtonText: {
    color: '#1A1A1A',
    fontSize: 14,
    fontFamily: 'DMSans_900Black',
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
    marginBottom: 12,
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
  title: {
    fontSize: 24,
    fontFamily: 'DMSans_900Black',
    color: colors.text,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
    fontFamily: 'DMSans_400Regular',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
    gap: 12,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#000000',
    padding: 14,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  statLabel: {
    fontSize: 12,
    color: '#888888',
    marginBottom: 4,
    textTransform: 'uppercase',
    fontFamily: 'DMSans_400Regular',
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: 24,
    fontFamily: 'DMSans_900Black',
    color: colors.text,
  },
  wrongValue: {
    color: '#E53935',
  },
  // Combined Result Card styles
  resultCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#000000',
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  jerseySection: {
    marginBottom: 16,
  },
  resultPlayerName: {
    fontSize: 24,
    fontFamily: 'DMSans_900Black',
    color: '#1A1A1A',
    textAlign: 'center',
  },
  resultTeamName: {
    fontSize: 16,
    fontFamily: 'DMSans_500Medium',
    color: '#888888',
    textAlign: 'center',
    marginTop: 4,
  },
  resultDivider: {
    width: '100%',
    height: 1,
    backgroundColor: '#E5E5E5',
    marginVertical: 16,
  },
  resultPointsBadge: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 12,
  },
  resultPointsText: {
    fontSize: 16,
    fontFamily: 'DMSans_700Bold',
    color: '#FFFFFF',
  },
  resultStats: {
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
    color: '#666666',
    textAlign: 'center',
  },
  resultStreaksContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    marginTop: 12,
  },
  resultStreakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  streakIconFire: {
    width: 20,
    height: 24,
  },
  streakIconLightning: {
    width: 16,
    height: 24,
  },
  resultStreakText: {
    fontSize: 18,
    fontFamily: 'DMSans_900Black',
    color: '#1A1A1A',
  },
  resultShareButton: {
    backgroundColor: '#1ABC9C',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#000000',
    marginTop: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  resultShareButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'DMSans_900Black',
  },
  resultFailedText: {
    fontSize: 16,
    fontFamily: 'DMSans_500Medium',
    color: '#666666',
    textAlign: 'center',
    marginBottom: 8,
  },
  wrongMessage: {
    backgroundColor: colors.error,
    borderRadius: borderRadius.card,
    borderWidth: borders.card,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 20,
    alignItems: 'center',
    ...shadows.card,
  },
  wrongText: {
    color: colors.surface,
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
  },
  notInPuzzleMessage: {
    backgroundColor: '#F59E0B',
    borderRadius: borderRadius.card,
    borderWidth: borders.card,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 20,
    alignItems: 'center',
    ...shadows.card,
  },
  notInPuzzleText: {
    color: colors.surface,
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
  },
  inputWrapper: {
    marginTop: 8,
    marginBottom: 16,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  input: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    color: colors.text,
    borderWidth: 2,
    borderColor: '#000000',
    fontFamily: 'DMSans_500Medium',
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  timerCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 3,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  timerText: {
    fontSize: 20,
    fontFamily: 'DMSans_900Black',
  },
  inputFocused: {
    borderColor: '#1ABC9C',
  },
  suggestionsContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#000000',
    marginTop: 8,
    marginBottom: 8,
    zIndex: 100,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  suggestionItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  suggestionName: {
    fontSize: 16,
    fontFamily: 'DMSans_600SemiBold',
    color: colors.text,
  },
  suggestionTeam: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
    fontFamily: 'DMSans_400Regular',
  },
  cluesContainer: {
    marginBottom: 24,
  },
  cluesTitle: {
    fontSize: 12,
    fontFamily: 'DMSans_700Bold',
    color: colors.textSecondary,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  clueCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#000000',
    padding: 16,
    marginBottom: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  clueNumberBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    flexShrink: 0,
  },
  clueNumberText: {
    fontSize: 14,
    fontFamily: 'DMSans_900Black',
    color: '#1A1A1A',
  },
  clueContent: {
    flex: 1,
  },
  cluePointsBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginTop: 10,
  },
  cluePointsText: {
    fontSize: 12,
    fontFamily: 'DMSans_700Bold',
    color: '#FFFFFF',
  },
  clueText: {
    fontSize: 15,
    color: '#FFFFFF',
    lineHeight: 22,
    fontFamily: 'DMSans_500Medium',
  },
  nextClueButton: {
    backgroundColor: '#1ABC9C',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    borderWidth: 2,
    borderColor: '#000000',
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  nextClueButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
  },
  giveUpButton: {
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
  giveUpButtonText: {
    color: '#1A1A1A',
    fontSize: 14,
    fontFamily: 'DMSans_900Black',
    letterSpacing: 0.5,
  },
  wrongToast: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    backgroundColor: colors.error,
    borderRadius: borderRadius.card,
    borderWidth: borders.card,
    borderColor: colors.border,
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
    ...shadows.card,
    elevation: 10,
  },
  wrongToastText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'DMSans_700Bold',
  },
});
