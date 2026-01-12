import { supabase } from './supabase';
import { Sport } from './theme';

export interface PuzzleCompletionStats {
  completionTimeSeconds: number;
  cluesUsed: number;
  percentile: number | null;
  totalCompletions: number;
  isFirstSolver: boolean;
}

/**
 * Record a daily puzzle completion
 * @param userId - The user's ID
 * @param sport - The sport ('nba', 'pl', 'nfl', 'mlb')
 * @param completionTimeSeconds - Time to solve in seconds (1 decimal place)
 * @param cluesUsed - Number of clues revealed before solving
 * @returns The completion stats including percentile
 */
export async function recordPuzzleCompletion(
  userId: string,
  sport: Sport,
  completionTimeSeconds: number,
  cluesUsed: number
): Promise<PuzzleCompletionStats | null> {
  // Round time to 1 decimal place
  const roundedTime = Math.round(completionTimeSeconds * 10) / 10;

  // Get today's date in UTC
  const today = new Date().toISOString().split('T')[0];

  try {
    // Insert the completion (upsert in case they somehow complete twice)
    const { error: insertError } = await supabase
      .from('daily_puzzle_completions')
      .upsert({
        user_id: userId,
        sport,
        puzzle_date: today,
        completion_time_seconds: roundedTime,
        clues_used: cluesUsed,
      }, {
        onConflict: 'user_id,sport,puzzle_date',
      });

    if (insertError) {
      console.error('Error recording puzzle completion:', insertError);
      // If it's a duplicate, that's okay - just continue to get stats
      if (!insertError.message.includes('duplicate')) {
        return null;
      }
    }

    // Get the stats including percentile
    return await getPuzzleCompletionStats(userId, sport, today);
  } catch (error) {
    console.error('Error in recordPuzzleCompletion:', error);
    return null;
  }
}

/**
 * Get puzzle completion stats for a user
 * @param userId - The user's ID
 * @param sport - The sport
 * @param puzzleDate - The puzzle date (YYYY-MM-DD format)
 * @returns Completion stats including percentile
 */
export async function getPuzzleCompletionStats(
  userId: string,
  sport: Sport,
  puzzleDate?: string
): Promise<PuzzleCompletionStats | null> {
  const date = puzzleDate || new Date().toISOString().split('T')[0];

  try {
    // Call the database function
    const { data, error } = await supabase
      .rpc('get_puzzle_completion_stats', {
        p_user_id: userId,
        p_puzzle_date: date,
        p_sport: sport,
      });

    if (error) {
      console.error('Error getting puzzle completion stats:', error);
      return null;
    }

    if (!data || data.length === 0) {
      return null;
    }

    const row = data[0];
    return {
      completionTimeSeconds: row.completion_time_seconds,
      cluesUsed: row.clues_used,
      percentile: row.percentile,
      totalCompletions: row.total_completions,
      isFirstSolver: row.is_first_solver,
    };
  } catch (error) {
    console.error('Error in getPuzzleCompletionStats:', error);
    return null;
  }
}

/**
 * Calculate percentile directly (for immediate display after solving)
 * @param sport - The sport
 * @param completionTimeSeconds - The user's completion time
 * @param puzzleDate - The puzzle date
 * @returns Percentile (10, 20, 30, etc.) or null if first solver
 */
export async function calculatePercentile(
  sport: Sport,
  completionTimeSeconds: number,
  puzzleDate?: string
): Promise<{ percentile: number | null; totalCompletions: number; isFirstSolver: boolean }> {
  const date = puzzleDate || new Date().toISOString().split('T')[0];

  try {
    // Get all completions for this puzzle
    const { data, error } = await supabase
      .from('daily_puzzle_completions')
      .select('completion_time_seconds')
      .eq('puzzle_date', date)
      .eq('sport', sport);

    if (error) {
      console.error('Error fetching completions for percentile:', error);
      return { percentile: null, totalCompletions: 0, isFirstSolver: true };
    }

    const completions = data || [];
    const totalCompletions = completions.length;

    // If this is the only completion (or none yet), user is first
    if (totalCompletions <= 1) {
      return { percentile: null, totalCompletions, isFirstSolver: true };
    }

    // Count how many are slower
    const slowerCount = completions.filter(
      c => c.completion_time_seconds > completionTimeSeconds
    ).length;

    // Calculate raw percentile (what % of people you beat)
    const rawPercentile = (slowerCount / totalCompletions) * 100;

    // Convert to "top X%" format and round to nearest 10%
    const topPercentile = Math.max(10, Math.ceil((100 - rawPercentile) / 10) * 10);

    return {
      percentile: topPercentile,
      totalCompletions,
      isFirstSolver: false,
    };
  } catch (error) {
    console.error('Error in calculatePercentile:', error);
    return { percentile: null, totalCompletions: 0, isFirstSolver: true };
  }
}

/**
 * Format completion time for display
 * @param seconds - Time in seconds
 * @returns Formatted string like "3.8 seconds" or "1 minute 23.5 seconds"
 */
export function formatCompletionTime(seconds: number): string {
  const roundedSeconds = Math.round(seconds * 10) / 10;

  if (roundedSeconds < 60) {
    return `${roundedSeconds} second${roundedSeconds !== 1 ? 's' : ''}`;
  }

  const minutes = Math.floor(roundedSeconds / 60);
  const remainingSeconds = Math.round((roundedSeconds % 60) * 10) / 10;

  if (remainingSeconds === 0) {
    return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  }

  return `${minutes}m ${remainingSeconds}s`;
}

/**
 * Format percentile for display
 * @param percentile - Percentile value (10, 20, 30, etc.)
 * @returns Formatted string like "Top 10% today"
 */
export function formatPercentile(percentile: number): string {
  return `Top ${percentile}% today`;
}
