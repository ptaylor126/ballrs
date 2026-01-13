// Supabase Edge Function for completing daily puzzles
// Uses user's JWT with RLS for secure access

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

// Level thresholds - must match client-side xpService.ts
const LEVEL_THRESHOLDS = [
  0, 500, 1000, 1700, 2550, 3550, 4750, 6250, 8050, 10200,
  12800, 15500, 18300, 21200, 24000, 29000, 34000, 39500, 45000, 50000,
  60000, 68000, 75000, 82000, 90000, 108000, 120000, 132000, 142000, 150000,
];
const BEYOND_30_INCREMENT = 15000;

type Sport = 'nba' | 'pl' | 'nfl' | 'mlb';

interface PuzzleCompletionRequest {
  oddsJsonId: string;
  guessCount: number;
  sport: Sport;
  completionTimeSeconds: number;
}

function calculateLevel(xp: number): number {
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (xp >= LEVEL_THRESHOLDS[i]) {
      if (i === LEVEL_THRESHOLDS.length - 1) {
        const xpAfterMax = xp - LEVEL_THRESHOLDS[i];
        const additionalLevels = Math.floor(xpAfterMax / BEYOND_30_INCREMENT);
        return i + 1 + additionalLevels;
      }
      return i + 1;
    }
  }
  return 1;
}

// XP: 10 per point (points = 7 - guesses, min 1)
function calculateXP(guessCount: number): number {
  const points = Math.max(1, 7 - guessCount);
  return points * 10;
}

function calculatePoints(guessCount: number): number {
  return Math.max(1, 7 - guessCount);
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get auth header and extract token
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');

    // Create Supabase client with proper auth configuration
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
      global: { headers: { Authorization: authHeader } },
    });

    // Verify user by passing token directly
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = user.id;
    console.log('User authenticated:', userId);

    // Parse request body
    const body: PuzzleCompletionRequest = await req.json();
    const { guessCount, sport, completionTimeSeconds } = body;
    console.log('Request:', { guessCount, sport, completionTimeSeconds });

    // Validate inputs
    if (!guessCount || guessCount < 1 || guessCount > 6) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid guess count' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!['nba', 'pl', 'nfl', 'mlb'].includes(sport)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid sport' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get today's date
    const today = new Date().toISOString().split('T')[0];

    // Check if already completed today
    const { data: existing, error: existingError } = await supabase
      .from('daily_puzzle_completions')
      .select('id')
      .eq('user_id', userId)
      .eq('sport', sport)
      .eq('puzzle_date', today)
      .maybeSingle();

    if (existingError) {
      console.error('Error checking existing completion:', existingError);
    }

    if (existing) {
      return new Response(
        JSON.stringify({ success: false, error: 'Already completed today' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate rewards
    const xpAwarded = calculateXP(guessCount);
    const pointsAwarded = calculatePoints(guessCount);

    // Get current user stats
    const { data: stats, error: statsError } = await supabase
      .from('user_stats')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (statsError) {
      console.error('Error fetching stats:', statsError);
    }
    console.log('Current stats:', stats ? 'found' : 'not found');

    // Calculate new values
    const currentXP = stats?.xp || 0;
    const newTotalXp = currentXP + xpAwarded;
    const newLevel = calculateLevel(newTotalXp);

    // Calculate streaks
    const lastPlayedDate = stats?.last_played_date;
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    let dailyStreak = 1;
    if (lastPlayedDate === today) {
      dailyStreak = stats?.daily_streak || 1;
    } else if (lastPlayedDate === yesterdayStr) {
      dailyStreak = (stats?.daily_streak || 0) + 1;
    }

    const sportStreakKey = `${sport}_current_streak`;
    const sportBestKey = `${sport}_best_streak`;
    const sportTotalKey = `${sport}_total_solved`;

    const currentSportStreak = (stats as any)?.[sportStreakKey] || 0;
    const sportStreak = currentSportStreak + 1;
    const sportBest = Math.max(sportStreak, (stats as any)?.[sportBestKey] || 0);
    const sportTotal = ((stats as any)?.[sportTotalKey] || 0) + 1;

    // Build update data
    const updateData: Record<string, any> = {
      xp: newTotalXp,
      level: newLevel,
      daily_streak: dailyStreak,
      last_played_date: today,
      points_all_time: (stats?.points_all_time || 0) + pointsAwarded,
      points_weekly: (stats?.points_weekly || 0) + pointsAwarded,
      points_monthly: (stats?.points_monthly || 0) + pointsAwarded,
      [sportStreakKey]: sportStreak,
      [sportBestKey]: sportBest,
      [sportTotalKey]: sportTotal,
    };

    // Update or create user_stats
    if (stats) {
      const { error: updateError } = await supabase
        .from('user_stats')
        .update(updateData)
        .eq('id', userId);

      if (updateError) {
        console.error('Stats update error:', updateError);
        return new Response(
          JSON.stringify({ success: false, error: 'Failed to update stats: ' + updateError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else {
      const { error: insertError } = await supabase
        .from('user_stats')
        .insert({ id: userId, ...updateData });

      if (insertError) {
        console.error('Stats insert error:', insertError);
        return new Response(
          JSON.stringify({ success: false, error: 'Failed to create stats: ' + insertError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Record completion
    const { error: completionError } = await supabase
      .from('daily_puzzle_completions')
      .insert({
        user_id: userId,
        sport,
        puzzle_date: today,
        completion_time_seconds: completionTimeSeconds || 0,
        clues_used: guessCount,
      });

    if (completionError) {
      console.error('Completion error:', completionError);
      // Don't fail - stats already updated
    }

    console.log('Success!', { xpAwarded, pointsAwarded, newLevel, dailyStreak, sportStreak });

    return new Response(
      JSON.stringify({
        success: true,
        xpAwarded,
        pointsAwarded,
        newLevel,
        newTotalXp,
        dailyStreak,
        sportStreak,
        achievementsUnlocked: [],
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('Error:', err);
    return new Response(
      JSON.stringify({ success: false, error: err instanceof Error ? err.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
