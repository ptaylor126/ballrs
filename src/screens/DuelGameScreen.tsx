import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Animated,
  Easing,
  Image,
  ActivityIndicator,
} from 'react-native';
import { getSportColor, Sport } from '../lib/theme';

// Sport icons
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
import { useAuth } from '../contexts/AuthContext';
import {
  Duel,
  TriviaQuestion,
  subscribeToDuel,
  unsubscribeFromDuel,
  submitTriviaAnswer,
  completeDuel,
  determineWinner,
  setRoundStartTime,
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

export default function DuelGameScreen({ duel: initialDuel, onBack, onComplete }: Props) {
  const { user } = useAuth();
  const [duel, setDuel] = useState<Duel>(initialDuel);
  const [question, setQuestion] = useState<TriviaQuestion | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [opponentAnswered, setOpponentAnswered] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(TIMER_DURATION);
  const [gamePhase, setGamePhase] = useState<'waiting' | 'playing' | 'results'>('waiting');
  const [showResultModal, setShowResultModal] = useState(false);
  const [roundStartTime, setRoundStartTimeState] = useState<number | null>(null);

  const [alreadyFriends, setAlreadyFriends] = useState(false);
  const [friendAdded, setFriendAdded] = useState(false);
  const [opponentUsername, setOpponentUsername] = useState<string | null>(null);
  const [showLevelUpModal, setShowLevelUpModal] = useState(false);
  const [newLevel, setNewLevel] = useState(1);
  const [xpAwarded, setXpAwarded] = useState(false);
  const [pendingAchievements, setPendingAchievements] = useState<Achievement[]>([]);
  const [currentAchievement, setCurrentAchievement] = useState<Achievement | null>(null);
  const [showAchievementToast, setShowAchievementToast] = useState(false);

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

  const isPlayer1 = user?.id === duel.player1_id;
  const opponentId = isPlayer1 ? duel.player2_id : duel.player1_id;
  const sportColor = getSportColor(duel.sport as Sport);
  const isFriendDuel = !!initialDuel.invite_code;

  // Find the trivia question
  useEffect(() => {
    const questions = getTriviaQuestions(duel.sport);
    const q = questions.find(q => q.id === duel.mystery_player_id);
    if (q) {
      setQuestion(q);
    }
  }, [duel.mystery_player_id, duel.sport]);

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

  // Subscribe to duel updates
  useEffect(() => {
    channelRef.current = subscribeToDuel(duel.id, (updatedDuel) => {
      setDuel(updatedDuel);

      // Check if round started
      if (updatedDuel.round_start_time && gamePhase === 'waiting') {
        const startTime = new Date(updatedDuel.round_start_time).getTime();
        setRoundStartTimeState(startTime);
        setGamePhase('playing');
      }

      // Check if opponent has answered
      const opponentAnswer = isPlayer1 ? updatedDuel.player2_answer : updatedDuel.player1_answer;
      if (opponentAnswer !== null) {
        setOpponentAnswered(true);
      }

      // Check if both have answered or game is completed
      const myAnswer = isPlayer1 ? updatedDuel.player1_answer : updatedDuel.player2_answer;
      if (updatedDuel.status === 'completed' || (myAnswer !== null && opponentAnswer !== null)) {
        setGamePhase('results');
        setShowResultModal(true);
      }
    });

    return () => {
      if (channelRef.current) {
        unsubscribeFromDuel(channelRef.current);
      }
    };
  }, [duel.id, isPlayer1, gamePhase]);

  // Timer countdown
  useEffect(() => {
    if (gamePhase !== 'playing' || !roundStartTime) return;

    const updateTimer = () => {
      const elapsed = (Date.now() - roundStartTime) / 1000;
      const remaining = Math.max(0, TIMER_DURATION - elapsed);
      setTimeRemaining(remaining);

      // Animate timer bar
      timerAnim.setValue(remaining / TIMER_DURATION);

      if (remaining <= 0 && !hasAnswered) {
        // Time's up - submit null answer
        handleTimeUp();
      }
    };

    updateTimer();
    timerRef.current = setInterval(updateTimer, 100);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [gamePhase, roundStartTime, hasAnswered]);

  const handleTimeUp = useCallback(async () => {
    if (hasAnswered) return;

    setHasAnswered(true);
    // Submit with empty answer (timed out)
    await submitTriviaAnswer(duel.id, isPlayer1, '', TIMER_DURATION * 1000);

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
      await completeDuel(duel.id, winnerId || '');
    }
  }, [duel.id, question]);

  const handleSelectAnswer = async (answer: string, index: number) => {
    if (hasAnswered || gamePhase !== 'playing' || !roundStartTime) return;

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

      const { winnerId } = determineWinner(duel, question.correctAnswer);
      const won = winnerId === user.id;
      const tie = winnerId === null;

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
  }, [gamePhase, user, xpAwarded, question, duel, isPlayer1]);

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

  // Determine result
  const getResult = () => {
    if (!question) return { won: false, tie: false, subtitle: '', xpEarned: 0 };

    const { winnerId, reason } = determineWinner(duel, question.correctAnswer);
    const won = winnerId === user?.id;
    const tie = winnerId === null;

    const myAnswer = isPlayer1 ? duel.player1_answer : duel.player2_answer;
    const opponentAnswer = isPlayer1 ? duel.player2_answer : duel.player1_answer;
    const myTime = isPlayer1 ? duel.player1_answer_time : duel.player2_answer_time;
    const opponentTime = isPlayer1 ? duel.player2_answer_time : duel.player1_answer_time;

    const iCorrect = myAnswer === question.correctAnswer;
    const oCorrect = opponentAnswer === question.correctAnswer;
    const iTimedOut = myAnswer === '' || myAnswer === null;
    const oTimedOut = opponentAnswer === '' || opponentAnswer === null;

    // Calculate XP earned
    const xpResult: 'win' | 'loss' | 'tie' = tie ? 'tie' : won ? 'win' : 'loss';
    const xpEarned = calculateDuelXP(xpResult);

    let subtitle = '';
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
      }
    } else {
      if (oCorrect && iTimedOut) {
        subtitle = 'You timed out';
      } else if (!iCorrect && oCorrect) {
        subtitle = 'Opponent answered correctly';
      } else if (iCorrect && oCorrect) {
        const timeDiff = ((myTime || 0) - (opponentTime || 0)) / 1000;
        subtitle = `Opponent was ${timeDiff.toFixed(2)}s faster`;
      }
    }

    return { won, tie, subtitle, xpEarned };
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
        </View>
        <Text style={styles.title}>Trivia Duel</Text>
        <View style={styles.sportBadgeContainer}>
          <View style={[styles.sportBadge, { backgroundColor: sportColor }]}>
            <Image source={sportIcons[duel.sport as Sport]} style={styles.sportIcon} />
            <Text style={styles.sportBadgeText}>{sportNames[duel.sport as Sport]}</Text>
          </View>
        </View>
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

      {/* Results Modal */}
      {showResultModal && question && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalEmoji}>
              {result.tie ? '🤝' : result.won ? '🎉' : '😔'}
            </Text>
            <Text style={[
              styles.modalTitle,
              result.won && styles.modalTitleWin,
              !result.won && !result.tie && styles.modalTitleLose,
              result.tie && styles.modalTitleTie,
            ]}>
              {result.tie ? "It's a Tie!" : result.won ? 'You Win!' : 'You Lose!'}
            </Text>
            <Text style={styles.modalSubtitle}>{result.subtitle}</Text>

            {/* XP Earned */}
            <View style={[styles.xpBadge, { backgroundColor: `${sportColor}30` }]}>
              <Text style={[styles.xpBadgeText, { color: sportColor }]}>
                +{result.xpEarned} XP
              </Text>
            </View>

            {/* Question */}
            <View style={styles.questionSummary}>
              <Text style={styles.questionSummaryText}>{question.question}</Text>
            </View>

            {/* Correct Answer */}
            <View style={styles.answerContainer}>
              <Text style={styles.answerLabel}>Correct Answer:</Text>
              <Text style={styles.answerText}>{question.correctAnswer}</Text>
            </View>

            {/* Players' Answers Comparison */}
            <View style={styles.answersComparison}>
              <View style={styles.answerColumn}>
                <Text style={styles.answerColumnLabel}>You</Text>
                <Text style={[
                  styles.answerColumnValue,
                  (isPlayer1 ? duel.player1_answer : duel.player2_answer) === question.correctAnswer
                    ? styles.correctAnswerText
                    : styles.wrongAnswerText
                ]}>
                  {(isPlayer1 ? duel.player1_answer : duel.player2_answer) || 'Timed out'}
                </Text>
                {(isPlayer1 ? duel.player1_answer_time : duel.player2_answer_time) ? (
                  <Text style={styles.answerTime}>
                    {((isPlayer1 ? duel.player1_answer_time : duel.player2_answer_time)! / 1000).toFixed(2)}s
                  </Text>
                ) : (
                  <Text style={styles.answerTime}>--</Text>
                )}
              </View>
              <View style={styles.vsContainer}>
                <Text style={styles.vsText}>VS</Text>
              </View>
              <View style={styles.answerColumn}>
                <Text style={styles.answerColumnLabel}>{opponentUsername || 'Opponent'}</Text>
                <Text style={[
                  styles.answerColumnValue,
                  (isPlayer1 ? duel.player2_answer : duel.player1_answer) === question.correctAnswer
                    ? styles.correctAnswerText
                    : styles.wrongAnswerText
                ]}>
                  {(isPlayer1 ? duel.player2_answer : duel.player1_answer) || 'Timed out'}
                </Text>
                {(isPlayer1 ? duel.player2_answer_time : duel.player1_answer_time) ? (
                  <Text style={styles.answerTime}>
                    {((isPlayer1 ? duel.player2_answer_time : duel.player1_answer_time)! / 1000).toFixed(2)}s
                  </Text>
                ) : (
                  <Text style={styles.answerTime}>--</Text>
                )}
              </View>
            </View>

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
                style={[styles.modalButton, { backgroundColor: sportColor }]}
                onPress={() => {
                  setShowResultModal(false);
                  onComplete(result.won);
                }}
              >
                <Text style={styles.modalButtonText}>Play Again</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalButtonSecondary}
                onPress={() => {
                  setShowResultModal(false);
                  onBack();
                }}
              >
                <Text style={styles.modalButtonSecondaryText}>Home</Text>
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
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
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
    fontSize: 14,
    fontFamily: 'DMSans_900Black',
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
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
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
    tintColor: '#FFFFFF',
    marginRight: 8,
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
    backgroundColor: '#FFFFFF',
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
    fontSize: 14,
    fontFamily: 'DMSans_900Black',
    color: colors.textDark,
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
    gap: 12,
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
});
