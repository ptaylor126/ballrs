import { Share, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Storage key for tracking if user has seen the invite prompt after first duel win
const HAS_SEEN_INVITE_PROMPT_KEY = 'ballrs_has_seen_invite_prompt';

// App store URLs - replace with actual app IDs when published
const IOS_APP_URL = 'https://apps.apple.com/app/ballrs/id6738029498';
const ANDROID_APP_URL = 'https://play.google.com/store/apps/details?id=com.anonymous.ballrs';

/**
 * Get the share message for inviting friends
 * Platform-specific to avoid App Store rejection for mentioning competing platforms
 */
export function getInviteMessage(): string {
  const appUrl = Platform.OS === 'ios' ? IOS_APP_URL : ANDROID_APP_URL;
  return `Think you know ball? \u{1F3C0}\u{26BD}\u{1F3C8}\u{26BE}
I'm playing Ballrs - daily sports trivia puzzles. Challenge me!
Download free: ${appUrl}`;
}

/**
 * Open native share sheet with invite message
 * Returns true if share was successful, false if cancelled or error
 */
export async function inviteFriends(): Promise<boolean> {
  try {
    const message = getInviteMessage();

    const result = await Share.share({
      message,
      // On iOS, we can also set a URL separately which some apps handle better
      ...(Platform.OS === 'ios' && { url: IOS_APP_URL }),
    });

    if (result.action === Share.sharedAction) {
      // User shared successfully
      console.log('[Invite] User shared successfully');
      return true;
    } else if (result.action === Share.dismissedAction) {
      // User dismissed the share sheet (iOS only)
      console.log('[Invite] User dismissed share sheet');
      return false;
    }

    return false;
  } catch (error) {
    console.error('[Invite] Error sharing:', error);
    return false;
  }
}

/**
 * Check if user has seen the invite prompt after first duel win
 */
export async function hasSeenInvitePrompt(): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(HAS_SEEN_INVITE_PROMPT_KEY);
    return value === 'true';
  } catch (error) {
    console.error('[Invite] Error checking invite prompt status:', error);
    return false;
  }
}

/**
 * Mark that user has seen the invite prompt
 */
export async function markInvitePromptSeen(): Promise<void> {
  try {
    await AsyncStorage.setItem(HAS_SEEN_INVITE_PROMPT_KEY, 'true');
    console.log('[Invite] Marked invite prompt as seen');
  } catch (error) {
    console.error('[Invite] Error marking invite prompt as seen:', error);
  }
}

/**
 * Check if this is the user's first duel win
 * Should be called with the user's total duel wins BEFORE incrementing
 */
export function isFirstDuelWin(previousWins: number): boolean {
  return previousWins === 0;
}

// TODO: Future enhancements
// - Referral code tracking for Recruiter achievement
// - Deep link so friend opens directly to sender's profile
// - Track successful invites and reward users
