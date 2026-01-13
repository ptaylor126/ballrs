import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create Supabase client with service role for admin operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    // Create client with user's auth token to verify identity
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    )

    // Get the requesting user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid user token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const userId = user.id
    console.log('Deleting account for user:', userId)

    // Delete all user data in order (same as client-side but with admin privileges)

    // 1. Delete league memberships
    await supabaseAdmin.from('league_members').delete().eq('user_id', userId)

    // 2. Delete friendships
    await supabaseAdmin.from('friends').delete().eq('user_id', userId)
    await supabaseAdmin.from('friends').delete().eq('friend_id', userId)

    // 3. Delete friend requests
    await supabaseAdmin.from('friend_requests').delete().eq('sender_id', userId)
    await supabaseAdmin.from('friend_requests').delete().eq('receiver_id', userId)

    // 4. Delete user achievements
    await supabaseAdmin.from('user_achievements').delete().eq('user_id', userId)

    // 5. Nullify duel references
    await supabaseAdmin.from('duels').update({ player1_id: null }).eq('player1_id', userId)
    await supabaseAdmin.from('duels').update({ player2_id: null }).eq('player2_id', userId)
    await supabaseAdmin.from('duels').update({ winner_id: null }).eq('winner_id', userId)

    // 6. Delete daily puzzle completions
    await supabaseAdmin.from('daily_puzzle_completions').delete().eq('user_id', userId)

    // 7. Delete user stats
    await supabaseAdmin.from('user_stats').delete().eq('id', userId)

    // 8. Delete profile
    const { error: profileError } = await supabaseAdmin.from('profiles').delete().eq('id', userId)

    if (profileError) {
      console.error('Error deleting profile:', profileError)
      return new Response(
        JSON.stringify({ error: 'Failed to delete profile' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 9. Delete the auth user using admin API
    const { error: deleteUserError } = await supabaseAdmin.auth.admin.deleteUser(userId)

    if (deleteUserError) {
      console.error('Error deleting auth user:', deleteUserError)
      // Profile is already deleted, so we log but don't fail
      // The orphaned auth user can be cleaned up later
    }

    console.log('Account deleted successfully:', userId)

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error in delete-account function:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
