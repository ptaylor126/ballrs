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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getSportColor, Sport } from '../lib/theme';
import { soundService } from '../lib/soundService';

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
} from '../lib/duelService';
import { areFriends, addFriend } from '../lib/friendsService';
import { supabase } from '../lib/supabase';
import { calculateDuelXP, awardXP } from '../lib/xpService';
import { checkDuelAchievements, Achievement } from '../lib/achievementsService';
import LevelUpModal from '../components/LevelUpModal';
import AchievementToast from '../components/AchievementToast';
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
  getRandomQuestionId?: (sport: 'nba' | 'pl' | 'nfl' | 'mlb') => string;
}

const TIMER_DURATION = 15; // seconds

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

export default function DuelGameScreen({ duel: initialDuel, onBack, onComplete, onPlayAgain, getRandomQuestionId }: Props) {
  const { user } = useAuth();
  const [duel, setDuel] = useState<Duel>(initialDuel);
  const [question, setQuestion] = useState<TriviaQuestion | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [opponentAnswered, setOpponentAnswered] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(TIMER_DURATION);
  const [gamePhase, setGamePhase] = useState<'waiting' | 'playing' | 'roundResult' | 'results'>('waiting');
  const [showResultModal, setShowResultModal] = useState(false);
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

  // Refs for safety timeout and connection monitoring
  const safetyTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const hasSubmittedTimeoutRef = useRef<boolean>(false);

  // Helper to check if this is a multi-question duel
  const isMultiQuestion = duel.question_count > 1;
  const totalQuestions = duel.question_count;
  const currentRound = duel.current_round;

  const channelRef = useRef<RealtimeChannel | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const timerAnim = useRef(new Animated.Value(1)).current;
  const liveAnim = useRef(new Animated.Value(1)).current;
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
    const q = questions.find(q => q.id === currentQuestionId);
    if (q) {
      setQuestion(q);
    }
  }, [duel.mystery_player_id, duel.sport, duel.current_round]);

  // Pulse animation for live indicator
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(liveAnim, {
          toValue: 0.4,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(liveAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [liveAnim]);

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
        setOpponentUsername(profile.username);
      }
    };

    checkFriendship();
  }, [user, opponentId, isFriendDuel]);

  // Start the game when duel becomes active
  useEffect(() => {
    if (duel.status === 'active' && gamePhase === 'waiting') {
      // If player1, set the round start time
      if (isPlayer1 && !duel.round_start_time) {
        setRoundStartTime(duel.id);
      }
    }
  }, [duel.status, gamePhase, isPlayer1, duel.id, duel.round_start_time]);

  // Subscribe to duel updates with connection monitoring
  useEffect(() => {
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
          const startTime = new Date(updatedDuel.round_start_time).getTime();
          setRoundStartTimeState(startTime);
          setGamePhase('playing');
          hasSubmittedTimeoutRef.current = false; // Reset for new round
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
  }, [duel.id, isPlayer1, gamePhase, isMultiQuestion]);

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
    if (gamePhase !== 'roundResult' || !question || isAdvancingRound) return;

    // Calculate if I won this round
    const myAnswer = isPlayer1 ? duel.player1_answer : duel.player2_answer;
    const oppAnswer = isPlayer1 ? duel.player2_answer : duel.player1_answer;
    const iCorrect = myAnswer === question.correctAnswer;
    const oCorrect = oppAnswer === question.correctAnswer;
    setRoundWon(iCorrect && !oCorrect ? true : (!iCorrect && oCorrect ? false : null));

    const isLastRound = currentRound >= totalQuestions;

    // Wait 1 second to show round result, then advance
    const timer = setTimeout(async () => {
      if (isLastRound) {
        // Last round - complete the duel and show final results
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
        }

        setGamePhase('results');
        setShowResultModal(true);
      } else {
        // Not last round - advance to next round (only player 1 does this)
        if (isPlayer1 && !isAdvancingRound) {
          setIsAdvancingRound(true);
          const newQuestionId = getNewQuestionId();
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
        }
        // Reset round state
        setSelectedAnswer(null);
        setHasAnswered(false);
        setOpponentAnswered(false);
        setTimeRemaining(TIMER_DURATION);
        setRoundStartTimeState(null);
        setRoundWon(null);
        setIsAdvancingRound(false);
        hasSubmittedTimeoutRef.current = false; // Reset for next round
        lastTickSecond.current = -1; // Reset tick sound tracker
        setGamePhase('waiting');
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [gamePhase, question, isPlayer1, currentRound, totalQuestions, duel, isAdvancingRound, getNewQuestionId]);

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
  }, [hasAnswered, duel.id, isPlayer1]);

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
      soundService.playCorrect();
    } else {
      soundService.playWrong();
    }

    // Calculate answer time (ms from round start)
    const answerTime = Date.now() - roundStartTime;

    // Submit answer
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

  // Award XP when game ends
  useEffect(() => {
    if (gamePhase === 'results' && user && !xpAwarded && question) {
      setXpAwarded(true);

      let won: boolean;
      let tie: boolean;

      if (isMultiQuestion) {
        // For multi-question duels, use scores to determine winner
        if (myScore > opponentScore) {
          won = true;
          tie = false;
        } else if (opponentScore > myScore) {
          won = false;
          tie = false;
        } else {
          // Scores tied - use total time as tiebreaker
          const myTotalTime = isPlayer1 ? duel.player1_total_time : duel.player2_total_time;
          const oppTotalTime = isPlayer1 ? duel.player2_total_time : duel.player1_total_time;
          if (myTotalTime < oppTotalTime) {
            won = true;
            tie = false;
          } else if (oppTotalTime < myTotalTime) {
            won = false;
            tie = false;
          } else {
            won = false;
            tie = true;
          }
        }
      } else {
        // Single question duel
        const { winnerId } = determineWinner(duel, question.correctAnswer);
        won = winnerId === user.id;
        tie = winnerId === null;
      }

      // Calculate XP: Winner 75, Loser 25, Tie 40
      const xpResult: 'win' | 'loss' | 'tie' = tie ? 'tie' : won ? 'win' : 'loss';
      const xpAmount = calculateDuelXP(xpResult);

      awardXP(user.id, xpAmount).then((result) => {
        if (result?.leveledUp) {
          setNewLevel(result.newLevel);
          setShowLevelUpModal(true);
        }
      });

      // Check for achievements
      setTimeout(() => {
        checkDuelAchievements(user.id).then((unlocked) => {
          if (unlocked.length > 0) {
            setPendingAchievements(unlocked);
            setCurrentAchievement(unlocked[0]);
            setShowAchievementToast(true);
          }
        });
      }, 500);
    }
  }, [gamePhase, user, xpAwarded, question, duel, isPlayer1, isMultiQuestion, myScore, opponentScore]);

  const getTimerColor = () => {
    if (timeRemaining <= 3) return colors.timerDanger;
    if (timeRemaining <= 7) return colors.timerWarning;
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
    if (!question) return { won: false, tie: false, subtitle: '', xpEarned: 0, finalScore: { me: 0, opp: 0 } };

    let won: boolean;
    let tie: boolean;
    let subtitle: string;

    if (isMultiQuestion) {
      // For multi-question duels, use scores to determine winner
      const finalMyScore = myScore;
      const finalOppScore = opponentScore;

      won = finalMyScore > finalOppScore;
      tie = finalMyScore === finalOppScore;

      // If scores are equal, use total time as tiebreaker
      if (tie) {
        const myTotalTime = isPlayer1 ? duel.player1_total_time : duel.player2_total_time;
        const oppTotalTime = isPlayer1 ? duel.player2_total_time : duel.player1_total_time;
        if (myTotalTime < oppTotalTime) {
          won = true;
          tie = false;
          subtitle = `Tied ${finalMyScore}-${finalOppScore}, but you were faster overall!`;
        } else if (oppTotalTime < myTotalTime) {
          won = false;
          tie = false;
          subtitle = `Tied ${finalMyScore}-${finalOppScore}, but opponent was faster overall`;
        } else {
          subtitle = `Tied ${finalMyScore}-${finalOppScore} with same total time!`;
        }
      } else if (won) {
        subtitle = `You won ${finalMyScore}-${finalOppScore}!`;
      } else {
        subtitle = `You lost ${finalMyScore}-${finalOppScore}`;
      }
    } else {
      // Single question duel - original logic
      const { winnerId, reason } = determineWinner(duel, question.correctAnswer);
      won = winnerId === user?.id;
      tie = winnerId === null;

      const myAnswer = isPlayer1 ? duel.player1_answer : duel.player2_answer;
      const opponentAnswer = isPlayer1 ? duel.player2_answer : duel.player1_answer;
      const myTime = isPlayer1 ? duel.player1_answer_time : duel.player2_answer_time;
      const opponentTime = isPlayer1 ? duel.player2_answer_time : duel.player1_answer_time;

      const iCorrect = myAnswer === question.correctAnswer;
      const oCorrect = opponentAnswer === question.correctAnswer;
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

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity style={styles.backButton} onPress={onBack}>
            <Text style={styles.backButtonText}>← Leave</Text>
          </TouchableOpacity>
          {gamePhase === 'playing' && (
            <View style={styles.liveIndicator}>
              <Animated.View style={[styles.liveDot, { opacity: liveAnim }]} />
              <Text style={styles.liveText}>LIVE</Text>
            </View>
          )}
          {connectionStatus === 'reconnecting' && (
            <View style={styles.reconnectingIndicator}>
              <ActivityIndicator size="small" color="#F59E0B" />
              <Text style={styles.reconnectingText}>Reconnecting...</Text>
            </View>
          )}
          {connectionStatus === 'disconnected' && (
            <View style={styles.disconnectedIndicator}>
              <Text style={styles.disconnectedText}>Connection Lost</Text>
            </View>
          )}
        </View>
        <Text style={styles.title}>Trivia Duel</Text>
        <View style={styles.sportBadgeContainer}>
          <View style={[styles.sportBadge, { backgroundColor: sportColor }]}>
            <Image source={sportIcons[duel.sport as Sport]} style={styles.sportIcon} resizeMode="contain" />
            <Text style={styles.sportBadgeText}>{sportNames[duel.sport as Sport]}</Text>
          </View>
        </View>
        {/* Round and Score Display for multi-question duels */}
        {isMultiQuestion && (
          <View style={styles.roundScoreContainer}>
            <View style={styles.roundIndicator}>
              <Text style={styles.roundText}>Round {currentRound} of {totalQuestions}</Text>
            </View>
            <View style={styles.scoreDisplay}>
              <View style={styles.scoreItem}>
                <Text style={styles.scoreLabel}>You</Text>
                <Text style={[styles.scoreValue, { color: sportColor }]}>{myScore}</Text>
              </View>
              <Text style={styles.scoreDivider}>-</Text>
              <View style={styles.scoreItem}>
                <Text style={styles.scoreLabel}>{opponentUsername || 'Opp'}</Text>
                <Text style={[styles.scoreValue, { color: colors.opponent }]}>{opponentScore}</Text>
              </View>
            </View>
          </View>
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

      {/* Waiting State */}
      {gamePhase === 'waiting' && (
        <View style={styles.waitingContainer}>
          <ActivityIndicator size="large" color={sportColor} style={styles.waitingSpinner} />
          <Text style={styles.waitingText}>Waiting for opponent...</Text>
          <Text style={styles.waitingSubtext}>Game starts when both players are ready</Text>

          {/* How it works card */}
          <View style={styles.howItWorksCard}>
            <Text style={styles.howItWorksTitle}>How it works</Text>
            <Text style={styles.howItWorksText}>
              • Both players answer the same trivia question{'\n'}
              • You have 15 seconds to answer{'\n'}
              • Correct answer + fastest time wins{'\n'}
              • Winner earns 75 XP, loser earns 25 XP
            </Text>
          </View>

          {/* Cancel button */}
          <TouchableOpacity style={styles.cancelButton} onPress={onBack}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Question */}
      {gamePhase !== 'waiting' && question && (
        <View style={styles.questionContainer}>
          <View style={[styles.difficultyBadge, { backgroundColor: `${sportColor}30` }]}>
            <Text style={[styles.difficultyText, { color: sportColor }]}>
              {question.difficulty.toUpperCase()}
            </Text>
          </View>
          <Text style={styles.questionText}>{question.question}</Text>
        </View>
      )}

      {/* Answer Options */}
      {gamePhase !== 'waiting' && question && (
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
                onPress={() => handleSelectAnswer(option, index)}
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
      {gamePhase === 'roundResult' && question && (
        <View style={styles.roundResultOverlay}>
          <View style={styles.roundResultCard}>
            <Text style={styles.roundResultEmoji}>
              {roundWon === true ? '✓' : roundWon === false ? '✗' : '−'}
            </Text>
            <Text style={[
              styles.roundResultText,
              roundWon === true && styles.roundResultWin,
              roundWon === false && styles.roundResultLose,
              roundWon === null && styles.roundResultTie,
            ]}>
              {roundWon === true ? 'Correct!' : roundWon === false ? 'Wrong!' : 'Tie!'}
            </Text>
            <Text style={styles.roundResultAnswer}>
              Answer: {question.correctAnswer}
            </Text>
            {currentRound < totalQuestions ? (
              <Text style={styles.roundResultNext}>Next question...</Text>
            ) : (
              <Text style={styles.roundResultNext}>Final results...</Text>
            )}
          </View>
        </View>
      )}

      {/* Results Modal */}
      {showResultModal && question && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Header Icon */}
            {result.tie ? (
              <Image source={handshakeIcon} style={styles.resultIcon} resizeMode="contain" />
            ) : result.won ? (
              <Image source={trophyIcon} style={styles.resultIcon} resizeMode="contain" />
            ) : (
              <Image source={thumbsDownIcon} style={styles.resultIcon} resizeMode="contain" />
            )}

            <Text style={[
              styles.modalTitle,
              result.won && styles.modalTitleWin,
              !result.won && !result.tie && styles.modalTitleLose,
              result.tie && styles.modalTitleTie,
            ]}>
              {result.tie ? "It's a Tie!" : result.won ? 'You Win!' : 'You Lose!'}
            </Text>
            <Text style={styles.modalSubtitle}>{result.subtitle}</Text>

            {/* Final Score Display for multi-question duels */}
            {isMultiQuestion && (
              <View style={styles.finalScoreContainer}>
                <View style={styles.finalScoreItem}>
                  <Text style={styles.finalScoreLabel}>You</Text>
                  <Text style={[styles.finalScoreValue, { color: sportColor }]}>{result.finalScore.me}</Text>
                </View>
                <Text style={styles.finalScoreDivider}>-</Text>
                <View style={styles.finalScoreItem}>
                  <Text style={styles.finalScoreLabel}>{opponentUsername || 'Opp'}</Text>
                  <Text style={[styles.finalScoreValue, { color: colors.opponent }]}>{result.finalScore.opp}</Text>
                </View>
              </View>
            )}

            {/* XP Earned */}
            <View style={styles.xpBadgeYellow}>
              <Text style={styles.xpBadgeTextBlack}>
                +{result.xpEarned} XP
              </Text>
            </View>

            {/* Question (only show for single-question duels) */}
            {!isMultiQuestion && (
              <>
                {/* Question & Answer Card */}
                <View style={styles.questionAnswerCard}>
                  <Text style={styles.questionSummaryText}>{question.question}</Text>
                  <View style={styles.correctAnswerRow}>
                    <Text style={styles.correctAnswerLabel}>Correct Answer:</Text>
                    <Text style={styles.correctAnswerValue}>{question.correctAnswer}</Text>
                  </View>
                </View>

                {/* Players' Answers Comparison - Two Cards */}
                <View style={styles.playersComparisonContainer}>
                  {/* You Card */}
                  <View style={[styles.playerCard, { marginRight: 24 }]}>
                    <Text style={styles.playerCardLabel}>YOU</Text>
                    <View style={styles.playerCardAnswerContainer}>
                      <Text
                        style={[
                          styles.playerCardAnswer,
                          (isPlayer1 ? duel.player1_answer : duel.player2_answer) === question.correctAnswer
                            ? styles.correctAnswerText
                            : styles.wrongAnswerText
                        ]}
                        numberOfLines={2}
                        ellipsizeMode="tail"
                      >
                        {(isPlayer1 ? duel.player1_answer : duel.player2_answer) || 'Timed out'}
                      </Text>
                    </View>
                    <Text style={styles.playerCardTime}>
                      {(isPlayer1 ? duel.player1_answer_time : duel.player2_answer_time)
                        ? `${((isPlayer1 ? duel.player1_answer_time : duel.player2_answer_time)! / 1000).toFixed(2)}s`
                        : '--'}
                    </Text>
                  </View>

                  {/* VS Badge - Centered */}
                  <View style={styles.vsBadge}>
                    <Text style={styles.vsBadgeText}>VS</Text>
                  </View>

                  {/* Opponent Card */}
                  <View style={[styles.playerCard, { marginLeft: 24 }]}>
                    <Text style={styles.playerCardLabel}>{opponentUsername?.toUpperCase() || 'OPPONENT'}</Text>
                    <View style={styles.playerCardAnswerContainer}>
                      <Text
                        style={[
                          styles.playerCardAnswer,
                          (isPlayer1 ? duel.player2_answer : duel.player1_answer) === question.correctAnswer
                            ? styles.correctAnswerText
                            : styles.wrongAnswerText
                        ]}
                        numberOfLines={2}
                        ellipsizeMode="tail"
                      >
                        {(isPlayer1 ? duel.player2_answer : duel.player1_answer) || 'Timed out'}
                      </Text>
                    </View>
                    <Text style={styles.playerCardTime}>
                      {(isPlayer1 ? duel.player2_answer_time : duel.player1_answer_time)
                        ? `${((isPlayer1 ? duel.player2_answer_time : duel.player1_answer_time)! / 1000).toFixed(2)}s`
                        : '--'}
                    </Text>
                  </View>
                </View>
              </>
            )}

            {showFriendPrompt && (
              <TouchableOpacity style={styles.addFriendButton} onPress={handleAddFriend}>
                <Text style={styles.addFriendButtonText}>
                  Add {opponentUsername || 'Opponent'} as Friend
                </Text>
              </TouchableOpacity>
            )}
            {friendAdded && (
              <Text style={styles.friendAddedText}>Friend added!</Text>
            )}

            <View style={styles.modalButtonsRow}>
              <TouchableOpacity
                style={styles.playAgainButton}
                onPress={() => {
                  setShowResultModal(false);
                  onPlayAgain(duel.sport);
                }}
              >
                <Text style={styles.playAgainButtonText}>Play Again</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.homeButton}
                onPress={() => {
                  setShowResultModal(false);
                  onBack();
                }}
              >
                <Text style={styles.homeButtonText}>Home</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
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
    paddingHorizontal: 24,
    marginBottom: 16,
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
    paddingTop: 48,
  },
  waitingSpinner: {
    marginBottom: 24,
  },
  waitingText: {
    fontSize: 20,
    fontFamily: 'DMSans_900Black',
    color: colors.textDark,
    marginBottom: 8,
  },
  waitingSubtext: {
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: 32,
  },
  howItWorksCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#000000',
    padding: 20,
    width: '100%',
    marginBottom: 24,
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  howItWorksTitle: {
    fontSize: 14,
    fontFamily: 'DMSans_900Black',
    color: colors.textDark,
    marginBottom: 12,
  },
  howItWorksText: {
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
    color: colors.textDark,
    lineHeight: 22,
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
    marginHorizontal: 24,
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
    paddingHorizontal: 24,
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
    padding: 24,
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
  // Multi-question duel styles
  roundScoreContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    paddingHorizontal: 8,
  },
  roundIndicator: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#000000',
  },
  roundText: {
    fontSize: 12,
    fontFamily: 'DMSans_700Bold',
    color: colors.textDark,
  },
  scoreDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#000000',
  },
  scoreItem: {
    alignItems: 'center',
  },
  scoreLabel: {
    fontSize: 10,
    fontFamily: 'DMSans_500Medium',
    color: colors.textMuted,
  },
  scoreValue: {
    fontSize: 20,
    fontFamily: 'DMSans_900Black',
  },
  scoreDivider: {
    fontSize: 20,
    fontFamily: 'DMSans_900Black',
    color: colors.textMuted,
    marginHorizontal: 12,
  },
  // Round result overlay
  roundResultOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  roundResultCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#000000',
    padding: 32,
    alignItems: 'center',
    width: '80%',
    maxWidth: 280,
    shadowColor: '#000000',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  roundResultEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  roundResultText: {
    fontSize: 24,
    fontFamily: 'DMSans_900Black',
    marginBottom: 8,
  },
  roundResultWin: {
    color: colors.correct,
  },
  roundResultLose: {
    color: colors.wrong,
  },
  roundResultTie: {
    color: colors.textMuted,
  },
  roundResultAnswer: {
    fontSize: 14,
    fontFamily: 'DMSans_500Medium',
    color: colors.textDark,
    textAlign: 'center',
    marginBottom: 16,
  },
  roundResultNext: {
    fontSize: 12,
    fontFamily: 'DMSans_400Regular',
    color: colors.textMuted,
    fontStyle: 'italic',
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
});
