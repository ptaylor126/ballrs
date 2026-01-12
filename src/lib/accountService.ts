import { supabase } from './supabase';

/**
 * Delete a user account and all associated data
 * First tries the Edge Function (which can delete auth user too)
 * Falls back to client-side deletion if Edge Function fails
 */
export async function deleteUserAccount(userId: string): Promise<boolean> {
  try {
    console.log('Starting account deletion for user:', userId);

    // Try Edge Function first (can delete auth user)
    const edgeFunctionResult = await tryEdgeFunctionDeletion();
    if (edgeFunctionResult) {
      console.log('Account deleted via Edge Function');
      return true;
    }

    // Fall back to client-side deletion
    console.log('Edge Function failed, falling back to client-side deletion');
    return await deleteUserDataClientSide(userId);
  } catch (error) {
    console.error('Error in deleteUserAccount:', error);
    return false;
  }
}

/**
 * Try to delete account via Edge Function
 * This can delete the auth user as well
 */
async function tryEdgeFunctionDeletion(): Promise<boolean> {
  try {
    const { data, error } = await supabase.functions.invoke('delete-account');

    if (error) {
      console.error('Edge Function error:', error);
      return false;
    }

    return data?.success === true;
  } catch (error) {
    console.error('Error calling Edge Function:', error);
    return false;
  }
}

/**
 * Delete user data from client side
 * Cannot delete auth user, but deletes all app data
 */
async function deleteUserDataClientSide(userId: string): Promise<boolean> {
  try {
    // 1. Delete league memberships
    const { error: leagueMembersError } = await supabase
      .from('league_members')
      .delete()
      .eq('user_id', userId);

    if (leagueMembersError) {
      console.error('Error deleting league_members:', leagueMembersError);
    }

    // 2. Delete friendships (where user is either user_id or friend_id)
    const { error: friendsError1 } = await supabase
      .from('friends')
      .delete()
      .eq('user_id', userId);

    if (friendsError1) {
      console.error('Error deleting friends (user_id):', friendsError1);
    }

    const { error: friendsError2 } = await supabase
      .from('friends')
      .delete()
      .eq('friend_id', userId);

    if (friendsError2) {
      console.error('Error deleting friends (friend_id):', friendsError2);
    }

    // 3. Delete friend requests (both directions)
    const { error: friendRequestsError1 } = await supabase
      .from('friend_requests')
      .delete()
      .eq('sender_id', userId);

    if (friendRequestsError1) {
      console.error('Error deleting friend_requests (sender):', friendRequestsError1);
    }

    const { error: friendRequestsError2 } = await supabase
      .from('friend_requests')
      .delete()
      .eq('receiver_id', userId);

    if (friendRequestsError2) {
      console.error('Error deleting friend_requests (receiver):', friendRequestsError2);
    }

    // 4. Delete user achievements
    const { error: achievementsError } = await supabase
      .from('user_achievements')
      .delete()
      .eq('user_id', userId);

    if (achievementsError) {
      console.error('Error deleting user_achievements:', achievementsError);
    }

    // 5. Handle duels - set user references to null instead of deleting
    const { error: duelsError1 } = await supabase
      .from('duels')
      .update({ player1_id: null })
      .eq('player1_id', userId);

    if (duelsError1) {
      console.error('Error nullifying duels (player1):', duelsError1);
    }

    const { error: duelsError2 } = await supabase
      .from('duels')
      .update({ player2_id: null })
      .eq('player2_id', userId);

    if (duelsError2) {
      console.error('Error nullifying duels (player2):', duelsError2);
    }

    const { error: duelsWinnerError } = await supabase
      .from('duels')
      .update({ winner_id: null })
      .eq('winner_id', userId);

    if (duelsWinnerError) {
      console.error('Error nullifying duels (winner):', duelsWinnerError);
    }

    // 6. Delete daily puzzle completions
    const { error: puzzleCompletionsError } = await supabase
      .from('daily_puzzle_completions')
      .delete()
      .eq('user_id', userId);

    if (puzzleCompletionsError) {
      console.error('Error deleting daily_puzzle_completions:', puzzleCompletionsError);
    }

    // 7. Delete user stats
    const { error: statsError } = await supabase
      .from('user_stats')
      .delete()
      .eq('id', userId);

    if (statsError) {
      console.error('Error deleting user_stats:', statsError);
    }

    // 8. Delete profile
    const { error: profileError } = await supabase
      .from('profiles')
      .delete()
      .eq('id', userId);

    if (profileError) {
      console.error('Error deleting profile:', profileError);
      return false;
    }

    console.log('Account data deleted successfully (client-side)');
    return true;
  } catch (error) {
    console.error('Error in deleteUserDataClientSide:', error);
    return false;
  }
}
