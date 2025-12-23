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

// Update stats after completing a puzzle
export async function updateStatsAfterWin(
  userId: string,
  sport: Sport,
  currentStats: UserStats
): Promise<UserStats | null> {
  const streakKey = `${sport}_current_streak` as keyof UserStats;
  const bestStreakKey = `${sport}_best_streak` as keyof UserStats;
  const totalSolvedKey = `${sport}_total_solved` as keyof UserStats;

  const newCurrentStreak = (currentStats[streakKey] as number) + 1;
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

// Reset streak after losing
export async function updateStatsAfterLoss(
  userId: string,
  sport: Sport
): Promise<UserStats | null> {
  const streakKey = `${sport}_current_streak`;

  const { data, error } = await supabase
    .from('user_stats')
    .update({ [streakKey]: 0 })
    .eq('id', userId)
    .select()
    .single();

  if (error) {
    console.error('Error updating stats after loss:', error);
    return null;
  }

  return data;
}
