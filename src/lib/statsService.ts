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
  points_all_time: number;
  points_weekly: number;
  points_monthly: number;
  daily_streak: number;
  last_played_date: string | null;
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

// Update daily streak when user completes any puzzle
// - If last_played_date was yesterday → increment daily_streak
// - If last_played_date was today → do nothing (already played today)
// - If last_played_date was earlier or null → reset to 1 (streak broken)
export async function updateDailyStreak(userId: string): Promise<{ newStreak: number; updated: boolean }> {
  // Get current stats
  const { data: stats, error: fetchError } = await supabase
    .from('user_stats')
    .select('daily_streak, last_played_date')
    .eq('id', userId)
    .single();

  if (fetchError) {
    console.error('Error fetching stats for daily streak:', fetchError);
    return { newStreak: 0, updated: false };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split('T')[0];

  const lastPlayedStr = stats?.last_played_date;
  const currentStreak = stats?.daily_streak || 0;

  // If already played today, don't update
  if (lastPlayedStr === todayStr) {
    console.log('[DailyStreak] Already played today, no update needed');
    return { newStreak: currentStreak, updated: false };
  }

  let newStreak: number;

  if (lastPlayedStr) {
    const lastPlayed = new Date(lastPlayedStr);
    lastPlayed.setHours(0, 0, 0, 0);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (lastPlayed.getTime() === yesterday.getTime()) {
      // Played yesterday - increment streak
      newStreak = currentStreak + 1;
      console.log(`[DailyStreak] Played yesterday, incrementing streak to ${newStreak}`);
    } else {
      // Missed a day - reset to 1
      newStreak = 1;
      console.log('[DailyStreak] Streak broken, resetting to 1');
    }
  } else {
    // First time playing
    newStreak = 1;
    console.log('[DailyStreak] First play, setting streak to 1');
  }

  // Update the database
  const { error: updateError } = await supabase
    .from('user_stats')
    .update({
      daily_streak: newStreak,
      last_played_date: todayStr,
    })
    .eq('id', userId);

  if (updateError) {
    console.error('Error updating daily streak:', updateError);
    return { newStreak: currentStreak, updated: false };
  }

  return { newStreak, updated: true };
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

