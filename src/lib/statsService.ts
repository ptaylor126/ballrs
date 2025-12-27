import { supabase } from './supabase';

export interface UserStats {
  id: string;
  nba_current_streak: number;
  nba_best_streak: number;
  nba_total_solved: number;
  pl_current_streak: number;
  pl_best_streak: number;
  pl_total_solved: number;
  nfl_current_streak: number;
  nfl_best_streak: number;
  nfl_total_solved: number;
  mlb_current_streak: number;
  mlb_best_streak: number;
  mlb_total_solved: number;
  created_at: string;
  updated_at: string;
}

export type Sport = 'nba' | 'pl' | 'nfl' | 'mlb';

// Helper to get current streak for a sport
export function getStreak(stats: UserStats, sport: Sport): number {
  const key = `${sport}_current_streak` as keyof UserStats;
  return (stats[key] as number) ?? 0;
}

// Alias for backwards compatibility
export function getPlayStreak(stats: UserStats, sport: Sport): number {
  return getStreak(stats, sport);
}

// Alias for backwards compatibility
export function getWinStreak(stats: UserStats, sport: Sport): number {
  return getStreak(stats, sport);
}

// Helper to get total streak across all sports
export function getTotalPlayStreak(stats: UserStats): number {
  return (
    getStreak(stats, 'nba') +
    getStreak(stats, 'pl') +
    getStreak(stats, 'nfl') +
    getStreak(stats, 'mlb')
  );
}

// Alias for backwards compatibility
export function getTotalWinStreak(stats: UserStats): number {
  return getTotalPlayStreak(stats);
}

// Fetch user stats from Supabase
export async function fetchUserStats(userId: string): Promise<UserStats | null> {
  const { data, error } = await supabase
    .from('user_stats')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    // If no row exists, create one
    if (error.code === 'PGRST116') {
      return createUserStats(userId);
    }
    console.error('Error fetching user stats:', error);
    return null;
  }

  return data;
}

// Create initial stats for a new user
export async function createUserStats(userId: string): Promise<UserStats | null> {
  const { data, error } = await supabase
    .from('user_stats')
    .insert({ id: userId })
    .select()
    .single();

  if (error) {
    console.error('Error creating user stats:', error);
    return null;
  }

  return data;
}

// Update stats after completing a puzzle with a WIN (correct guess)
// If newStreak is provided, use it (for daily streak logic). Otherwise increment by 1.
export async function updateStatsAfterWin(
  userId: string,
  sport: Sport,
  currentStats: UserStats,
  newStreak?: number
): Promise<UserStats | null> {
  // Legacy keys (these exist in the database)
  const streakKey = `${sport}_current_streak` as keyof UserStats;
  const bestStreakKey = `${sport}_best_streak` as keyof UserStats;
  const totalSolvedKey = `${sport}_total_solved` as keyof UserStats;

  // Use provided streak value or increment by 1 (for backwards compatibility)
  const newCurrentStreak = newStreak !== undefined ? newStreak : (currentStats[streakKey] as number) + 1;
  const newBestStreak = Math.max(newCurrentStreak, currentStats[bestStreakKey] as number);
  const newTotalSolved = (currentStats[totalSolvedKey] as number) + 1;

  const updates: Partial<UserStats> = {
    [streakKey]: newCurrentStreak,
    [bestStreakKey]: newBestStreak,
    [totalSolvedKey]: newTotalSolved,
  };

  const { data, error } = await supabase
    .from('user_stats')
    .update(updates)
    .eq('id', userId)
    .select()
    .single();

  if (error) {
    console.error('Error updating stats after win:', error);
    return null;
  }

  return data;
}

// Update stats after completing a puzzle with a LOSS (failed/gave up)
// Play streak continues (they still played today), but total_solved doesn't increment
export async function updateStatsAfterLoss(
  userId: string,
  sport: Sport,
  currentStats?: UserStats,
  newStreak?: number
): Promise<UserStats | null> {
  // Play streak key (exists in database as current_streak)
  const streakKey = `${sport}_current_streak`;
  const bestStreakKey = `${sport}_best_streak`;

  // If no streak provided, we can't update properly (legacy fallback - just return)
  if (newStreak === undefined || !currentStats) {
    // Legacy behavior: fetch current stats and maintain streak (don't reset)
    const { data, error } = await supabase
      .from('user_stats')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Error fetching stats for legacy loss update:', error);
      return null;
    }
    // Just return current stats without modification (streak maintained)
    return data;
  }

  // Update play streak (they played today, even if they lost)
  const newBestStreak = Math.max(newStreak, currentStats[bestStreakKey as keyof UserStats] as number);

  const updates: Record<string, number> = {
    [streakKey]: newStreak,
    [bestStreakKey]: newBestStreak,
  };

  const { data, error } = await supabase
    .from('user_stats')
    .update(updates)
    .eq('id', userId)
    .select()
    .single();

  if (error) {
    console.error('Error updating stats after loss:', error);
    return null;
  }

  return data;
}

// Reset play streak when user misses a day (called on app load if needed)
export async function resetPlayStreakIfMissedDay(
  userId: string,
  sport: Sport,
  lastPlayedDate: string | null,
  today: string
): Promise<void> {
  if (!lastPlayedDate) return;

  // Check if more than 1 day has passed
  const lastPlayed = new Date(lastPlayedDate);
  const todayDate = new Date(today);
  const diffTime = todayDate.getTime() - lastPlayed.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays > 1) {
    const playStreakKey = `${sport}_play_streak`;

    await supabase
      .from('user_stats')
      .update({ [playStreakKey]: 0 })
      .eq('id', userId);
  }
}
