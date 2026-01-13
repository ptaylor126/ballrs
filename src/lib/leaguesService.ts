import { supabase } from './supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

// Helper to get the current authenticated user ID
async function getCurrentUserId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id || null;
}

// Check if error is "table not found" - leagues/league_members tables may not exist yet
function isTableNotFound(error: any): boolean {
  return error?.code === 'PGRST205' ||
         error?.code === '42P01' ||
         error?.message?.includes('Could not find the table') ||
         error?.message?.includes('relation') && error?.message?.includes('does not exist');
}

export type LeagueSport = 'nba' | 'pl' | 'nfl' | 'mlb' | 'all';
export type LeagueDuration = '1_week' | '2_weeks' | '3_weeks' | '1_month';
export type LeagueStatus = 'pending' | 'active' | 'completed';

export interface League {
  id: string;
  name: string;
  created_by: string;
  invite_code: string;
  sport: LeagueSport;
  duration: LeagueDuration;
  status: LeagueStatus;
  starts_at: string;
  ends_at: string;
  created_at: string;
}

export interface LeagueMember {
  id: string;
  league_id: string;
  user_id: string;
  points_weekly: number;
  points_monthly: number;
  points_all_time: number;
  joined_at: string;
  username?: string;
}

export interface LeagueWithMemberCount extends League {
  member_count: number;
  is_creator: boolean;
}

// Duration options for UI
export const DURATION_OPTIONS: { value: LeagueDuration; label: string; days: number }[] = [
  { value: '1_week', label: '1 Week', days: 7 },
  { value: '2_weeks', label: '2 Weeks', days: 14 },
  { value: '3_weeks', label: '3 Weeks', days: 21 },
  { value: '1_month', label: '1 Month', days: 30 },
];

// Get duration in days
export function getDurationDays(duration: LeagueDuration): number {
  const option = DURATION_OPTIONS.find(o => o.value === duration);
  return option?.days || 7;
}

// Calculate league dates based on duration
export function calculateLeagueDates(duration: LeagueDuration): { starts_at: Date; ends_at: Date } {
  const now = new Date();
  const starts_at = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000); // 2 days from now
  starts_at.setHours(0, 0, 0, 0); // Start at midnight

  const durationDays = getDurationDays(duration);
  const ends_at = new Date(starts_at.getTime() + durationDays * 24 * 60 * 60 * 1000);
  ends_at.setHours(23, 59, 59, 999); // End at end of day

  return { starts_at, ends_at };
}

// Get current league status based on dates
export function getLeagueStatus(league: League): LeagueStatus {
  const now = new Date();
  const starts = new Date(league.starts_at);
  const ends = new Date(league.ends_at);

  if (now < starts) return 'pending';
  if (now > ends) return 'completed';
  return 'active';
}

// Get countdown text for league
export function getLeagueCountdown(league: League): { text: string; type: 'pending' | 'active' | 'completed' } {
  const now = new Date();
  const starts = new Date(league.starts_at);
  const ends = new Date(league.ends_at);

  if (now < starts) {
    const diff = starts.getTime() - now.getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    const hours = Math.ceil(diff / (1000 * 60 * 60));

    if (days > 1) {
      return { text: `Starts in ${days} days`, type: 'pending' };
    } else if (hours > 1) {
      return { text: `Starts in ${hours} hours`, type: 'pending' };
    } else {
      return { text: 'Starting soon', type: 'pending' };
    }
  }

  if (now > ends) {
    return { text: 'Completed', type: 'completed' };
  }

  const diff = ends.getTime() - now.getTime();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  const hours = Math.ceil(diff / (1000 * 60 * 60));

  if (days > 1) {
    return { text: `Ends in ${days} days`, type: 'active' };
  } else if (hours > 1) {
    return { text: `Ends in ${hours} hours`, type: 'active' };
  } else {
    return { text: 'Ending soon', type: 'active' };
  }
}

const MAX_MEMBERS = 50;

// Generate a unique 6-character invite code
function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Get all leagues the user is a member of
export async function getUserLeagues(userId: string): Promise<LeagueWithMemberCount[]> {
  // First get league IDs the user is a member of
  const { data: memberships, error: memberError } = await supabase
    .from('league_members')
    .select('league_id')
    .eq('user_id', userId);

  if (memberError) {
    if (!isTableNotFound(memberError)) {
      console.error('Error fetching league memberships:', memberError);
    }
    return [];
  }

  if (!memberships || memberships.length === 0) {
    return [];
  }

  const leagueIds = memberships.map(m => m.league_id);

  // Get league details
  const { data: leagues, error: leagueError } = await supabase
    .from('leagues')
    .select('*')
    .in('id', leagueIds);

  if (leagueError) {
    if (!isTableNotFound(leagueError)) {
      console.error('Error fetching leagues:', leagueError);
    }
    return [];
  }

  if (!leagues) {
    return [];
  }

  // Get member counts for each league
  const leaguesWithCounts: LeagueWithMemberCount[] = [];

  for (const league of leagues) {
    const { count } = await supabase
      .from('league_members')
      .select('*', { count: 'exact', head: true })
      .eq('league_id', league.id);

    leaguesWithCounts.push({
      ...league,
      member_count: count || 0,
      is_creator: league.created_by === userId,
    });
  }

  return leaguesWithCounts.sort((a, b) => a.name.localeCompare(b.name));
}

// Get a league by invite code
export async function getLeagueByInviteCode(inviteCode: string): Promise<League | null> {
  const { data, error } = await supabase
    .from('leagues')
    .select('*')
    .eq('invite_code', inviteCode.toUpperCase())
    .single();

  if (error) {
    if (error.code === 'PGRST116' || isTableNotFound(error)) {
      return null; // Not found or table doesn't exist
    }
    console.error('Error finding league:', error);
    return null;
  }

  return data;
}

// Get member count for a league
export async function getLeagueMemberCount(leagueId: string): Promise<number> {
  const { count, error } = await supabase
    .from('league_members')
    .select('*', { count: 'exact', head: true })
    .eq('league_id', leagueId);

  if (error) {
    if (!isTableNotFound(error)) {
      console.error('Error getting member count:', error);
    }
    return 0;
  }

  return count || 0;
}

// Create a new league
export async function createLeague(
  userId: string,
  name: string,
  sport: LeagueSport,
  duration: LeagueDuration = '1_week'
): Promise<League | null> {
  console.log('=== Creating League ===');
  console.log('User ID:', userId);
  console.log('Name:', name);
  console.log('Sport:', sport);
  console.log('Duration:', duration);

  if (!userId) {
    console.error('Error: No user ID provided');
    return null;
  }

  // Calculate start and end dates
  const { starts_at, ends_at } = calculateLeagueDates(duration);
  console.log('Starts at:', starts_at.toISOString());
  console.log('Ends at:', ends_at.toISOString());

  // Try up to 5 times to generate a unique invite code
  for (let attempt = 0; attempt < 5; attempt++) {
    const inviteCode = generateInviteCode();
    console.log(`Attempt ${attempt + 1}: Invite code = ${inviteCode}`);

    const insertData = {
      name: name.trim(),
      created_by: userId,
      invite_code: inviteCode,
      sport,
      duration,
      status: 'pending' as const,
      starts_at: starts_at.toISOString(),
      ends_at: ends_at.toISOString(),
    };
    console.log('Insert data:', JSON.stringify(insertData, null, 2));

    const { data, error } = await supabase
      .from('leagues')
      .insert(insertData)
      .select()
      .single();

    if (!error && data) {
      console.log('League created successfully:', data.id);
      // Auto-join the creator to their league
      const joinResult = await joinLeague(data.id, userId);
      console.log('Join league result:', joinResult);
      return data;
    }

    // Check if table doesn't exist
    if (isTableNotFound(error)) {
      console.error('Leagues table does not exist. Please create the table in Supabase.');
      return null;
    }

    // Log the full error
    console.error('Supabase error creating league:', {
      code: error?.code,
      message: error?.message,
      details: error?.details,
      hint: error?.hint,
    });

    // If unique constraint violation, try again
    if (error?.code === '23505') {
      console.log('Invite code collision, trying again...');
      continue;
    }

    // For any other error, return null
    return null;
  }

  console.error('Failed to generate unique invite code after 5 attempts');
  return null;
}

// Join league result types
export type JoinLeagueResult =
  | { success: true; league: League }
  | { success: false; error: 'not_found' | 'full' | 'already_member' | 'failed' };

// Join a league by invite code
export async function joinLeagueByCode(
  inviteCode: string,
  userId: string
): Promise<JoinLeagueResult> {
  const league = await getLeagueByInviteCode(inviteCode);

  if (!league) {
    return { success: false, error: 'not_found' };
  }

  // Check if already a member
  const { data: existing } = await supabase
    .from('league_members')
    .select('id')
    .eq('league_id', league.id)
    .eq('user_id', userId)
    .single();

  if (existing) {
    return { success: false, error: 'already_member' };
  }

  // Check member count
  const memberCount = await getLeagueMemberCount(league.id);
  if (memberCount >= MAX_MEMBERS) {
    return { success: false, error: 'full' };
  }

  // Join the league
  const success = await joinLeague(league.id, userId);
  if (!success) {
    return { success: false, error: 'failed' };
  }

  return { success: true, league };
}

// Join a league (internal)
async function joinLeague(leagueId: string, userId: string): Promise<boolean> {
  const { error } = await supabase
    .from('league_members')
    .insert({
      league_id: leagueId,
      user_id: userId,
    });

  if (error) {
    if (error.code === '23505') {
      // Already a member
      return true;
    }
    if (!isTableNotFound(error)) {
      console.error('Error joining league:', error);
    }
    return false;
  }

  return true;
}

// Leave a league
export async function leaveLeague(leagueId: string, userId: string): Promise<boolean> {
  const { error } = await supabase
    .from('league_members')
    .delete()
    .eq('league_id', leagueId)
    .eq('user_id', userId);

  if (error) {
    if (!isTableNotFound(error)) {
      console.error('Error leaving league:', error);
    }
    return false;
  }

  return true;
}

// Delete a league (only creator can do this)
export async function deleteLeague(leagueId: string): Promise<boolean> {
  // Security: Verify the current user is the league creator
  const currentUserId = await getCurrentUserId();
  if (!currentUserId) {
    console.error('Unauthorized: No authenticated user');
    return false;
  }

  // Only delete if the user is the creator
  const { data: deleted, error } = await supabase
    .from('leagues')
    .delete()
    .eq('id', leagueId)
    .eq('created_by', currentUserId)
    .select()
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // No row returned - either doesn't exist or user isn't creator
      console.error('Unauthorized: User is not the league creator or league not found');
      return false;
    }
    if (!isTableNotFound(error)) {
      console.error('Error deleting league:', error);
    }
    return false;
  }

  return !!deleted;
}

// Get league leaderboard
export async function getLeagueLeaderboard(
  leagueId: string,
  period: 'weekly' | 'monthly' | 'all_time' = 'all_time'
): Promise<LeagueMember[]> {
  const pointsColumn = `points_${period}`;

  const { data: members, error } = await supabase
    .from('league_members')
    .select('*')
    .eq('league_id', leagueId)
    .order(pointsColumn, { ascending: false });

  if (error) {
    if (!isTableNotFound(error)) {
      console.error('Error fetching leaderboard:', error);
    }
    return [];
  }

  if (!members || members.length === 0) {
    return [];
  }

  // Get usernames for all members
  const userIds = members.map(m => m.user_id);
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, username')
    .in('id', userIds);

  const usernameMap = new Map(profiles?.map(p => [p.id, p.username]) || []);

  return members.map(m => ({
    ...m,
    username: usernameMap.get(m.user_id) || 'Unknown',
  }));
}

// Subscribe to league member updates
export function subscribeToLeague(
  leagueId: string,
  onUpdate: (members: LeagueMember[]) => void
): RealtimeChannel {
  const channel = supabase
    .channel(`league:${leagueId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'league_members',
        filter: `league_id=eq.${leagueId}`,
      },
      async () => {
        // Refetch the leaderboard on any change
        const members = await getLeagueLeaderboard(leagueId);
        onUpdate(members);
      }
    )
    .subscribe();

  return channel;
}

// Unsubscribe from league updates
export function unsubscribeFromLeague(channel: RealtimeChannel) {
  supabase.removeChannel(channel);
}

// Calculate points based on number of guesses
// 1 guess = 6 points, 2 = 5, 3 = 4, ..., 6 = 1, 7+ = 1, failed = 0
export function calculateLeaguePoints(guessCount: number, solved: boolean): number {
  if (!solved) return 0;
  return Math.max(1, 7 - guessCount);
}

// Check if a league is currently accepting points
export function isLeagueActive(league: League): boolean {
  const now = new Date();
  const starts = new Date(league.starts_at);
  const ends = new Date(league.ends_at);
  return now >= starts && now <= ends;
}

// Update league status in database if needed
export async function updateLeagueStatusIfNeeded(league: League): Promise<void> {
  const currentStatus = getLeagueStatus(league);
  if (currentStatus !== league.status) {
    await supabase
      .from('leagues')
      .update({ status: currentStatus })
      .eq('id', league.id);
  }
}

// Award league points when a user completes a daily puzzle
export async function awardLeaguePoints(
  userId: string,
  sport: 'nba' | 'pl' | 'nfl' | 'mlb',
  guessCount: number,
  solved: boolean
): Promise<boolean> {
  const points = calculateLeaguePoints(guessCount, solved);

  // If no points to award, skip
  if (points === 0) return true;

  try {
    // Get all leagues the user is a member of
    const { data: memberships, error: memberError } = await supabase
      .from('league_members')
      .select('id, league_id')
      .eq('user_id', userId);

    if (memberError || !memberships || memberships.length === 0) {
      return true; // No leagues, nothing to update
    }

    const leagueIds = memberships.map(m => m.league_id);

    // Get leagues that match the sport or are "all sports"
    // AND are currently active (within their time window)
    const now = new Date().toISOString();
    const { data: matchingLeagues, error: leagueError } = await supabase
      .from('leagues')
      .select('id, starts_at, ends_at, status')
      .in('id', leagueIds)
      .or(`sport.eq.${sport},sport.eq.all`)
      .lte('starts_at', now)  // Started before now
      .gte('ends_at', now);   // Ends after now

    if (leagueError || !matchingLeagues || matchingLeagues.length === 0) {
      return true; // No active matching leagues
    }

    // Filter to only include active leagues
    const activeLeagueIds = matchingLeagues
      .filter(l => l.status !== 'completed')
      .map(l => l.id);

    if (activeLeagueIds.length === 0) {
      return true; // No active leagues
    }

    // Get the membership records to update
    const membershipsToUpdate = memberships.filter(m =>
      activeLeagueIds.includes(m.league_id)
    );

    // Update points for each matching league membership
    for (const membership of membershipsToUpdate) {
      // Try RPC for atomic increment first
      const { error } = await supabase.rpc('increment_league_points', {
        member_id: membership.id,
        points_to_add: points,
      });

      if (error) {
        // Fallback: read current values and update
        const { data: current } = await supabase
          .from('league_members')
          .select('points_weekly, points_monthly, points_all_time')
          .eq('id', membership.id)
          .single();

        if (current) {
          await supabase
            .from('league_members')
            .update({
              points_weekly: (current.points_weekly || 0) + points,
              points_monthly: (current.points_monthly || 0) + points,
              points_all_time: (current.points_all_time || 0) + points,
            })
            .eq('id', membership.id);
        }
      }
    }

    return true;
  } catch (err) {
    console.error('Error awarding league points:', err);
    return false;
  }
}
