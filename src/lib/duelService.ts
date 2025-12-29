import { supabase } from './supabase';
import { RealtimeChannel } from '@supabase/supabase-js';
import { sendDuelChallengeNotification, sendDuelResultNotification } from './notificationService';

// Duel status types
export type DuelStatus = 'waiting' | 'active' | 'completed' | 'invite' | 'declined' | 'waiting_for_p2' | 'expired';

// Player result for async duels
export interface PlayerResult {
  answer: string;
  time: number;
  correct: boolean;
}

export interface Duel {
  id: string;
  player1_id: string;
  player2_id: string | null;
  sport: 'nba' | 'pl' | 'nfl' | 'mlb';
  mystery_player_id: string; // Used as question_id for trivia (comma-separated for multi-question)
  player1_guesses: number;
  player2_guesses: number;
  player1_answer: string | null;
  player2_answer: string | null;
  player1_answer_time: number | null; // ms timestamp when answered
  player2_answer_time: number | null;
  winner_id: string | null;
  status: DuelStatus;
  invite_code: string | null;
  created_at: string;
  round_start_time: string | null; // When the round started (for timer sync)
  question_count: number; // Number of questions in the duel (1, 3, 7, or 10)
  current_round: number; // Current round number (1-indexed)
  player1_score: number; // Player 1's score (correct answers)
  player2_score: number; // Player 2's score (correct answers)
  player1_total_time: number; // Player 1's total answer time across all rounds
  player2_total_time: number; // Player 2's total answer time across all rounds
  // Async duel fields
  player1_completed_at: string | null;
  player2_completed_at: string | null;
  expires_at: string | null;
  player1_result: PlayerResult | null;
  player2_result: PlayerResult | null;
}

export type QuestionCategory = 'records' | 'history' | 'current' | 'awards' | 'transfers' | 'moments' | 'team';

export interface TriviaQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: string;
  difficulty: 'easy' | 'medium' | 'hard';
  category: QuestionCategory;
  team?: string; // Optional team association (e.g., "Lakers", "Man Utd")
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

// Get a duel by ID
export async function getDuelById(duelId: string): Promise<Duel | null> {
  const { data, error } = await supabase
    .from('duels')
    .select('*')
    .eq('id', duelId)
    .single();

  if (error) {
    console.error('Error fetching duel by ID:', error);
    return null;
  }

  return data;
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

// Create a new duel (Quick Duel - always 1 question)
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
      question_count: 1,
      current_round: 1,
      player1_score: 0,
      player2_score: 0,
      player1_total_time: 0,
      player2_total_time: 0,
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
  mysteryPlayerId: string,
  questionCount: number = 1
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
        question_count: questionCount,
        current_round: 1,
        player1_score: 0,
        player2_score: 0,
        player1_total_time: 0,
        player2_total_time: 0,
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

// Complete a duel with a winner (null for tie)
export async function completeDuel(duelId: string, winnerId: string | null): Promise<Duel | null> {
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

// Forfeit a duel (player quits mid-game, opponent wins by default)
// Returns the completed duel with winner set, or null on error
export async function forfeitDuel(
  duelId: string,
  forfeitingUserId: string
): Promise<Duel | null> {
  // First get the duel to determine the opponent
  const { data: duel, error: fetchError } = await supabase
    .from('duels')
    .select('*')
    .eq('id', duelId)
    .single();

  if (fetchError || !duel) {
    console.error('Error fetching duel for forfeit:', fetchError);
    return null;
  }

  // Determine the winner (the player who didn't forfeit)
  let winnerId: string | null = null;
  if (duel.player1_id === forfeitingUserId && duel.player2_id) {
    winnerId = duel.player2_id;
  } else if (duel.player2_id === forfeitingUserId) {
    winnerId = duel.player1_id;
  }

  // Update the duel to completed with forfeit
  const { data: completedDuel, error: updateError } = await supabase
    .from('duels')
    .update({
      status: 'completed',
      winner_id: winnerId,
      // Set the forfeiting player's answer to indicate forfeit
      ...(duel.player1_id === forfeitingUserId
        ? { player1_answer: '__FORFEIT__' }
        : { player2_answer: '__FORFEIT__' }),
    })
    .eq('id', duelId)
    .select()
    .single();

  if (updateError) {
    console.error('Error forfeiting duel:', updateError);
    return null;
  }

  return completedDuel;
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
  // Show duels that are:
  // - waiting/invite: waiting for opponent to join
  // - waiting_for_p2: user has played, waiting for friend to play (async duels)
  const { data, error } = await supabase
    .from('duels')
    .select('*')
    .eq('player1_id', userId)
    .in('status', ['waiting', 'invite', 'waiting_for_p2'])
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

// Get incoming challenges for a user (invite duels they can join)
export async function getIncomingChallenges(userId: string): Promise<DuelWithOpponent[]> {
  // Get invite duels where:
  // 1. User is not the creator
  // 2. Either open to anyone (player2_id is null) OR specifically for this user
  // Includes both regular invite duels and async friend duels (where challenger has completed)
  const { data, error } = await supabase
    .from('duels')
    .select('*')
    .eq('status', 'invite')
    .neq('player1_id', userId)
    .or(`player2_id.is.null,player2_id.eq.${userId}`)
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
  // Only show duels from the last 48 hours
  const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('duels')
    .select('*')
    .or(`player1_id.eq.${userId},player2_id.eq.${userId}`)
    .eq('status', 'completed')
    .gte('created_at', fortyEightHoursAgo)
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

// Decline a challenge by updating status to 'declined'
export async function declineChallenge(
  duelId: string,
  challengerId?: string,
  declinerUsername?: string
): Promise<boolean> {
  // Update status to 'declined' instead of deleting
  // This prevents re-fetching issues and works with RLS
  const { data, error } = await supabase
    .from('duels')
    .update({ status: 'declined' })
    .eq('id', duelId)
    .in('status', ['invite', 'waiting'])
    .select();

  if (error) {
    console.error('Error declining challenge:', error);
    return false;
  }

  // Check if any rows were actually updated
  if (!data || data.length === 0) {
    console.error('No duel found to decline or already processed');
    return false;
  }

  // Send notification to challenger if we have their info
  if (challengerId && declinerUsername) {
    const { sendChallengeDeclinedNotification } = await import('./notificationService');
    sendChallengeDeclinedNotification(challengerId, declinerUsername)
      .catch(err => console.log('Failed to send decline notification:', err));
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

// Advance to next round in a multi-question duel
export async function advanceToNextRound(
  duelId: string,
  newQuestionId: string,
  p1Correct: boolean,
  p2Correct: boolean,
  p1AnswerTime: number,
  p2AnswerTime: number
): Promise<Duel | null> {
  // First get current duel state
  const { data: currentDuel, error: fetchError } = await supabase
    .from('duels')
    .select('*')
    .eq('id', duelId)
    .single();

  if (fetchError || !currentDuel) {
    console.error('Error fetching duel for round advance:', fetchError);
    return null;
  }

  // Calculate new scores and total times
  const newPlayer1Score = currentDuel.player1_score + (p1Correct ? 1 : 0);
  const newPlayer2Score = currentDuel.player2_score + (p2Correct ? 1 : 0);
  const newPlayer1TotalTime = currentDuel.player1_total_time + p1AnswerTime;
  const newPlayer2TotalTime = currentDuel.player2_total_time + p2AnswerTime;

  // Append new question ID to the list (comma-separated)
  const questionIds = currentDuel.mystery_player_id + ',' + newQuestionId;

  const { data, error } = await supabase
    .from('duels')
    .update({
      mystery_player_id: questionIds,
      current_round: currentDuel.current_round + 1,
      player1_score: newPlayer1Score,
      player2_score: newPlayer2Score,
      player1_total_time: newPlayer1TotalTime,
      player2_total_time: newPlayer2TotalTime,
      player1_answer: null,
      player2_answer: null,
      player1_answer_time: null,
      player2_answer_time: null,
      round_start_time: null,
    })
    .eq('id', duelId)
    .select()
    .single();

  if (error) {
    console.error('Error advancing to next round:', error);
    return null;
  }

  return data;
}

// Determine final winner for multi-question duel based on score, then total time as tiebreaker
export function determineFinalWinner(
  duel: Duel
): { winnerId: string | null; reason: string } {
  const p1Score = duel.player1_score;
  const p2Score = duel.player2_score;

  // Player 1 has more correct answers
  if (p1Score > p2Score) {
    return { winnerId: duel.player1_id, reason: 'p1_higher_score' };
  }

  // Player 2 has more correct answers
  if (p2Score > p1Score) {
    return { winnerId: duel.player2_id, reason: 'p2_higher_score' };
  }

  // Same score - use total time as tiebreaker
  const p1TotalTime = duel.player1_total_time;
  const p2TotalTime = duel.player2_total_time;

  if (p1TotalTime < p2TotalTime) {
    return { winnerId: duel.player1_id, reason: 'p1_faster_total' };
  } else if (p2TotalTime < p1TotalTime) {
    return { winnerId: duel.player2_id, reason: 'p2_faster_total' };
  }

  // Exact same total time (very rare)
  return { winnerId: null, reason: 'tie_same_total' };
}

// Get question IDs for a multi-question duel (returns array of IDs)
export function getQuestionIds(duel: Duel): string[] {
  return duel.mystery_player_id.split(',');
}

// Get current question ID for a multi-question duel
export function getCurrentQuestionId(duel: Duel): string {
  const questionIds = getQuestionIds(duel);
  // current_round is 1-indexed, so we need index = current_round - 1
  const index = Math.min(duel.current_round - 1, questionIds.length - 1);
  return questionIds[index];
}

// ============================================
// ASYNC FRIEND DUEL FUNCTIONS
// ============================================

// Create an async duel (challenger plays first, friend has 48h to respond)
export async function createAsyncDuel(
  challengerId: string,
  friendId: string,
  sport: 'nba' | 'pl' | 'nfl' | 'mlb',
  questionIds: string,  // Comma-separated question IDs for all rounds
  questionCount: number = 1,
  isRematch: boolean = false
): Promise<Duel | null> {
  console.log('[createAsyncDuel] Creating duel with questions:', questionIds);

  // Try with expires_at first (if migration has been applied)
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 48);

  let { data, error } = await supabase
    .from('duels')
    .insert({
      player1_id: challengerId,
      player2_id: friendId,
      sport,
      mystery_player_id: questionIds,
      status: 'invite', // Use 'invite' status which should exist
      question_count: questionCount,
      current_round: 1,
      player1_score: 0,
      player2_score: 0,
      player1_total_time: 0,
      player2_total_time: 0,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating async duel:', error);
    return null;
  }

  // Send challenge notification to the friend
  if (data) {
    try {
      // Get challenger's username
      const { data: challengerProfile } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', challengerId)
        .single();

      const challengerUsername = challengerProfile?.username || 'Someone';

      // Send notification asynchronously (don't block on it)
      sendDuelChallengeNotification(
        friendId,
        challengerUsername,
        sport,
        data.id,
        isRematch
      ).catch(err => console.log('Failed to send challenge notification:', err));
    } catch (notifError) {
      console.log('Error preparing challenge notification:', notifError);
    }
  }

  return data;
}

// Submit challenger's result (player1) after playing
export async function submitChallengerResult(
  duelId: string,
  result: PlayerResult
): Promise<Duel | null> {
  console.log('submitChallengerResult called:', { duelId, result });

  // Calculate player1's score from the result
  let player1Score = 0;
  try {
    // For multi-question duels, result.answer contains JSON array of round results
    const roundResults = JSON.parse(result.answer) as PlayerResult[];
    player1Score = roundResults.filter(r => r.correct).length;
  } catch {
    // Single question duel
    player1Score = result.correct ? 1 : 0;
  }

  const { data, error } = await supabase
    .from('duels')
    .update({
      player1_result: result,
      player1_completed_at: new Date().toISOString(),
      player1_score: player1Score,
    })
    .eq('id', duelId)
    .select()
    .single();

  if (error) {
    console.error('Error submitting challenger result:', error);
    return null;
  }

  console.log('Challenger result saved:', { player1_result: data?.player1_result });
  return data;
}

// Submit opponent's result (player2) and determine winner
export async function submitOpponentResult(
  duelId: string,
  result: PlayerResult
): Promise<Duel | null> {
  // First get the duel to access player1's result
  const { data: duel, error: fetchError } = await supabase
    .from('duels')
    .select('*')
    .eq('id', duelId)
    .single();

  if (fetchError || !duel) {
    console.error('Error fetching duel for opponent result:', fetchError);
    return null;
  }

  const p1Result = duel.player1_result as PlayerResult | null;
  const p2Result = result;

  // Determine winner
  let winnerId: string | null = null;
  let player1Score = 0;
  let player2Score = 0;

  // Handle case where player1 didn't submit (shouldn't happen but be safe)
  if (!p1Result) {
    console.warn('Player1 result is null, treating as forfeit');
    winnerId = duel.player2_id;
    player2Score = p2Result.correct ? 1 : 0;
  } else {
    // Normal case - both players submitted
    if (p1Result.correct && !p2Result.correct) {
      winnerId = duel.player1_id;
    } else if (!p1Result.correct && p2Result.correct) {
      winnerId = duel.player2_id;
    } else if (p1Result.correct && p2Result.correct) {
      // Both correct - faster wins
      if (p1Result.time < p2Result.time) {
        winnerId = duel.player1_id;
      } else if (p2Result.time < p1Result.time) {
        winnerId = duel.player2_id;
      }
      // If times are equal, winnerId stays null (tie)
    }
    // If both wrong, winnerId stays null (tie)

    // Calculate scores from player results
    try {
      // For multi-question duels, result.answer contains JSON array of round results
      const p1RoundResults = JSON.parse(p1Result.answer) as PlayerResult[];
      const p2RoundResults = JSON.parse(p2Result.answer) as PlayerResult[];
      player1Score = p1RoundResults.filter(r => r.correct).length;
      player2Score = p2RoundResults.filter(r => r.correct).length;
    } catch {
      // Single question duel
      player1Score = p1Result.correct ? 1 : 0;
      player2Score = p2Result.correct ? 1 : 0;
    }
  }

  // Update duel with result, scores, and complete it
  const { data: completedDuel, error: updateError } = await supabase
    .from('duels')
    .update({
      player2_result: result,
      player2_completed_at: new Date().toISOString(),
      player1_score: player1Score,
      player2_score: player2Score,
      winner_id: winnerId,
      status: 'completed',
    })
    .eq('id', duelId)
    .select()
    .single();

  if (updateError) {
    console.error('Error completing async duel:', updateError);
    return null;
  }

  // Send notification to challenger (player1) that duel is complete
  try {
    // Get opponent's username (player2)
    const { data: opponentProfile } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', duel.player2_id)
      .single();

    const opponentUsername = opponentProfile?.username || 'Your opponent';

    // Determine result from challenger's perspective
    let challengerResult: 'win' | 'loss' | 'tie';
    if (winnerId === duel.player1_id) {
      challengerResult = 'win';
    } else if (winnerId === duel.player2_id) {
      challengerResult = 'loss';
    } else {
      challengerResult = 'tie';
    }

    // Send notification asynchronously (don't block on it)
    // Use the already-calculated scores
    sendDuelResultNotification(
      duel.player1_id,
      challengerResult,
      opponentUsername,
      player1Score,
      player2Score,
      duel.sport,
      duelId
    ).catch(err => console.log('Failed to send duel result notification:', err));
  } catch (notifError) {
    console.log('Error preparing duel result notification:', notifError);
  }

  return completedDuel;
}

// Get pending async challenges for a user (duels where they need to play)
export async function getPendingAsyncChallenges(userId: string): Promise<DuelWithOpponent[]> {
  const { data, error } = await supabase
    .from('duels')
    .select('*')
    .eq('player2_id', userId)
    .eq('status', 'invite')
    .not('player1_completed_at', 'is', null)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching pending async challenges:', error);
    return [];
  }

  // Add opponent info (challenger is player1)
  const duelsWithOpponents = await Promise.all((data || []).map(async (duel) => {
    const { data: profile } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', duel.player1_id)
      .single();

    return {
      ...duel,
      opponent_id: duel.player1_id,
      opponent_username: profile?.username || null,
    };
  }));

  return duelsWithOpponents;
}

// Get count of pending async challenges (for badge)
export async function getPendingAsyncChallengesCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('duels')
    .select('*', { count: 'exact', head: true })
    .eq('player2_id', userId)
    .eq('status', 'invite')
    .not('player1_completed_at', 'is', null);

  if (error) {
    console.error('Error fetching pending async challenges count:', error);
    return 0;
  }

  return count || 0;
}

// Get async duels that user created and are waiting for opponent
export async function getWaitingAsyncDuels(userId: string): Promise<DuelWithOpponent[]> {
  const { data, error } = await supabase
    .from('duels')
    .select('*')
    .eq('player1_id', userId)
    .eq('status', 'invite')
    .not('player1_completed_at', 'is', null)
    .is('player2_completed_at', null)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching waiting async duels:', error);
    return [];
  }

  // Add opponent info (opponent is player2)
  const duelsWithOpponents = await Promise.all((data || []).map(async (duel) => {
    let opponentUsername = null;
    if (duel.player2_id) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', duel.player2_id)
        .single();
      opponentUsername = profile?.username || null;
    }

    return {
      ...duel,
      opponent_id: duel.player2_id,
      opponent_username: opponentUsername,
    };
  }));

  return duelsWithOpponents;
}

// Calculate time remaining until async duel expires
export function getTimeRemaining(expiresAt: string | null): { hours: number; minutes: number; expired: boolean } {
  if (!expiresAt) {
    return { hours: 0, minutes: 0, expired: true };
  }

  const now = new Date().getTime();
  const expiry = new Date(expiresAt).getTime();
  const diff = expiry - now;

  if (diff <= 0) {
    return { hours: 0, minutes: 0, expired: true };
  }

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  return { hours, minutes, expired: false };
}
