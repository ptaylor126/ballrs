// Server-side rewards service
// Calls Edge Functions for secure puzzle and duel completion

import { supabase } from './supabase';

export type Sport = 'nba' | 'pl' | 'nfl' | 'mlb';

export interface PuzzleCompletionResult {
  success: boolean;
  xpAwarded: number;
  pointsAwarded: number;
  newLevel: number;
  newTotalXp: number;
  dailyStreak: number;
  sportStreak: number;
  achievementsUnlocked: string[];
  error?: string;
}

export interface DuelCompletionResult {
  success: boolean;
  duelResult: 'win' | 'loss' | 'tie' | 'pending';
  winnerId: string | null;
  xpAwarded: number;
  pointsAwarded: number;
  achievementsUnlocked: string[];
  error?: string;
}

interface PlayerResult {
  answer: string;
  time: number;
  correct: boolean;
}

// Supabase credentials - must match the ones in supabase.ts
const SUPABASE_URL = 'https://nnnnzouwfxyzpcpynuae.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ubm56b3V3Znh5enBjcHludWFlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYyODY4MzMsImV4cCI6MjA4MTg2MjgzM30.mQoFVIOO0PPMLY9SwlldGxfk2-Wx49VbJbRgzfSBCgE';

/**
 * Complete a daily puzzle and receive rewards (server-side)
 * This is the secure way to complete puzzles - all rewards are calculated server-side
 */
export async function completePuzzleServerSide(
  oddsJsonId: string,
  guessCount: number,
  sport: Sport,
  completionTimeSeconds: number
): Promise<PuzzleCompletionResult> {
  try {
    console.log('[ServerRewards] Calling complete-daily-puzzle with:', { oddsJsonId, guessCount, sport, completionTimeSeconds });

    const { data, error } = await supabase.functions.invoke('complete-daily-puzzle', {
      body: {
        oddsJsonId,
        guessCount,
        sport,
        completionTimeSeconds,
      },
    });

    if (error) {
      console.error('[ServerRewards] Puzzle completion error:', error);
      console.error('[ServerRewards] Error details:', JSON.stringify(error, null, 2));
      console.error('[ServerRewards] Data returned:', data);
      return {
        success: false,
        xpAwarded: 0,
        pointsAwarded: 0,
        newLevel: 1,
        newTotalXp: 0,
        dailyStreak: 0,
        sportStreak: 0,
        achievementsUnlocked: [],
        error: error.message || 'Failed to complete puzzle',
      };
    }

    console.log('[ServerRewards] Puzzle completed:', data);
    return data as PuzzleCompletionResult;
  } catch (err) {
    console.error('[ServerRewards] Puzzle completion exception:', err);
    return {
      success: false,
      xpAwarded: 0,
      pointsAwarded: 0,
      newLevel: 1,
      newTotalXp: 0,
      dailyStreak: 0,
      sportStreak: 0,
      achievementsUnlocked: [],
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

/**
 * Complete a duel and receive rewards (server-side)
 * This is the secure way to complete duels - winner determination and rewards are server-side
 */
export async function completeDuelServerSide(
  duelId: string,
  result: PlayerResult,
  isChallenger: boolean
): Promise<DuelCompletionResult> {
  try {
    console.log('[ServerRewards] Calling complete-duel with:', { duelId, result, isChallenger });

    const { data, error } = await supabase.functions.invoke('complete-duel', {
      body: {
        duelId,
        result,
        isChallenger,
      },
    });

    if (error) {
      console.error('[ServerRewards] Duel completion error:', error);
      return {
        success: false,
        duelResult: 'pending',
        winnerId: null,
        xpAwarded: 0,
        pointsAwarded: 0,
        achievementsUnlocked: [],
        error: error.message || 'Failed to complete duel',
      };
    }

    console.log('[ServerRewards] Duel completed:', data);
    return data as DuelCompletionResult;
  } catch (err) {
    console.error('[ServerRewards] Duel completion exception:', err);
    return {
      success: false,
      duelResult: 'pending',
      winnerId: null,
      xpAwarded: 0,
      pointsAwarded: 0,
      achievementsUnlocked: [],
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}
