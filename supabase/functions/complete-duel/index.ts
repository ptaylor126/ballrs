// Supabase Edge Function for completing duels
// This handles winner determination and rewards server-side to prevent cheating

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

// Duel XP and points - must match client-side constants
const DUEL_XP = { WIN: 75, LOSS: 25, TIE: 40 };
const DUEL_POINTS = { WIN: 3, LOSS: 1, TIE: 2 };

type Sport = 'nba' | 'pl' | 'nfl' | 'mlb';

interface PlayerResult {
  answer: string;
  time: number;
  correct: boolean;
}

interface DuelCompletionRequest {
  duelId: string;
  result: PlayerResult;
  isChallenger: boolean;  // true if player1, false if player2
}

interface DuelCompletionResponse {
  success: boolean;
  duelResult: 'win' | 'loss' | 'tie' | 'pending';
  winnerId: string | null;
  xpAwarded: number;
  pointsAwarded: number;
  achievementsUnlocked: string[];
  error?: string;
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
    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');

    // Create client with user's JWT - RLS will handle authorization
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
      global: { headers: { Authorization: authHeader } },
    });

    // Verify the user
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = user.id;

    // Parse request body
    const body: DuelCompletionRequest = await req.json();
    const { duelId, result, isChallenger } = body;

    // Validate inputs
    if (!duelId || typeof duelId !== 'string') {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid duel ID' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!result || typeof result.correct !== 'boolean') {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid result data' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch the duel
    const { data: duel, error: duelError } = await supabase
      .from('duels')
      .select('*')
      .eq('id', duelId)
      .single();

    if (duelError || !duel) {
      return new Response(
        JSON.stringify({ success: false, error: 'Duel not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user is a participant
    const isPlayer1 = duel.player1_id === userId;
    const isPlayer2 = duel.player2_id === userId;

    if (!isPlayer1 && !isPlayer2) {
      return new Response(
        JSON.stringify({ success: false, error: 'You are not a participant in this duel' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify the isChallenger flag matches actual position
    if ((isChallenger && !isPlayer1) || (!isChallenger && !isPlayer2)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Player position mismatch' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If duel is already completed, just award XP/points based on recorded winner
    if (duel.status === 'completed') {
      let duelResult: 'win' | 'loss' | 'tie';
      let xpAwarded: number;
      let pointsAwarded: number;

      if (duel.winner_id === userId) {
        duelResult = 'win';
        xpAwarded = DUEL_XP.WIN;
        pointsAwarded = DUEL_POINTS.WIN;
      } else if (duel.winner_id === null) {
        duelResult = 'tie';
        xpAwarded = DUEL_XP.TIE;
        pointsAwarded = DUEL_POINTS.TIE;
      } else {
        duelResult = 'loss';
        xpAwarded = DUEL_XP.LOSS;
        pointsAwarded = DUEL_POINTS.LOSS;
      }

      // Award rewards for completed duel
      const sport = duel.sport as Sport;
      await awardDuelRewards(supabase, userId, xpAwarded, pointsAwarded, sport, duelResult === 'win');

      // Check achievements
      const achievementsUnlocked = await checkDuelAchievements(supabase, userId);

      return new Response(
        JSON.stringify({
          success: true,
          duelResult,
          winnerId: duel.winner_id,
          xpAwarded,
          pointsAwarded,
          achievementsUnlocked,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate player score from result
    let playerScore = 0;
    try {
      // For multi-question duels, result.answer contains JSON array of round results
      const roundResults = JSON.parse(result.answer) as PlayerResult[];
      playerScore = roundResults.filter(r => r.correct).length;
    } catch {
      // Single question duel
      playerScore = result.correct ? 1 : 0;
    }

    // Update duel with player's result
    const updateData: Record<string, any> = {};

    if (isPlayer1) {
      updateData.player1_result = result;
      updateData.player1_completed_at = new Date().toISOString();
      updateData.player1_score = playerScore;
    } else {
      updateData.player2_result = result;
      updateData.player2_completed_at = new Date().toISOString();
      updateData.player2_score = playerScore;
    }

    // Check if both players have completed
    const p1Completed = isPlayer1 ? true : !!duel.player1_completed_at;
    const p2Completed = isPlayer2 ? true : !!duel.player2_completed_at;
    const bothCompleted = p1Completed && p2Completed;

    let winnerId: string | null = null;
    let duelResult: 'win' | 'loss' | 'tie' | 'pending' = 'pending';
    let xpAwarded = 0;
    let pointsAwarded = 0;

    if (bothCompleted) {
      // Calculate final scores
      const p1Score = isPlayer1 ? playerScore : (duel.player1_score || 0);
      const p2Score = isPlayer2 ? playerScore : (duel.player2_score || 0);

      // Determine winner based on scores only (no time tiebreaker)
      if (p1Score > p2Score) {
        winnerId = duel.player1_id;
      } else if (p2Score > p1Score) {
        winnerId = duel.player2_id;
      }
      // If scores equal, winnerId stays null (tie)

      updateData.winner_id = winnerId;
      updateData.status = 'completed';

      // Determine this user's result
      if (winnerId === userId) {
        duelResult = 'win';
        xpAwarded = DUEL_XP.WIN;
        pointsAwarded = DUEL_POINTS.WIN;
      } else if (winnerId === null) {
        duelResult = 'tie';
        xpAwarded = DUEL_XP.TIE;
        pointsAwarded = DUEL_POINTS.TIE;
      } else {
        duelResult = 'loss';
        xpAwarded = DUEL_XP.LOSS;
        pointsAwarded = DUEL_POINTS.LOSS;
      }
    }

    // Update the duel
    const { error: updateError } = await supabase
      .from('duels')
      .update(updateData)
      .eq('id', duelId);

    if (updateError) {
      console.error('Error updating duel:', updateError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to update duel' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const achievementsUnlocked: string[] = [];

    // If duel is completed, award XP/points to both players
    if (bothCompleted) {
      const sport = duel.sport as Sport;

      // Award to current user
      await awardDuelRewards(supabase, userId, xpAwarded, pointsAwarded, sport, duelResult === 'win');

      // Award to opponent
      const opponentId = isPlayer1 ? duel.player2_id : duel.player1_id;
      if (opponentId) {
        let opponentResult: 'win' | 'loss' | 'tie';
        let opponentXP: number;
        let opponentPoints: number;

        if (winnerId === opponentId) {
          opponentResult = 'win';
          opponentXP = DUEL_XP.WIN;
          opponentPoints = DUEL_POINTS.WIN;
        } else if (winnerId === null) {
          opponentResult = 'tie';
          opponentXP = DUEL_XP.TIE;
          opponentPoints = DUEL_POINTS.TIE;
        } else {
          opponentResult = 'loss';
          opponentXP = DUEL_XP.LOSS;
          opponentPoints = DUEL_POINTS.LOSS;
        }

        await awardDuelRewards(supabase, opponentId, opponentXP, opponentPoints, sport, opponentResult === 'win');
      }

      // Check achievements for current user
      const unlockedNames = await checkDuelAchievements(supabase, userId);
      achievementsUnlocked.push(...unlockedNames);
    }

    const response: DuelCompletionResponse = {
      success: true,
      duelResult,
      winnerId,
      xpAwarded,
      pointsAwarded,
      achievementsUnlocked,
    };

    console.log(`[complete-duel] User ${userId} duel ${duelId}: ${duelResult}, +${xpAwarded} XP, +${pointsAwarded} points`);

    return new Response(
      JSON.stringify(response),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Edge function error:', err);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error', details: err instanceof Error ? err.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Helper function to award XP and points after duel completion
async function awardDuelRewards(
  supabase: any,
  userId: string,
  xp: number,
  points: number,
  sport: Sport,
  isWin: boolean
) {
  // Fetch current stats
  const { data: stats, error: fetchError } = await supabase
    .from('user_stats')
    .select('*')
    .eq('id', userId)
    .single();

  if (fetchError && fetchError.code !== 'PGRST116') {
    console.error('Error fetching user stats for duel rewards:', fetchError);
    return;
  }

  // Build update object
  const currentXP = stats?.xp || 0;
  const newXP = currentXP + xp;
  const newLevel = calculateLevel(newXP);

  const sportPointsAllTime = `points_all_time_${sport}`;
  const sportPointsWeekly = `points_weekly_${sport}`;
  const sportPointsMonthly = `points_monthly_${sport}`;

  const updateData: Record<string, any> = {
    xp: newXP,
    level: newLevel,
    points_all_time: (stats?.points_all_time || 0) + points,
    points_weekly: (stats?.points_weekly || 0) + points,
    points_monthly: (stats?.points_monthly || 0) + points,
    [sportPointsAllTime]: ((stats as any)?.[sportPointsAllTime] || 0) + points,
    [sportPointsWeekly]: ((stats as any)?.[sportPointsWeekly] || 0) + points,
    [sportPointsMonthly]: ((stats as any)?.[sportPointsMonthly] || 0) + points,
    duels_played: (stats?.duels_played || 0) + 1,
  };

  if (isWin) {
    updateData.duel_wins = (stats?.duel_wins || 0) + 1;
  }

  // Update or create stats
  if (stats) {
    const { error: updateError } = await supabase
      .from('user_stats')
      .update(updateData)
      .eq('id', userId);

    if (updateError) {
      console.error('Error updating duel rewards:', updateError);
    }
  } else {
    // Create new stats row
    const { error: insertError } = await supabase
      .from('user_stats')
      .insert({ id: userId, ...updateData });

    if (insertError) {
      console.error('Error creating user stats for duel rewards:', insertError);
    }
  }
}

// Helper function to check duel achievements
async function checkDuelAchievements(
  supabase: any,
  userId: string
): Promise<string[]> {
  const achievementsUnlocked: string[] = [];

  // Fetch current stats
  const { data: stats } = await supabase
    .from('user_stats')
    .select('duel_wins, duels_played, level')
    .eq('id', userId)
    .single();

  if (!stats) return [];

  // Duel achievement conditions
  const duelConditions: Record<string, (s: any) => boolean> = {
    'Duel Debut': (s) => s.duel_wins >= 1,
    'Duel Champion': (s) => s.duel_wins >= 10,
    'Duel Legend': (s) => s.duel_wins >= 50,
  };

  // Fetch all achievements
  const { data: allAchievements } = await supabase
    .from('achievements')
    .select('*');

  // Fetch user's unlocked achievements
  const { data: unlockedAchievements } = await supabase
    .from('user_achievements')
    .select('achievement_id')
    .eq('user_id', userId);

  const unlockedIds = new Set((unlockedAchievements || []).map((ua: any) => ua.achievement_id));

  // Check each duel achievement
  for (const achievement of (allAchievements || [])) {
    if (unlockedIds.has(achievement.id)) continue;

    const condition = duelConditions[achievement.name];
    if (condition && condition(stats)) {
      // Unlock achievement
      const { error: unlockError } = await supabase
        .from('user_achievements')
        .insert({
          user_id: userId,
          achievement_id: achievement.id,
        });

      if (!unlockError) {
        achievementsUnlocked.push(achievement.name);

        // Award achievement XP
        if (achievement.xp_reward > 0) {
          const { data: currentStats } = await supabase
            .from('user_stats')
            .select('xp')
            .eq('id', userId)
            .single();

          const currentXP = currentStats?.xp || 0;
          const newXP = currentXP + achievement.xp_reward;

          await supabase
            .from('user_stats')
            .update({
              xp: newXP,
              level: calculateLevel(newXP),
            })
            .eq('id', userId);
        }
      }
    }
  }

  return achievementsUnlocked;
}
