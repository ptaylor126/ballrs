import { supabase } from './supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

export interface Duel {
  id: string;
  player1_id: string;
  player2_id: string | null;
  sport: 'nba' | 'pl' | 'nfl' | 'mlb';
  mystery_player_id: string; // Used as question_id for trivia
  player1_guesses: number;
  player2_guesses: number;
  player1_answer: string | null;
  player2_answer: string | null;
  player1_answer_time: number | null; // ms timestamp when answered
  player2_answer_time: number | null;
  winner_id: string | null;
  status: 'waiting' | 'active' | 'completed' | 'invite';
  invite_code: string | null;
  created_at: string;
  round_start_time: string | null; // When the round started (for timer sync)
}

export interface TriviaQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

// Generate a random 6-character alphanumeric code
function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Excluding confusing chars like 0/O, 1/I/L
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Find a waiting duel for a sport
export async function findWaitingDuel(sport: 'nba' | 'pl' | 'nfl' | 'mlb', excludeUserId: string): Promise<Duel | null> {
  const { data, error } = await supabase
    .from('duels')
    .select('*')
    .eq('sport', sport)
    .eq('status', 'waiting')
    .neq('player1_id', excludeUserId)
    .order('created_at', { ascending: true })
    .limit(1)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // No waiting duel found
    }
    console.error('Error finding waiting duel:', error);
    return null;
  }

  return data;
}

// Create a new duel
export async function createDuel(
  userId: string,
  sport: 'nba' | 'pl' | 'nfl' | 'mlb',
  mysteryPlayerId: string
): Promise<Duel | null> {
  const { data, error } = await supabase
    .from('duels')
    .insert({
      player1_id: userId,
      sport,
      mystery_player_id: mysteryPlayerId,
      status: 'waiting',
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating duel:', error);
    return null;
  }

  return data;
}

// Create an invite duel with a unique code
export async function createInviteDuel(
  userId: string,
  sport: 'nba' | 'pl' | 'nfl' | 'mlb',
  mysteryPlayerId: string
): Promise<Duel | null> {
  // Try up to 5 times to generate a unique code
  for (let attempt = 0; attempt < 5; attempt++) {
    const inviteCode = generateInviteCode();

    const { data, error } = await supabase
      .from('duels')
      .insert({
        player1_id: userId,
        sport,
        mystery_player_id: mysteryPlayerId,
        status: 'invite',
        invite_code: inviteCode,
      })
      .select()
      .single();

    if (!error) {
      return data;
    }

    // If it's a unique constraint violation, try again
    if (error.code === '23505') {
      continue;
    }

    console.error('Error creating invite duel:', error);
    return null;
  }

  console.error('Failed to generate unique invite code after 5 attempts');
  return null;
}

// Find a duel by invite code (including expired ones for better error messages)
export async function findDuelByInviteCode(inviteCode: string): Promise<Duel | null> {
  const { data, error } = await supabase
    .from('duels')
    .select('*')
    .eq('invite_code', inviteCode.toUpperCase())
    .eq('status', 'invite')
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // No duel found
    }
    console.error('Error finding duel by invite code:', error);
    return null;
  }

  return data;
}

// Check if a duel is expired (older than 24 hours)
export function isDuelExpired(duel: Duel): boolean {
  const createdAt = new Date(duel.created_at);
  const now = new Date();
  const hoursDiff = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
  return hoursDiff >= 24;
}

// Join duel result types
export type JoinDuelResult =
  | { success: true; duel: Duel }
  | { success: false; error: 'not_found' | 'expired' | 'own_duel' | 'already_joined' | 'failed' };

// Join a duel by invite code with detailed error handling
export async function joinDuelByInviteCode(inviteCode: string, userId: string): Promise<JoinDuelResult> {
  const duel = await findDuelByInviteCode(inviteCode);

  if (!duel) {
    // Check if there's a duel with this code that's already been used
    const { data: usedDuel } = await supabase
      .from('duels')
      .select('*')
      .eq('invite_code', inviteCode.toUpperCase())
      .single();

    if (usedDuel && usedDuel.status !== 'invite') {
      return { success: false, error: 'already_joined' };
    }
    return { success: false, error: 'not_found' };
  }

  // Check if expired (24 hours)
  if (isDuelExpired(duel)) {
    return { success: false, error: 'expired' };
  }

  // Can't join your own duel
  if (duel.player1_id === userId) {
    return { success: false, error: 'own_duel' };
  }

  const joinedDuel = await joinDuel(duel.id, userId);
  if (!joinedDuel) {
    return { success: false, error: 'failed' };
  }

  return { success: true, duel: joinedDuel };
}

// Join an existing duel (works for both 'waiting' and 'invite' status)
export async function joinDuel(duelId: string, userId: string): Promise<Duel | null> {
  const { data, error } = await supabase
    .from('duels')
    .update({
      player2_id: userId,
      status: 'active',
    })
    .eq('id', duelId)
    .in('status', ['waiting', 'invite'])
    .select()
    .single();

  if (error) {
    console.error('Error joining duel:', error);
    return null;
  }

  return data;
}

// Get a duel by ID
export async function getDuel(duelId: string): Promise<Duel | null> {
  const { data, error } = await supabase
    .from('duels')
    .select('*')
    .eq('id', duelId)
    .single();

  if (error) {
    console.error('Error getting duel:', error);
    return null;
  }

  return data;
}

// Update guess count for a player
export async function updateDuelGuesses(
  duelId: string,
  isPlayer1: boolean,
  guessCount: number
): Promise<Duel | null> {
  const field = isPlayer1 ? 'player1_guesses' : 'player2_guesses';

  const { data, error } = await supabase
    .from('duels')
    .update({ [field]: guessCount })
    .eq('id', duelId)
    .select()
    .single();

  if (error) {
    console.error('Error updating duel guesses:', error);
    return null;
  }

  return data;
}

// Complete a duel with a winner
export async function completeDuel(duelId: string, winnerId: string): Promise<Duel | null> {
  const { data, error } = await supabase
    .from('duels')
    .update({
      winner_id: winnerId,
      status: 'completed',
    })
    .eq('id', duelId)
    .select()
    .single();

  if (error) {
    console.error('Error completing duel:', error);
    return null;
  }

  return data;
}

// Cancel a duel (delete it from the database)
export async function cancelDuel(duelId: string): Promise<boolean> {
  const { error } = await supabase
    .from('duels')
    .delete()
    .eq('id', duelId);

  if (error) {
    console.error('Error canceling duel:', error);
    return false;
  }

  return true;
}

// Subscribe to duel updates
export function subscribeToDuel(
  duelId: string,
  onUpdate: (duel: Duel) => void
): RealtimeChannel {
  const channel = supabase
    .channel(`duel:${duelId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'duels',
        filter: `id=eq.${duelId}`,
      },
      (payload) => {
        onUpdate(payload.new as Duel);
      }
    )
    .subscribe();

  return channel;
}

// Unsubscribe from duel updates
export function unsubscribeFromDuel(channel: RealtimeChannel) {
  supabase.removeChannel(channel);
}

// Submit a trivia answer
export async function submitTriviaAnswer(
  duelId: string,
  isPlayer1: boolean,
  answer: string,
  answerTime: number
): Promise<Duel | null> {
  const answerField = isPlayer1 ? 'player1_answer' : 'player2_answer';
  const timeField = isPlayer1 ? 'player1_answer_time' : 'player2_answer_time';

  const { data, error } = await supabase
    .from('duels')
    .update({
      [answerField]: answer,
      [timeField]: answerTime,
    })
    .eq('id', duelId)
    .select()
    .single();

  if (error) {
    console.error('Error submitting trivia answer:', error);
    return null;
  }

  return data;
}

// Set round start time when both players are ready
export async function setRoundStartTime(duelId: string): Promise<Duel | null> {
  const { data, error } = await supabase
    .from('duels')
    .update({
      round_start_time: new Date().toISOString(),
    })
    .eq('id', duelId)
    .select()
    .single();

  if (error) {
    console.error('Error setting round start time:', error);
    return null;
  }

  return data;
}

// Extended duel type with opponent info
export interface DuelWithOpponent extends Duel {
  opponent_username: string | null;
  opponent_id: string | null;
}

// Get active duels for a user (waiting or active)
export async function getActiveDuels(userId: string): Promise<DuelWithOpponent[]> {
  const { data, error } = await supabase
    .from('duels')
    .select('*')
    .or(`player1_id.eq.${userId},player2_id.eq.${userId}`)
    .in('status', ['waiting', 'active'])
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching active duels:', error);
    return [];
  }

  // Fetch opponent usernames separately
  const duelsWithOpponents = await Promise.all((data || []).map(async (duel: any) => {
    const isPlayer1 = duel.player1_id === userId;
    const opponentId = isPlayer1 ? duel.player2_id : duel.player1_id;

    let opponentUsername = null;
    if (opponentId) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', opponentId)
        .single();
      opponentUsername = profile?.username || null;
    }

    return {
      ...duel,
      opponent_id: opponentId,
      opponent_username: opponentUsername,
    };
  }));

  return duelsWithOpponents;
}

// Get incoming challenges for a user (invite duels where they are player2)
export async function getIncomingChallenges(userId: string): Promise<DuelWithOpponent[]> {
  // For incoming challenges, we need to find duels where this user was challenged
  // This would require tracking who was challenged - for now, show all invite duels
  // where the user could potentially join (not their own)
  const { data, error } = await supabase
    .from('duels')
    .select('*')
    .eq('status', 'invite')
    .neq('player1_id', userId)
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('Error fetching incoming challenges:', error);
    return [];
  }

  // Fetch challenger usernames separately
  const challengesWithOpponents = await Promise.all((data || []).map(async (duel: any) => {
    let opponentUsername = null;
    if (duel.player1_id) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', duel.player1_id)
        .single();
      opponentUsername = profile?.username || null;
    }

    return {
      ...duel,
      opponent_id: duel.player1_id,
      opponent_username: opponentUsername,
    };
  }));

  return challengesWithOpponents;
}

// Get duel history for a user (completed duels)
export async function getDuelHistory(userId: string, limit: number = 20): Promise<DuelWithOpponent[]> {
  const { data, error } = await supabase
    .from('duels')
    .select('*')
    .or(`player1_id.eq.${userId},player2_id.eq.${userId}`)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching duel history:', error);
    return [];
  }

  // Fetch opponent usernames separately
  const duelsWithOpponents = await Promise.all((data || []).map(async (duel: any) => {
    const isPlayer1 = duel.player1_id === userId;
    const opponentId = isPlayer1 ? duel.player2_id : duel.player1_id;

    let opponentUsername = null;
    if (opponentId) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', opponentId)
        .single();
      opponentUsername = profile?.username || null;
    }

    return {
      ...duel,
      opponent_id: opponentId,
      opponent_username: opponentUsername,
    };
  }));

  return duelsWithOpponents;
}

// Decline (delete) a challenge
export async function declineChallenge(duelId: string): Promise<boolean> {
  const { error } = await supabase
    .from('duels')
    .delete()
    .eq('id', duelId)
    .eq('status', 'invite');

  if (error) {
    console.error('Error declining challenge:', error);
    return false;
  }

  return true;
}

// Duel stats interface
export interface DuelStats {
  totalDuels: number;
  wins: number;
  losses: number;
  ties: number;
  winRate: number;
  currentStreak: number;
}

// Get duel stats for a user
export async function getDuelStats(userId: string): Promise<DuelStats> {
  const { data, error } = await supabase
    .from('duels')
    .select('winner_id, player1_id, player2_id, created_at')
    .or(`player1_id.eq.${userId},player2_id.eq.${userId}`)
    .eq('status', 'completed')
    .order('created_at', { ascending: false });

  if (error || !data) {
    console.error('Error fetching duel stats:', error);
    return {
      totalDuels: 0,
      wins: 0,
      losses: 0,
      ties: 0,
      winRate: 0,
      currentStreak: 0,
    };
  }

  let wins = 0;
  let losses = 0;
  let ties = 0;
  let currentStreak = 0;
  let streakCounting = true;

  for (const duel of data) {
    const won = duel.winner_id === userId;
    const tie = duel.winner_id === null;

    if (tie) {
      ties++;
      if (streakCounting) streakCounting = false; // Tie breaks streak
    } else if (won) {
      wins++;
      if (streakCounting) currentStreak++;
    } else {
      losses++;
      if (streakCounting) streakCounting = false; // Loss breaks streak
    }
  }

  const totalDuels = wins + losses + ties;
  const winRate = totalDuels > 0 ? Math.round((wins / totalDuels) * 100) : 0;

  return {
    totalDuels,
    wins,
    losses,
    ties,
    winRate,
    currentStreak,
  };
}

// Determine winner based on answers and timing
export function determineWinner(
  duel: Duel,
  correctAnswer: string
): { winnerId: string | null; reason: string } {
  const p1Correct = duel.player1_answer === correctAnswer;
  const p2Correct = duel.player2_answer === correctAnswer;

  // Neither answered or both wrong
  if (!p1Correct && !p2Correct) {
    return { winnerId: null, reason: 'tie_both_wrong' };
  }

  // Only player 1 correct
  if (p1Correct && !p2Correct) {
    return { winnerId: duel.player1_id, reason: 'p1_correct' };
  }

  // Only player 2 correct
  if (!p1Correct && p2Correct) {
    return { winnerId: duel.player2_id, reason: 'p2_correct' };
  }

  // Both correct - fastest wins
  const p1Time = duel.player1_answer_time || Infinity;
  const p2Time = duel.player2_answer_time || Infinity;

  if (p1Time < p2Time) {
    return { winnerId: duel.player1_id, reason: 'p1_faster' };
  } else if (p2Time < p1Time) {
    return { winnerId: duel.player2_id, reason: 'p2_faster' };
  }

  // Exact same time (very rare)
  return { winnerId: null, reason: 'tie_same_time' };
}
