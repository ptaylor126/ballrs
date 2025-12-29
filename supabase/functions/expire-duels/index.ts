// Supabase Edge Function to expire async duels that have exceeded their 48h window
// This should be scheduled to run hourly via Supabase Dashboard (cron: 0 * * * *)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// XP amount for forfeit win
const FORFEIT_WIN_XP = 75;

interface Duel {
  id: string;
  player1_id: string;
  player2_id: string;
  status: string;
  expires_at: string;
}

Deno.serve(async (req: Request) => {
  try {
    // Create Supabase client with service role key for admin access
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Find all expired duels that are still waiting for player 2
    const { data: expiredDuels, error: fetchError } = await supabase
      .from('duels')
      .select('id, player1_id, player2_id, status, expires_at')
      .eq('status', 'waiting_for_p2')
      .lt('expires_at', new Date().toISOString());

    if (fetchError) {
      console.error('Error fetching expired duels:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch expired duels', details: fetchError.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!expiredDuels || expiredDuels.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No expired duels found', processed: 0 }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${expiredDuels.length} expired duels to process`);

    let processedCount = 0;
    const errors: string[] = [];

    for (const duel of expiredDuels as Duel[]) {
      try {
        // Update duel status to expired and set challenger as winner
        const { error: updateError } = await supabase
          .from('duels')
          .update({
            status: 'expired',
            winner_id: duel.player1_id,
            player2_completed_at: new Date().toISOString(),
          })
          .eq('id', duel.id);

        if (updateError) {
          errors.push(`Failed to update duel ${duel.id}: ${updateError.message}`);
          continue;
        }

        // Award XP to challenger (player1) for forfeit win
        // First get current XP
        const { data: xpData, error: xpFetchError } = await supabase
          .from('user_xp')
          .select('xp, level')
          .eq('user_id', duel.player1_id)
          .single();

        if (xpFetchError && xpFetchError.code !== 'PGRST116') {
          errors.push(`Failed to fetch XP for user ${duel.player1_id}: ${xpFetchError.message}`);
          continue;
        }

        const currentXP = xpData?.xp || 0;
        const newXP = currentXP + FORFEIT_WIN_XP;

        // Calculate new level (simple formula: level = floor(xp / 100) + 1)
        const newLevel = Math.floor(newXP / 100) + 1;

        // Upsert the XP
        const { error: xpUpdateError } = await supabase
          .from('user_xp')
          .upsert({
            user_id: duel.player1_id,
            xp: newXP,
            level: newLevel,
          }, {
            onConflict: 'user_id',
          });

        if (xpUpdateError) {
          errors.push(`Failed to update XP for user ${duel.player1_id}: ${xpUpdateError.message}`);
          continue;
        }

        processedCount++;
        console.log(`Processed duel ${duel.id}: challenger ${duel.player1_id} wins by forfeit, awarded ${FORFEIT_WIN_XP} XP`);
      } catch (err) {
        errors.push(`Error processing duel ${duel.id}: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }

    return new Response(
      JSON.stringify({
        message: `Processed ${processedCount} expired duels`,
        processed: processedCount,
        total: expiredDuels.length,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Edge function error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: err instanceof Error ? err.message : 'Unknown error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
