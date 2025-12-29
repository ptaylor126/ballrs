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

// Award points to a user (updates weekly, monthly, and all-time in user_stats)
export async function awardPoints(userId: string, points: number): Promise<boolean> {
  console.log(`[Points] Awarding ${points} points to user ${userId}`);

  // First get current points
  const { data: currentStats, error: fetchError } = await supabase
    .from('user_stats')
    .select('points_all_time, points_weekly, points_monthly')
    .eq('id', userId)
    .single();

  if (fetchError) {
    // If no row exists, the stats might not be initialized
    if (fetchError.code === 'PGRST116') {
      console.log('[Points] No user_stats row found, cannot award points');
    } else {
      console.error('[Points] Error fetching current points:', fetchError);
    }
    return false;
  }

  const newPointsAllTime = (currentStats?.points_all_time || 0) + points;
  const newPointsWeekly = (currentStats?.points_weekly || 0) + points;
  const newPointsMonthly = (currentStats?.points_monthly || 0) + points;

  console.log(`[Points] Updating: all_time=${newPointsAllTime}, weekly=${newPointsWeekly}, monthly=${newPointsMonthly}`);

  // Update with new points
  const { error: updateError } = await supabase
    .from('user_stats')
    .update({
      points_all_time: newPointsAllTime,
      points_weekly: newPointsWeekly,
      points_monthly: newPointsMonthly,
    })
    .eq('id', userId);

  if (updateError) {
    console.error('[Points] Error awarding points:', updateError);
    return false;
  }

  console.log('[Points] Successfully awarded points');
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

// Get leaderboard directly from user_stats points columns
export async function getFallbackLeaderboard(limit: number = 50): Promise<LeaderboardEntry[]> {
  console.log('[Leaderboard] Fetching from user_stats...');

  // Get user_stats with actual points
  const { data: statsData, error: statsError } = await supabase
    .from('user_stats')
    .select('id, points_all_time')
    .gt('points_all_time', 0)
    .order('points_all_time', { ascending: false })
    .limit(limit);

  if (statsError) {
    console.error('[Leaderboard] Error fetching user stats:', statsError);
    return [];
  }

  console.log(`[Leaderboard] Found ${statsData?.length || 0} users with points`);

  if (!statsData || statsData.length === 0) return [];

  // Get profiles for these users
  const userIds = statsData.map((u: any) => u.id);
  const { data: profilesData, error: profilesError } = await supabase
    .from('profiles')
    .select('id, username, country')
    .in('id', userIds);

  if (profilesError) {
    console.error('Error fetching profiles:', profilesError);
    return [];
  }

  // Create a map of profiles by id
  const profilesMap = new Map(
    (profilesData || []).map((p: any) => [p.id, p])
  );

  // Combine and create leaderboard entries with actual points
  const entries: LeaderboardEntry[] = statsData.map((user: any, index: number) => {
    const profile = profilesMap.get(user.id);
    return {
      rank: index + 1,
      user_id: user.id,
      username: profile?.username || 'Unknown',
      country: profile?.country || null,
      points: user.points_all_time || 0,
      avatar: null,
    };
  });

  return entries;
}

// Get player count (users with points)
export async function getFallbackPlayerCount(): Promise<number> {
  const { count, error } = await supabase
    .from('user_stats')
    .select('*', { count: 'exact', head: true })
    .gt('points_all_time', 0);

  if (error) {
    console.error('Error fetching player count:', error);
    return 0;
  }

  return count || 0;
}
