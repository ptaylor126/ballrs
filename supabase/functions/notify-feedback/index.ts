// Supabase Edge Function to send email notifications when feedback is submitted
// This is triggered by a database webhook on INSERT to feedback table

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
    user_id: string | null;
    username: string | null;
    message: string;
    image_url: string | null;
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

    // Only process INSERT events on feedback table
    if (payload.type !== 'INSERT' || payload.table !== 'feedback') {
      return new Response(
        JSON.stringify({ message: 'Ignored - not a feedback INSERT event' }),
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

    // Format timestamp
    const timestamp = new Date(record.created_at).toLocaleString('en-US', {
      timeZone: 'America/New_York',
      dateStyle: 'medium',
      timeStyle: 'short'
    });

    // Determine if image was included
    const hasImage = record.image_url ? 'Yes' : 'No';

    // Format the email content
    const emailSubject = 'Ballrs: New Feedback';
    const emailBody = `
New feedback has been submitted on Ballrs.

Feedback Details:
-----------------
From: ${record.username || 'Anonymous'}
Time: ${timestamp} ET

Message:
${record.message}

Image Attached: ${hasImage}${record.image_url ? `\nImage URL: ${record.image_url}` : ''}

---
Feedback ID: ${record.id}
User ID: ${record.user_id || 'Anonymous'}
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
        message: 'Feedback notification sent successfully',
        feedbackId: record.id,
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
