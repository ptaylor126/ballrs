import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Share,
  Alert,
  Image,
  Easing,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ConfettiCannon from 'react-native-confetti-cannon';
import { colors, shadows, getSportColor, Sport, borders, borderRadius } from '../lib/theme';
import { AnimatedButton } from '../components/AnimatedComponents';
import { useAuth } from '../contexts/AuthContext';
import { awardXP, calculateLevel, XPAwardResult } from '../lib/xpService';
import XPEarnedModal from '../components/XPEarnedModal';
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

interface CluePlayer {
  id: number;
  name: string;
  team: string;
  position: string;
  clues: string[];
}

interface AutocompletePlayer {
  id: number;
  name: string;
  team: string;
}

interface Props {
  sport: Sport;
  onBack: () => void;
}

const getStorageKey = (sport: string) => `ballrs_clue_puzzle_state_${sport}`;
const getStreakKey = (sport: string) => `ballrs_clue_puzzle_streak_${sport}`;

interface GameState {
  date: string;
  mysteryPlayerId: number;
  currentClueIndex: number;
  wrongGuesses: number;
  solved: boolean;
  pointsEarned: number;
}

interface StreakState {
  currentStreak: number;
  lastPlayedDate: string;
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

function getSportNameLocal(sport: Sport): string {
  switch (sport) {
    case 'nba': return 'NBA';
    case 'pl': return 'Premier League';
    case 'nfl': return 'NFL';
    case 'mlb': return 'MLB';
  }
}

export default function CluePuzzleScreen({ sport, onBack }: Props) {
  const { user } = useAuth();
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
  const [pointsEarned, setPointsEarned] = useState(0);
  const [showWrongMessage, setShowWrongMessage] = useState(false);
  const [showNotInPuzzleMessage, setShowNotInPuzzleMessage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [streak, setStreak] = useState(0);
  const [shakeAnim] = useState(new Animated.Value(0));
  const [celebrateAnim] = useState(new Animated.Value(0));
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // XP and confetti state
  const [showXPModal, setShowXPModal] = useState(false);
  const [xpResult, setXpResult] = useState<XPAwardResult | null>(null);
  const [xpEarned, setXpEarned] = useState(0);
  const [showConfetti, setShowConfetti] = useState(false);
  const confettiRef = useRef<any>(null);

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

  const potentialPoints = Math.max(0, 6 - currentClueIndex);
  const revealedClues = mysteryPlayer?.clues.slice(0, currentClueIndex + 1) || [];
  const isLastClue = currentClueIndex >= 5;
  const gameOver = solved || (isLastClue && wrongGuesses > 0 && !solved);

  useEffect(() => {
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
          setPointsEarned(state.pointsEarned);
        }
      }

      const streakStored = await AsyncStorage.getItem(getStreakKey(sport));
      if (streakStored) {
        const streakState: StreakState = JSON.parse(streakStored);
        setStreak(streakState.currentStreak);
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
    updateStreak: boolean = false
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
    if (!mysteryPlayer || solved) return;

    // Check if player is in the mystery pool (clue players)
    const isInMysteryPool = players.some(p =>
      p.name.toLowerCase() === selectedPlayer.name.toLowerCase()
    );

    // Check if the selected player matches the mystery player
    const isCorrect = mysteryPlayer.name.toLowerCase() === selectedPlayer.name.toLowerCase();

    if (isCorrect) {
      const points = potentialPoints;
      setSolved(true);
      setPointsEarned(points);
      setGuess('');
      setShowSuggestions(false);
      triggerCelebration();
      saveGameState(currentClueIndex, wrongGuesses, true, points, true);

      // Show confetti
      setShowConfetti(true);

      // Award XP (points earned = XP earned in clue puzzle)
      if (user) {
        const xpAmount = points * 10; // 10 XP per point earned
        setXpEarned(xpAmount);
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
      }
    } else if (!isInMysteryPool) {
      // Player is not in the mystery pool - show "not in puzzle" message
      setShowNotInPuzzleMessage(true);
      setGuess('');
      setShowSuggestions(false);
      triggerShake();
      setTimeout(() => setShowNotInPuzzleMessage(false), 2000);
    } else {
      // Player is in mystery pool but wrong
      const newWrongGuesses = wrongGuesses + 1;
      setWrongGuesses(newWrongGuesses);
      setShowWrongMessage(true);
      setGuess('');
      setShowSuggestions(false);
      triggerShake();
      saveGameState(currentClueIndex, newWrongGuesses, false, 0);

      setTimeout(() => setShowWrongMessage(false), 2000);
    }
  }

  function handleNextClue() {
    if (currentClueIndex < 5 && !solved) {
      const newIndex = currentClueIndex + 1;
      setCurrentClueIndex(newIndex);
      setShowWrongMessage(false);
      saveGameState(newIndex, wrongGuesses, false, 0);
    }
  }

  function handleGiveUp() {
    setSolved(false);
    setPointsEarned(0);
    setCurrentClueIndex(5);
    saveGameState(5, wrongGuesses, false, 0);
  }

  async function handleReset() {
    await AsyncStorage.removeItem(getStorageKey(sport));
    const player = getDailyPlayer(players, sport);
    setMysteryPlayer(player);
    setCurrentClueIndex(0);
    setWrongGuesses(0);
    setSolved(false);
    setPointsEarned(0);
    setGuess('');
    setShowWrongMessage(false);
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

    return `Ballrs ${sportName}
${squares}
${clueText}
${pointsEarned > 0 ? `+${pointsEarned} points\n` : ''}Streak: ${streak}`;
  }

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

  const showAnswer = isLastClue && !solved;

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
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
              <Text style={styles.sportBadgeText}>{sport.toUpperCase()}</Text>
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

          {/* Success Message */}
          {solved && (
            <Animated.View
              style={[
                styles.successContainer,
                shadows.card,
                { transform: [{ scale: celebrateAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1, 1.02],
                }) }] }
              ]}
            >
              <Text style={styles.successText}>Correct!</Text>
              <Text style={styles.successPlayer}>{mysteryPlayer.name}</Text>
              <View style={styles.successPointsBadge}>
                <Text style={styles.successPoints}>+{pointsEarned} points</Text>
              </View>
              <Text style={styles.successStats}>
                Solved on clue {currentClueIndex + 1} with {wrongGuesses} wrong {wrongGuesses === 1 ? 'guess' : 'guesses'}
              </Text>
              <Text style={styles.streakText}>Streak: {streak}</Text>
              <AnimatedButton style={styles.shareButton} onPress={handleShare}>
                <Text style={styles.shareButtonText}>Share Result</Text>
              </AnimatedButton>
            </Animated.View>
          )}

          {/* Game Over - Reveal Answer */}
          {showAnswer && (
            <View style={[styles.revealContainer, shadows.card]}>
              <Text style={styles.revealText}>The answer was:</Text>
              <Text style={styles.revealPlayer}>{mysteryPlayer.name}</Text>
              <Text style={styles.revealInfo}>
                {mysteryPlayer.team} • {mysteryPlayer.position}
              </Text>
              <AnimatedButton style={styles.shareButtonFailed} onPress={handleShare}>
                <Text style={styles.shareButtonFailedText}>Share Result</Text>
              </AnimatedButton>
            </View>
          )}

          {/* Wrong Message */}
          {showWrongMessage && (
            <Animated.View
              style={[
                styles.wrongMessage,
                { transform: [{ translateX: shakeAnim }] }
              ]}
            >
              <Text style={styles.wrongText}>Wrong! Try again</Text>
            </Animated.View>
          )}

          {/* Not In Puzzle Message */}
          {showNotInPuzzleMessage && (
            <Animated.View
              style={[
                styles.notInPuzzleMessage,
                { transform: [{ translateX: shakeAnim }] }
              ]}
            >
              <Text style={styles.notInPuzzleText}>Not in today's puzzle</Text>
            </Animated.View>
          )}

          {/* Clues Stack */}
          <View style={styles.cluesContainer}>
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
            <View style={styles.inputWrapper}>
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
              <TextInput
                style={styles.input}
                value={guess}
                onChangeText={(text) => {
                  setGuess(text);
                  setShowSuggestions(text.trim().length > 0);
                }}
                placeholder="Type player name..."
                placeholderTextColor="#888888"
                autoCapitalize="words"
                autoCorrect={false}
              />
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

          {/* Play Again */}
          {(solved || showAnswer) && (
            <View style={styles.gameOverActions}>
              <TouchableOpacity
                style={styles.playAgainButton}
                onPress={handleReset}
              >
                <Text style={styles.playAgainButtonText}>Play Again (Dev)</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Confetti */}
      {showConfetti && (
        <ConfettiCannon
          ref={confettiRef}
          count={200}
          origin={{ x: -10, y: 0 }}
          autoStart={true}
          fadeOut={true}
          fallSpeed={3000}
          explosionSpeed={350}
          colors={[sportColor, '#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4']}
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
          onClose={() => setShowXPModal(false)}
          sportColor={sportColor}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingTop: 12,
    paddingBottom: 32,
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
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#000000',
    borderRadius: 8,
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
    gap: 6,
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
    fontSize: 12,
    fontFamily: 'DMSans_900Black',
    color: '#FFFFFF',
    letterSpacing: 0.5,
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
  successContainer: {
    backgroundColor: colors.success,
    borderRadius: borderRadius.card,
    borderWidth: borders.card,
    borderColor: colors.border,
    padding: 28,
    alignItems: 'center',
    marginBottom: 24,
    ...shadows.card,
  },
  successText: {
    fontSize: 24,
    fontFamily: 'DMSans_900Black',
    color: colors.surface,
  },
  successPlayer: {
    fontSize: 20,
    fontFamily: 'DMSans_700Bold',
    color: colors.surface,
    marginTop: 8,
  },
  successPointsBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: borderRadius.button,
    marginTop: 16,
  },
  successPoints: {
    fontSize: 16,
    fontFamily: 'DMSans_700Bold',
    color: colors.surface,
  },
  successStats: {
    fontSize: 13,
    color: colors.surface,
    opacity: 0.9,
    marginTop: 12,
    fontFamily: 'DMSans_400Regular',
  },
  streakText: {
    fontSize: 16,
    fontFamily: 'DMSans_700Bold',
    color: colors.surface,
    marginTop: 12,
  },
  shareButton: {
    backgroundColor: colors.surface,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: borderRadius.button,
    borderWidth: borders.button,
    borderColor: colors.border,
    marginTop: 20,
  },
  shareButtonText: {
    color: colors.text,
    fontSize: 12,
    fontFamily: 'DMSans_900Black',
  },
  revealContainer: {
    backgroundColor: colors.error,
    borderRadius: borderRadius.card,
    borderWidth: borders.card,
    borderColor: colors.border,
    padding: 28,
    alignItems: 'center',
    marginBottom: 24,
    ...shadows.card,
  },
  revealText: {
    fontSize: 14,
    color: colors.surface,
    fontFamily: 'DMSans_400Regular',
  },
  revealPlayer: {
    fontSize: 24,
    fontFamily: 'DMSans_900Black',
    color: colors.surface,
    marginTop: 8,
  },
  revealInfo: {
    fontSize: 14,
    color: colors.surface,
    opacity: 0.9,
    marginTop: 6,
    fontFamily: 'DMSans_400Regular',
  },
  shareButtonFailed: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: borderRadius.button,
    borderWidth: borders.button,
    borderColor: 'rgba(255,255,255,0.3)',
    marginTop: 20,
  },
  shareButtonFailedText: {
    color: colors.surface,
    fontSize: 12,
    fontFamily: 'DMSans_900Black',
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
  input: {
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
  suggestionsContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#000000',
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
    paddingVertical: 14,
    alignItems: 'center',
  },
  giveUpButtonText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontFamily: 'DMSans_500Medium',
  },
  gameOverActions: {
    alignItems: 'center',
    marginTop: 8,
  },
  playAgainButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderWidth: 2,
    borderColor: '#000000',
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  playAgainButtonText: {
    color: '#1A1A1A',
    fontSize: 14,
    fontFamily: 'DMSans_900Black',
  },
});
