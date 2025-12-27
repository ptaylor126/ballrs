import { supabase } from './supabase';

// Level thresholds: exponential curve with ~20% more XP per level
// Stored as lookup array for easy tweaking
// Index = level - 1 (so LEVEL_THRESHOLDS[0] = Level 1 = 0 XP)
const LEVEL_THRESHOLDS = [
  0,        // Level 1  (500 to next)
  500,      // Level 2  (500 to next)
  1000,     // Level 3  (700 to next)
  1700,     // Level 4  (850 to next)
  2550,     // Level 5  (1,000 to next)
  3550,     // Level 6  (1,200 to next)
  4750,     // Level 7  (1,500 to next)
  6250,     // Level 8  (1,800 to next)
  8050,     // Level 9  (2,150 to next)
  10200,    // Level 10 (2,600 to next)
  12800,    // Level 11 (2,700 to next)
  15500,    // Level 12 (2,800 to next)
  18300,    // Level 13 (2,900 to next)
  21200,    // Level 14 (2,800 to next)
  24000,    // Level 15 (5,000 to next)
  29000,    // Level 16 (5,000 to next)
  34000,    // Level 17 (5,500 to next)
  39500,    // Level 18 (5,500 to next)
  45000,    // Level 19 (5,000 to next)
  50000,    // Level 20 (10,000 to next)
  60000,    // Level 21 (8,000 to next)
  68000,    // Level 22 (7,000 to next)
  75000,    // Level 23 (7,000 to next)
  82000,    // Level 24 (8,000 to next)
  90000,    // Level 25 (18,000 to next)
  108000,   // Level 26 (12,000 to next)
  120000,   // Level 27 (12,000 to next)
  132000,   // Level 28 (10,000 to next)
  142000,   // Level 29 (8,000 to next)
  150000,   // Level 30
];

// For levels beyond 30, add ~15,000 XP per level
const BEYOND_30_INCREMENT = 15000;

export function getXPForLevel(level: number): number {
  if (level <= 1) return 0;
  if (level <= LEVEL_THRESHOLDS.length) {
    return LEVEL_THRESHOLDS[level - 1];
  }
  // Beyond level 30: continue with fixed increment
  const levelsAfter30 = level - LEVEL_THRESHOLDS.length;
  return LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1] + (levelsAfter30 * BEYOND_30_INCREMENT);
}

export function calculateLevel(xp: number): number {
  // Check lookup array first
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (xp >= LEVEL_THRESHOLDS[i]) {
      // Check if beyond max defined level
      if (i === LEVEL_THRESHOLDS.length - 1) {
        // Calculate levels beyond 30
        const xpAfterMax = xp - LEVEL_THRESHOLDS[i];
        const additionalLevels = Math.floor(xpAfterMax / BEYOND_30_INCREMENT);
        return i + 1 + additionalLevels;
      }
      return i + 1;
    }
  }
  return 1;
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
