import { supabase } from './supabase';

export interface UserStats {
  id: string;
  // Legacy fields (kept for backwards compatibility, now maps to win streak)
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
  // New play streak fields (increments on any completion)
  nba_play_streak: number;
  nba_best_play_streak: number;
  pl_play_streak: number;
  pl_best_play_streak: number;
  nfl_play_streak: number;
  nfl_best_play_streak: number;
  mlb_play_streak: number;
  mlb_best_play_streak: number;
  // New win streak fields (increments only on correct guess)
  nba_win_streak: number;
  nba_best_win_streak: number;
  pl_win_streak: number;
  pl_best_win_streak: number;
  nfl_win_streak: number;
  nfl_best_win_streak: number;
  mlb_win_streak: number;
  mlb_best_win_streak: number;
  created_at: string;
  updated_at: string;
}

export type Sport = 'nba' | 'pl' | 'nfl' | 'mlb';

// Helper to get play streak for a sport (with fallback to legacy)
export function getPlayStreak(stats: UserStats, sport: Sport): number {
  const playStreakKey = `${sport}_play_streak` as keyof UserStats;
  const legacyKey = `${sport}_current_streak` as keyof UserStats;
  // Use play_streak if available, otherwise fall back to legacy current_streak
  return (stats[playStreakKey] as number) ?? (stats[legacyKey] as number) ?? 0;
}

// Helper to get win streak for a sport (with fallback to legacy)
export function getWinStreak(stats: UserStats, sport: Sport): number {
  const winStreakKey = `${sport}_win_streak` as keyof UserStats;
  const legacyKey = `${sport}_current_streak` as keyof UserStats;
  // Use win_streak if available, otherwise fall back to legacy current_streak
  return (stats[winStreakKey] as number) ?? (stats[legacyKey] as number) ?? 0;
}

// Helper to get total play streak across all sports
export function getTotalPlayStreak(stats: UserStats): number {
  return (
    getPlayStreak(stats, 'nba') +
    getPlayStreak(stats, 'pl') +
    getPlayStreak(stats, 'nfl') +
    getPlayStreak(stats, 'mlb')
  );
}

// Helper to get total win streak across all sports
export function getTotalWinStreak(stats: UserStats): number {
  return (
    getWinStreak(stats, 'nba') +
    getWinStreak(stats, 'pl') +
    getWinStreak(stats, 'nfl') +
    getWinStreak(stats, 'mlb')
  );
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
export async function updateStatsAfterWin(
  userId: string,
  sport: Sport,
  currentStats: UserStats
): Promise<UserStats | null> {
  // Legacy keys (for backwards compatibility)
  const streakKey = `${sport}_current_streak` as keyof UserStats;
  const bestStreakKey = `${sport}_best_streak` as keyof UserStats;
  const totalSolvedKey = `${sport}_total_solved` as keyof UserStats;

  // New play streak keys
  const playStreakKey = `${sport}_play_streak` as keyof UserStats;
  const bestPlayStreakKey = `${sport}_best_play_streak` as keyof UserStats;

  // New win streak keys
  const winStreakKey = `${sport}_win_streak` as keyof UserStats;
  const bestWinStreakKey = `${sport}_best_win_streak` as keyof UserStats;

  // Calculate new values
  const currentPlayStreak = (currentStats[playStreakKey] as number) ?? 0;
  const currentBestPlayStreak = (currentStats[bestPlayStreakKey] as number) ?? 0;
  const currentWinStreak = (currentStats[winStreakKey] as number) ?? 0;
  const currentBestWinStreak = (currentStats[bestWinStreakKey] as number) ?? 0;

  const newPlayStreak = currentPlayStreak + 1;
  const newBestPlayStreak = Math.max(newPlayStreak, currentBestPlayStreak);
  const newWinStreak = currentWinStreak + 1;
  const newBestWinStreak = Math.max(newWinStreak, currentBestWinStreak);

  // Legacy values (keep in sync with win streak for compatibility)
  const newCurrentStreak = (currentStats[streakKey] as number) + 1;
  const newBestStreak = Math.max(newCurrentStreak, currentStats[bestStreakKey] as number);
  const newTotalSolved = (currentStats[totalSolvedKey] as number) + 1;

  const updates: Partial<UserStats> = {
    // Legacy updates
    [streakKey]: newCurrentStreak,
    [bestStreakKey]: newBestStreak,
    [totalSolvedKey]: newTotalSolved,
    // New play streak updates
    [playStreakKey]: newPlayStreak,
    [bestPlayStreakKey]: newBestPlayStreak,
    // New win streak updates
    [winStreakKey]: newWinStreak,
    [bestWinStreakKey]: newBestWinStreak,
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
// Play streak continues, win streak resets
export async function updateStatsAfterLoss(
  userId: string,
  sport: Sport,
  currentStats?: UserStats
): Promise<UserStats | null> {
  // Legacy key
  const streakKey = `${sport}_current_streak`;

  // New play streak keys
  const playStreakKey = `${sport}_play_streak` as keyof UserStats;
  const bestPlayStreakKey = `${sport}_best_play_streak` as keyof UserStats;

  // New win streak key
  const winStreakKey = `${sport}_win_streak`;

  // If we have current stats, increment play streak
  let updates: Record<string, number> = {
    [streakKey]: 0, // Legacy: reset on loss
    [winStreakKey]: 0, // Win streak resets on loss
  };

  if (currentStats) {
    const currentPlayStreak = (currentStats[playStreakKey] as number) ?? 0;
    const currentBestPlayStreak = (currentStats[bestPlayStreakKey] as number) ?? 0;
    const newPlayStreak = currentPlayStreak + 1;
    const newBestPlayStreak = Math.max(newPlayStreak, currentBestPlayStreak);

    updates[playStreakKey as string] = newPlayStreak;
    updates[bestPlayStreakKey as string] = newBestPlayStreak;
  }

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
