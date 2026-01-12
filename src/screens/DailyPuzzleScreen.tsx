import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Share,
  Image,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import * as Clipboard from 'expo-clipboard';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Player,
  PlayersData,
  DailyGameState,
  StatsData,
} from '../types';
import { useAuth } from '../contexts/AuthContext';
import {
  fetchUserStats,
  updateStatsAfterWin,
  updateStatsAfterLoss,
  UserStats,
} from '../lib/statsService';
import { awardLeaguePoints } from '../lib/leaguesService';
import { soundService } from '../lib/soundService';
import { calculatePuzzleXP, awardXP, XPAwardResult } from '../lib/xpService';
import { awardPuzzlePoints } from '../lib/pointsService';
import { checkPuzzleAchievements, Achievement } from '../lib/achievementsService';
import LevelUpModal from '../components/LevelUpModal';
import XPEarnedModal from '../components/XPEarnedModal';
import AchievementToast from '../components/AchievementToast';
import playersData from '../../data/nba-players.json';

// Sport icons
const basketballIcon = require('../../assets/images/icon-basketball.png');

interface Props {
  onBack: () => void;
}

// Neubrutalist colors
const colors = {
  background: '#F5F2EB',
  surface: '#FFFFFF',
  text: '#1A1A1A',
  textSecondary: '#666666',
  border: '#000000',
  correct: '#3BA978',
  wrong: '#E53935',
  nba: '#E07A3D',
};

const MAX_GUESSES = 6;
const MAX_CLUES = 6;
const STORAGE_KEY = 'ballrs_nba_daily_game';
const STATS_KEY = 'ballrs_nba_stats';

const defaultStats: StatsData = {
  currentStreak: 0,
  bestStreak: 0,
  gamesPlayed: 0,
  gamesWon: 0,
  lastPlayedDate: '',
};

const STREAK_KEY = 'ballrs_nba_daily_streak';

interface StreakState {
  currentStreak: number;
  lastPlayedDate: string;
}

// Helper to calculate daily streak (only increments once per day)
async function calculateDailyStreak(): Promise<number> {
  const today = getTodayString();
  const streakStored = await AsyncStorage.getItem(STREAK_KEY);
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

  // Save the new streak state
  const newStreakState: StreakState = { currentStreak: newStreak, lastPlayedDate: today };
  await AsyncStorage.setItem(STREAK_KEY, JSON.stringify(newStreakState));

  return newStreak;
}

// Position groups for partial matching
const positionGroups: Record<string, string> = {
  PG: 'Guard',
  SG: 'Guard',
  SF: 'Forward',
  PF: 'Forward',
  C: 'Center',
};

function getTodayString(): string {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
}

function getYesterdayString(): string {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
}

function getDailyPlayer(players: Player[]): Player {
  const dateString = getTodayString();
  let hash = 0;
  for (let i = 0; i < dateString.length; i++) {
    const char = dateString.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  const index = Math.abs(hash) % players.length;
  return players[index];
}

function formatHeight(inches: number): string {
  const feet = Math.floor(inches / 12);
  const remainingInches = inches % 12;
  return `${feet}'${remainingInches}"`;
}

// Generate clues for a player
function generateClues(player: Player): string[] {
  return [
    `Plays for the ${player.team}`,
    `Plays in the ${player.conference}ern Conference`,
    `Position: ${positionGroups[player.position] || player.position}`,
    `Age: ${player.age} years old`,
    `Wears jersey number ${player.jerseyNumber}`,
    `Height: ${formatHeight(player.height)}`,
  ];
}

// Calculate points based on clues used
function calculatePoints(cluesUsed: number): number {
  return Math.max(1, MAX_CLUES - cluesUsed + 1);
}

export default function DailyPuzzleScreen({ onBack }: Props) {
  const { user } = useAuth();
  const [players] = useState<Player[]>((playersData as PlayersData).players);
  const [dailyPlayer, setDailyPlayer] = useState<Player | null>(null);
  const [clues, setClues] = useState<string[]>([]);
  const [revealedClues, setRevealedClues] = useState(1);
  const [guess, setGuess] = useState('');
  const [wrongGuesses, setWrongGuesses] = useState(0);
  const [solved, setSolved] = useState(false);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [stats, setStats] = useState<StatsData>(defaultStats);
  const [cloudStats, setCloudStats] = useState<UserStats | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showCopiedMessage, setShowCopiedMessage] = useState(false);
  const [showLevelUpModal, setShowLevelUpModal] = useState(false);
  const [newLevel, setNewLevel] = useState(1);
  const [showXPModal, setShowXPModal] = useState(false);
  const [xpResult, setXPResult] = useState<XPAwardResult | null>(null);
  const [xpEarned, setXPEarned] = useState(0);
  const [pendingAchievements, setPendingAchievements] = useState<Achievement[]>([]);
  const [currentAchievement, setCurrentAchievement] = useState<Achievement | null>(null);
  const [showAchievementToast, setShowAchievementToast] = useState(false);
  const [wrongGuessMessage, setWrongGuessMessage] = useState('');
  const toastAnim = useRef(new Animated.Value(100)).current;

  const filteredPlayers = guess.trim().length > 0
    ? players
        .filter(p =>
          p.name.toLowerCase().includes(guess.toLowerCase())
        )
        .slice(0, 5)
    : [];

  useEffect(() => {
    loadGameState();
  }, []);

  // Load cloud stats when user logs in
  useEffect(() => {
    if (user) {
      loadCloudStats();
    } else {
      setCloudStats(null);
    }
  }, [user]);

  async function loadCloudStats() {
    if (!user) return;
    const stats = await fetchUserStats(user.id);
    if (stats) {
      setCloudStats(stats);
    }
  }

  async function loadGameState() {
    try {
      const player = getDailyPlayer(players);
      setDailyPlayer(player);
      setClues(generateClues(player));

      // Load local stats
      const storedStats = await AsyncStorage.getItem(STATS_KEY);
      if (storedStats) {
        const loadedStats: StatsData = JSON.parse(storedStats);
        const today = getTodayString();
        const yesterday = getYesterdayString();
        if (loadedStats.lastPlayedDate &&
            loadedStats.lastPlayedDate !== today &&
            loadedStats.lastPlayedDate !== yesterday) {
          loadedStats.currentStreak = 0;
        }
        setStats(loadedStats);
      }

      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const state: DailyGameState = JSON.parse(stored);
        const today = getTodayString();

        if (state.date === today) {
          setRevealedClues(state.revealedClues || 1);
          setWrongGuesses(state.wrongGuesses || 0);
          setSolved(state.solved);
          setFailed(state.failed || false);
        }
      }
    } catch (error) {
      console.error('Error loading game state:', error);
    } finally {
      setLoading(false);
    }
  }

  async function saveGameState(newRevealedClues: number, newWrongGuesses: number, newSolved: boolean, newFailed: boolean) {
    try {
      const state = {
        date: getTodayString(),
        revealedClues: newRevealedClues,
        wrongGuesses: newWrongGuesses,
        solved: newSolved,
        failed: newFailed,
        guessedPlayerIds: [], // Legacy field
      };
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.error('Error saving game state:', error);
    }
  }

  async function updateStats(won: boolean) {
    const today = getTodayString();
    const yesterday = getYesterdayString();

    if (stats.lastPlayedDate === today) return;

    // Update local stats
    const newStats = { ...stats };
    newStats.gamesPlayed += 1;
    newStats.lastPlayedDate = today;

    if (won) {
      newStats.gamesWon += 1;
      if (stats.lastPlayedDate === yesterday || stats.lastPlayedDate === '') {
        newStats.currentStreak += 1;
      } else {
        newStats.currentStreak = 1;
      }
      if (newStats.currentStreak > newStats.bestStreak) {
        newStats.bestStreak = newStats.currentStreak;
      }
    } else {
      newStats.currentStreak = 0;
    }

    setStats(newStats);
    await AsyncStorage.setItem(STATS_KEY, JSON.stringify(newStats));

    // Update cloud stats if logged in
    if (user) {
      let currentCloudStats = cloudStats;
      if (!currentCloudStats) {
        currentCloudStats = await fetchUserStats(user.id);
        if (currentCloudStats) {
          setCloudStats(currentCloudStats);
        }
      }

      if (currentCloudStats) {
        if (won) {
          const dailyStreak = await calculateDailyStreak();
          const updatedStats = await updateStatsAfterWin(user.id, 'nba', currentCloudStats, dailyStreak);
          if (updatedStats) {
            setCloudStats(updatedStats);
          }
        } else {
          const updatedStats = await updateStatsAfterLoss(user.id, 'nba');
          if (updatedStats) {
            setCloudStats(updatedStats);
          }
        }
      }
    }
  }

  function handleSelectPlayer(selectedPlayer: Player) {
    if (!dailyPlayer || solved || failed) return;

    const isCorrect = selectedPlayer.id === dailyPlayer.id;
    setGuess('');
    setShowSuggestions(false);

    if (isCorrect) {
      soundService.playDailyCorrect();
      setSolved(true);
      saveGameState(revealedClues, wrongGuesses, true, false);
      updateStats(true);

      // Award league points for winning
      if (user) {
        const guessCount = revealedClues;
        awardLeaguePoints(user.id, 'nba', guessCount, true);

        // Award leaderboard points (6 points for 1 clue, down to 1 point for 6 clues)
        awardPuzzlePoints(user.id, guessCount, 'nba');

        // Award XP for solving puzzle
        const streakDay = (cloudStats?.nba_current_streak || stats.currentStreak) + 1;
        const { total: xpAmount } = calculatePuzzleXP(guessCount, streakDay);

        awardXP(user.id, xpAmount).then((result) => {
          if (result) {
            setXPEarned(xpAmount);
            setXPResult(result);
            // Delay XP modal by 2.6 seconds after confetti to let user see jersey reveal first
            setTimeout(() => {
              setShowXPModal(true);
            }, 2900);
          }
        });

        // Check for achievements
        setTimeout(() => {
          checkPuzzleAchievements(user.id, guessCount).then((unlocked) => {
            if (unlocked.length > 0) {
              setPendingAchievements(unlocked);
              setCurrentAchievement(unlocked[0]);
              setShowAchievementToast(true);
            }
          });
        }, 500);
      }
    } else {
      const newWrongGuesses = wrongGuesses + 1;
      setWrongGuesses(newWrongGuesses);

      if (newWrongGuesses >= MAX_GUESSES) {
        setFailed(true);
        saveGameState(revealedClues, newWrongGuesses, false, true);
        updateStats(false);
        if (user) {
          awardLeaguePoints(user.id, 'nba', MAX_GUESSES, false);
        }
      } else {
        showWrongGuessToast(selectedPlayer.name, MAX_GUESSES - newWrongGuesses);
        saveGameState(revealedClues, newWrongGuesses, false, false);
      }
    }
  }

  function handleRevealClue() {
    if (revealedClues >= MAX_CLUES || solved || failed) return;
    const newRevealedClues = revealedClues + 1;
    setRevealedClues(newRevealedClues);
    saveGameState(newRevealedClues, wrongGuesses, solved, failed);
  }

  function handleTextChange(text: string) {
    setGuess(text);
    setShowSuggestions(text.trim().length > 0);
  }

  function handleAchievementDismiss() {
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
  }

  function showWrongGuessToast(playerName: string, remaining: number) {
    const message = `Not ${playerName}! ${remaining} guess${remaining !== 1 ? 'es' : ''} left`;
    setWrongGuessMessage(message);

    // Hide after delay
    setTimeout(() => {
      setWrongGuessMessage('');
    }, 2500);
  }

  function getShareText() {
    const status = solved ? `Solved with ${revealedClues} clue${revealedClues > 1 ? 's' : ''}!` : 'Failed';
    const clueEmojis = Array(revealedClues).fill('🟧').join('');
    const wrongEmojis = Array(wrongGuesses).fill('❌').join('');

    return `Ballrs NBA Daily 🏀
${status}
Clues: ${clueEmojis}
${wrongGuesses > 0 ? `Wrong: ${wrongEmojis}` : ''}
Points: ${solved ? calculatePoints(revealedClues) : 0}`;
  }

  async function handleNativeShare() {
    try {
      await Share.share({ message: getShareText() });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  }

  async function handleCopyToClipboard() {
    await Clipboard.setStringAsync(getShareText());
    setShowCopiedMessage(true);
    setTimeout(() => setShowCopiedMessage(false), 2000);
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const gameOver = solved || failed;
  const currentPoints = calculatePoints(revealedClues);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <KeyboardAwareScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        style={styles.scrollView}
        enableOnAndroid={true}
        extraScrollHeight={0}
        enableAutomaticScroll={true}
        keyboardOpeningTime={0}
      >
          {/* Back Button */}
          <TouchableOpacity style={styles.backButton} onPress={onBack}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>

          {/* Sport Badge */}
          <View style={styles.sportBadgeContainer}>
            <View style={[styles.sportBadge, { backgroundColor: colors.nba }]}>
              <Image source={basketballIcon} style={styles.sportIcon} />
            </View>
          </View>

          {/* Title */}
          <Text style={styles.title}>Daily Puzzle</Text>
          <Text style={styles.subtitle}>Guess today's NBA player</Text>

          {/* Stats Boxes */}
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{revealedClues}</Text>
              <Text style={styles.statLabel}>CLUE</Text>
            </View>
            <View style={[styles.statBox, styles.statBoxAccent]}>
              <Text style={[styles.statValue, styles.statValueAccent]}>{currentPoints}</Text>
              <Text style={[styles.statLabel, styles.statLabelAccent]}>WORTH</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={[styles.statValue, wrongGuesses > 0 && styles.statValueWrong]}>{wrongGuesses}</Text>
              <Text style={styles.statLabel}>WRONG</Text>
            </View>
          </View>

          {/* Success/Fail Messages */}
          {solved && (
            <View style={styles.successContainer}>
              <Text style={styles.successText}>Correct!</Text>
              <Text style={styles.successPlayer}>{dailyPlayer?.name}</Text>
              <Text style={styles.successStats}>
                +{currentPoints} points
              </Text>
            </View>
          )}

          {failed && (
            <View style={styles.failContainer}>
              <Text style={styles.failText}>Game Over</Text>
              <Text style={styles.failAnswer}>
                The answer was: {dailyPlayer?.name}
              </Text>
            </View>
          )}

          {/* Clues Section */}
          <View style={styles.cluesSection}>
            <Text style={styles.cluesSectionTitle}>CLUES</Text>
            {clues.slice(0, revealedClues).map((clue, index) => (
              <View key={index} style={styles.clueCard}>
                <View style={styles.clueNumberBadge}>
                  <Text style={styles.clueNumberText}>{index + 1}</Text>
                </View>
                <Text style={styles.clueText}>{clue}</Text>
              </View>
            ))}
          </View>

          {/* Need Another Clue Button */}
          {!gameOver && revealedClues < MAX_CLUES && (
            <TouchableOpacity
              style={[styles.revealClueButton, { backgroundColor: colors.nba }]}
              onPress={handleRevealClue}
            >
              <Text style={styles.revealClueButtonText}>Need Another Clue</Text>
            </TouchableOpacity>
          )}

          {/* Game Over Actions */}
          {gameOver && (
            <TouchableOpacity
              style={styles.shareButton}
              onPress={() => setShowShareModal(true)}
            >
              <Text style={styles.shareButtonText}>Share Result</Text>
            </TouchableOpacity>
          )}

          {/* Input Section */}
          {!gameOver && (
            <View style={styles.inputSection}>
              <TextInput
                style={styles.input}
                value={guess}
                onChangeText={handleTextChange}
                onFocus={() => console.log('INPUT FOCUSED')}
                placeholder="Type player name..."
                placeholderTextColor={colors.textSecondary}
                autoCapitalize="words"
                autoCorrect={false}
                selectionColor="#1ABC9C"
              />
              {showSuggestions && filteredPlayers.length > 0 && (
                <View style={styles.suggestionsContainer}>
                  {filteredPlayers.map((player) => (
                    <TouchableOpacity
                      key={player.id}
                      style={styles.suggestionItem}
                      onPress={() => handleSelectPlayer(player)}
                    >
                      <Text style={styles.suggestionText}>{player.name}</Text>
                      <Text style={styles.suggestionTeam}>{player.team}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          )}
        </KeyboardAwareScrollView>

      {/* Share Modal */}
      <Modal
        visible={showShareModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowShareModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Share Your Result</Text>
            <View style={styles.sharePreview}>
              <Text style={styles.sharePreviewText}>{getShareText()}</Text>
            </View>
            <TouchableOpacity
              style={styles.shareNativeButton}
              onPress={handleNativeShare}
            >
              <Text style={styles.shareNativeButtonText}>Share</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.copyButton}
              onPress={handleCopyToClipboard}
            >
              <Text style={styles.copyButtonText}>
                {showCopiedMessage ? 'Copied!' : 'Copy to Clipboard'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.closeButtonSecondary}
              onPress={() => setShowShareModal(false)}
            >
              <Text style={styles.closeButtonSecondaryText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* XP Earned Modal */}
      {xpResult && (
        <XPEarnedModal
          visible={showXPModal}
          xpEarned={xpEarned}
          previousXP={xpResult.previousXP}
          newXP={xpResult.newXP}
          previousLevel={xpResult.previousLevel}
          newLevel={xpResult.newLevel}
          onClose={() => {
            setShowXPModal(false);
            if (xpResult.leveledUp) {
              setNewLevel(xpResult.newLevel);
              setTimeout(() => setShowLevelUpModal(true), 300);
            }
          }}
        />
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

      {/* Wrong Guess Toast */}
      {wrongGuessMessage !== '' && (
        <View style={styles.wrongGuessToast}>
          <Text style={styles.wrongGuessToastText}>{wrongGuessMessage}</Text>
        </View>
      )}
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
    padding: 16,
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
    fontFamily: 'DMSans_700Bold',
  },
  backButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#F2C94C',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#000000',
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
    marginBottom: 16,
  },
  backButtonText: {
    color: '#1A1A1A',
    fontSize: 12,
    fontFamily: 'DMSans_900Black',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sportBadgeContainer: {
    alignItems: 'center',
    marginBottom: 12,
  },
  sportBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.border,
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  sportIcon: {
    width: 24,
    height: 24,
    tintColor: '#FFFFFF',
  },
  title: {
    fontSize: 32,
    fontFamily: 'DMSans_900Black',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: 'DMSans_400Regular',
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 20,
  },
  statBox: {
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    minWidth: 80,
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  statBoxAccent: {
    backgroundColor: colors.nba,
  },
  statValue: {
    fontSize: 24,
    fontFamily: 'DMSans_900Black',
    color: colors.text,
  },
  statValueAccent: {
    color: '#FFFFFF',
  },
  statValueWrong: {
    color: colors.wrong,
  },
  statLabel: {
    fontSize: 11,
    fontFamily: 'DMSans_700Bold',
    color: colors.textSecondary,
    marginTop: 2,
    letterSpacing: 1,
  },
  statLabelAccent: {
    color: 'rgba(255,255,255,0.8)',
  },
  successContainer: {
    backgroundColor: colors.correct,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.border,
    padding: 20,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  successText: {
    fontSize: 24,
    fontFamily: 'DMSans_900Black',
    color: '#FFFFFF',
  },
  successPlayer: {
    fontSize: 18,
    fontFamily: 'DMSans_700Bold',
    color: '#FFFFFF',
    marginTop: 4,
  },
  successStats: {
    fontSize: 14,
    fontFamily: 'DMSans_600SemiBold',
    color: 'rgba(255,255,255,0.9)',
    marginTop: 4,
  },
  failContainer: {
    backgroundColor: colors.wrong,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.border,
    padding: 20,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  failText: {
    fontSize: 24,
    fontFamily: 'DMSans_900Black',
    color: '#FFFFFF',
  },
  failAnswer: {
    fontSize: 16,
    fontFamily: 'DMSans_600SemiBold',
    color: '#FFFFFF',
    marginTop: 4,
  },
  cluesSection: {
    marginBottom: 16,
  },
  cluesSectionTitle: {
    fontSize: 14,
    fontFamily: 'DMSans_900Black',
    color: colors.textSecondary,
    letterSpacing: 2,
    marginBottom: 12,
  },
  clueCard: {
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
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
    backgroundColor: colors.nba,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  clueNumberText: {
    fontSize: 14,
    fontFamily: 'DMSans_900Black',
    color: '#FFFFFF',
  },
  clueText: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'DMSans_600SemiBold',
    color: colors.text,
  },
  revealClueButton: {
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.border,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  revealClueButtonText: {
    fontSize: 14,
    fontFamily: 'DMSans_900Black',
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  shareButton: {
    backgroundColor: colors.correct,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.border,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  shareButtonText: {
    fontSize: 14,
    fontFamily: 'DMSans_900Black',
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inputSection: {
    marginTop: 16,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.border,
    paddingHorizontal: 20,
    paddingVertical: 14,
    fontSize: 16,
    fontFamily: 'DMSans_600SemiBold',
    color: colors.text,
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  suggestionsContainer: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.border,
    marginTop: 8,
    maxHeight: 180,
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 5,
  },
  suggestionItem: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#CCCCCC',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  suggestionText: {
    fontSize: 16,
    fontFamily: 'DMSans_700Bold',
    color: colors.text,
  },
  suggestionTeam: {
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
    color: colors.textSecondary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.border,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    shadowColor: '#000000',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  modalTitle: {
    fontSize: 24,
    fontFamily: 'DMSans_900Black',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 16,
  },
  sharePreview: {
    backgroundColor: colors.background,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 20,
    alignItems: 'center',
  },
  sharePreviewText: {
    color: colors.text,
    fontSize: 14,
    fontFamily: 'DMSans_600SemiBold',
    textAlign: 'center',
    lineHeight: 22,
  },
  shareNativeButton: {
    backgroundColor: colors.correct,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  shareNativeButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'DMSans_900Black',
    textTransform: 'uppercase',
  },
  copyButton: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  copyButtonText: {
    color: colors.text,
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
  },
  closeButtonSecondary: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  closeButtonSecondaryText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontFamily: 'DMSans_600SemiBold',
  },
  wrongGuessToast: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    backgroundColor: colors.wrong,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.border,
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 10,
  },
  wrongGuessToastText: {
    fontSize: 16,
    fontFamily: 'DMSans_700Bold',
    color: '#FFFFFF',
    textAlign: 'center',
  },
});
