// Supabase Edge Function to send email notifications when a user is reported
// This is triggered by a database webhook on INSERT to user_reports table

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

// Email configuration
const NOTIFICATION_EMAIL = 'hello@ballrs.net';
const FROM_EMAIL = 'Ballrs <noreply@ballrs.net>';

interface WebhookPayload {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  record: {
    id: string;
    reporter_id: string;
    reported_id: string;
    reason: string;
    details: string | null;
    created_at: string;
  };
  schema: string;
  old_record: null | Record<string, unknown>;
}

Deno.serve(async (req: Request) => {
  try {
    // Parse the webhook payload
    const payload: WebhookPayload = await req.json();

    console.log('Received webhook payload:', JSON.stringify(payload, null, 2));

    // Only process INSERT events on user_reports table
    if (payload.type !== 'INSERT' || payload.table !== 'user_reports') {
      return new Response(
        JSON.stringify({ message: 'Ignored - not a report INSERT event' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { record } = payload;

    // Check if Resend API key is configured
    if (!RESEND_API_KEY) {
      console.error('RESEND_API_KEY is not configured');
      return new Response(
        JSON.stringify({ error: 'Email service not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with service role key for admin access
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch reporter and reported user profiles
    const [reporterResult, reportedResult] = await Promise.all([
      supabase
        .from('profiles')
        .select('username')
        .eq('id', record.reporter_id)
        .single(),
      supabase
        .from('profiles')
        .select('username')
        .eq('id', record.reported_id)
        .single(),
    ]);

    const reporterUsername = reporterResult.data?.username || 'Unknown';
    const reportedUsername = reportedResult.data?.username || 'Unknown';

    // Format the email content
    const emailSubject = `Ballrs: User Report - ${record.reason}`;
    const emailBody = `
A user has been reported on Ballrs.

Report Details:
---------------
Reporter: ${reporterUsername} (${record.reporter_id})
Reported User: ${reportedUsername} (${record.reported_id})
Reason: ${record.reason}
Details: ${record.details || 'None provided'}
Time: ${new Date(record.created_at).toLocaleString('en-US', { timeZone: 'America/New_York' })} ET

Report ID: ${record.id}
    `.trim();

    // Send email via Resend API
    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: NOTIFICATION_EMAIL,
        subject: emailSubject,
        text: emailBody,
      }),
    });

    if (!emailResponse.ok) {
      const errorText = await emailResponse.text();
      console.error('Resend API error:', emailResponse.status, errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to send email notification', details: errorText }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const emailResult = await emailResponse.json();
    console.log('Email sent successfully:', emailResult);

    return new Response(
      JSON.stringify({
        message: 'Report notification sent successfully',
        reportId: record.id,
        emailId: emailResult.id,
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
