import { supabase } from './supabase';

export type TimePeriod = 'weekly' | 'monthly' | 'all_time';

export interface LeaderboardEntry {
  rank: number;
  user_id: string;
  username: string;
  country: string | null;
  points: number;
  avatar: string | null;
}

// Calculate points for daily puzzle based on clues used
// 6 points for 1 clue, 5 for 2, etc. Minimum 1 point for 6 clues
export function calculatePuzzlePoints(cluesUsed: number): number {
  return Math.max(1, 7 - cluesUsed);
}

// Points for duel results
export const DUEL_WIN_POINTS = 3;
export const DUEL_LOSS_POINTS = 1;

// Award points to a user (updates weekly, monthly, and all-time)
export async function awardPoints(userId: string, points: number): Promise<boolean> {
  const { error } = await supabase.rpc('award_leaderboard_points', {
    p_user_id: userId,
    p_points: points,
  });

  if (error) {
    console.error('Error awarding points:', error);
    return false;
  }

  return true;
}

// Award points for daily puzzle completion
export async function awardPuzzlePoints(userId: string, cluesUsed: number): Promise<boolean> {
  const points = calculatePuzzlePoints(cluesUsed);
  return awardPoints(userId, points);
}

// Award points for duel completion
export async function awardDuelPoints(userId: string, won: boolean): Promise<boolean> {
  const points = won ? DUEL_WIN_POINTS : DUEL_LOSS_POINTS;
  return awardPoints(userId, points);
}

// Get global leaderboard
export async function getGlobalLeaderboard(
  timePeriod: TimePeriod = 'weekly',
  sportFilter?: string,
  limit: number = 50
): Promise<LeaderboardEntry[]> {
  const { data, error } = await supabase.rpc('get_global_leaderboard', {
    p_time_period: timePeriod,
    p_sport_filter: sportFilter || null,
    p_limit: limit,
  });

  if (error) {
    console.error('Error fetching leaderboard:', error);
    return [];
  }

  return data || [];
}

// Get total player count for a time period
export async function getLeaderboardPlayerCount(timePeriod: TimePeriod = 'weekly'): Promise<number> {
  const { data, error } = await supabase.rpc('get_leaderboard_player_count', {
    p_time_period: timePeriod,
  });

  if (error) {
    console.error('Error fetching player count:', error);
    return 0;
  }

  return data || 0;
}

// Get user's current points
export async function getUserPoints(userId: string): Promise<{
  weekly: number;
  monthly: number;
  allTime: number;
} | null> {
  const { data, error } = await supabase
    .from('user_stats')
    .select('points_weekly, points_monthly, points_all_time')
    .eq('user_id', userId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // No row found
      return { weekly: 0, monthly: 0, allTime: 0 };
    }
    console.error('Error fetching user points:', error);
    return null;
  }

  return {
    weekly: data.points_weekly || 0,
    monthly: data.points_monthly || 0,
    allTime: data.points_all_time || 0,
  };
}

// Get user's rank for a time period
export async function getUserRank(userId: string, timePeriod: TimePeriod = 'weekly'): Promise<number | null> {
  // Fetch the full leaderboard and find user's position
  const leaderboard = await getGlobalLeaderboard(timePeriod, undefined, 1000);
  const userEntry = leaderboard.find(entry => entry.user_id === userId);
  return userEntry?.rank || null;
}
