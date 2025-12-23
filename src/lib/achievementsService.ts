import { supabase } from './supabase';
import { awardXP } from './xpService';

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  xp_reward: number;
  category: string;
  is_secret: boolean;
}

export interface UnlockedAchievement {
  achievement: Achievement;
  justUnlocked: boolean;
}

export interface UserAchievementWithDate {
  achievement_id: string;
  unlocked_at: string;
}

export interface AchievementProgress {
  current: number;
  target: number;
}

// Map achievement names to their progress calculation
const achievementProgress: Record<string, (stats: UserStatsForAchievements) => AchievementProgress | null> = {
  'First Victory': (stats) => ({ current: Math.min(stats.totalPuzzlesSolved, 1), target: 1 }),
  'Week Warrior': (stats) => ({ current: Math.min(stats.currentStreak, 7), target: 7 }),
  'Monthly Master': (stats) => ({ current: Math.min(stats.currentStreak, 30), target: 30 }),
  'Perfect Game': () => null, // No progress - either you did it or not
  'Puzzle Enthusiast': (stats) => ({ current: Math.min(stats.totalPuzzlesSolved, 10), target: 10 }),
  'Puzzle Expert': (stats) => ({ current: Math.min(stats.totalPuzzlesSolved, 50), target: 50 }),
  'Puzzle Master': (stats) => ({ current: Math.min(stats.totalPuzzlesSolved, 100), target: 100 }),
  'Duel Debut': (stats) => ({ current: Math.min(stats.totalDuelWins, 1), target: 1 }),
  'Duel Champion': (stats) => ({ current: Math.min(stats.totalDuelWins, 10), target: 10 }),
  'Duel Legend': (stats) => ({ current: Math.min(stats.totalDuelWins, 50), target: 50 }),
  'Social Starter': (stats) => ({ current: Math.min(stats.friendCount, 1), target: 1 }),
  'Popular Player': (stats) => ({ current: Math.min(stats.friendCount, 10), target: 10 }),
  'Team Player': (stats) => ({ current: Math.min(stats.leagueCount, 1), target: 1 }),
  'Rising Star': (stats) => ({ current: Math.min(stats.level, 10), target: 10 }),
  'Elite Status': (stats) => ({ current: Math.min(stats.level, 25), target: 25 }),
};

// Achievement condition keys that map to stat checks
export type AchievementKey =
  | 'first_puzzle_win'
  | 'streak_7'
  | 'streak_30'
  | 'perfect_game'
  | 'puzzles_10'
  | 'puzzles_50'
  | 'puzzles_100'
  | 'first_duel_win'
  | 'duel_wins_10'
  | 'duel_wins_50'
  | 'first_friend'
  | 'friends_10'
  | 'join_league'
  | 'level_10'
  | 'level_25';

// Map achievement names to their unlock conditions
const achievementConditions: Record<string, (stats: UserStatsForAchievements) => boolean> = {
  'First Victory': (stats) => stats.totalPuzzlesSolved >= 1,
  'Week Warrior': (stats) => stats.currentStreak >= 7,
  'Monthly Master': (stats) => stats.currentStreak >= 30,
  'Perfect Game': (stats) => stats.lastPuzzleGuesses === 1,
  'Puzzle Enthusiast': (stats) => stats.totalPuzzlesSolved >= 10,
  'Puzzle Expert': (stats) => stats.totalPuzzlesSolved >= 50,
  'Puzzle Master': (stats) => stats.totalPuzzlesSolved >= 100,
  'Duel Debut': (stats) => stats.totalDuelWins >= 1,
  'Duel Champion': (stats) => stats.totalDuelWins >= 10,
  'Duel Legend': (stats) => stats.totalDuelWins >= 50,
  'Social Starter': (stats) => stats.friendCount >= 1,
  'Popular Player': (stats) => stats.friendCount >= 10,
  'Team Player': (stats) => stats.leagueCount >= 1,
  'Rising Star': (stats) => stats.level >= 10,
  'Elite Status': (stats) => stats.level >= 25,
};

export interface UserStatsForAchievements {
  totalPuzzlesSolved: number;
  currentStreak: number;
  bestStreak: number;
  lastPuzzleGuesses: number;
  totalDuelWins: number;
  totalDuelsPlayed: number;
  friendCount: number;
  leagueCount: number;
  level: number;
}

// Fetch all achievements from database
export async function fetchAllAchievements(): Promise<Achievement[]> {
  const { data, error } = await supabase
    .from('achievements')
    .select('*')
    .order('category', { ascending: true });

  if (error) {
    console.error('Error fetching achievements:', error);
    return [];
  }

  return data || [];
}

// Fetch user's unlocked achievements
export async function fetchUserAchievements(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('user_achievements')
    .select('achievement_id')
    .eq('user_id', userId);

  if (error) {
    console.error('Error fetching user achievements:', error);
    return [];
  }

  return data?.map(ua => ua.achievement_id) || [];
}

// Unlock an achievement for a user
export async function unlockAchievement(
  userId: string,
  achievement: Achievement
): Promise<boolean> {
  // Check if already unlocked
  const { data: existing } = await supabase
    .from('user_achievements')
    .select('id')
    .eq('user_id', userId)
    .eq('achievement_id', achievement.id)
    .single();

  if (existing) {
    console.log('Achievement already unlocked:', achievement.name);
    return false;
  }

  // Insert new achievement unlock
  const { error: insertError } = await supabase
    .from('user_achievements')
    .insert({
      user_id: userId,
      achievement_id: achievement.id,
    });

  if (insertError) {
    console.error('Error unlocking achievement:', insertError);
    return false;
  }

  // Award XP for the achievement
  if (achievement.xp_reward > 0) {
    await awardXP(userId, achievement.xp_reward);
  }

  console.log('Achievement unlocked:', achievement.name, '+', achievement.xp_reward, 'XP');
  return true;
}

// Check and unlock any achievements based on current stats
export async function checkAndUnlockAchievements(
  userId: string,
  stats: UserStatsForAchievements
): Promise<Achievement[]> {
  const newlyUnlocked: Achievement[] = [];

  // Fetch all achievements and user's already unlocked ones
  const [allAchievements, unlockedIds] = await Promise.all([
    fetchAllAchievements(),
    fetchUserAchievements(userId),
  ]);

  // Check each achievement
  for (const achievement of allAchievements) {
    // Skip if already unlocked
    if (unlockedIds.includes(achievement.id)) {
      continue;
    }

    // Check if condition is met
    const condition = achievementConditions[achievement.name];
    if (condition && condition(stats)) {
      const unlocked = await unlockAchievement(userId, achievement);
      if (unlocked) {
        newlyUnlocked.push(achievement);
      }
    }
  }

  return newlyUnlocked;
}

// Get stats needed for achievement checking after a puzzle
export async function getStatsForAchievements(
  userId: string,
  lastPuzzleGuesses: number
): Promise<UserStatsForAchievements> {
  // Fetch user_stats
  const { data: stats } = await supabase
    .from('user_stats')
    .select('*')
    .eq('id', userId)
    .single();

  // Fetch friend count (table may not exist)
  let friendCount = 0;
  try {
    const { count, error } = await supabase
      .from('friends')
      .select('*', { count: 'exact', head: true })
      .or(`user_id.eq.${userId},friend_id.eq.${userId}`);
    if (!error) {
      friendCount = count || 0;
    }
  } catch {
    // Friends table doesn't exist, that's ok
  }

  // Fetch league count
  const { count: leagueCount } = await supabase
    .from('league_members')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  const nbaTotal = stats?.nba_total_solved || 0;
  const plTotal = stats?.pl_total_solved || 0;
  const nbaStreak = stats?.nba_current_streak || 0;
  const plStreak = stats?.pl_current_streak || 0;
  const nbaBest = stats?.nba_best_streak || 0;
  const plBest = stats?.pl_best_streak || 0;

  return {
    totalPuzzlesSolved: nbaTotal + plTotal,
    currentStreak: Math.max(nbaStreak, plStreak),
    bestStreak: Math.max(nbaBest, plBest),
    lastPuzzleGuesses,
    totalDuelWins: stats?.duel_wins || 0,
    totalDuelsPlayed: stats?.duels_played || 0,
    friendCount: friendCount,
    leagueCount: leagueCount || 0,
    level: stats?.level || 1,
  };
}

// Convenience function to check achievements after completing a puzzle
export async function checkPuzzleAchievements(
  userId: string,
  guessCount: number
): Promise<Achievement[]> {
  const stats = await getStatsForAchievements(userId, guessCount);
  return checkAndUnlockAchievements(userId, stats);
}

// Convenience function to check achievements after a duel
export async function checkDuelAchievements(userId: string): Promise<Achievement[]> {
  const stats = await getStatsForAchievements(userId, 0);
  return checkAndUnlockAchievements(userId, stats);
}

// Fetch user achievements with unlock dates
export async function fetchUserAchievementsWithDates(userId: string): Promise<UserAchievementWithDate[]> {
  const { data, error } = await supabase
    .from('user_achievements')
    .select('achievement_id, unlocked_at')
    .eq('user_id', userId);

  if (error) {
    console.error('Error fetching user achievements with dates:', error);
    return [];
  }

  return data || [];
}

// Get progress for a specific achievement
export function getAchievementProgress(
  achievementName: string,
  stats: UserStatsForAchievements
): AchievementProgress | null {
  const progressFn = achievementProgress[achievementName];
  if (!progressFn) return null;
  return progressFn(stats);
}

// Fetch all achievements with user's unlock status and progress
export async function fetchAchievementsWithStatus(userId: string): Promise<{
  achievements: Achievement[];
  unlockedMap: Map<string, string>; // achievement_id -> unlocked_at
  stats: UserStatsForAchievements;
}> {
  const [achievements, userAchievements, stats] = await Promise.all([
    fetchAllAchievements(),
    fetchUserAchievementsWithDates(userId),
    getStatsForAchievements(userId, 0),
  ]);

  const unlockedMap = new Map<string, string>();
  userAchievements.forEach(ua => {
    unlockedMap.set(ua.achievement_id, ua.unlocked_at);
  });

  return { achievements, unlockedMap, stats };
}
