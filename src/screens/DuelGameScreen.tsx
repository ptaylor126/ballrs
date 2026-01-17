import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
  Image,
  ActivityIndicator,
  AppState,
  AppStateStatus,
  ScrollView,
  Modal,
  BackHandler,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { getSportColor, Sport, truncateUsername, colors as themeColors } from '../lib/theme';
import { soundService } from '../lib/soundService';
import AdBanner from '../components/AdBanner';

// Toggle this to hide ads for screenshots
const HIDE_ADS_FOR_SCREENSHOTS = true;

// Sport icons
const sportIcons: Record<Sport, any> = {
  nba: require('../../assets/images/icon-basketball.png'),
  pl: require('../../assets/images/icon-soccer.png'),
  nfl: require('../../assets/images/icon-football.png'),
  mlb: require('../../assets/images/icon-baseball.png'),
};

// Result icons
const handshakeIcon = require('../../assets/images/icon-handshake.png');
const trophyIcon = require('../../assets/images/icon-trophy.png');
const thumbsDownIcon = require('../../assets/images/icon-thumbs-down.png');
const crownIcon = require('../../assets/images/icon-crown.png');
const speakerIcon = require('../../assets/images/icon-speaker.png');

// Ad banners
const adBannerImage = require('../../assets/images/ad-banner.png');
const countdownAdImage = require('../../assets/images/ad-banner.png');
const feedbackBannerImage = require('../../assets/images/feedback-banner.png');

const sportNames: Record<Sport, string> = {
  nba: 'NBA',
  pl: 'EPL',
  nfl: 'NFL',
  mlb: 'MLB',
};
import { useAuth } from '../contexts/AuthContext';
import {
  Duel,
  TriviaQuestion,
  subscribeToDuel,
  unsubscribeFromDuel,
  submitTriviaAnswer,
  completeDuel,
  determineWinner,
  determineFinalWinner,
  setRoundStartTime,
  advanceToNextRound,
  getCurrentQuestionId,
  submitChallengerResult,
  submitOpponentResult,
  getTimeRemaining,
  PlayerResult,
  forfeitDuel,
} from '../lib/duelService';
import { areFriends, addFriend } from '../lib/friendsService';
import { supabase } from '../lib/supabase';
import { calculateDuelXP, getXPProgressInLevel, awardXP, getUserXP, getXPForLevel } from '../lib/xpService';
import { completeDuelServerSide } from '../lib/serverRewardsService';
import { Achievement } from '../lib/achievementsService';
import { hasSeenInvitePrompt, markInvitePromptSeen, inviteFriends } from '../lib/inviteService';
import LevelUpModal from '../components/LevelUpModal';
import AchievementToast from '../components/AchievementToast';
import ReportUserModal from '../components/ReportUserModal';
import { RealtimeChannel } from '@supabase/supabase-js';

// Import trivia data
import nbaTriviaData from '../../data/nba-trivia.json';
import plTriviaData from '../../data/pl-trivia.json';
import nflTriviaData from '../../data/nfl-trivia.json';
import mlbTriviaData from '../../data/mlb-trivia.json';

interface Props {
  duel: Duel;
  onBack: () => void;
  onComplete: (won: boolean) => void;
  onPlayAgain: (sport: 'nba' | 'pl' | 'nfl' | 'mlb') => void;
  onRematch?: (opponentId: string, sport: 'nba' | 'pl' | 'nfl' | 'mlb', questionCount: number) => void;
  getRandomQuestionId?: (sport: 'nba' | 'pl' | 'nfl' | 'mlb') => string;
  // Async duel props
  isAsyncMode?: boolean;
  isChallenger?: boolean;
}

const TIMER_DURATION = 10; // seconds per question

const colors = {
  background: '#F5F2EB',
  cardBackground: '#FFFFFF',
  primary: '#1ABC9C',
  accent: '#1ABC9C',
  correct: '#3BA978',
  wrong: '#DC2626',
  textDark: '#1A1A1A',
  textMuted: '#888888',
  border: '#000000',
  borderLight: '#E5E5E0',
  nba: '#E07A3D',
  pl: '#A17FFF',
  nfl: '#3BA978',
  mlb: '#7A93D2',
  opponent: '#DC2626',
  live: '#3BA978',
  timerWarning: '#F59E0B',
  timerDanger: '#DC2626',
  waiting: '#888888',
  selected: '#1ABC9C',
};

// Get trivia questions by sport
const getTriviaQuestions = (sport: 'nba' | 'pl' | 'nfl' | 'mlb'): TriviaQuestion[] => {
  switch (sport) {
    case 'nba': return nbaTriviaData as TriviaQuestion[];
    case 'pl': return plTriviaData as TriviaQuestion[];
    case 'nfl': return nflTriviaData as TriviaQuestion[];
    case 'mlb': return mlbTriviaData as TriviaQuestion[];
  }
};

export default function DuelGameScreen({ duel: initialDuel, onBack, onComplete, onPlayAgain, onRematch, getRandomQuestionId, isAsyncMode = false, isChallenger = false }: Props) {
  const { user } = useAuth();
  const [duel, setDuel] = useState<Duel>(initialDuel);
  const [question, setQuestion] = useState<TriviaQuestion | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [opponentAnswered, setOpponentAnswered] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(TIMER_DURATION);
  // For async mode, start with countdown immediately (skip waiting phase)
  // For completed async duels (from notification tap), start with results
  const initialGamePhase = isAsyncMode
    ? (initialDuel.status === 'completed' ? 'results' : 'countdown')
    : 'waiting';
  const [gamePhase, setGamePhase] = useState<'waiting' | 'countdown' | 'playing' | 'roundResult' | 'results'>(initialGamePhase);
  const [countdownNumber, setCountdownNumber] = useState(3);
  const countdownScaleAnim = useRef(new Animated.Value(0)).current;
  // Show result modal immediately for completed async duels
  const [showResultModal, setShowResultModal] = useState(isAsyncMode && initialDuel.status === 'completed');
  const [roundStartTime, setRoundStartTimeState] = useState<number | null>(null);

  // Multi-question state
  const [myScore, setMyScore] = useState(0);
  const [opponentScore, setOpponentScore] = useState(0);
  const [roundWon, setRoundWon] = useState<boolean | null>(null);
  const [isAdvancingRound, setIsAdvancingRound] = useState(false);

  const [alreadyFriends, setAlreadyFriends] = useState(false);
  const [friendAdded, setFriendAdded] = useState(false);
  const [opponentUsername, setOpponentUsername] = useState<string | null>(null);
  const [showLevelUpModal, setShowLevelUpModal] = useState(false);
  const [newLevel, setNewLevel] = useState(1);
  const [xpAwarded, setXpAwarded] = useState(false);
  const [pendingAchievements, setPendingAchievements] = useState<Achievement[]>([]);
  const [currentAchievement, setCurrentAchievement] = useState<Achievement | null>(null);
  const [showAchievementToast, setShowAchievementToast] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'reconnecting' | 'disconnected'>('connected');

  // Async mode state
  const [asyncWaitingForFriend, setAsyncWaitingForFriend] = useState(false);
  const [asyncTimeRemaining, setAsyncTimeRemaining] = useState<{ hours: number; minutes: number; expired: boolean } | null>(null);
  // Track local results for async multi-round duels
  const [asyncLocalResults, setAsyncLocalResults] = useState<PlayerResult[]>([]);
  // Track round summaries for end-of-duel display
  interface RoundSummary {
    roundNumber: number;
    question: string;
    correctAnswer: string;
    userAnswer: string;
    isCorrect: boolean;
    time: number;
  }
  const [roundSummaries, setRoundSummaries] = useState<RoundSummary[]>([]);
  // Combined async result modal (shows result + waiting in one modal)
  const [showAsyncResultModal, setShowAsyncResultModal] = useState(false);
  const [showFullAnswers, setShowFullAnswers] = useState(false);

  // Forfeit modal state
  const [showForfeitModal, setShowForfeitModal] = useState(false);
  const [isForfeiting, setIsForfeiting] = useState(false);

  // Report modal state
  const [showReportModal, setShowReportModal] = useState(false);

  // Sound toggle state
  const [soundEnabled, setSoundEnabled] = useState(soundService.isEnabled());

  // First duel win invite modal state
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [isInviting, setIsInviting] = useState(false);

  // XP progress bar state
  const [xpProgressInfo, setXpProgressInfo] = useState<{
    previousXP: number;
    newXP: number;
    current: number;
    required: number;
    percentage: number;
  } | null>(null);
  const xpBarAnimatedWidth = useRef(new Animated.Value(0)).current;

  // Animate XP bar when progress info updates
  useEffect(() => {
    if (xpProgressInfo) {
      // Calculate starting percentage (before XP was awarded)
      const startPercentage = (xpProgressInfo.previousXP / xpProgressInfo.required) * 100;

      // Set to starting position immediately
      xpBarAnimatedWidth.setValue(Math.min(startPercentage, 100));

      // Animate to final percentage after a brief delay for modal to render
      setTimeout(() => {
        Animated.timing(xpBarAnimatedWidth, {
          toValue: Math.min(xpProgressInfo.percentage, 100),
          duration: 600,
          useNativeDriver: false,
        }).start();
      }, 150);
    }
  }, [xpProgressInfo]);

  // Refs for safety timeout and connection monitoring
  const safetyTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const hasSubmittedTimeoutRef = useRef<boolean>(false);
  const roundResultTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [skipRoundResult, setSkipRoundResult] = useState(false);
  const [hidingRoundResult, setHidingRoundResult] = useState(false);

  // Helper to check if this is a multi-question duel
  const isMultiQuestion = duel.question_count > 1;
  const totalQuestions = duel.question_count;
  const currentRound = duel.current_round;

  // Helper to extract async duel answer data from player_result
  const getAsyncAnswerData = (playerResult: PlayerResult | null): { answer: string | null; time: number | null; correct: boolean } => {
    if (!playerResult) return { answer: null, time: null, correct: false };

    try {
      // The answer field contains JSON-stringified array of round results
      const roundResults = JSON.parse(playerResult.answer) as PlayerResult[];
      if (roundResults && roundResults.length > 0) {
        // For single question, return first round's data
        const firstRound = roundResults[0];
        return {
          answer: firstRound.answer,
          time: firstRound.time,
          correct: firstRound.correct,
        };
      }
    } catch (e) {
      // If parsing fails, the answer might be a direct string (fallback)
      console.log('Failed to parse async result:', e);
    }

    return { answer: null, time: null, correct: playerResult.correct };
  };

  const channelRef = useRef<RealtimeChannel | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const timerAnim = useRef(new Animated.Value(1)).current;
  const buttonScaleAnims = useRef([
    new Animated.Value(1),
    new Animated.Value(1),
    new Animated.Value(1),
    new Animated.Value(1),
  ]).current;
  const lastTickSecond = useRef<number>(-1);
  const soundPlayedForResult = useRef<boolean>(false);

  const isPlayer1 = user?.id === duel.player1_id;
  const opponentId = isPlayer1 ? duel.player2_id : duel.player1_id;
  const sportColor = getSportColor(duel.sport as Sport);
  const isFriendDuel = !!initialDuel.invite_code;

  // Initialize sound service
  useEffect(() => {
    soundService.initialize();
    return () => {
      soundService.cleanup();
    };
  }, []);

  // Countdown effect - runs 3-2-1 before starting the game
  useEffect(() => {
    if (gamePhase !== 'countdown') return;

    // Play countdown + whistle sound when countdown begins (only on first round)
    if (countdownNumber === 3 && currentRound === 1) {
      soundService.playCountdownWhistle();
    }

    // Animate the countdown number
    const animateNumber = () => {
      countdownScaleAnim.setValue(0);
      Animated.sequence([
        Animated.spring(countdownScaleAnim, {
          toValue: 1,
          friction: 4,
          tension: 100,
          useNativeDriver: true,
        }),
        Animated.timing(countdownScaleAnim, {
          toValue: 0.8,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    };

    animateNumber();

    // Countdown timer
    const timer = setTimeout(() => {
      if (countdownNumber > 1) {
        setCountdownNumber(countdownNumber - 1);
      } else {
        // Countdown finished, start playing
        // For async mode, set roundStartTime now
        // For sync mode, roundStartTime is already set from server (with +3s offset)
        if (isAsyncMode) {
          setRoundStartTimeState(Date.now());
        }
        setGamePhase('playing');
        hasSubmittedTimeoutRef.current = false;
        setCountdownNumber(3); // Reset for next round
      }
    }, 1000);

    return () => {
      clearTimeout(timer);
    };
  }, [gamePhase, countdownNumber, isAsyncMode]);

  // Note: countdown + whistle sound is played when countdown begins (round 1 only)
  // No separate sound needed when game phase changes to 'playing'

  // Handle app going to background/foreground
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      // Coming back from background
      if (appStateRef.current.match(/inactive|background/) && nextAppState === 'active') {
        // If we're in playing phase and should have timed out, force submit
        if (gamePhase === 'playing' && roundStartTime && !hasAnswered) {
          const elapsed = (Date.now() - roundStartTime) / 1000;
          if (elapsed >= TIMER_DURATION) {
            console.log('App returned from background after timeout, submitting...');
            handleTimeUp();
          }
        }
      }
      appStateRef.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, [gamePhase, roundStartTime, hasAnswered]);

  // Find the trivia question for current round
  useEffect(() => {
    const questions = getTriviaQuestions(duel.sport);
    const currentQuestionId = getCurrentQuestionId(duel);
    console.log('[DuelGameScreen] Loading question:', {
      round: duel.current_round,
      totalQuestions: duel.question_count,
      mysteryPlayerIds: duel.mystery_player_id,
      currentQuestionId,
    });
    const q = questions.find(q => q.id === currentQuestionId);
    if (q) {
      console.log('[DuelGameScreen] Found question:', q.question?.substring(0, 50));
      setQuestion(q);
    } else {
      console.error('[DuelGameScreen] Question not found for ID:', currentQuestionId);
    }
  }, [duel.mystery_player_id, duel.sport, duel.current_round]);

  // Check friendship status and get opponent username
  useEffect(() => {
    const checkFriendship = async () => {
      if (!user || !opponentId || !isFriendDuel) return;

      const friends = await areFriends(user.id, opponentId);
      setAlreadyFriends(friends);

      const { data: profile } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', opponentId)
        .single();

      if (profile?.username) {
        setOpponentUsername(truncateUsername(profile.username));
      }
    };

    checkFriendship();
  }, [user, opponentId, isFriendDuel]);

  // Start async game immediately when entering async mode
  useEffect(() => {
    if (isAsyncMode) {
      // Initialize scores from duel object for async mode
      const myCurrentScore = isPlayer1 ? duel.player1_score : duel.player2_score;
      const oppCurrentScore = isPlayer1 ? duel.player2_score : duel.player1_score;
      setMyScore(myCurrentScore);
      setOpponentScore(oppCurrentScore);

      // Check if duel is already completed (e.g., navigating from notification tap)
      if (duel.status === 'completed') {
        setGamePhase('results');
        setShowResultModal(true);
        return;
      }
      // For async duels, start with countdown
      setCountdownNumber(3);
      setGamePhase('countdown');
    }
  }, [isAsyncMode, duel.status, isPlayer1, duel.player1_score, duel.player2_score]);

  // Load round summaries from stored player results when viewing completed duel
  useEffect(() => {
    if (duel.status !== 'completed' || roundSummaries.length > 0) return;

    const myResult = isPlayer1 ? duel.player1_result : duel.player2_result;
    if (!myResult?.answer) return;

    try {
      // Get all question IDs
      const questionIds = duel.mystery_player_id.split(',');
      const allQuestions = getTriviaQuestions(duel.sport);

      // Parse the answers array
      let answers: PlayerResult[] = [];
      try {
        const parsed = JSON.parse(myResult.answer);
        answers = Array.isArray(parsed) ? parsed : [myResult];
      } catch {
        answers = [myResult];
      }

      // Build round summaries
      const summaries: RoundSummary[] = questionIds.map((qId, index) => {
        const q = allQuestions.find(question => question.id === qId);
        const answerData = answers[index] || { answer: '', correct: false, time: 0 };

        return {
          roundNumber: index + 1,
          question: q?.question || 'Question not found',
          correctAnswer: q?.correctAnswer || '',
          userAnswer: answerData.answer || 'No answer',
          isCorrect: answerData.correct,
          time: answerData.time || 0,
        };
      });

      setRoundSummaries(summaries);
    } catch (err) {
      console.error('Error loading round summaries:', err);
    }
  }, [duel.status, duel.mystery_player_id, duel.sport, duel.player1_result, duel.player2_result, isPlayer1, roundSummaries.length]);

  // Start the game when duel becomes active (for sync mode only)
  useEffect(() => {
    if (isAsyncMode) return; // Skip for async mode - handled above

    if (duel.status === 'active' && gamePhase === 'waiting') {
      // If player1, set the round start time
      if (isPlayer1 && !duel.round_start_time) {
        setRoundStartTime(duel.id);
      }
    }
  }, [duel.status, gamePhase, isPlayer1, duel.id, duel.round_start_time, isAsyncMode]);

  // Subscribe to duel updates with connection monitoring (skip for async mode)
  useEffect(() => {
    // Skip real-time subscription for async mode - we handle results differently
    if (isAsyncMode) {
      return;
    }

    let reconnectAttempts = 0;
    const maxReconnectAttempts = 5;
    let reconnectTimer: NodeJS.Timeout | null = null;

    const setupSubscription = () => {
      channelRef.current = subscribeToDuel(duel.id, (updatedDuel) => {
        setConnectionStatus('connected');
        reconnectAttempts = 0;
        setDuel(updatedDuel);

        // Update scores from duel state
        const myCurrentScore = isPlayer1 ? updatedDuel.player1_score : updatedDuel.player2_score;
        const oppCurrentScore = isPlayer1 ? updatedDuel.player2_score : updatedDuel.player1_score;
        setMyScore(myCurrentScore);
        setOpponentScore(oppCurrentScore);

        // Check if round started
        if (updatedDuel.round_start_time && gamePhase === 'waiting') {
          // For sync mode, start countdown before playing
          // Store the server time but add countdown duration to account for countdown
          const serverStartTime = new Date(updatedDuel.round_start_time).getTime();
          // Add 3 seconds to account for countdown (so timer starts correctly after countdown)
          setRoundStartTimeState(serverStartTime + 3000);
          setCountdownNumber(3);
          setGamePhase('countdown');
        }

        // Check if opponent has answered
        const opponentAnswer = isPlayer1 ? updatedDuel.player2_answer : updatedDuel.player1_answer;
        if (opponentAnswer !== null) {
          setOpponentAnswered(true);
        }

        // Check if both have answered or game is completed
        const myAnswer = isPlayer1 ? updatedDuel.player1_answer : updatedDuel.player2_answer;
        if (updatedDuel.status === 'completed') {
          setGamePhase('results');
          setShowResultModal(true);
        } else if (myAnswer !== null && opponentAnswer !== null && gamePhase === 'playing') {
          // Both answered - handle round end
          if (isMultiQuestion) {
            // Show round result, then advance
            setHidingRoundResult(false);
            setGamePhase('roundResult');
          } else {
            // Single question - show final results
            setGamePhase('results');
            setShowResultModal(true);
          }
        }
      });

      // Monitor channel status
      if (channelRef.current) {
        channelRef.current.on('system', { event: 'disconnect' }, () => {
          console.log('Duel subscription disconnected');
          setConnectionStatus('reconnecting');

          // Attempt to reconnect
          if (reconnectAttempts < maxReconnectAttempts) {
            reconnectAttempts++;
            reconnectTimer = setTimeout(() => {
              console.log(`Reconnecting... attempt ${reconnectAttempts}`);
              if (channelRef.current) {
                unsubscribeFromDuel(channelRef.current);
              }
              setupSubscription();
            }, 1000 * reconnectAttempts); // Exponential backoff
          } else {
            setConnectionStatus('disconnected');
          }
        });
      }
    };

    setupSubscription();

    return () => {
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }
      if (channelRef.current) {
        unsubscribeFromDuel(channelRef.current);
      }
    };
  }, [duel.id, isPlayer1, gamePhase, isMultiQuestion, isAsyncMode]);

  // Helper function to get random question ID
  const getNewQuestionId = useCallback(() => {
    if (getRandomQuestionId) {
      return getRandomQuestionId(duel.sport);
    }
    // Fallback: generate random question ID from available questions
    const questions = getTriviaQuestions(duel.sport);
    const usedIds = duel.mystery_player_id.split(',');
    const availableQuestions = questions.filter(q => !usedIds.includes(q.id));
    if (availableQuestions.length > 0) {
      const randomIndex = Math.floor(Math.random() * availableQuestions.length);
      return availableQuestions[randomIndex].id;
    }
    // If all questions used, just pick a random one
    const randomIndex = Math.floor(Math.random() * questions.length);
    return questions[randomIndex].id;
  }, [duel.sport, duel.mystery_player_id, getRandomQuestionId]);

  // Handle round result phase - advance to next round after brief delay
  useEffect(() => {
    if (gamePhase !== 'roundResult' || !question) return;

    // For async mode, determine round result from local answer
    if (isAsyncMode) {
      const latestResult = asyncLocalResults[asyncLocalResults.length - 1];
      setRoundWon(latestResult?.correct ? true : false);
    } else {
      // Calculate if I won this round (sync mode)
      const myAnswer = isPlayer1 ? duel.player1_answer : duel.player2_answer;
      const oppAnswer = isPlayer1 ? duel.player2_answer : duel.player1_answer;
      const iCorrect = myAnswer === question.correctAnswer;
      const oCorrect = oppAnswer === question.correctAnswer;
      setRoundWon(iCorrect && !oCorrect ? true : (!iCorrect && oCorrect ? false : null));
    }

    const isLastRound = currentRound >= totalQuestions;

    // Function to advance from round result
    const advanceFromRoundResult = async () => {
      if (isLastRound) {
        // ASYNC MODE: Submit all results and show waiting screen
        if (isAsyncMode) {
          // Calculate total score and time from local results
          const totalScore = asyncLocalResults.filter(r => r.correct).length;
          const totalTime = asyncLocalResults.reduce((sum, r) => sum + r.time, 0);

          // Create aggregated result for submission
          const aggregatedResult: PlayerResult = {
            answer: JSON.stringify(asyncLocalResults), // Store all answers
            time: totalTime,
            correct: totalScore > totalQuestions / 2, // Won more than half
          };

          if (isChallenger) {
            try {
              const result = await submitChallengerResult(duel.id, aggregatedResult);
              if (result?.expires_at) {
                const remaining = getTimeRemaining(result.expires_at);
                setAsyncTimeRemaining(remaining);
              }
            } catch (err) {
              console.error('[DuelGame] submitChallengerResult error:', err);
            }
            // Always show waiting screen for challenger
            setGamePhase('results');
            setAsyncWaitingForFriend(true);
            setShowAsyncResultModal(true);
          } else {
            // Helper function to show results with local/fallback scores
            const showLocalResults = () => {
              console.warn('[DuelGame] Using local scores for results');
              const localMyScore = asyncLocalResults.filter(r => r.correct).length;
              setMyScore(localMyScore);

              // Try to get opponent's score from the duel's player1_result
              let oppScore = 0;
              const p1Result = duel.player1_result as PlayerResult | null;
              if (p1Result?.answer) {
                try {
                  const p1Answers = JSON.parse(p1Result.answer);
                  oppScore = Array.isArray(p1Answers) ? p1Answers.filter((a: PlayerResult) => a.correct).length : (p1Result.correct ? 1 : 0);
                } catch {
                  oppScore = p1Result.correct ? 1 : 0;
                }
              }
              setOpponentScore(oppScore);
              setGamePhase('results');
              setShowResultModal(true);
            };

            try {
              const result = await submitOpponentResult(duel.id, aggregatedResult);
              if (result) {
                // Calculate scores from the player results
                const p1Result = result.player1_result as PlayerResult | null;
                const p2Result = result.player2_result as PlayerResult | null;

                // Parse the answer field to count correct answers (it's a JSON array)
                let p1Score = 0;
                let p2Score = 0;

                if (p1Result?.answer) {
                  try {
                    const p1Answers = JSON.parse(p1Result.answer);
                    p1Score = Array.isArray(p1Answers) ? p1Answers.filter((a: PlayerResult) => a.correct).length : (p1Result.correct ? 1 : 0);
                  } catch {
                    p1Score = p1Result.correct ? 1 : 0;
                  }
                }

                if (p2Result?.answer) {
                  try {
                    const p2Answers = JSON.parse(p2Result.answer);
                    p2Score = Array.isArray(p2Answers) ? p2Answers.filter((a: PlayerResult) => a.correct).length : (p2Result.correct ? 1 : 0);
                  } catch {
                    p2Score = p2Result.correct ? 1 : 0;
                  }
                }

                // Set scores based on which player this user is
                setMyScore(isPlayer1 ? p1Score : p2Score);
                setOpponentScore(isPlayer1 ? p2Score : p1Score);

                setDuel(result);
                setGamePhase('results');
                setShowResultModal(true);
              } else {
                // submitOpponentResult returned null
                showLocalResults();
              }
            } catch (err) {
              // submitOpponentResult threw an error
              console.error('[DuelGame] submitOpponentResult error:', err);
              showLocalResults();
            }
          }
          return;
        }

        // SYNC MODE: Complete the duel and show final results
        const p1Correct = duel.player1_answer === question.correctAnswer;
        const p2Correct = duel.player2_answer === question.correctAnswer;

        // Calculate final scores including this round
        const finalP1Score = duel.player1_score + (p1Correct ? 1 : 0);
        const finalP2Score = duel.player2_score + (p2Correct ? 1 : 0);
        const finalP1Time = duel.player1_total_time + (duel.player1_answer_time || TIMER_DURATION * 1000);
        const finalP2Time = duel.player2_total_time + (duel.player2_answer_time || TIMER_DURATION * 1000);

        // Update local scores for display
        setMyScore(isPlayer1 ? finalP1Score : finalP2Score);
        setOpponentScore(isPlayer1 ? finalP2Score : finalP1Score);

        // Player 1 determines final winner and completes duel
        if (isPlayer1) {
          try {
            // Create a temporary duel object with final scores for winner determination
            const finalDuel = {
              ...duel,
              player1_score: finalP1Score,
              player2_score: finalP2Score,
              player1_total_time: finalP1Time,
              player2_total_time: finalP2Time,
            };
            const { winnerId } = determineFinalWinner(finalDuel);
            await completeDuel(duel.id, winnerId);
          } catch (err) {
            console.error('[DuelGame] completeDuel error:', err);
          }
        }

        // Always show results even if completeDuel failed
        setGamePhase('results');
        setShowResultModal(true);
      } else {
        // Not last round - advance to next round
        if (isAsyncMode) {
          // ASYNC MODE: All questions are pre-stored in mystery_player_id
          // Just advance the round counter - questions are already there
          setDuel(prev => ({
            ...prev,
            current_round: prev.current_round + 1,
          }));
        } else {
          // SYNC MODE: Advance through database (only player 1 does this)
          if (isPlayer1 && !isAdvancingRound) {
            setIsAdvancingRound(true);
            try {
              // Check if questions are pre-stored (comma-separated in mystery_player_id)
              const storedQuestionIds = duel.mystery_player_id.split(',');
              const nextRound = duel.current_round + 1;
              // Use pre-stored question if available, otherwise generate new
              const newQuestionId = storedQuestionIds.length >= nextRound
                ? storedQuestionIds[nextRound - 1]
                : getNewQuestionId();
              const p1Correct = duel.player1_answer === question.correctAnswer;
              const p2Correct = duel.player2_answer === question.correctAnswer;
              await advanceToNextRound(
                duel.id,
                newQuestionId,
                p1Correct,
                p2Correct,
                duel.player1_answer_time || TIMER_DURATION * 1000,
                duel.player2_answer_time || TIMER_DURATION * 1000
              );
            } catch (err) {
              console.error('[DuelGame] advanceToNextRound error:', err);
            }
          }
        }

        // Change game phase FIRST to hide the modal before resetting roundWon
        // This prevents the modal from briefly showing "Wrong!" when roundWon becomes null
        if (isAsyncMode) {
          // Async mode: start next round immediately
          setRoundStartTimeState(Date.now());
          setGamePhase('playing');
        } else {
          // Sync mode: wait for database update
          setRoundStartTimeState(null);
          setGamePhase('waiting');
        }

        // Reset round state after hiding the modal
        // Note: Don't reset roundWon here - it will be set correctly when next round result shows
        setSelectedAnswer(null);
        setHasAnswered(false);
        setOpponentAnswered(false);
        setTimeRemaining(TIMER_DURATION);
        setIsAdvancingRound(false);
        hasSubmittedTimeoutRef.current = false; // Reset for next round
        lastTickSecond.current = -1; // Reset tick sound tracker
      }
    };

    // If skip was triggered, advance immediately
    if (skipRoundResult) {
      setSkipRoundResult(false);
      advanceFromRoundResult();
      return;
    }

    // Otherwise wait 3.5 seconds to show correct/incorrect feedback, then auto-advance
    roundResultTimerRef.current = setTimeout(() => {
      advanceFromRoundResult();
    }, 3500);

    return () => {
      if (roundResultTimerRef.current) {
        clearTimeout(roundResultTimerRef.current);
        roundResultTimerRef.current = null;
      }
    };
  }, [gamePhase, question, isPlayer1, currentRound, totalQuestions, duel, isAdvancingRound, getNewQuestionId, isAsyncMode, asyncLocalResults, isChallenger, skipRoundResult]);

  // Timer countdown with tick sounds and safety timeout
  useEffect(() => {
    if (gamePhase !== 'playing' || !roundStartTime) return;

    // Calculate how much time is actually remaining based on server timestamp
    const initialElapsed = (Date.now() - roundStartTime) / 1000;
    const initialRemaining = Math.max(0, TIMER_DURATION - initialElapsed);

    // Safety timeout: A backup setTimeout that fires slightly after timer should end
    // This ensures we submit even if the interval timer fails or the screen freezes
    const GRACE_PERIOD = 2000; // 2 second grace period for network latency
    const safetyDelay = (initialRemaining * 1000) + GRACE_PERIOD;

    if (safetyDelay > 0 && !hasAnswered && !hasSubmittedTimeoutRef.current) {
      safetyTimeoutRef.current = setTimeout(() => {
        if (!hasAnswered && !hasSubmittedTimeoutRef.current) {
          console.log('Safety timeout triggered - forcing submission');
          hasSubmittedTimeoutRef.current = true;
          handleTimeUp();
        }
      }, safetyDelay);
    }

    const updateTimer = () => {
      const elapsed = (Date.now() - roundStartTime) / 1000;
      const remaining = Math.max(0, TIMER_DURATION - elapsed);
      setTimeRemaining(remaining);

      // Animate timer bar
      timerAnim.setValue(remaining / TIMER_DURATION);

      // Play tick sounds each second
      const currentSecond = Math.ceil(remaining);
      if (currentSecond !== lastTickSecond.current && currentSecond > 0 && currentSecond <= TIMER_DURATION && !hasAnswered) {
        lastTickSecond.current = currentSecond;
        // Play faster tick in last 5 seconds
        soundService.playTick(currentSecond <= 5);
      }

      if (remaining <= 0 && !hasAnswered && !hasSubmittedTimeoutRef.current) {
        // Time's up - play buzzer and submit null answer
        hasSubmittedTimeoutRef.current = true;
        soundService.playBuzzer();
        handleTimeUp();
      }
    };

    updateTimer();
    timerRef.current = setInterval(updateTimer, 100);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (safetyTimeoutRef.current) {
        clearTimeout(safetyTimeoutRef.current);
      }
    };
  }, [gamePhase, roundStartTime, hasAnswered]);

  const handleTimeUp = useCallback(async () => {
    if (hasAnswered) return;

    setHasAnswered(true);

    // Handle async mode timeout - store timeout result locally
    if (isAsyncMode && question) {
      const playerResult: PlayerResult = {
        answer: '',
        time: TIMER_DURATION * 1000,
        correct: false,
      };

      // Store timeout result locally (same as regular answer)
      setAsyncLocalResults(prev => [...prev, playerResult]);

      // Store round summary for end-of-duel display
      const roundSummary: RoundSummary = {
        roundNumber: currentRound,
        question: question.question,
        correctAnswer: question.correctAnswer,
        userAnswer: 'Timed out',
        isCorrect: false,
        time: TIMER_DURATION * 1000,
      };
      setRoundSummaries(prev => [...prev, roundSummary]);

      // Show round result feedback
      setHidingRoundResult(false);
      setGamePhase('roundResult');
      return;
    }

    // Submit with retry logic for network failures
    const maxRetries = 3;
    let submitted = false;

    for (let attempt = 0; attempt < maxRetries && !submitted; attempt++) {
      try {
        const result = await submitTriviaAnswer(duel.id, isPlayer1, '', TIMER_DURATION * 1000);
        if (result) {
          submitted = true;
          console.log('Timeout answer submitted successfully');
        } else {
          console.log(`Timeout submission attempt ${attempt + 1} failed, retrying...`);
          await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1))); // Backoff
        }
      } catch (error) {
        console.error(`Timeout submission error on attempt ${attempt + 1}:`, error);
        await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
      }
    }

    if (!submitted) {
      console.error('Failed to submit timeout answer after all retries');
    }

    // Check if we should determine winner
    checkForGameEnd();
  }, [hasAnswered, duel.id, isPlayer1, isAsyncMode, isChallenger, user?.id]);

  const checkForGameEnd = useCallback(async () => {
    // Refetch duel to get latest state
    const { data: latestDuel } = await supabase
      .from('duels')
      .select('*')
      .eq('id', duel.id)
      .single();

    if (!latestDuel || !question) return;

    const p1Answered = latestDuel.player1_answer !== null;
    const p2Answered = latestDuel.player2_answer !== null;

    if (p1Answered && p2Answered && latestDuel.status !== 'completed') {
      // Both have answered, determine winner
      const { winnerId } = determineWinner(latestDuel, question.correctAnswer);
      await completeDuel(duel.id, winnerId);
    }
  }, [duel.id, question]);

  const handleSelectAnswer = async (answer: string, index: number) => {
    if (hasAnswered || gamePhase !== 'playing' || !roundStartTime || !question) return;

    // Clear safety timeout since player answered manually
    if (safetyTimeoutRef.current) {
      clearTimeout(safetyTimeoutRef.current);
      safetyTimeoutRef.current = null;
    }
    hasSubmittedTimeoutRef.current = true; // Prevent any future timeout submissions

    // Animate button press
    Animated.sequence([
      Animated.timing(buttonScaleAnims[index], {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(buttonScaleAnims[index], {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();

    setSelectedAnswer(answer);
    setHasAnswered(true);

    // Play correct/wrong sound
    if (answer === question.correctAnswer) {
      soundService.playTriviaCorrect();
    } else {
      soundService.playTriviaWrong();
    }

    // Calculate answer time (ms from round start)
    const answerTime = Date.now() - roundStartTime;

    // Handle async mode - store results locally, don't submit until all rounds complete
    if (isAsyncMode) {
      const playerResult: PlayerResult = {
        answer,
        time: answerTime,
        correct: answer === question.correctAnswer,
      };

      // Store result locally
      setAsyncLocalResults(prev => [...prev, playerResult]);

      // Store round summary for end-of-duel display
      const roundSummary: RoundSummary = {
        roundNumber: currentRound,
        question: question.question,
        correctAnswer: question.correctAnswer,
        userAnswer: answer,
        isCorrect: answer === question.correctAnswer,
        time: answerTime,
      };
      setRoundSummaries(prev => [...prev, roundSummary]);

      // Update local score for display
      if (answer === question.correctAnswer) {
        setMyScore(prev => prev + 1);
      }

      // Show round result feedback (correct/incorrect)
      setHidingRoundResult(false);
      setGamePhase('roundResult');
      return;
    }

    // Submit answer (regular synchronous mode)
    await submitTriviaAnswer(duel.id, isPlayer1, answer, answerTime);

    // Check if game should end
    setTimeout(checkForGameEnd, 500);
  };

  const handleAchievementDismiss = () => {
    setShowAchievementToast(false);
    const remaining = pendingAchievements.slice(1);
    if (remaining.length > 0) {
      setPendingAchievements(remaining);
      setTimeout(() => {
        setCurrentAchievement(remaining[0]);
        setShowAchievementToast(true);
      }, 500);
    } else {
      setPendingAchievements([]);
      setCurrentAchievement(null);
    }
  };

  const handleAddFriend = async () => {
    if (!user || !opponentId) return;
    const success = await addFriend(user.id, opponentId);
    if (success) {
      setFriendAdded(true);
      setAlreadyFriends(true);
    }
  };

  // Handle back button during gameplay - show forfeit warning
  const toggleSound = async () => {
    const newEnabled = !soundEnabled;
    setSoundEnabled(newEnabled);
    await soundService.setEnabled(newEnabled);
  };

  const handleBackPress = () => {
    // During waiting phase, countdown, or results, just go back
    if (gamePhase === 'waiting' || gamePhase === 'countdown' || gamePhase === 'results' || gamePhase === 'roundResult') {
      onBack();
      return;
    }
    // During playing phase (and async waiting), show forfeit modal
    if (gamePhase === 'playing' || asyncWaitingForFriend) {
      setShowForfeitModal(true);
    }
  };

  // Confirm forfeit and exit
  const handleConfirmForfeit = async () => {
    if (!user) return;

    setIsForfeiting(true);

    // Call forfeit API - opponent wins, forfeiter gets 0 XP
    const result = await forfeitDuel(duel.id, user.id);

    if (result) {
      // Successfully forfeited - opponent gets win (handled by server)
      // Forfeiter gets 0 XP (we don't award anything)
      onComplete(false); // Mark as loss
    }

    setIsForfeiting(false);
    setShowForfeitModal(false);
    onBack();
  };

  // Handle invite friends from first win modal
  const handleInviteFromModal = async () => {
    setIsInviting(true);
    try {
      await inviteFriends();
    } finally {
      setIsInviting(false);
      setShowInviteModal(false);
    }
  };

  // Handle Android hardware back button
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      // During playing phase or async waiting, show forfeit modal
      if (gamePhase === 'playing' || asyncWaitingForFriend) {
        setShowForfeitModal(true);
        return true; // Prevent default back behavior
      }
      // For other phases, allow normal back navigation
      return false;
    });

    return () => backHandler.remove();
  }, [gamePhase, asyncWaitingForFriend]);

  // Award XP when game ends
  useEffect(() => {
    console.log('[DuelGame] XP award check:', { gamePhase, user: !!user, xpAwarded, question: !!question, asyncWaitingForFriend });

    // Don't award XP for async challenger waiting - they'll get it when viewing final results
    if (asyncWaitingForFriend) {
      console.log('[DuelGame] Skipping XP - async waiting for friend');
      return;
    }

    if (gamePhase === 'results' && user && !xpAwarded && question) {
      // For multi-question duels, wait until scores are set (non-zero or we have local results)
      // This prevents the issue where state updates haven't propagated yet
      if (isMultiQuestion && myScore === 0 && opponentScore === 0 && asyncLocalResults.length === 0) {
        console.log('[DuelGame] Waiting for scores to be set before awarding XP');
        return;
      }

      console.log('[DuelGame] Awarding XP - conditions met, scores:', { myScore, opponentScore });
      setXpAwarded(true);

      let won: boolean;
      let tie: boolean;

      if (isMultiQuestion) {
        // For multi-question duels, use scores only to determine winner
        // If scores are still 0/0 but we have local results, calculate from those
        let effectiveMyScore = myScore;
        let effectiveOppScore = opponentScore;

        if (myScore === 0 && asyncLocalResults.length > 0) {
          effectiveMyScore = asyncLocalResults.filter(r => r.correct).length;
          console.log('[DuelGame] Using asyncLocalResults for myScore:', effectiveMyScore);
        }

        // Equal scores = tie (no time tiebreaker)
        if (effectiveMyScore > effectiveOppScore) {
          won = true;
          tie = false;
        } else if (effectiveOppScore > effectiveMyScore) {
          won = false;
          tie = false;
        } else {
          // Same score = tie
          won = false;
          tie = true;
        }
      } else {
        // Single question duel
        const { winnerId } = determineWinner(duel, question.correctAnswer);
        won = winnerId === user.id;
        tie = winnerId === null;
      }

      // Award XP and points via server-side Edge Function
      const xpResult: 'win' | 'loss' | 'tie' = tie ? 'tie' : won ? 'win' : 'loss';
      const xpAmount = calculateDuelXP(xpResult);

      // Award XP and update progress display
      const awardAndDisplayXP = async () => {
        // First, get current XP before awarding
        const beforeXPData = await getUserXP(user.id);
        const beforeXP = beforeXPData?.xp || 0;
        const currentLevel = beforeXPData?.level || 1;

        // Calculate level progress before award
        const currentLevelXP = getXPForLevel(currentLevel);
        const nextLevelXP = getXPForLevel(currentLevel + 1);
        const xpIntoLevelBefore = beforeXP - currentLevelXP;
        const xpNeededForLevel = nextLevelXP - currentLevelXP;

        // Try server-side first, fall back to client-side
        console.log('[DuelGame] Calling completeDuelServerSide:', { duelId: duel.id, won, isPlayer1 });
        const serverResult = await completeDuelServerSide(duel.id, { answer: '', time: 0, correct: won }, isPlayer1);
        console.log('[DuelGame] Server response:', serverResult);

        if (serverResult.success) {
          console.log('[DuelGame] Server awarded:', serverResult);

          // Handle achievements from server
          if (serverResult.achievementsUnlocked && serverResult.achievementsUnlocked.length > 0) {
            const achievementObjects: Achievement[] = serverResult.achievementsUnlocked.map((name: string) => ({
              id: name,
              name,
              description: '',
              xp_reward: 0,
              icon: 'trophy',
              category: 'duel',
              is_secret: false,
            }));
            setPendingAchievements(achievementObjects);
            setCurrentAchievement(achievementObjects[0]);
            setShowAchievementToast(true);
          }
        } else {
          // Server failed - fall back to client-side XP awarding
          console.warn('[DuelGame] Server reward failed, using client-side fallback:', serverResult.error);
          try {
            const result = await awardXP(user.id, xpAmount);
            if (result) {
              console.log('[DuelGame] Client-side XP awarded:', result);
            }
          } catch (err) {
            console.error('[DuelGame] Client-side XP award failed:', err);
          }
        }

        // Calculate XP after award
        const xpIntoLevelAfter = xpIntoLevelBefore + xpAmount;

        // Set the progress display (shows animation from before to after)
        setXpProgressInfo({
          previousXP: xpIntoLevelBefore,
          newXP: xpIntoLevelAfter,
          current: xpIntoLevelAfter,
          required: xpNeededForLevel,
          percentage: (xpIntoLevelAfter / xpNeededForLevel) * 100,
        });
      };
      awardAndDisplayXP();

      // Check for first duel win invite prompt
      if (won && !tie) {
        setTimeout(async () => {
          const hasSeen = await hasSeenInvitePrompt();
          if (!hasSeen) {
            // Check if this was their first duel win
            const { data: stats } = await supabase
              .from('user_stats')
              .select('duel_wins')
              .eq('id', user.id)
              .single();

            // If duel_wins === 1, this was their first win
            if (stats?.duel_wins === 1) {
              setShowInviteModal(true);
              await markInvitePromptSeen();
            }
          }
        }, 2000); // Show after achievements have had time to display
      }
    }
  }, [gamePhase, user, xpAwarded, question, duel, isPlayer1, isMultiQuestion, myScore, opponentScore, asyncWaitingForFriend, asyncLocalResults]);

  const getTimerColor = () => {
    if (timeRemaining <= 3) return colors.timerDanger;
    if (timeRemaining <= 5) return colors.timerWarning;
    return sportColor;
  };

  const getButtonStyle = (option: string, index: number) => {
    if (gamePhase === 'results' && question) {
      const isCorrect = option === question.correctAnswer;
      const wasSelected = option === selectedAnswer;

      if (isCorrect) return styles.buttonCorrect;
      if (wasSelected && !isCorrect) return styles.buttonWrong;
      return styles.buttonDisabled;
    }

    if (hasAnswered) {
      if (option === selectedAnswer) return { backgroundColor: sportColor };
      return styles.buttonDisabled;
    }

    return {};
  };

  const getButtonTextStyle = (option: string) => {
    if (hasAnswered && option === selectedAnswer && gamePhase === 'playing') {
      return { color: '#FFFFFF' };
    }
    if (gamePhase === 'results' && question) {
      const isCorrect = option === question.correctAnswer;
      const wasSelected = option === selectedAnswer;
      if (isCorrect || (wasSelected && !isCorrect)) {
        return { color: '#FFFFFF' };
      }
    }
    return {};
  };

  const showFriendPrompt = isFriendDuel && !alreadyFriends && !friendAdded && opponentId;

  // Determine result for both single and multi-question duels
  const getResult = () => {
    // For async completed duels, we can determine result even without question loaded
    // Use winner_id and scores from duel directly
    if (!question && isAsyncMode && duel.status === 'completed') {
      const won = duel.winner_id === user?.id;
      const tie = duel.winner_id === null;
      const finalMyScore = myScore;
      const finalOppScore = opponentScore;

      let subtitle = '';
      if (tie) {
        subtitle = `Tied ${finalMyScore}-${finalOppScore}!`;
      } else if (won) {
        subtitle = `You won ${finalMyScore}-${finalOppScore}!`;
      } else {
        subtitle = `You lost ${finalMyScore}-${finalOppScore}`;
      }

      const xpResult: 'win' | 'loss' | 'tie' = tie ? 'tie' : won ? 'win' : 'loss';
      const xpEarned = calculateDuelXP(xpResult);

      return { won, tie, subtitle, xpEarned, finalScore: { me: finalMyScore, opp: finalOppScore } };
    }

    if (!question) return { won: false, tie: false, subtitle: '', xpEarned: 0, finalScore: { me: 0, opp: 0 } };

    let won: boolean;
    let tie: boolean;
    let subtitle: string;

    if (isMultiQuestion) {
      // For multi-question duels, use scores only to determine winner
      // Equal scores = tie (no time tiebreaker)
      const finalMyScore = myScore;
      const finalOppScore = opponentScore;

      won = finalMyScore > finalOppScore;
      tie = finalMyScore === finalOppScore;

      if (tie) {
        subtitle = `Tied ${finalMyScore}-${finalOppScore}!`;
      } else if (won) {
        subtitle = `You won ${finalMyScore}-${finalOppScore}!`;
      } else {
        subtitle = `You lost ${finalMyScore}-${finalOppScore}`;
      }
    } else {
      // Single question duel
      let myAnswer: string | null;
      let opponentAnswer: string | null;
      let myTime: number | null;
      let opponentTime: number | null;
      let iCorrect: boolean;
      let oCorrect: boolean;

      if (isAsyncMode) {
        // For async duels, extract data from player_result fields
        const p1Data = getAsyncAnswerData(duel.player1_result as PlayerResult | null);
        const p2Data = getAsyncAnswerData(duel.player2_result as PlayerResult | null);

        myAnswer = isPlayer1 ? p1Data.answer : p2Data.answer;
        opponentAnswer = isPlayer1 ? p2Data.answer : p1Data.answer;
        myTime = isPlayer1 ? p1Data.time : p2Data.time;
        opponentTime = isPlayer1 ? p2Data.time : p1Data.time;
        iCorrect = isPlayer1 ? p1Data.correct : p2Data.correct;
        oCorrect = isPlayer1 ? p2Data.correct : p1Data.correct;

        // For async duels, use winner_id from the completed duel
        won = duel.winner_id === user?.id;
        tie = duel.winner_id === null && duel.status === 'completed';
      } else {
        // For sync duels, use the standard fields
        const { winnerId, reason } = determineWinner(duel, question.correctAnswer);
        won = winnerId === user?.id;
        tie = winnerId === null;

        myAnswer = isPlayer1 ? duel.player1_answer : duel.player2_answer;
        opponentAnswer = isPlayer1 ? duel.player2_answer : duel.player1_answer;
        myTime = isPlayer1 ? duel.player1_answer_time : duel.player2_answer_time;
        opponentTime = isPlayer1 ? duel.player2_answer_time : duel.player1_answer_time;
        iCorrect = myAnswer === question.correctAnswer;
        oCorrect = opponentAnswer === question.correctAnswer;
      }

      const iTimedOut = myAnswer === '' || myAnswer === null;
      const oTimedOut = opponentAnswer === '' || opponentAnswer === null;

      if (tie) {
        if (iTimedOut && oTimedOut) {
          subtitle = 'Both players timed out';
        } else if (!iCorrect && !oCorrect) {
          subtitle = 'Neither player answered correctly';
        } else {
          subtitle = 'Exact same answer time!';
        }
      } else if (won) {
        if (iCorrect && oTimedOut) {
          subtitle = 'Opponent timed out!';
        } else if (iCorrect && !oCorrect) {
          subtitle = 'You answered correctly!';
        } else if (iCorrect && oCorrect) {
          const timeDiff = ((opponentTime || 0) - (myTime || 0)) / 1000;
          subtitle = `You were ${timeDiff.toFixed(2)}s faster!`;
        } else {
          subtitle = '';
        }
      } else {
        if (oCorrect && iTimedOut) {
          subtitle = 'You timed out';
        } else if (!iCorrect && oCorrect) {
          subtitle = 'Opponent answered correctly';
        } else if (iCorrect && oCorrect) {
          const timeDiff = ((myTime || 0) - (opponentTime || 0)) / 1000;
          subtitle = `Opponent was ${timeDiff.toFixed(2)}s faster`;
        } else {
          subtitle = '';
        }
      }
    }

    // Calculate XP earned
    const xpResult: 'win' | 'loss' | 'tie' = tie ? 'tie' : won ? 'win' : 'loss';
    const xpEarned = calculateDuelXP(xpResult);

    return { won, tie, subtitle, xpEarned, finalScore: { me: myScore, opp: opponentScore } };
  };

  const result = getResult();

  // Compute display values for answers (handles both sync and async modes)
  const getDisplayAnswers = () => {
    if (isAsyncMode) {
      const p1Data = getAsyncAnswerData(duel.player1_result as PlayerResult | null);
      const p2Data = getAsyncAnswerData(duel.player2_result as PlayerResult | null);
      return {
        myAnswer: isPlayer1 ? p1Data.answer : p2Data.answer,
        myTime: isPlayer1 ? p1Data.time : p2Data.time,
        myCorrect: isPlayer1 ? p1Data.correct : p2Data.correct,
        oppAnswer: isPlayer1 ? p2Data.answer : p1Data.answer,
        oppTime: isPlayer1 ? p2Data.time : p1Data.time,
        oppCorrect: isPlayer1 ? p2Data.correct : p1Data.correct,
      };
    } else {
      return {
        myAnswer: isPlayer1 ? duel.player1_answer : duel.player2_answer,
        myTime: isPlayer1 ? duel.player1_answer_time : duel.player2_answer_time,
        myCorrect: (isPlayer1 ? duel.player1_answer : duel.player2_answer) === question?.correctAnswer,
        oppAnswer: isPlayer1 ? duel.player2_answer : duel.player1_answer,
        oppTime: isPlayer1 ? duel.player2_answer_time : duel.player1_answer_time,
        oppCorrect: (isPlayer1 ? duel.player2_answer : duel.player1_answer) === question?.correctAnswer,
      };
    }
  };
  const displayAnswers = getDisplayAnswers();

  return (
    <SafeAreaView style={styles.container}>
      {/* Minimal Sticky Header - only round/score and timer */}
      {gamePhase !== 'waiting' && gamePhase !== 'countdown' && (
        <View style={styles.stickyHeader}>
          {/* Combined Round + Score Card */}
          <View style={styles.roundScoreCard}>
            <Text style={styles.roundScoreRound}>Round {currentRound} of {totalQuestions}</Text>
            <View style={styles.roundScoreDivider} />
            {isAsyncMode ? (
              <Text style={styles.roundScoreScore}>
                <Text style={{ color: sportColor }}>{myScore}</Text>/{totalQuestions} correct
              </Text>
            ) : (
              <Text style={styles.roundScoreScore}>
                You <Text style={{ color: sportColor }}>{myScore}</Text>
                <Text style={styles.roundScoreDash}> - </Text>
                <Text style={{ color: colors.opponent }}>{opponentScore}</Text> {opponentUsername || 'Opp'}
              </Text>
            )}
          </View>

          {/* Timer Bar */}
          {gamePhase === 'playing' && (
            <View style={styles.timerContainer}>
              <View style={styles.timerBar}>
                <Animated.View
                  style={[
                    styles.timerFill,
                    {
                      width: timerAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0%', '100%'],
                      }),
                      backgroundColor: getTimerColor(),
                    },
                  ]}
                />
              </View>
              <Text style={[styles.timerText, { color: getTimerColor() }]}>
                {Math.ceil(timeRemaining)}s
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Waiting State */}
      {gamePhase === 'waiting' && (
        <View style={styles.waitingContainer}>
          {/* Sport Badge */}
          <View style={[styles.waitingSportBadge, { backgroundColor: sportColor }]}>
            <Image source={sportIcons[duel.sport as Sport]} style={styles.waitingSportIcon} resizeMode="contain" />
          </View>

          {/* Title */}
          <Text style={styles.waitingTitle}>Trivia Duel</Text>

          {/* Large Spinner */}
          <View style={styles.waitingSpinnerContainer}>
            <ActivityIndicator size="large" color={sportColor} />
          </View>

          {/* Waiting Text */}
          <Text style={styles.waitingText}>Waiting for opponent...</Text>
          <Text style={styles.waitingSubtext}>You'll be matched with the next player who joins</Text>

          {/* Brief Rules */}
          <Text style={styles.waitingRules}>
            Answer the same trivia question{'\n'}
            Correct answer + fastest time wins
          </Text>

          {/* Cancel button */}
          <TouchableOpacity style={styles.cancelButton} onPress={onBack}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Countdown State */}
      {gamePhase === 'countdown' && (
        <View style={styles.countdownContainer}>
          {/* Large Ad Banner - 1/3 of screen at top */}
          {!HIDE_ADS_FOR_SCREENSHOTS && (
            <TouchableOpacity
              style={styles.countdownAdBanner}
              onPress={() => Linking.openURL('https://parlaysfordays.com')}
              activeOpacity={0.9}
            >
              <Image
                source={countdownAdImage}
                style={styles.countdownAdImage}
                resizeMode="cover"
              />
            </TouchableOpacity>
          )}

          {/* Countdown Content - centered in remaining 2/3 */}
          <View style={styles.countdownContent}>
            {/* Sport Badge */}
            <View style={[styles.waitingSportBadge, { backgroundColor: sportColor }]}>
              <Image
                source={sportIcons[duel.sport as Sport]}
                style={styles.waitingSportIcon}
                resizeMode="contain"
              />
            </View>

            {/* Title */}
            <Text style={styles.countdownTitle}>Get Ready!</Text>

            {/* Countdown Number */}
            <Animated.View
              style={[
                styles.countdownNumberContainer,
                {
                  transform: [{ scale: countdownScaleAnim }],
                },
              ]}
            >
              <Text style={[styles.countdownNumber, { color: sportColor }]}>
                {countdownNumber}
              </Text>
            </Animated.View>

            {/* Subtitle */}
            <Text style={styles.countdownSubtext}>
              Answer quickly and correctly to win!
            </Text>
          </View>

          {/* Bottom Ad Banner */}
          {!HIDE_ADS_FOR_SCREENSHOTS && <AdBanner />}
        </View>
      )}

      {/* Scrollable Question and Options */}
      {gamePhase !== 'waiting' && gamePhase !== 'countdown' && question && (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Scrollable Header - LEAVE button, sound toggle, and sport badge */}
          <View style={styles.scrollableHeader}>
            <TouchableOpacity style={styles.backButton} onPress={handleBackPress}>
              <Text style={styles.backButtonText}>← LEAVE</Text>
            </TouchableOpacity>
            <View style={styles.headerRightGroup}>
              <TouchableOpacity style={styles.soundToggleButton} onPress={toggleSound}>
                <Image
                  source={speakerIcon}
                  style={[styles.soundToggleIcon, !soundEnabled && styles.soundToggleIconMuted]}
                  resizeMode="contain"
                />
              </TouchableOpacity>
              <View style={[styles.sportBadge, { backgroundColor: sportColor }]}>
                <Image source={sportIcons[duel.sport as Sport]} style={styles.sportIcon} resizeMode="contain" />
                <Text style={styles.sportBadgeText}>{sportNames[duel.sport as Sport]}</Text>
              </View>
            </View>
          </View>

          {/* Question */}
          <View style={styles.questionContainer}>
            <View style={[styles.difficultyBadge, { backgroundColor: `${sportColor}30` }]}>
              <Text style={[styles.difficultyText, { color: sportColor }]}>
                {question.difficulty.toUpperCase()}
              </Text>
            </View>
            <Text style={styles.questionText}>{question.question}</Text>
          </View>

          {/* Answer Options */}
          <View style={styles.optionsContainer}>
            {question.options.map((option, index) => (
              <Animated.View
                key={index}
                style={{ transform: [{ scale: buttonScaleAnims[index] }] }}
              >
                <TouchableOpacity
                  style={[
                    styles.optionButton,
                    getButtonStyle(option, index),
                  ]}
                  onPress={() => {
                    soundService.playButtonClick();
                    handleSelectAnswer(option, index);
                  }}
                  disabled={hasAnswered || gamePhase === 'results'}
                  activeOpacity={0.7}
                >
                  <View style={[styles.optionLetter, { backgroundColor: sportColor }]}>
                    <Text style={styles.optionLetterText}>
                      {String.fromCharCode(65 + index)}
                    </Text>
                  </View>
                  <Text style={[styles.optionText, getButtonTextStyle(option)]}>{option}</Text>
                  {gamePhase === 'results' && option === question.correctAnswer && (
                    <Text style={styles.correctMark}>✓</Text>
                  )}
                </TouchableOpacity>
              </Animated.View>
            ))}
          </View>

          {/* Feedback Banner at bottom of questions */}
          {!HIDE_ADS_FOR_SCREENSHOTS && (
            <TouchableOpacity
              style={styles.questionAdBanner}
              onPress={() => Linking.openURL('mailto:hello@ballrs.net')}
              activeOpacity={0.9}
            >
              <Image
                source={feedbackBannerImage}
                style={styles.questionAdImage}
                resizeMode="contain"
              />
            </TouchableOpacity>
          )}
        </ScrollView>
      )}

      {/* Waiting for opponent indicator */}
      {hasAnswered && !opponentAnswered && gamePhase === 'playing' && (
        <View style={styles.waitingForOpponent}>
          <Text style={styles.waitingForOpponentText}>
            Waiting for {opponentUsername || 'opponent'}...
          </Text>
        </View>
      )}

      {/* Round Result Overlay (for multi-question duels) */}
      <Modal
        visible={gamePhase === 'roundResult' && !!question && !hidingRoundResult}
        transparent
        animationType="none"
      >
        <View style={styles.modalOverlayFullScreen}>
          <View style={styles.roundResultCard}>
            {/* Icon Circle */}
            <View style={[
              styles.roundResultIconCircle,
              roundWon === true ? styles.roundResultIconCorrect : styles.roundResultIconWrong,
            ]}>
              <Text style={styles.roundResultIconText}>
                {roundWon === true ? '✓' : '✗'}
              </Text>
            </View>

            {/* Result Text */}
            <Text style={[
              styles.roundResultText,
              roundWon === true ? styles.roundResultWin : styles.roundResultLose,
            ]}>
              {roundWon === true ? 'Correct!' : 'Wrong!'}
            </Text>

            {/* Question Text */}
            <Text style={styles.roundResultQuestion} numberOfLines={3}>
              {question?.question}
            </Text>

            {/* Answer Pill */}
            <View style={[
              styles.roundResultAnswerPill,
              roundWon === true ? styles.answerPillCorrect : styles.answerPillWrong,
            ]}>
              <Text style={styles.roundResultAnswerLabel}>Answer:</Text>
              <Text style={styles.roundResultAnswerText}>{question?.correctAnswer}</Text>
            </View>

            {/* Next Button */}
            {currentRound < totalQuestions ? (
              <TouchableOpacity
                style={styles.roundResultNextButton}
                onPress={() => {
                  setHidingRoundResult(true); // Hide modal immediately
                  setSkipRoundResult(true);
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.roundResultNextButtonText}>NEXT QUESTION</Text>
              </TouchableOpacity>
            ) : (
              <Text style={styles.roundResultNext}>
                {isAsyncMode ? 'Submitting results...' : 'Final results...'}
              </Text>
            )}
          </View>
        </View>
      </Modal>

      {/* Duel Results Modal */}
      <Modal
        visible={showResultModal && !!(question || (isAsyncMode && duel.status === 'completed'))}
        transparent
        animationType="fade"
      >
        <View style={styles.modalOverlayFullScreen}>
          <View style={styles.duelResultsContent}>
            {/* Presented By Ad Banner */}
            {!HIDE_ADS_FOR_SCREENSHOTS && (
              <View style={styles.presentedByContainerTop}>
                <Text style={styles.presentedByText}>Results presented by</Text>
                <TouchableOpacity
                  style={styles.presentedByAdBanner}
                  onPress={() => Linking.openURL('https://parlaysfordays.com')}
                  activeOpacity={0.9}
                >
                  <Image
                    source={adBannerImage}
                    style={styles.presentedByAdImage}
                    resizeMode="contain"
                  />
                </TouchableOpacity>
              </View>
            )}

            {/* Sport Badge */}
            <View style={[styles.duelResultsSportBadge, { backgroundColor: sportColor }]}>
              <Image source={sportIcons[duel.sport as Sport]} style={styles.duelResultsSportIcon} resizeMode="contain" />
              <Text style={styles.duelResultsSportText}>{sportNames[duel.sport as Sport]}</Text>
            </View>

            {/* Header */}
            <Text style={styles.duelResultsHeader}>DUEL COMPLETE</Text>

            {/* Players Section */}
            <View style={styles.duelResultsPlayersCard}>
              {/* Your Row */}
              <View style={styles.duelResultsPlayerRow}>
                <View style={[styles.duelResultsAvatar, result.won && styles.duelResultsAvatarWinner]}>
                  <Text style={styles.duelResultsAvatarText}>Y</Text>
                </View>
                <View style={styles.duelResultsNameContainer}>
                  <Text style={[styles.duelResultsPlayerName, result.won && styles.duelResultsPlayerNameWinner]}>
                    You
                  </Text>
                  {result.won && (
                    <Image source={crownIcon} style={styles.duelResultsCrownIcon} resizeMode="contain" />
                  )}
                </View>
                <Text style={[styles.duelResultsPlayerScore, result.won && styles.duelResultsPlayerScoreWinner]}>
                  {result.finalScore.me}/{totalQuestions}
                </Text>
              </View>

              {/* Opponent Row */}
              <View style={styles.duelResultsPlayerRow}>
                <View style={[styles.duelResultsAvatar, !result.won && !result.tie && styles.duelResultsAvatarWinner]}>
                  <Text style={styles.duelResultsAvatarText}>
                    {opponentUsername?.charAt(0).toUpperCase() || 'O'}
                  </Text>
                </View>
                <View style={styles.duelResultsNameContainer}>
                  <Text style={[styles.duelResultsPlayerName, !result.won && !result.tie && styles.duelResultsPlayerNameWinner]}>
                    {opponentUsername || 'Opponent'}
                  </Text>
                  {!result.won && !result.tie && (
                    <Image source={crownIcon} style={styles.duelResultsCrownIcon} resizeMode="contain" />
                  )}
                </View>
                <Text style={[styles.duelResultsPlayerScore, !result.won && !result.tie && styles.duelResultsPlayerScoreWinner]}>
                  {result.finalScore.opp}/{totalQuestions}
                </Text>
              </View>
            </View>

            {/* Result Message */}
            <View style={styles.duelResultsMessageContainer}>
              <Text style={[
                styles.duelResultsMessage,
                result.won && styles.duelResultsMessageWin,
                !result.won && !result.tie && styles.duelResultsMessageLose,
                result.tie && styles.duelResultsMessageTie,
              ]}>
                {result.tie ? "IT'S A TIE!" : result.won ? 'YOU WIN! ' : 'Better luck next time!'}
              </Text>
              {result.won && (
                <Image source={trophyIcon} style={styles.duelResultsWinIcon} resizeMode="contain" />
              )}
            </View>

            {/* XP Earned */}
            <View style={styles.duelResultsXpBadge}>
              <Text style={styles.duelResultsXpText}>+{result.xpEarned} XP</Text>
            </View>

            {/* XP Progress Bar */}
            {xpProgressInfo && (
              <View style={styles.xpProgressContainer}>
                <View style={styles.xpBarOuter}>
                  <Animated.View
                    style={[
                      styles.xpBarFillContainer,
                      {
                        width: xpBarAnimatedWidth.interpolate({
                          inputRange: [0, 100],
                          outputRange: ['0%', '100%'],
                        }),
                      },
                    ]}
                  >
                    <LinearGradient
                      colors={[themeColors.xpGradientStart, themeColors.xpGradientEnd]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.xpBarFill}
                    />
                  </Animated.View>
                </View>
                <Text style={styles.xpProgressText}>
                  {xpProgressInfo.current}/{xpProgressInfo.required}
                </Text>
              </View>
            )}

            {/* View Answers Link */}
            <TouchableOpacity
              style={styles.duelResultsViewAnswers}
              activeOpacity={0.7}
              onPress={() => {
                // Close results modal first, then show answers modal
                // This prevents modal stacking issues on native
                setShowResultModal(false);
                setTimeout(() => {
                  setShowFullAnswers(true);
                }, 100);
              }}
            >
              <Text style={styles.duelResultsViewAnswersText}>View Answers ({roundSummaries.length})</Text>
            </TouchableOpacity>

            {/* Buttons */}
            <View style={styles.duelResultsButtons}>
              <TouchableOpacity
                style={styles.duelResultsDoneButton}
                onPress={() => {
                  setShowResultModal(false);
                  onBack();
                }}
              >
                <Text style={styles.duelResultsDoneButtonText}>DONE</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.duelResultsRematchButton}
                onPress={() => {
                  setShowResultModal(false);
                  if (isAsyncMode && onRematch) {
                    // For async duels, start a rematch with the same opponent
                    const opponentId = isPlayer1 ? duel.player2_id : duel.player1_id;
                    if (opponentId) {
                      onRematch(opponentId, duel.sport as 'nba' | 'pl' | 'nfl' | 'mlb', duel.question_count);
                    }
                  } else {
                    // For sync duels, use regular play again
                    onPlayAgain(duel.sport as 'nba' | 'pl' | 'nfl' | 'mlb');
                  }
                }}
              >
                <Text style={styles.duelResultsRematchButtonText}>REMATCH?</Text>
              </TouchableOpacity>
            </View>

            {/* Report Link */}
            <TouchableOpacity
              style={styles.duelResultsReportLink}
              onPress={() => {
                setShowResultModal(false);
                setShowReportModal(true);
              }}
            >
              <Text style={styles.duelResultsReportLinkText}>Report User</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Turn Complete Screen (Player A waiting for Player B) */}
      <Modal
        visible={showAsyncResultModal && roundSummaries.length > 0}
        transparent
        animationType="fade"
      >
        <View style={styles.modalOverlayFullScreen}>
          <View style={styles.turnCompleteContent}>
            {/* Teal Checkmark */}
            <View style={styles.turnCompleteCheckCircle}>
              <Text style={styles.turnCompleteCheckText}>✓</Text>
            </View>

            {/* Title */}
            <Text style={styles.turnCompleteTitle}>Your Turn Complete!</Text>

            {/* Score */}
            <Text style={styles.turnCompleteScore}>
              You scored: {roundSummaries.filter(r => r.isCorrect).length}/{roundSummaries.length}
            </Text>

            {/* Waiting Message */}
            <Text style={styles.turnCompleteWaiting}>
              Waiting for {opponentUsername || 'your friend'} to{'\u00A0'}finish...
            </Text>

            {/* Notification Note */}
            <Text style={styles.turnCompleteNote}>
              We'll notify you when results are{'\u00A0'}ready
            </Text>

            {/* Back Button */}
            <TouchableOpacity
              style={styles.turnCompleteButton}
              onPress={() => {
                setShowAsyncResultModal(false);
                onBack();
              }}
            >
              <Text style={styles.turnCompleteButtonText}>BACK TO HOME</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Async Waiting for Friend Screen */}
      <Modal
        visible={asyncWaitingForFriend && !showAsyncResultModal}
        transparent
        animationType="fade"
      >
        <View style={styles.modalOverlayFullScreen}>
          <View style={styles.asyncWaitingContent}>
            {/* Sport Badge */}
            <View style={[styles.duelResultsSportBadge, { backgroundColor: sportColor }]}>
              <Image source={sportIcons[duel.sport as Sport]} style={styles.duelResultsSportIcon} resizeMode="contain" />
              <Text style={styles.duelResultsSportText}>{sportNames[duel.sport as Sport]}</Text>
            </View>

            {/* Checkmark Icon */}
            <View style={styles.asyncCheckContainer}>
              <Text style={styles.asyncCheckText}>✓</Text>
            </View>

            <Text style={styles.asyncWaitingTitle}>Your Turn Complete!</Text>

            {/* Show player's score */}
            <View style={styles.asyncScoreContainer}>
              <Text style={styles.asyncScoreLabel}>Your Score</Text>
              <Text style={styles.asyncScoreValue}>{myScore}/{totalQuestions}</Text>
            </View>

            <Text style={styles.asyncWaitingSubtitle}>
              Waiting for {opponentUsername || 'your friend'} to finish...
            </Text>

            {asyncTimeRemaining && !asyncTimeRemaining.expired && (
              <View style={styles.asyncTimeContainer}>
                <Text style={styles.asyncTimeIcon}>⏱️</Text>
                <Text style={styles.asyncTimeText}>
                  {asyncTimeRemaining.hours}h {asyncTimeRemaining.minutes}m remaining
                </Text>
              </View>
            )}

            <Text style={styles.asyncInfoText}>
              We'll notify you when the results are ready!
            </Text>

            <TouchableOpacity
              style={styles.asyncBackButton}
              onPress={onBack}
            >
              <Text style={styles.asyncBackButtonText}>BACK TO HOME</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Forfeit Confirmation Modal */}
      <Modal
        visible={showForfeitModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowForfeitModal(false)}
      >
        <View style={styles.modalOverlayFullScreen}>
          <View style={styles.forfeitModalContent}>
            <Text style={styles.forfeitModalTitle}>Leave Duel?</Text>
            <Text style={styles.forfeitModalText}>
              If you leave now, you'll forfeit and your opponent will win.{'\n\n'}
              You will receive 0 XP.
            </Text>
            <View style={styles.forfeitModalButtons}>
              <TouchableOpacity
                style={styles.forfeitStayButton}
                onPress={() => setShowForfeitModal(false)}
                disabled={isForfeiting}
              >
                <Text style={styles.forfeitStayButtonText}>STAY</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.forfeitLeaveButton}
                onPress={handleConfirmForfeit}
                disabled={isForfeiting}
              >
                {isForfeiting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.forfeitLeaveButtonText}>FORFEIT</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Full Answers Modal */}
      <Modal
        visible={showFullAnswers}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setShowFullAnswers(false);
          // Re-open results modal so user can access DONE/REMATCH
          setTimeout(() => setShowResultModal(true), 100);
        }}
      >
        <View style={styles.fullAnswersOverlay}>
          <View style={styles.fullAnswersContent}>
            <View style={styles.fullAnswersHeader}>
              <Text style={styles.fullAnswersTitle}>Your Answers</Text>
              <TouchableOpacity onPress={() => {
                setShowFullAnswers(false);
                // Re-open results modal so user can access DONE/REMATCH
                setTimeout(() => setShowResultModal(true), 100);
              }}>
                <Text style={styles.fullAnswersClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.fullAnswersList}>
              {roundSummaries.map((summary, index) => (
                <View key={index} style={styles.fullAnswerItem}>
                  <View style={styles.fullAnswerHeader}>
                    <Text style={styles.fullAnswerRound}>Q{summary.roundNumber}</Text>
                    <View style={[
                      styles.fullAnswerStatus,
                      summary.isCorrect ? styles.fullAnswerStatusCorrect : styles.fullAnswerStatusWrong
                    ]}>
                      <Text style={[
                        styles.fullAnswerStatusText,
                        { color: summary.isCorrect ? '#3BA978' : '#DC2626' }
                      ]}>
                        {summary.isCorrect ? '✓' : '✗'}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.fullAnswerQuestion} numberOfLines={2}>
                    {summary.question}
                  </Text>
                  <View style={styles.fullAnswerDetails}>
                    <Text style={styles.fullAnswerLabel}>Your answer:</Text>
                    <Text style={[
                      styles.fullAnswerValue,
                      summary.isCorrect ? styles.fullAnswerValueCorrect : styles.fullAnswerValueWrong
                    ]}>
                      {summary.userAnswer || 'Timed out'}
                    </Text>
                  </View>
                  {!summary.isCorrect && (
                    <View style={styles.fullAnswerDetails}>
                      <Text style={styles.fullAnswerLabel}>Correct:</Text>
                      <Text style={[styles.fullAnswerValue, styles.fullAnswerValueCorrect]}>
                        {summary.correctAnswer}
                      </Text>
                    </View>
                  )}
                </View>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={styles.fullAnswersDoneButton}
              onPress={() => {
                setShowFullAnswers(false);
                // Re-open results modal so user can access DONE/REMATCH
                setTimeout(() => setShowResultModal(true), 100);
              }}
            >
              <Text style={styles.fullAnswersDoneText}>DONE</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Level Up Modal */}
      <LevelUpModal
        visible={showLevelUpModal}
        newLevel={newLevel}
        onClose={() => setShowLevelUpModal(false)}
      />

      {/* Achievement Toast */}
      <AchievementToast
        achievement={currentAchievement}
        visible={showAchievementToast}
        onDismiss={handleAchievementDismiss}
      />

      {/* First Duel Win Invite Modal */}
      <Modal
        visible={showInviteModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowInviteModal(false)}
      >
        <View style={styles.forfeitModalOverlay}>
          <View style={styles.inviteModalContent}>
            <Text style={styles.inviteModalTitle}>You Won Your First Duel!</Text>
            <Text style={styles.inviteModalSubtitle}>
              Challenge your friends to see who really knows ball
            </Text>
            <TouchableOpacity
              style={styles.inviteModalShareButton}
              onPress={handleInviteFromModal}
              disabled={isInviting}
            >
              {isInviting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.inviteModalShareText}>INVITE FRIENDS</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.inviteModalLaterButton}
              onPress={() => setShowInviteModal(false)}
              disabled={isInviting}
            >
              <Text style={styles.inviteModalLaterText}>Maybe Later</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Report User Modal */}
      <ReportUserModal
        visible={showReportModal}
        onClose={() => setShowReportModal(false)}
        userId={isPlayer1 ? duel.player2_id || '' : duel.player1_id || ''}
        username={opponentUsername || 'Opponent'}
        reporterId={user?.id || ''}
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
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  stickyHeader: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
    backgroundColor: colors.background,
  },
  scrollableHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingTop: 8,
  },
  headerRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  soundToggleButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  soundToggleIcon: {
    width: 20,
    height: 20,
  },
  soundToggleIconMuted: {
    opacity: 0.3,
  },
  header: {
    padding: 24,
    paddingBottom: 16,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  backButton: {
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
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(59, 169, 120, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.live,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.live,
    marginRight: 6,
  },
  liveText: {
    color: colors.live,
    fontSize: 12,
    fontFamily: 'DMSans_900Black',
  },
  reconnectingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F59E0B',
    gap: 6,
  },
  reconnectingText: {
    color: '#F59E0B',
    fontSize: 11,
    fontFamily: 'DMSans_700Bold',
  },
  disconnectedIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(220, 38, 38, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DC2626',
  },
  disconnectedText: {
    color: '#DC2626',
    fontSize: 11,
    fontFamily: 'DMSans_700Bold',
  },
  title: {
    fontSize: 24,
    fontFamily: 'DMSans_900Black',
    color: colors.textDark,
    textAlign: 'center',
    marginBottom: 12,
  },
  sportBadgeContainer: {
    alignItems: 'center',
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
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  sportIcon: {
    width: 20,
    height: 20,
  },
  sportBadgeText: {
    fontSize: 14,
    fontFamily: 'DMSans_900Black',
    color: '#FFFFFF',
  },
  timerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 12,
  },
  timerBar: {
    flex: 1,
    height: 12,
    backgroundColor: colors.borderLight,
    borderRadius: 6,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#000000',
  },
  timerFill: {
    height: '100%',
    borderRadius: 4,
  },
  timerText: {
    fontSize: 18,
    fontFamily: 'DMSans_900Black',
    width: 40,
    textAlign: 'right',
  },
  waitingContainer: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    padding: 24,
    paddingTop: 32,
  },
  waitingSportBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#000000',
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
    marginBottom: 16,
  },
  waitingSportIcon: {
    width: 40,
    height: 40,
  },
  waitingTitle: {
    fontSize: 28,
    fontFamily: 'DMSans_900Black',
    color: colors.textDark,
    marginBottom: 32,
  },
  waitingSpinnerContainer: {
    marginBottom: 24,
    transform: [{ scale: 2 }],
  },
  waitingText: {
    fontSize: 22,
    fontFamily: 'DMSans_900Black',
    color: colors.textDark,
    marginBottom: 8,
  },
  waitingSubtext: {
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: 24,
  },
  waitingRules: {
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 32,
  },
  // Countdown styles
  countdownContainer: {
    flex: 1,
  },
  countdownContent: {
    flex: 2,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  countdownTitle: {
    fontSize: 28,
    fontFamily: 'DMSans_900Black',
    color: colors.textDark,
    marginBottom: 32,
  },
  countdownNumberContainer: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#000000',
    shadowColor: '#000000',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
    marginBottom: 32,
  },
  countdownNumber: {
    fontSize: 80,
    fontFamily: 'DMSans_900Black',
  },
  countdownSubtext: {
    fontSize: 16,
    fontFamily: 'DMSans_500Medium',
    color: colors.textMuted,
    textAlign: 'center',
  },
  countdownAdBanner: {
    flex: 1,
    marginTop: 32,
    marginHorizontal: 32,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
  },
  countdownAdImage: {
    width: '100%',
    height: '100%',
  },
  questionAdBanner: {
    marginTop: 24,
    width: '100%',
    maxWidth: 360,
    alignSelf: 'center',
    height: 60,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  questionAdImage: {
    width: '100%',
    height: 50,
  },
  cancelButton: {
    backgroundColor: '#F2C94C',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#000000',
    paddingHorizontal: 32,
    paddingVertical: 14,
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  cancelButtonText: {
    fontSize: 12,
    fontFamily: 'DMSans_900Black',
    color: '#1A1A1A',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  questionContainer: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 8,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#000000',
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  difficultyBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#000000',
  },
  difficultyText: {
    fontSize: 11,
    fontFamily: 'DMSans_900Black',
    letterSpacing: 1,
  },
  questionText: {
    fontSize: 18,
    fontFamily: 'DMSans_600SemiBold',
    color: colors.textDark,
    lineHeight: 26,
  },
  optionsContainer: {
    gap: 12,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 2,
    borderColor: '#000000',
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  optionLetter: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 2,
    borderColor: '#000000',
  },
  optionLetterText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'DMSans_900Black',
  },
  optionText: {
    flex: 1,
    fontSize: 16,
    color: colors.textDark,
    fontFamily: 'DMSans_500Medium',
  },
  correctMark: {
    fontSize: 20,
    color: colors.correct,
    fontFamily: 'DMSans_900Black',
  },
  buttonSelected: {
    backgroundColor: colors.selected,
  },
  buttonCorrect: {
    backgroundColor: '#3BA978',
  },
  buttonWrong: {
    backgroundColor: '#E53935',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  waitingForOpponent: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  waitingForOpponentText: {
    fontSize: 16,
    fontFamily: 'DMSans_500Medium',
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalOverlayFullScreen: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#000000',
    padding: 24,
    alignItems: 'center',
    width: '100%',
    maxWidth: 360,
    shadowColor: '#000000',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  modalEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  resultIcon: {
    width: 80,
    height: 80,
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 28,
    fontFamily: 'DMSans_900Black',
    color: colors.textDark,
    marginBottom: 8,
  },
  modalTitleWin: {
    color: '#3BA978',
  },
  modalTitleLose: {
    color: '#E53935',
  },
  modalTitleTie: {
    color: '#888888',
  },
  modalSubtitle: {
    fontSize: 16,
    fontFamily: 'DMSans_400Regular',
    color: colors.textMuted,
    marginBottom: 20,
    textAlign: 'center',
  },
  xpBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#000000',
  },
  xpBadgeText: {
    fontSize: 18,
    fontFamily: 'DMSans_900Black',
  },
  xpBadgeYellow: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#000000',
    backgroundColor: '#F2C94C',
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  xpBadgeTextBlack: {
    fontSize: 18,
    fontFamily: 'DMSans_900Black',
    color: '#1A1A1A',
  },
  questionSummary: {
    backgroundColor: colors.background,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#000000',
    padding: 12,
    width: '100%',
    marginBottom: 12,
  },
  questionSummaryText: {
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
  questionAnswerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#000000',
    padding: 16,
    width: '100%',
    marginBottom: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  correctAnswerRow: {
    marginTop: 12,
    alignItems: 'center',
  },
  correctAnswerLabel: {
    fontSize: 12,
    fontFamily: 'DMSans_500Medium',
    color: colors.textMuted,
    marginBottom: 4,
  },
  correctAnswerValue: {
    fontSize: 16,
    fontFamily: 'DMSans_700Bold',
    color: '#1ABC9C',
    textAlign: 'center',
  },
  playersComparisonContainer: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginBottom: 16,
    width: '100%',
    position: 'relative',
  },
  playerCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#000000',
    padding: 12,
    minHeight: 100,
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  playerCardLabel: {
    fontSize: 10,
    fontFamily: 'DMSans_700Bold',
    color: '#888888',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  playerCardAnswerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 8,
  },
  playerCardAnswer: {
    fontSize: 14,
    fontFamily: 'DMSans_900Black',
    textAlign: 'center',
  },
  playerCardTime: {
    fontSize: 12,
    fontFamily: 'DMSans_400Regular',
    color: '#888888',
  },
  vsBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1A1A1A',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    left: '50%',
    top: '50%',
    marginLeft: -18,
    marginTop: -18,
    zIndex: 10,
    borderWidth: 2,
    borderColor: '#1A1A1A',
  },
  vsBadgeText: {
    fontSize: 11,
    fontFamily: 'DMSans_900Black',
    color: '#FFFFFF',
  },
  answerContainer: {
    backgroundColor: colors.background,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#000000',
    padding: 16,
    width: '100%',
    alignItems: 'center',
    marginBottom: 16,
  },
  answerLabel: {
    fontSize: 12,
    fontFamily: 'DMSans_600SemiBold',
    color: colors.textMuted,
    marginBottom: 4,
  },
  answerText: {
    fontSize: 16,
    fontFamily: 'DMSans_700Bold',
    color: colors.correct,
    textAlign: 'center',
  },
  answersComparison: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    width: '100%',
  },
  answerColumn: {
    flex: 1,
    alignItems: 'center',
  },
  answerColumnLabel: {
    fontSize: 12,
    fontFamily: 'DMSans_600SemiBold',
    color: colors.textMuted,
    marginBottom: 4,
  },
  answerColumnValue: {
    fontSize: 14,
    fontFamily: 'DMSans_600SemiBold',
    textAlign: 'center',
  },
  correctAnswerText: {
    color: colors.correct,
  },
  wrongAnswerText: {
    color: colors.wrong,
  },
  answerTime: {
    fontSize: 12,
    fontFamily: 'DMSans_400Regular',
    color: colors.textMuted,
    marginTop: 4,
  },
  vsContainer: {
    paddingHorizontal: 16,
  },
  vsText: {
    fontSize: 14,
    fontFamily: 'DMSans_900Black',
    color: colors.textMuted,
  },
  addFriendButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.correct,
    marginBottom: 12,
    backgroundColor: '#FFFFFF',
  },
  addFriendButtonText: {
    color: colors.correct,
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
  },
  friendAddedText: {
    color: colors.correct,
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
    marginBottom: 12,
  },
  modalButtonsRow: {
    flexDirection: 'row',
    gap: 16,
    width: '100%',
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#000000',
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
    alignItems: 'center',
  },
  modalButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'DMSans_900Black',
  },
  modalButtonSecondary: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#000000',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
    alignItems: 'center',
  },
  modalButtonSecondaryText: {
    color: '#1A1A1A',
    fontSize: 16,
    fontFamily: 'DMSans_900Black',
  },
  playAgainButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#000000',
    backgroundColor: '#1ABC9C',
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
    alignItems: 'center',
  },
  playAgainButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'DMSans_900Black',
  },
  homeButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#000000',
    backgroundColor: '#F2C94C',
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
    alignItems: 'center',
  },
  homeButtonText: {
    color: '#1A1A1A',
    fontSize: 16,
    fontFamily: 'DMSans_900Black',
  },
  // Combined Round + Score Card
  roundScoreCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#000000',
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  roundScoreRound: {
    fontSize: 13,
    fontFamily: 'DMSans_700Bold',
    color: colors.textDark,
  },
  roundScoreDivider: {
    width: 2,
    height: 20,
    backgroundColor: '#E5E5E0',
    marginHorizontal: 16,
  },
  roundScoreScore: {
    fontSize: 13,
    fontFamily: 'DMSans_700Bold',
    color: colors.textDark,
  },
  roundScoreDash: {
    color: colors.textMuted,
  },
  // Round result overlay
  roundResultOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  roundResultCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 3,
    borderColor: '#000000',
    padding: 24,
    alignItems: 'center',
    width: '90%',
    maxWidth: 320,
    shadowColor: '#000000',
    shadowOffset: { width: 6, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 6,
  },
  roundResultIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#000000',
    marginBottom: 12,
  },
  roundResultIconCorrect: {
    backgroundColor: colors.correct,
  },
  roundResultIconWrong: {
    backgroundColor: '#E53935',
  },
  roundResultIconText: {
    fontSize: 32,
    fontFamily: 'DMSans_900Black',
    color: '#FFFFFF',
  },
  roundResultText: {
    fontSize: 28,
    fontFamily: 'DMSans_900Black',
    marginBottom: 12,
  },
  roundResultWin: {
    color: colors.correct,
  },
  roundResultLose: {
    color: '#E53935',
  },
  roundResultTie: {
    color: colors.textMuted,
  },
  roundResultQuestion: {
    fontSize: 14,
    fontFamily: 'DMSans_500Medium',
    color: '#666666',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
    paddingHorizontal: 8,
  },
  roundResultAnswerPill: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#000000',
    marginBottom: 16,
    width: '100%',
    alignItems: 'center',
  },
  answerPillCorrect: {
    backgroundColor: `${colors.correct}20`,
  },
  answerPillWrong: {
    backgroundColor: '#FFEBEE',
  },
  roundResultAnswerLabel: {
    fontSize: 11,
    fontFamily: 'DMSans_700Bold',
    color: '#888888',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  roundResultAnswerText: {
    fontSize: 16,
    fontFamily: 'DMSans_700Bold',
    color: '#1A1A1A',
    textAlign: 'center',
  },
  roundResultNext: {
    fontSize: 13,
    fontFamily: 'DMSans_500Medium',
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  roundResultNextButton: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#000000',
    marginTop: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  roundResultNextButtonText: {
    fontSize: 14,
    fontFamily: 'DMSans_900Black',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  // Final score display in results modal
  finalScoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#000000',
    marginBottom: 16,
  },
  finalScoreItem: {
    alignItems: 'center',
    flex: 1,
  },
  finalScoreLabel: {
    fontSize: 12,
    fontFamily: 'DMSans_600SemiBold',
    color: colors.textMuted,
    marginBottom: 4,
  },
  finalScoreValue: {
    fontSize: 32,
    fontFamily: 'DMSans_900Black',
  },
  finalScoreDivider: {
    fontSize: 28,
    fontFamily: 'DMSans_900Black',
    color: colors.textMuted,
    marginHorizontal: 16,
  },
  // Async waiting for friend styles
  asyncWaitingContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#000000',
    padding: 32,
    alignItems: 'center',
    width: '90%',
    maxWidth: 360,
    shadowColor: '#000000',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  asyncCheckContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#3BA978',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#000000',
    marginBottom: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  asyncCheckText: {
    fontSize: 40,
    color: '#FFFFFF',
    fontFamily: 'DMSans_900Black',
  },
  asyncWaitingTitle: {
    fontSize: 24,
    fontFamily: 'DMSans_900Black',
    color: colors.textDark,
    marginBottom: 16,
    textAlign: 'center',
  },
  asyncScoreContainer: {
    backgroundColor: '#F5F2EB',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 16,
    alignItems: 'center',
  },
  asyncScoreLabel: {
    fontSize: 12,
    fontFamily: 'DMSans_600SemiBold',
    color: colors.textMuted,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  asyncScoreValue: {
    fontSize: 28,
    fontFamily: 'DMSans_900Black',
    color: colors.primary,
  },
  asyncWaitingSubtitle: {
    fontSize: 16,
    fontFamily: 'DMSans_500Medium',
    color: colors.textMuted,
    marginBottom: 20,
    textAlign: 'center',
  },
  asyncTimeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F2EB',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#000000',
    marginBottom: 20,
  },
  asyncTimeIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  asyncTimeText: {
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
    color: colors.textDark,
  },
  asyncInfoText: {
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  asyncBackButton: {
    backgroundColor: '#F2C94C',
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
  asyncBackButtonText: {
    fontSize: 14,
    fontFamily: 'DMSans_900Black',
    color: '#1A1A1A',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  // Combined Async Result Modal styles
  asyncResultScrollView: {
    flex: 1,
    width: '100%',
  },
  asyncResultScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  asyncResultModalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#000000',
    padding: 24,
    alignItems: 'center',
    width: '100%',
    maxWidth: 380,
    shadowColor: '#000000',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  asyncResultIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#000000',
    marginBottom: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  asyncResultIconCorrect: {
    backgroundColor: '#3BA978',
  },
  asyncResultIconIncorrect: {
    backgroundColor: '#DC2626',
  },
  asyncResultIconText: {
    fontSize: 36,
    color: '#FFFFFF',
    fontFamily: 'DMSans_900Black',
  },
  asyncResultTitle: {
    fontSize: 28,
    fontFamily: 'DMSans_900Black',
    marginBottom: 16,
    textAlign: 'center',
    color: '#1A1A1A',
  },
  asyncResultTitleCorrect: {
    color: '#3BA978',
  },
  asyncResultTitleIncorrect: {
    color: '#DC2626',
  },
  asyncResultAnswerContainer: {
    backgroundColor: '#F5F2EB',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#000000',
    marginBottom: 20,
    width: '100%',
    alignItems: 'center',
  },
  asyncResultAnswerLabel: {
    fontSize: 12,
    fontFamily: 'DMSans_700Bold',
    color: '#888888',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  asyncResultAnswerText: {
    fontSize: 18,
    fontFamily: 'DMSans_700Bold',
    color: '#1A1A1A',
    textAlign: 'center',
  },
  // Turn Complete Screen styles
  turnCompleteContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#000000',
    padding: 32,
    alignItems: 'center',
    width: '90%',
    maxWidth: 340,
    shadowColor: '#000000',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  turnCompleteCheckCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#1ABC9C',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 3,
    borderColor: '#000000',
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  turnCompleteCheckText: {
    fontSize: 40,
    fontFamily: 'DMSans_900Black',
    color: '#FFFFFF',
  },
  turnCompleteTitle: {
    fontSize: 24,
    fontFamily: 'DMSans_900Black',
    color: '#1A1A1A',
    marginBottom: 12,
    textAlign: 'center',
  },
  turnCompleteScore: {
    fontSize: 18,
    fontFamily: 'DMSans_700Bold',
    color: '#1A1A1A',
    marginBottom: 24,
  },
  turnCompleteWaiting: {
    fontSize: 16,
    fontFamily: 'DMSans_600SemiBold',
    color: '#666666',
    textAlign: 'center',
    marginBottom: 8,
  },
  turnCompleteNote: {
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
    color: '#888888',
    textAlign: 'center',
    marginBottom: 28,
  },
  turnCompleteButton: {
    backgroundColor: '#F2C94C',
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
  turnCompleteButtonText: {
    fontSize: 14,
    fontFamily: 'DMSans_900Black',
    color: '#1A1A1A',
    letterSpacing: 0.5,
  },
  // Duel Results Modal styles
  duelResultsContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#000000',
    padding: 20,
    alignItems: 'center',
    width: '92%',
    maxWidth: 380,
    shadowColor: '#000000',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  duelResultsSportBadge: {
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
  duelResultsSportIcon: {
    width: 20,
    height: 20,
  },
  duelResultsSportText: {
    fontSize: 14,
    fontFamily: 'DMSans_900Black',
    color: '#FFFFFF',
  },
  duelResultsHeader: {
    fontSize: 12,
    fontFamily: 'DMSans_700Bold',
    color: '#888888',
    letterSpacing: 2,
    marginBottom: 16,
  },
  duelResultsPlayersCard: {
    width: '100%',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#000000',
    padding: 12,
    marginBottom: 16,
  },
  duelResultsPlayerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  duelResultsCrownIcon: {
    width: 20,
    height: 20,
    marginLeft: 6,
  },
  duelResultsNameContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  duelResultsAvatar: {
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
  duelResultsAvatarWinner: {
    backgroundColor: '#1ABC9C',
  },
  duelResultsAvatarText: {
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
    color: '#FFFFFF',
  },
  duelResultsPlayerName: {
    fontSize: 16,
    fontFamily: 'DMSans_600SemiBold',
    color: '#666666',
  },
  duelResultsPlayerNameWinner: {
    fontFamily: 'DMSans_700Bold',
    color: '#1A1A1A',
  },
  duelResultsPlayerScore: {
    fontSize: 18,
    fontFamily: 'DMSans_700Bold',
    color: '#888888',
  },
  duelResultsPlayerScoreWinner: {
    color: '#1ABC9C',
  },
  duelResultsMessageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
  },
  duelResultsMessage: {
    fontSize: 22,
    fontFamily: 'DMSans_900Black',
    textAlign: 'center',
  },
  duelResultsWinIcon: {
    width: 28,
    height: 28,
  },
  duelResultsMessageWin: {
    color: '#1ABC9C',
  },
  duelResultsMessageLose: {
    color: '#666666',
  },
  duelResultsMessageTie: {
    color: '#F2C94C',
  },
  duelResultsXpBadge: {
    backgroundColor: '#F2C94C',
    paddingHorizontal: 24,
    paddingVertical: 12,
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
  duelResultsXpText: {
    fontSize: 20,
    fontFamily: 'DMSans_900Black',
    color: '#1A1A1A',
  },
  xpProgressContainer: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 20,
  },
  xpBarOuter: {
    width: '100%',
    height: 16,
    backgroundColor: '#E8E8E8',
    borderWidth: 2,
    borderColor: '#000000',
    borderRadius: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
    marginBottom: 6,
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
  xpProgressText: {
    fontSize: 12,
    fontFamily: 'DMSans_600SemiBold',
    color: '#888888',
  },
  duelResultsViewAnswers: {
    marginBottom: 20,
  },
  duelResultsViewAnswersText: {
    fontSize: 14,
    fontFamily: 'DMSans_600SemiBold',
    color: '#1ABC9C',
    textDecorationLine: 'underline',
  },
  duelResultsButtons: {
    width: '100%',
    gap: 12,
  },
  duelResultsDoneButton: {
    backgroundColor: '#1ABC9C',
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
  duelResultsDoneButtonText: {
    fontSize: 14,
    fontFamily: 'DMSans_900Black',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  duelResultsRematchButton: {
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
  duelResultsRematchButtonText: {
    fontSize: 14,
    fontFamily: 'DMSans_900Black',
    color: '#1A1A1A',
    letterSpacing: 0.5,
  },
  duelResultsReportLink: {
    marginTop: 16,
    paddingVertical: 8,
  },
  duelResultsReportLinkText: {
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
    color: '#888888',
    textDecorationLine: 'underline',
  },
  // Presented By Ad Banner styles
  presentedByContainer: {
    alignItems: 'center',
    marginBottom: 16,
    width: '100%',
  },
  presentedByContainerTop: {
    alignItems: 'center',
    marginBottom: 16,
    width: '100%',
  },
  presentedByText: {
    fontSize: 12,
    fontFamily: 'DMSans_400Regular',
    color: '#888888',
    marginBottom: 8,
  },
  presentedByAdBanner: {
    width: '100%',
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  presentedByAdImage: {
    width: '100%',
    height: 50,
  },
  asyncResultDivider: {
    width: '100%',
    height: 2,
    backgroundColor: '#E5E5E0',
    marginBottom: 20,
  },
  asyncResultWaitingSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  asyncResultWaitingTitle: {
    fontSize: 16,
    fontFamily: 'DMSans_700Bold',
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 4,
  },
  asyncResultWaitingSubtext: {
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
    color: '#888888',
    textAlign: 'center',
  },
  asyncResultBackButton: {
    backgroundColor: '#F2C94C',
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
    width: '100%',
    alignItems: 'center',
  },
  asyncResultBackButtonText: {
    fontSize: 14,
    fontFamily: 'DMSans_900Black',
    color: '#1A1A1A',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  // Async Score Summary
  asyncScoreSummary: {
    backgroundColor: '#F5F2EB',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#000000',
    alignItems: 'center',
    marginBottom: 16,
  },
  // Simplified Round Icons styles
  roundIconsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
    paddingVertical: 8,
  },
  roundIconItem: {
    alignItems: 'center',
    gap: 4,
  },
  roundIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#000000',
  },
  roundIconCorrect: {
    backgroundColor: '#3BA978',
  },
  roundIconIncorrect: {
    backgroundColor: '#DC2626',
  },
  roundIconText: {
    fontSize: 18,
    fontFamily: 'DMSans_900Black',
    color: '#FFFFFF',
  },
  roundIconNumber: {
    fontSize: 12,
    fontFamily: 'DMSans_700Bold',
    color: '#888888',
  },
  // View Full Answers styles
  viewAnswersButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  viewAnswersText: {
    fontSize: 14,
    fontFamily: 'DMSans_600SemiBold',
    color: '#1ABC9C',
    textDecorationLine: 'underline',
  },
  fullAnswersContainer: {
    width: '100%',
    backgroundColor: '#F5F2EB',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  fullAnswerItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E5E0',
    marginBottom: 8,
  },
  fullAnswerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  fullAnswerRound: {
    fontSize: 11,
    fontFamily: 'DMSans_700Bold',
    color: '#888888',
    textTransform: 'uppercase',
  },
  fullAnswerResult: {
    fontSize: 11,
    fontFamily: 'DMSans_700Bold',
  },
  fullAnswerCorrect: {
    color: '#3BA978',
  },
  fullAnswerIncorrect: {
    color: '#DC2626',
  },
  fullAnswerQuestion: {
    fontSize: 13,
    fontFamily: 'DMSans_500Medium',
    color: '#1A1A1A',
    lineHeight: 18,
    marginBottom: 6,
  },
  fullAnswerYours: {
    fontSize: 12,
    fontFamily: 'DMSans_400Regular',
    color: '#666666',
  },
  fullAnswerCorrectText: {
    fontSize: 12,
    fontFamily: 'DMSans_400Regular',
    color: '#666666',
    marginTop: 2,
  },
  fullAnswerCorrectAnswer: {
    fontFamily: 'DMSans_600SemiBold',
    color: '#1ABC9C',
  },
  // Full Answers Modal Styles
  fullAnswersOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  fullAnswersContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '80%',
  },
  fullAnswersHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  fullAnswersTitle: {
    fontSize: 20,
    fontFamily: 'DMSans_700Bold',
    color: '#1A1A1A',
  },
  fullAnswersClose: {
    fontSize: 24,
    color: '#888888',
    padding: 4,
  },
  fullAnswersList: {
    marginBottom: 16,
  },
  fullAnswerStatus: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullAnswerStatusCorrect: {
    backgroundColor: '#BBF7D0',
  },
  fullAnswerStatusWrong: {
    backgroundColor: '#FECACA',
  },
  fullAnswerStatusText: {
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
    color: '#FFFFFF',
  },
  fullAnswerDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  fullAnswerLabel: {
    fontSize: 12,
    fontFamily: 'DMSans_400Regular',
    color: '#888888',
    marginRight: 6,
  },
  fullAnswerValue: {
    fontSize: 12,
    fontFamily: 'DMSans_600SemiBold',
    flex: 1,
  },
  fullAnswerValueCorrect: {
    color: '#3BA978',
  },
  fullAnswerValueWrong: {
    color: '#DC2626',
  },
  fullAnswersDoneButton: {
    backgroundColor: '#1ABC9C',
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
  fullAnswersDoneText: {
    fontSize: 14,
    fontFamily: 'DMSans_900Black',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  // Forfeit Modal Styles
  forfeitModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  forfeitModalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#000000',
    padding: 24,
    width: '100%',
    maxWidth: 320,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  forfeitModalTitle: {
    fontSize: 22,
    fontFamily: 'DMSans_900Black',
    color: '#1A1A1A',
    marginBottom: 12,
  },
  forfeitModalText: {
    fontSize: 15,
    fontFamily: 'DMSans_400Regular',
    color: '#666666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  forfeitModalButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  forfeitStayButton: {
    flex: 1,
    backgroundColor: '#1ABC9C',
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
  forfeitStayButtonText: {
    fontSize: 14,
    fontFamily: 'DMSans_900Black',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  forfeitLeaveButton: {
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
  forfeitLeaveButtonText: {
    fontSize: 14,
    fontFamily: 'DMSans_900Black',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  // Invite Modal Styles
  inviteModalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#000000',
    padding: 24,
    width: '90%',
    maxWidth: 340,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  inviteModalTitle: {
    fontSize: 22,
    fontFamily: 'DMSans_900Black',
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 8,
  },
  inviteModalSubtitle: {
    fontSize: 15,
    fontFamily: 'DMSans_400Regular',
    color: '#666666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  inviteModalShareButton: {
    backgroundColor: '#1ABC9C',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#000000',
    alignItems: 'center',
    width: '100%',
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
    marginBottom: 12,
  },
  inviteModalShareText: {
    fontSize: 14,
    fontFamily: 'DMSans_900Black',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  inviteModalLaterButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  inviteModalLaterText: {
    fontSize: 14,
    fontFamily: 'DMSans_600SemiBold',
    color: '#888888',
  },
});
