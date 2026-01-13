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

export type Sport = 'nba' | 'pl' | 'nfl' | 'mlb';

// Award points to a user (updates weekly, monthly, and all-time in user_stats)
// If sport is provided, also updates sport-specific columns (if they exist)
export async function awardPoints(userId: string, points: number, sport?: Sport): Promise<boolean> {
  console.log(`[Points] Awarding ${points} points to user ${userId}${sport ? ` for ${sport}` : ''}`);

  // First get current total points (always works)
  const { data: currentStats, error: fetchError } = await supabase
    .from('user_stats')
    .select('points_all_time, points_weekly, points_monthly')
    .eq('id', userId)
    .single();

  if (fetchError) {
    if (fetchError.code === 'PGRST116') {
      console.log('[Points] No user_stats row found, cannot award points');
    } else {
      console.error('[Points] Error fetching current points:', fetchError);
    }
    return false;
  }

  // Calculate new totals
  const newPointsAllTime = (currentStats?.points_all_time || 0) + points;
  const newPointsWeekly = (currentStats?.points_weekly || 0) + points;
  const newPointsMonthly = (currentStats?.points_monthly || 0) + points;

  // Build update object with total points
  const updateData: Record<string, number> = {
    points_all_time: newPointsAllTime,
    points_weekly: newPointsWeekly,
    points_monthly: newPointsMonthly,
  };

  console.log(`[Points] Updating totals:`, updateData);

  // Update total points first (this always works)
  const { error: updateError } = await supabase
    .from('user_stats')
    .update(updateData)
    .eq('id', userId);

  if (updateError) {
    console.error('[Points] Error awarding points:', updateError);
    return false;
  }

  console.log('[Points] Successfully awarded total points');

  // Try to update sport-specific points if sport is provided
  // This is done separately so it doesn't break if columns don't exist yet
  if (sport) {
    try {
      // First check if sport columns exist by trying to select them
      const sportAllTimeKey = `points_all_time_${sport}`;
      const sportWeeklyKey = `points_weekly_${sport}`;
      const sportMonthlyKey = `points_monthly_${sport}`;

      const { data: sportStats, error: sportFetchError } = await supabase
        .from('user_stats')
        .select(`${sportAllTimeKey}, ${sportWeeklyKey}, ${sportMonthlyKey}`)
        .eq('id', userId)
        .single();

      if (sportFetchError) {
        // Column doesn't exist yet - that's OK, just skip sport-specific tracking
        console.log(`[Points] Sport columns not available yet for ${sport}, skipping sport-specific update`);
        return true;
      }

      // Update sport-specific points
      const sportUpdateData: Record<string, number> = {
        [sportAllTimeKey]: ((sportStats as any)?.[sportAllTimeKey] || 0) + points,
        [sportWeeklyKey]: ((sportStats as any)?.[sportWeeklyKey] || 0) + points,
        [sportMonthlyKey]: ((sportStats as any)?.[sportMonthlyKey] || 0) + points,
      };

      console.log(`[Points] Updating ${sport} points:`, sportUpdateData);

      const { error: sportUpdateError } = await supabase
        .from('user_stats')
        .update(sportUpdateData)
        .eq('id', userId);

      if (sportUpdateError) {
        console.warn(`[Points] Could not update sport-specific points for ${sport}:`, sportUpdateError);
        // Don't return false - total points were already awarded
      } else {
        console.log(`[Points] Successfully awarded ${sport} points`);
      }
    } catch (err) {
      console.warn(`[Points] Error updating sport-specific points:`, err);
      // Don't return false - total points were already awarded
    }
  }

  return true;
}

// Award points for daily puzzle completion
export async function awardPuzzlePoints(userId: string, cluesUsed: number, sport?: Sport): Promise<boolean> {
  const points = calculatePuzzlePoints(cluesUsed);
  return awardPoints(userId, points, sport);
}

// Award points for duel completion
export async function awardDuelPoints(userId: string, won: boolean, sport?: Sport): Promise<boolean> {
  const points = won ? DUEL_WIN_POINTS : DUEL_LOSS_POINTS;
  return awardPoints(userId, points, sport);
}

// Get global leaderboard with filter support
export async function getGlobalLeaderboard(
  timePeriod: TimePeriod = 'weekly',
  sportFilter?: string,
  limit: number = 50
): Promise<LeaderboardEntry[]> {
  console.log('[getGlobalLeaderboard] Fetching with:', { timePeriod, sportFilter, limit });

  try {
    // For "ALL" sports filter, we need to aggregate sport-specific columns
    // because the total columns (points_weekly, etc.) may have inconsistent data
    if (!sportFilter || sportFilter === 'all') {
      const prefix = timePeriod === 'weekly' ? 'points_weekly'
        : timePeriod === 'monthly' ? 'points_monthly'
        : 'points_all_time';

      // Query all sport-specific columns for this time period
      const sportColumns = ['nba', 'pl', 'nfl', 'mlb'].map(s => `${prefix}_${s}`);

      const { data: statsData, error: statsError } = await supabase
        .from('user_stats')
        .select(`id, ${sportColumns.join(', ')}`);

      if (statsError) {
        console.error('[getGlobalLeaderboard] Stats query error:', statsError);
        return [];
      }

      if (!statsData || statsData.length === 0) {
        return [];
      }

      // Calculate total points per user by summing sport columns
      const usersWithPoints = statsData
        .map((user: any) => ({
          id: user.id,
          totalPoints: sportColumns.reduce((sum, col) => sum + (user[col] || 0), 0)
        }))
        .filter(u => u.totalPoints > 0)
        .sort((a, b) => b.totalPoints - a.totalPoints)
        .slice(0, limit);

      if (usersWithPoints.length === 0) {
        return [];
      }

      // Get profiles for these users
      const userIds = usersWithPoints.map(u => u.id);
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, username, country')
        .in('id', userIds);

      if (profilesError) {
        console.error('[getGlobalLeaderboard] Profiles query error:', profilesError);
        return [];
      }

      const profilesMap = new Map(
        (profilesData || []).map((p: any) => [p.id, p])
      );

      const entries: LeaderboardEntry[] = usersWithPoints
        .filter(user => profilesMap.has(user.id))
        .map((user, index) => {
          const profile = profilesMap.get(user.id);
          return {
            rank: index + 1,
            user_id: user.id,
            username: profile?.username || 'Unknown',
            country: profile?.country || null,
            points: user.totalPoints,
            avatar: null,
          };
        });

      console.log('[getGlobalLeaderboard] Returning', entries.length, 'aggregated entries');
      return entries;
    }

    // For specific sport filter, use the sport-specific column directly
    const pointsColumn = timePeriod === 'weekly' ? `points_weekly_${sportFilter}`
      : timePeriod === 'monthly' ? `points_monthly_${sportFilter}`
      : `points_all_time_${sportFilter}`;

    console.log('[getGlobalLeaderboard] Using column:', pointsColumn);

    const { data: statsData, error: statsError } = await supabase
      .from('user_stats')
      .select(`id, ${pointsColumn}`)
      .gt(pointsColumn, 0)
      .order(pointsColumn, { ascending: false })
      .limit(limit);

    if (statsError) {
      console.error('[getGlobalLeaderboard] Stats query error:', statsError);
      return [];
    }

    if (!statsData || statsData.length === 0) {
      console.log('[getGlobalLeaderboard] No users with points found');
      return [];
    }

    // Get profiles for these users
    const userIds = statsData.map((u: any) => u.id);
    const { data: profilesData, error: profilesError } = await supabase
      .from('profiles')
      .select('id, username, country')
      .in('id', userIds);

    if (profilesError) {
      console.error('[getGlobalLeaderboard] Profiles query error:', profilesError);
      return [];
    }

    // Create a map of profiles by id
    const profilesMap = new Map(
      (profilesData || []).map((p: any) => [p.id, p])
    );

    // Combine and create leaderboard entries, filtering out deleted users (no profile)
    const entries: LeaderboardEntry[] = statsData
      .filter((user: any) => profilesMap.has(user.id)) // Only include users with profiles
      .map((user: any, index: number) => {
        const profile = profilesMap.get(user.id);
        return {
          rank: index + 1,
          user_id: user.id,
          username: profile?.username || 'Unknown',
          country: profile?.country || null,
          points: user[pointsColumn] || 0,
          avatar: null,
        };
      });

    console.log('[getGlobalLeaderboard] Returning', entries.length, 'entries');
    return entries;
  } catch (error) {
    console.error('[getGlobalLeaderboard] Unexpected error:', error);
    return [];
  }
}

// Get total player count for a time period and optional sport filter
export async function getLeaderboardPlayerCount(
  timePeriod: TimePeriod = 'weekly',
  sportFilter?: string
): Promise<number> {
  // For "ALL" sports filter, count users with any sport-specific points
  if (!sportFilter || sportFilter === 'all') {
    const prefix = timePeriod === 'weekly' ? 'points_weekly'
      : timePeriod === 'monthly' ? 'points_monthly'
      : 'points_all_time';

    const sportColumns = ['nba', 'pl', 'nfl', 'mlb'].map(s => `${prefix}_${s}`);

    const { data, error } = await supabase
      .from('user_stats')
      .select(`id, ${sportColumns.join(', ')}`);

    if (error) {
      console.error('[getLeaderboardPlayerCount] Error:', error);
      return 0;
    }

    // Count users with any points across all sports
    const count = (data || []).filter((user: any) =>
      sportColumns.some(col => (user[col] || 0) > 0)
    ).length;

    return count;
  }

  // For specific sport filter, use the sport-specific column
  const pointsColumn = timePeriod === 'weekly' ? `points_weekly_${sportFilter}`
    : timePeriod === 'monthly' ? `points_monthly_${sportFilter}`
    : `points_all_time_${sportFilter}`;

  const { count, error } = await supabase
    .from('user_stats')
    .select('*', { count: 'exact', head: true })
    .gt(pointsColumn, 0);

  if (error) {
    console.error('[getLeaderboardPlayerCount] Error:', error);
    return 0;
  }

  return count || 0;
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
