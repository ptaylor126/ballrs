// Supabase Edge Function to send daily puzzle reminder notifications
// This should be scheduled to run daily at 11:00 AM UTC via pg_cron

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Expo push notification API endpoint
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

// Batch size for Expo push notifications (max 100 per request)
const BATCH_SIZE = 100;

interface PushMessage {
  to: string;
  sound: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

interface ExpoPushResponse {
  data: Array<{
    status: 'ok' | 'error';
    message?: string;
    details?: {
      error?: string;
    };
  }>;
}

// Send batch of push notifications to Expo
async function sendPushNotificationBatch(messages: PushMessage[]): Promise<{ sent: number; failed: number }> {
  try {
    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });

    if (!response.ok) {
      console.error(`Expo API error: ${response.status} ${response.statusText}`);
      return { sent: 0, failed: messages.length };
    }

    const result: ExpoPushResponse = await response.json();

    let sent = 0;
    let failed = 0;

    for (const ticket of result.data) {
      if (ticket.status === 'ok') {
        sent++;
      } else {
        failed++;
        if (ticket.details?.error === 'DeviceNotRegistered') {
          // Token is no longer valid - could mark for cleanup
          console.log('Device not registered, token should be cleaned up');
        }
      }
    }

    return { sent, failed };
  } catch (error) {
    console.error('Error sending push notification batch:', error);
    return { sent: 0, failed: messages.length };
  }
}

Deno.serve(async (req: Request) => {
  try {
    // Create Supabase client with service role key for admin access
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Query all users with push tokens
    const { data: users, error: fetchError } = await supabase
      .from('profiles')
      .select('id, push_token')
      .not('push_token', 'is', null);

    if (fetchError) {
      console.error('Error fetching users with push tokens:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch users', details: fetchError.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!users || users.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No users with push tokens found', sent: 0 }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${users.length} users with push tokens`);

    // Build notification messages
    const messages: PushMessage[] = users
      .filter(user => user.push_token)
      .map(user => ({
        to: user.push_token,
        sound: 'default',
        title: "Daily Challenge Ready! \u{1F3C0}\u{26BD}\u{1F3C8}\u{26BE}",
        body: "Your new puzzles are waiting. Keep your streak alive!",
        data: {
          type: 'daily_reminder',
        },
      }));

    // Send in batches
    let totalSent = 0;
    let totalFailed = 0;

    for (let i = 0; i < messages.length; i += BATCH_SIZE) {
      const batch = messages.slice(i, i + BATCH_SIZE);
      const { sent, failed } = await sendPushNotificationBatch(batch);
      totalSent += sent;
      totalFailed += failed;

      console.log(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: sent ${sent}, failed ${failed}`);

      // Small delay between batches to avoid rate limiting
      if (i + BATCH_SIZE < messages.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    return new Response(
      JSON.stringify({
        message: `Daily reminder notifications sent`,
        totalUsers: users.length,
        sent: totalSent,
        failed: totalFailed,
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
