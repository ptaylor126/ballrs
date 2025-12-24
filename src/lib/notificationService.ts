import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from './supabase';

// Configure how notifications appear when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

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
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;

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
