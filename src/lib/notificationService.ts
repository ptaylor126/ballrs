import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

const NOTIFICATION_PROMPT_KEY = 'notificationPromptDismissedAt';

// Configure how notifications appear when app is in foreground
// Wrapped in try-catch to prevent crashes on Android if native module isn't ready
try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
} catch (error) {
  console.warn('Failed to set notification handler:', error);
}

// Register for push notifications and get token
export async function registerForPushNotifications(): Promise<string | null> {
  let token: string | null = null;

  // Check if physical device (push notifications don't work on simulators)
  if (!Device.isDevice) {
    console.log('Push notifications require a physical device');
    return null;
  }

  // Check/request permissions
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('Push notification permissions not granted');
    return null;
  }

  // Get Expo push token
  try {
    // Safely access projectId with multiple fallbacks
    let projectId: string | undefined;
    try {
      projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    } catch (e) {
      console.log('Could not access Constants for projectId:', e);
    }

    // If no projectId, push notifications won't work (need EAS setup)
    if (!projectId) {
      console.log('No projectId found - push notifications require EAS setup. Skipping registration.');
      return null;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId,
    });
    token = tokenData.data;
  } catch (error) {
    // Gracefully handle errors - push notifications are optional
    console.log('Push notifications not available:', error);
    return null;
  }

  // Android specific channel setup
  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#1ABC9C',
    });
  }

  return token;
}

// Save push token to user's profile
export async function savePushToken(userId: string, token: string): Promise<boolean> {
  const { error } = await supabase
    .from('profiles')
    .update({ push_token: token })
    .eq('id', userId);

  if (error) {
    console.error('Error saving push token:', error);
    return false;
  }

  return true;
}

// Get push token for a user
export async function getUserPushToken(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('push_token')
    .eq('id', userId)
    .single();

  if (error || !data?.push_token) {
    return null;
  }

  return data.push_token;
}

// Send push notification to a user
export async function sendPushNotification(
  expoPushToken: string,
  title: string,
  body: string,
  data?: Record<string, any>
): Promise<boolean> {
  // Skip on web - CORS blocks direct API calls to Expo push service
  if (Platform.OS === 'web') {
    console.log('Push notifications not supported on web');
    return false;
  }

  const message = {
    to: expoPushToken,
    sound: 'default',
    title,
    body,
    data: data || {},
  };

  try {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    const result = await response.json();
    if (result.data?.status === 'error') {
      console.error('Push notification error:', result.data.message);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error sending push notification:', error);
    return false;
  }
}

// Send challenge notification to a friend
export async function sendChallengeNotification(
  friendUserId: string,
  challengerUsername: string,
  sport: string,
  inviteCode: string
): Promise<boolean> {
  // Get friend's push token
  const pushToken = await getUserPushToken(friendUserId);

  if (!pushToken) {
    console.log('Friend does not have push notifications enabled');
    return false;
  }

  const sportNames: Record<string, string> = {
    nba: 'NBA',
    pl: 'Premier League',
    nfl: 'NFL',
    mlb: 'MLB',
  };

  return sendPushNotification(
    pushToken,
    `${challengerUsername} challenged you!`,
    `Join their ${sportNames[sport] || sport} trivia duel. Code: ${inviteCode}`,
    {
      type: 'challenge',
      inviteCode,
      sport,
    }
  );
}

// Add notification listeners
export function addNotificationListeners(
  onNotificationReceived?: (notification: Notifications.Notification) => void,
  onNotificationResponse?: (response: Notifications.NotificationResponse) => void
) {
  const receivedSubscription = Notifications.addNotificationReceivedListener(
    notification => {
      onNotificationReceived?.(notification);
    }
  );

  const responseSubscription = Notifications.addNotificationResponseReceivedListener(
    response => {
      onNotificationResponse?.(response);
    }
  );

  return () => {
    receivedSubscription.remove();
    responseSubscription.remove();
  };
}

// Check if notifications are already enabled
export async function areNotificationsEnabled(): Promise<boolean> {
  if (!Device.isDevice) return false;

  const { status } = await Notifications.getPermissionsAsync();
  return status === 'granted';
}

// Check if we should show the notification prompt
// Returns true if: notifications not enabled AND (never dismissed OR dismissed > 7 days ago)
export async function shouldShowNotificationPrompt(): Promise<boolean> {
  // First check if notifications are already enabled
  const enabled = await areNotificationsEnabled();
  if (enabled) return false;

  // Check if user dismissed the prompt recently
  try {
    const dismissedAt = await AsyncStorage.getItem(NOTIFICATION_PROMPT_KEY);
    if (!dismissedAt) return true; // Never dismissed

    const dismissedDate = new Date(dismissedAt);
    const now = new Date();
    const daysSinceDismissed = (now.getTime() - dismissedDate.getTime()) / (1000 * 60 * 60 * 24);

    return daysSinceDismissed >= 7; // Show again after 7 days
  } catch {
    return true; // On error, show the prompt
  }
}

// Mark the notification prompt as dismissed
export async function dismissNotificationPrompt(): Promise<void> {
  try {
    await AsyncStorage.setItem(NOTIFICATION_PROMPT_KEY, new Date().toISOString());
  } catch (error) {
    console.error('Error saving notification prompt dismissal:', error);
  }
}

// Request notification permissions and save token
export async function requestAndSaveNotifications(userId: string): Promise<boolean> {
  const token = await registerForPushNotifications();
  if (token) {
    await savePushToken(userId, token);
    return true;
  }
  return false;
}

// Sport name mapping
const sportNames: Record<string, string> = {
  nba: 'NBA',
  pl: 'EPL',
  nfl: 'NFL',
  mlb: 'MLB',
};

// Send notification when a duel challenge is created
export async function sendDuelChallengeNotification(
  opponentUserId: string,
  challengerUsername: string,
  sport: string,
  duelId: string,
  isRematch: boolean = false
): Promise<boolean> {
  const pushToken = await getUserPushToken(opponentUserId);

  if (!pushToken) {
    console.log('Opponent does not have push notifications enabled');
    return false;
  }

  const sportName = sportNames[sport] || sport.toUpperCase();

  const title = isRematch ? 'Rematch! 🔥' : 'New Challenge! ⚔️';
  const body = isRematch
    ? `${challengerUsername} wants a rematch!`
    : `${challengerUsername} challenged you to ${sportName} trivia!`;

  return sendPushNotification(
    pushToken,
    title,
    body,
    {
      type: 'duel_challenge',
      duelId,
      sport,
    }
  );
}

// Send notification when a challenge is declined
export async function sendChallengeDeclinedNotification(
  challengerUserId: string,
  declinerUsername: string
): Promise<boolean> {
  const pushToken = await getUserPushToken(challengerUserId);

  if (!pushToken) {
    console.log('Challenger does not have push notifications enabled');
    return false;
  }

  return sendPushNotification(
    pushToken,
    'Challenge Declined',
    `${declinerUsername} declined your challenge`,
    {
      type: 'challenge_declined',
    }
  );
}

// Send notification when duel results are ready
export async function sendDuelResultNotification(
  recipientUserId: string,
  result: 'win' | 'loss' | 'tie',
  opponentUsername: string,
  yourScore: number,
  theirScore: number,
  sport: string,
  duelId: string
): Promise<boolean> {
  const pushToken = await getUserPushToken(recipientUserId);

  if (!pushToken) {
    console.log('Recipient does not have push notifications enabled');
    return false;
  }

  const sportName = sportNames[sport] || sport.toUpperCase();
  let title: string;
  let body: string;

  switch (result) {
    case 'win':
      title = 'You Won! 🎉';
      body = `Beat ${opponentUsername} ${yourScore}-${theirScore} in ${sportName}. Tap to see results.`;
      break;
    case 'loss':
      title = 'Duel Complete';
      body = `${opponentUsername} won ${theirScore}-${yourScore} in ${sportName}. Tap to see results.`;
      break;
    case 'tie':
      title = "It's a Tie! 🤝";
      body = `You and ${opponentUsername} tied ${yourScore}-${theirScore} in ${sportName}. Tap to see results.`;
      break;
  }

  return sendPushNotification(
    pushToken,
    title,
    body,
    {
      type: 'duel_complete',
      duelId,
      result,
    }
  );
}

// Send notification when a friend request is received
export async function sendFriendRequestNotification(
  recipientUserId: string,
  senderUsername: string,
  requestId: string,
  senderUserId: string
): Promise<boolean> {
  const pushToken = await getUserPushToken(recipientUserId);

  if (!pushToken) {
    console.log('Recipient does not have push notifications enabled');
    return false;
  }

  return sendPushNotification(
    pushToken,
    'Friend Request 👋',
    `${senderUsername} wants to be friends!`,
    {
      type: 'friend_request',
      from_user_id: senderUserId,
      request_id: requestId,
    }
  );
}

// Send notification when a friend request is accepted
export async function sendFriendAcceptedNotification(
  recipientUserId: string,
  accepterUsername: string,
  friendId: string
): Promise<boolean> {
  const pushToken = await getUserPushToken(recipientUserId);

  if (!pushToken) {
    console.log('Recipient does not have push notifications enabled');
    return false;
  }

  return sendPushNotification(
    pushToken,
    'Request Accepted ✓',
    `${accepterUsername} accepted your friend request!`,
    {
      type: 'friend_accepted',
      friend_id: friendId,
    }
  );
}

// Legacy function - kept for backwards compatibility
export async function sendAsyncDuelCompletedNotification(
  challengerUserId: string,
  opponentUsername: string,
  duelId: string,
  challengerWon: boolean
): Promise<boolean> {
  // Use the new function with appropriate parameters
  return sendDuelResultNotification(
    challengerUserId,
    challengerWon ? 'win' : 'loss',
    opponentUsername,
    challengerWon ? 1 : 0, // Simple scores for single-question duels
    challengerWon ? 0 : 1,
    'nba', // Default sport - will be updated when called with proper context
    duelId
  );
}

// ============================================
// STREAK REMINDER NOTIFICATIONS
// ============================================

const STREAK_REMINDER_ID = 'streak-reminder-8pm';

// Schedule a daily streak reminder notification at 8pm local time
// This will only show if the user hasn't played today and has an active streak
export async function scheduleStreakReminder(
  dailyStreak: number,
  lastPlayedDate: string | null
): Promise<void> {
  // Skip if no streak to protect
  if (dailyStreak < 1) {
    console.log('[StreakReminder] No streak to protect, skipping');
    await cancelStreakReminder();
    return;
  }

  // Check if already played today
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split('T')[0];

  if (lastPlayedDate === todayStr) {
    console.log('[StreakReminder] Already played today, cancelling reminder');
    await cancelStreakReminder();
    return;
  }

  // Cancel any existing reminder first
  await cancelStreakReminder();

  // Schedule for 8pm today (or tomorrow if past 8pm)
  const now = new Date();
  const trigger8pm = new Date();
  trigger8pm.setHours(20, 0, 0, 0); // 8:00 PM

  // If it's already past 8pm today, don't schedule
  // (they'll get reminded tomorrow if they still haven't played)
  if (now.getTime() >= trigger8pm.getTime()) {
    console.log('[StreakReminder] Past 8pm, will check again tomorrow');
    return;
  }

  // Calculate seconds until 8pm
  const secondsUntil8pm = Math.floor((trigger8pm.getTime() - now.getTime()) / 1000);

  try {
    await Notifications.scheduleNotificationAsync({
      identifier: STREAK_REMINDER_ID,
      content: {
        title: "Don't lose your streak! 🔥",
        body: `You're on a ${dailyStreak} day streak. Play today to keep it going!`,
        sound: 'default',
        data: { type: 'streak_reminder' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: secondsUntil8pm,
      },
    });
    console.log(`[StreakReminder] Scheduled for ${secondsUntil8pm} seconds (8pm local)`);
  } catch (error) {
    console.error('[StreakReminder] Error scheduling notification:', error);
  }
}

// Cancel any scheduled streak reminder
export async function cancelStreakReminder(): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(STREAK_REMINDER_ID);
    console.log('[StreakReminder] Cancelled existing reminder');
  } catch (error) {
    // Ignore errors - notification might not exist
  }
}

// Check and schedule streak reminder based on user stats
// Call this on app launch and after playing
export async function updateStreakReminderFromStats(userId: string): Promise<void> {
  try {
    const { data, error } = await supabase
      .from('user_stats')
      .select('daily_streak, last_played_date')
      .eq('id', userId)
      .single();

    if (error || !data) {
      console.log('[StreakReminder] No stats found for user');
      return;
    }

    await scheduleStreakReminder(data.daily_streak || 0, data.last_played_date);
  } catch (error) {
    console.error('[StreakReminder] Error updating reminder:', error);
  }
}
