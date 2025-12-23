import { supabase } from './supabase';

// Level thresholds: Level 1 = 0, Level 2 = 200, Level 3 = 500, then +400 per level
// Level 1: 0 XP
// Level 2: 200 XP
// Level 3: 500 XP
// Level 4: 900 XP
// Level 5: 1300 XP
// Level 6: 1700 XP
// etc.

export function getXPForLevel(level: number): number {
  if (level <= 1) return 0;
  if (level === 2) return 200;
  if (level === 3) return 500;
  // Level 4+: 500 + (level - 3) * 400
  return 500 + (level - 3) * 400;
}

export function calculateLevel(xp: number): number {
  if (xp < 200) return 1;
  if (xp < 500) return 2;
  // For level 3+: level = 3 + floor((xp - 500) / 400)
  return 3 + Math.floor((xp - 500) / 400);
}

export function getXPProgressInLevel(xp: number): { current: number; required: number; percentage: number } {
  const level = calculateLevel(xp);
  const currentLevelXP = getXPForLevel(level);
  const nextLevelXP = getXPForLevel(level + 1);
  const xpIntoLevel = xp - currentLevelXP;
  const xpNeededForNext = nextLevelXP - currentLevelXP;

  return {
    current: xpIntoLevel,
    required: xpNeededForNext,
    percentage: Math.min(100, (xpIntoLevel / xpNeededForNext) * 100),
  };
}

// Calculate XP for solving a daily puzzle
// Formula: 100 XP - (guesses × 10), minimum 50 XP
// Plus streak bonus: 10 × current streak day
export function calculatePuzzleXP(guesses: number, streakDay: number = 0): { base: number; streakBonus: number; total: number } {
  const base = Math.max(50, 100 - (guesses * 10));
  const streakBonus = streakDay * 10;
  return {
    base,
    streakBonus,
    total: base + streakBonus,
  };
}

// Calculate XP for duel result
// Winner: 75 XP, Loser: 25 XP, Tie: 40 XP each
export function calculateDuelXP(result: 'win' | 'loss' | 'tie'): number {
  switch (result) {
    case 'win': return 75;
    case 'loss': return 25;
    case 'tie': return 40;
  }
}

export interface XPAwardResult {
  success: boolean;
  xpAwarded: number;
  previousXP: number;
  newXP: number;
  previousLevel: number;
  newLevel: number;
  leveledUp: boolean;
}

// Award XP to a user and check for level up
export async function awardXP(userId: string, amount: number): Promise<XPAwardResult | null> {
  try {
    console.log('awardXP called with userId:', userId, 'amount:', amount);

    // Get current stats - user_stats uses 'id' as the column name (not user_id)
    const { data: stats, error: fetchError } = await supabase
      .from('user_stats')
      .select('xp, level')
      .eq('id', userId)
      .single();

    console.log('Fetch result:', { stats, fetchError });

    let previousXP = 0;
    let previousLevel = 1;

    if (fetchError) {
      // No existing row - this shouldn't happen normally as statsService creates it
      console.log('No user_stats row found, error:', fetchError);

      // The row should exist, so just update with xp/level
      const newXP = amount;
      const newLevel = calculateLevel(newXP);

      const { error: upsertError } = await supabase
        .from('user_stats')
        .upsert({
          id: userId,
          xp: newXP,
          level: newLevel,
        });

      if (upsertError) {
        console.error('Error upserting user stats:', upsertError);
        return null;
      }

      console.log('Created/upserted user_stats with XP:', newXP);

      return {
        success: true,
        xpAwarded: amount,
        previousXP: 0,
        newXP,
        previousLevel: 1,
        newLevel,
        leveledUp: newLevel > 1,
      };
    }

    // Row exists - update XP
    previousXP = stats?.xp || 0;
    previousLevel = stats?.level || 1;
    const newXP = previousXP + amount;
    const newLevel = calculateLevel(newXP);
    const leveledUp = newLevel > previousLevel;

    console.log('Updating XP:', { previousXP, newXP, previousLevel, newLevel });

    // Update stats in database
    const { error: updateError } = await supabase
      .from('user_stats')
      .update({
        xp: newXP,
        level: newLevel,
      })
      .eq('id', userId);

    if (updateError) {
      console.error('Error updating XP:', updateError);
      return null;
    }

    console.log('XP update successful');

    return {
      success: true,
      xpAwarded: amount,
      previousXP,
      newXP,
      previousLevel,
      newLevel,
      leveledUp,
    };
  } catch (err) {
    console.error('Error awarding XP:', err);
    return null;
  }
}

// Get user's current XP and level
export async function getUserXP(userId: string): Promise<{ xp: number; level: number } | null> {
  try {
    const { data, error } = await supabase
      .from('user_stats')
      .select('xp, level')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Error fetching user XP:', error);
      return null;
    }

    return {
      xp: data?.xp || 0,
      level: data?.level || 1,
    };
  } catch (err) {
    console.error('Error getting user XP:', err);
    return null;
  }
}
