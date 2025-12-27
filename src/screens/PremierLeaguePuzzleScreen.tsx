import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Modal,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import * as Clipboard from 'expo-clipboard';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  FootballPlayer,
  FootballPlayersData,
  DailyGameState,
  StatsData,
  GuessedFootballPlayer,
  FootballMatchResult,
  MatchStatus,
  NumberDirection,
} from '../types';
import { useAuth } from '../contexts/AuthContext';
import {
  fetchUserStats,
  updateStatsAfterWin,
  updateStatsAfterLoss,
  UserStats,
} from '../lib/statsService';
import { awardLeaguePoints } from '../lib/leaguesService';
import { calculatePuzzleXP, awardXP, XPAwardResult } from '../lib/xpService';
import { awardPuzzlePoints } from '../lib/pointsService';
import { checkPuzzleAchievements, Achievement } from '../lib/achievementsService';
import LevelUpModal from '../components/LevelUpModal';
import XPEarnedModal from '../components/XPEarnedModal';
import AchievementToast from '../components/AchievementToast';
import playersData from '../../data/premier-league-players.json';

interface Props {
  onBack: () => void;
}

const colors = {
  background: '#1a1a2e',
  cardBackground: '#16213e',
  primary: '#e94560',
  primaryDark: '#c73e54',
  accent: '#0f3460',
  correct: '#22c55e',
  partial: '#eab308',
  wrong: '#374151',
  textLight: '#ffffff',
  textMuted: '#94a3b8',
  inputBackground: '#0f3460',
  border: '#334155',
};

const MAX_GUESSES = 8;
const STORAGE_KEY = 'ballrs_pl_daily_game';
const STATS_KEY = 'ballrs_pl_stats';

const defaultStats: StatsData = {
  currentStreak: 0,
  bestStreak: 0,
  gamesPlayed: 0,
  gamesWon: 0,
  lastPlayedDate: '',
};

const STREAK_KEY = 'ballrs_pl_daily_streak';

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

  const newStreakState: StreakState = { currentStreak: newStreak, lastPlayedDate: today };
  await AsyncStorage.setItem(STREAK_KEY, JSON.stringify(newStreakState));

  return newStreak;
}

// Position groups for partial matching
const positionGroups: Record<string, string> = {
  GK: 'Keeper',
  DEF: 'Defensive',
  MID: 'Midfield',
  FWD: 'Attack',
};

// Adjacent positions for partial matching
const adjacentPositions: Record<string, string[]> = {
  GK: [],
  DEF: ['MID'],
  MID: ['DEF', 'FWD'],
  FWD: ['MID'],
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

function getDailyPlayer(players: FootballPlayer[]): FootballPlayer {
  const dateString = getTodayString();
  // Use a different hash offset so PL and NBA have different daily players
  let hash = 12345;
  for (let i = 0; i < dateString.length; i++) {
    const char = dateString.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  const index = Math.abs(hash) % players.length;
  return players[index];
}

function comparePlayer(guessed: FootballPlayer, target: FootballPlayer): FootballMatchResult {
  const getNumberMatch = (guessedVal: number, targetVal: number): { status: MatchStatus; direction: NumberDirection } => {
    if (guessedVal === targetVal) {
      return { status: 'correct', direction: 'equal' };
    }
    return {
      status: 'wrong',
      direction: targetVal > guessedVal ? 'higher' : 'lower',
    };
  };

  const getPositionMatch = (): MatchStatus => {
    if (guessed.position === target.position) return 'correct';
    if (adjacentPositions[guessed.position]?.includes(target.position)) return 'partial';
    return 'wrong';
  };

  return {
    team: guessed.team === target.team ? 'correct' : 'wrong',
    nationality: guessed.nationality === target.nationality ? 'correct' : 'wrong',
    position: getPositionMatch(),
    age: getNumberMatch(guessed.age, target.age),
    jerseyNumber: getNumberMatch(guessed.jerseyNumber, target.jerseyNumber),
  };
}

export default function PremierLeaguePuzzleScreen({ onBack }: Props) {
  const { user } = useAuth();
  const [players] = useState<FootballPlayer[]>((playersData as FootballPlayersData).players);
  const [dailyPlayer, setDailyPlayer] = useState<FootballPlayer | null>(null);
  const [guess, setGuess] = useState('');
  const [guessedPlayers, setGuessedPlayers] = useState<GuessedFootballPlayer[]>([]);
  const [solved, setSolved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [stats, setStats] = useState<StatsData>(defaultStats);
  const [cloudStats, setCloudStats] = useState<UserStats | null>(null);
  const [showStatsModal, setShowStatsModal] = useState(false);
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

  const filteredPlayers = guess.trim().length > 0
    ? players
        .filter(p =>
          p.name.toLowerCase().includes(guess.toLowerCase()) &&
          !guessedPlayers.some(gp => gp.player.id === p.id)
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
          const restoredGuesses: GuessedFootballPlayer[] = state.guessedPlayerIds
            .map(id => {
              const guessedPlayer = players.find(p => p.id === id);
              if (!guessedPlayer) return null;
              return {
                player: guessedPlayer,
                matches: comparePlayer(guessedPlayer, player),
              };
            })
            .filter((g): g is GuessedFootballPlayer => g !== null);

          setGuessedPlayers(restoredGuesses);
          setSolved(state.solved);
        }
      }
    } catch (error) {
      console.error('Error loading game state:', error);
    } finally {
      setLoading(false);
    }
  }

  async function saveGameState(newGuessedPlayers: GuessedFootballPlayer[], newSolved: boolean) {
    try {
      const state: DailyGameState = {
        date: getTodayString(),
        guessedPlayerIds: newGuessedPlayers.map(gp => gp.player.id),
        solved: newSolved,
      };
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.error('Error saving game state:', error);
    }
  }

  async function updateStats(won: boolean) {
    const today = getTodayString();
    const yesterday = getYesterdayString();

    if (stats.lastPlayedDate === today) {
      // Still sync cloud stats even if already played today (for testing)
      if (user) {
        let currentCloudStats = cloudStats;
        if (!currentCloudStats) {
          currentCloudStats = await fetchUserStats(user.id);
          if (currentCloudStats) {
            setCloudStats(currentCloudStats);
          }
        }
        if (currentCloudStats && won) {
          const dailyStreak = await calculateDailyStreak();
          const updatedStats = await updateStatsAfterWin(user.id, 'pl', currentCloudStats, dailyStreak);
          if (updatedStats) {
            setCloudStats(updatedStats);
          }
        }
      }
      return;
    }

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
      // Fetch stats if we don't have them yet
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
          const updatedStats = await updateStatsAfterWin(user.id, 'pl', currentCloudStats, dailyStreak);
          if (updatedStats) {
            setCloudStats(updatedStats);
          }
        } else {
          const updatedStats = await updateStatsAfterLoss(user.id, 'pl');
          if (updatedStats) {
            setCloudStats(updatedStats);
          }
        }
      }
    }
  }

  function handleSelectPlayer(selectedPlayer: FootballPlayer) {
    if (!dailyPlayer || solved || guessedPlayers.length >= MAX_GUESSES) return;

    const matches = comparePlayer(selectedPlayer, dailyPlayer);
    const newGuess: GuessedFootballPlayer = { player: selectedPlayer, matches };
    const newGuessedPlayers = [newGuess, ...guessedPlayers];
    setGuessedPlayers(newGuessedPlayers);
    setGuess('');
    setShowSuggestions(false);

    const isCorrect = selectedPlayer.id === dailyPlayer.id;
    const guessCount = newGuessedPlayers.length;

    if (isCorrect) {
      setSolved(true);
      saveGameState(newGuessedPlayers, true);
      updateStats(true);
      // Award league points for winning
      if (user) {
        awardLeaguePoints(user.id, 'pl', guessCount, true);

        // Award leaderboard points (6 points for 1 guess, down to 1 point for 6 guesses)
        awardPuzzlePoints(user.id, guessCount);

        // Award XP for solving puzzle
        const streakDay = (cloudStats?.pl_current_streak || stats.currentStreak) + 1;
        const { total: xpAmount } = calculatePuzzleXP(guessCount, streakDay);
        awardXP(user.id, xpAmount).then((result) => {
          console.log('XP Award result:', result);
          if (result) {
            setXPEarned(xpAmount);
            setXPResult(result);
            setShowXPModal(true);
          }
        }).catch((err) => {
          console.error('Error awarding XP:', err);
        });

        // Check for achievements after a short delay (to let stats update)
        setTimeout(() => {
          checkPuzzleAchievements(user.id, guessCount).then((unlocked) => {
            if (unlocked.length > 0) {
              console.log('Achievements unlocked:', unlocked.map(a => a.name));
              setPendingAchievements(unlocked);
              setCurrentAchievement(unlocked[0]);
              setShowAchievementToast(true);
            }
          }).catch((err) => {
            console.error('Error checking achievements:', err);
          });
        }, 500);
      }
    } else {
      saveGameState(newGuessedPlayers, false);
      if (guessCount >= MAX_GUESSES) {
        updateStats(false);
        // No points for losing, but still call to record the attempt
        if (user) {
          awardLeaguePoints(user.id, 'pl', guessCount, false);
        }
      }
    }
  }

  function handleAchievementDismiss() {
    setShowAchievementToast(false);
    // Show next achievement if there are more pending
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

  function handleTextChange(text: string) {
    setGuess(text);
    setShowSuggestions(text.trim().length > 0);
  }

  async function handleReset() {
    await AsyncStorage.removeItem(STORAGE_KEY);
    // Also reset lastPlayedDate so stats will update on next win (for testing)
    const newStats = { ...stats, lastPlayedDate: '' };
    setStats(newStats);
    await AsyncStorage.setItem(STATS_KEY, JSON.stringify(newStats));
    setGuessedPlayers([]);
    setSolved(false);
  }

  // Use cloud stats if available, otherwise local stats
  const displayStats = {
    currentStreak: cloudStats?.pl_current_streak ?? stats.currentStreak,
    bestStreak: cloudStats?.pl_best_streak ?? stats.bestStreak,
    totalSolved: cloudStats?.pl_total_solved ?? stats.gamesWon,
    gamesPlayed: stats.gamesPlayed,
  };

  function getShareText() {
    const rows = guessedPlayers.slice().reverse().map(gp => {
      const m = gp.matches;
      const getEmoji = (status: MatchStatus) => {
        if (status === 'correct') return '🟩';
        if (status === 'partial') return '🟨';
        return '⬛';
      };
      return [
        getEmoji(m.team),
        getEmoji(m.nationality),
        getEmoji(m.position),
        getEmoji(m.age.status),
        getEmoji(m.jerseyNumber.status),
      ].join('');
    }).join('\n');

    return `Ballrs PL ⚽ ${guessedPlayers.length}/${MAX_GUESSES}
${rows}
Streak: ${displayStats.currentStreak}`;
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

  function getCellStyle(status: MatchStatus) {
    switch (status) {
      case 'correct': return styles.cellCorrect;
      case 'partial': return styles.cellPartial;
      default: return styles.cellWrong;
    }
  }

  function renderArrow(direction: NumberDirection) {
    if (direction === 'equal') return null;
    return (
      <Text style={styles.arrow}>
        {direction === 'higher' ? '↑' : '↓'}
      </Text>
    );
  }

  function renderGuessRow(guessedPlayer: GuessedFootballPlayer, index: number) {
    const { player, matches } = guessedPlayer;
    return (
      <View key={player.id} style={styles.guessRow}>
        <View style={[styles.cell, styles.nameCell, getCellStyle(player.id === dailyPlayer?.id ? 'correct' : 'wrong')]}>
          <Text style={styles.cellText} numberOfLines={1}>{player.name}</Text>
        </View>
        <View style={[styles.cell, getCellStyle(matches.team)]}>
          <Text style={styles.cellText}>{player.teamAbbr}</Text>
        </View>
        <View style={[styles.cell, getCellStyle(matches.nationality)]}>
          <Text style={styles.cellTextSmall} numberOfLines={1}>{player.nationality}</Text>
        </View>
        <View style={[styles.cell, getCellStyle(matches.position)]}>
          <Text style={styles.cellText}>{player.position}</Text>
        </View>
        <View style={[styles.cell, getCellStyle(matches.age.status)]}>
          <Text style={styles.cellText}>{player.age}</Text>
          {renderArrow(matches.age.direction)}
        </View>
        <View style={[styles.cell, getCellStyle(matches.jerseyNumber.status)]}>
          <Text style={styles.cellText}>#{player.jerseyNumber}</Text>
          {renderArrow(matches.jerseyNumber.direction)}
        </View>
      </View>
    );
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

  const gameOver = solved || guessedPlayers.length >= MAX_GUESSES;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <KeyboardAwareScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        enableOnAndroid={true}
        extraScrollHeight={0}
        enableAutomaticScroll={true}
      >
          <View style={styles.header}>
            <View style={styles.headerButtons}>
              <TouchableOpacity style={styles.backButton} onPress={onBack}>
                <Text style={styles.backButtonText}>← Back</Text>
              </TouchableOpacity>
              <View style={styles.headerRight}>
                <TouchableOpacity style={styles.devResetButton} onPress={handleReset}>
                  <Text style={styles.devResetButtonText}>Reset</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.statsButton}
                  onPress={() => setShowStatsModal(true)}
                >
                  <Text style={styles.statsButtonText}>Stats</Text>
                </TouchableOpacity>
              </View>
            </View>
            <Text style={styles.title}>Ballrs ⚽</Text>
            <Text style={styles.subtitle}>Guess the Premier League player!</Text>
            <Text style={styles.guessCount}>{guessedPlayers.length}/{MAX_GUESSES} guesses</Text>
          </View>

          {solved && (
            <View style={styles.successContainer}>
              <Text style={styles.successText}>You got it!</Text>
              <Text style={styles.successPlayer}>{dailyPlayer?.name}</Text>
              <Text style={styles.successStats}>
                Solved in {guessedPlayers.length} {guessedPlayers.length === 1 ? 'guess' : 'guesses'}
              </Text>
            </View>
          )}

          {!solved && guessedPlayers.length >= MAX_GUESSES && (
            <View style={styles.failContainer}>
              <Text style={styles.failText}>Game Over!</Text>
              <Text style={styles.failAnswer}>
                The answer was: {dailyPlayer?.name}
              </Text>
            </View>
          )}

          {!gameOver && (
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                value={guess}
                onChangeText={handleTextChange}
                placeholder="Search for a player..."
                placeholderTextColor={colors.textMuted}
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

          {guessedPlayers.length > 0 && (
            <View style={styles.gridContainer}>
              <View style={styles.headerRow}>
                <View style={[styles.headerCell, styles.nameCell]}>
                  <Text style={styles.headerText}>Player</Text>
                </View>
                <View style={styles.headerCell}>
                  <Text style={styles.headerText}>Team</Text>
                </View>
                <View style={styles.headerCell}>
                  <Text style={styles.headerText}>Nation</Text>
                </View>
                <View style={styles.headerCell}>
                  <Text style={styles.headerText}>Pos</Text>
                </View>
                <View style={styles.headerCell}>
                  <Text style={styles.headerText}>Age</Text>
                </View>
                <View style={styles.headerCell}>
                  <Text style={styles.headerText}>#</Text>
                </View>
              </View>
              {guessedPlayers.map((gp, index) => renderGuessRow(gp, index))}
            </View>
          )}

          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendBox, { backgroundColor: colors.correct }]} />
              <Text style={styles.legendText}>Correct</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendBox, { backgroundColor: colors.partial }]} />
              <Text style={styles.legendText}>Partial</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendBox, { backgroundColor: colors.wrong }]} />
              <Text style={styles.legendText}>Wrong</Text>
            </View>
          </View>

          {gameOver && (
            <View style={styles.gameOverActions}>
              <TouchableOpacity
                style={styles.shareButton}
                onPress={() => setShowShareModal(true)}
              >
                <Text style={styles.shareButtonText}>Share Result</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.resetButton} onPress={handleReset}>
                <Text style={styles.resetButtonText}>Play Again (Dev)</Text>
              </TouchableOpacity>
            </View>
          )}
      </KeyboardAwareScrollView>

      {/* Stats Modal */}
      <Modal
        visible={showStatsModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowStatsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Your Stats ⚽</Text>
            {user && <Text style={styles.cloudSyncText}>Synced to cloud</Text>}
            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{displayStats.totalSolved}</Text>
                <Text style={styles.statLabel}>Total Solved</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{displayStats.currentStreak}</Text>
                <Text style={styles.statLabel}>Current Streak</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{displayStats.bestStreak}</Text>
                <Text style={styles.statLabel}>Best Streak</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowStatsModal(false)}
            >
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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
      <XPEarnedModal
        visible={showXPModal}
        xpEarned={xpEarned}
        previousXP={xpResult?.previousXP || 0}
        newXP={xpResult?.newXP || 0}
        previousLevel={xpResult?.previousLevel || 1}
        newLevel={xpResult?.newLevel || 1}
        onClose={() => {
          setShowXPModal(false);
          // Show level up modal after XP modal if leveled up
          if (xpResult?.leveledUp) {
            setNewLevel(xpResult.newLevel);
            setShowLevelUpModal(true);
          }
        }}
      />

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
  scrollContent: {
    padding: 12,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: colors.textLight,
    fontSize: 18,
  },
  header: {
    alignItems: 'center',
    marginBottom: 16,
    paddingTop: 8,
  },
  headerButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 8,
  },
  headerRight: {
    flexDirection: 'row',
    gap: 8,
  },
  backButton: {
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
  },
  backButtonText: {
    color: '#1A1A1A',
    fontSize: 12,
    fontFamily: 'DMSans_900Black',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  devResetButton: {
    backgroundColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  devResetButtonText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  statsButton: {
    backgroundColor: colors.accent,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  statsButtonText: {
    color: colors.textLight,
    fontSize: 14,
    fontWeight: '600',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.textLight,
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: 4,
  },
  guessCount: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
  },
  successContainer: {
    backgroundColor: colors.correct,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  successText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.background,
  },
  successPlayer: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.background,
    marginTop: 4,
  },
  successStats: {
    fontSize: 14,
    color: colors.background,
    opacity: 0.8,
    marginTop: 2,
  },
  failContainer: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  failText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textLight,
  },
  failAnswer: {
    fontSize: 16,
    color: colors.textLight,
    opacity: 0.9,
    marginTop: 4,
  },
  inputWrapper: {
    marginBottom: 16,
  },
  input: {
    backgroundColor: colors.inputBackground,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.textLight,
    borderWidth: 1,
    borderColor: colors.border,
  },
  suggestionsContainer: {
    backgroundColor: colors.cardBackground,
    borderRadius: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  suggestionItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  suggestionText: {
    fontSize: 16,
    color: colors.textLight,
    fontWeight: '500',
  },
  suggestionTeam: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  gridContainer: {
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  headerCell: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
  },
  headerText: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  guessRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  cell: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 2,
    marginHorizontal: 1,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  nameCell: {
    flex: 2,
  },
  cellCorrect: {
    backgroundColor: colors.correct,
  },
  cellPartial: {
    backgroundColor: colors.partial,
  },
  cellWrong: {
    backgroundColor: colors.wrong,
  },
  cellText: {
    fontSize: 13,
    color: colors.textLight,
    fontWeight: '600',
    textAlign: 'center',
  },
  cellTextSmall: {
    fontSize: 11,
    color: colors.textLight,
    fontWeight: '500',
    textAlign: 'center',
  },
  arrow: {
    fontSize: 14,
    color: colors.textLight,
    fontWeight: 'bold',
    marginTop: 2,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendBox: {
    width: 16,
    height: 16,
    borderRadius: 3,
  },
  legendText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  gameOverActions: {
    alignItems: 'center',
    gap: 12,
  },
  shareButton: {
    backgroundColor: colors.correct,
    borderRadius: 12,
    paddingHorizontal: 32,
    paddingVertical: 14,
  },
  shareButtonText: {
    color: colors.background,
    fontSize: 16,
    fontWeight: 'bold',
  },
  resetButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: colors.accent,
    borderRadius: 8,
  },
  resetButtonText: {
    color: colors.textMuted,
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: colors.cardBackground,
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 340,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.textLight,
    textAlign: 'center',
    marginBottom: 8,
  },
  cloudSyncText: {
    fontSize: 12,
    color: colors.correct,
    textAlign: 'center',
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  statItem: {
    width: '31%',
    backgroundColor: colors.accent,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.textLight,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 10,
    color: colors.textMuted,
    textAlign: 'center',
  },
  closeButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  closeButtonText: {
    color: colors.textLight,
    fontSize: 16,
    fontWeight: 'bold',
  },
  sharePreview: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    alignItems: 'center',
  },
  sharePreviewText: {
    color: colors.textLight,
    fontSize: 16,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    textAlign: 'center',
    lineHeight: 24,
  },
  shareNativeButton: {
    backgroundColor: colors.correct,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  shareNativeButtonText: {
    color: colors.background,
    fontSize: 16,
    fontWeight: 'bold',
  },
  copyButton: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  copyButtonText: {
    color: colors.textLight,
    fontSize: 16,
    fontWeight: '600',
  },
  closeButtonSecondary: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  closeButtonSecondaryText: {
    color: colors.textMuted,
    fontSize: 14,
  },
});
