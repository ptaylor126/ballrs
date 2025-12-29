-- Daily Reminder Notification Cron Job
-- This migration sets up pg_cron to trigger the send-daily-reminder Edge Function daily at 11:00 AM UTC

-- Enable pg_cron extension if not already enabled
-- Note: This requires pg_cron to be enabled in Supabase Dashboard under Database > Extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Grant usage to postgres user
GRANT USAGE ON SCHEMA cron TO postgres;

-- Create a function to call the Edge Function
CREATE OR REPLACE FUNCTION invoke_daily_reminder()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  response_status int;
  response_body text;
BEGIN
  -- Call the Edge Function using pg_net (HTTP extension)
  SELECT status, content::text
  INTO response_status, response_body
  FROM net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/send-daily-reminder',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );

  -- Log the result
  RAISE NOTICE 'Daily reminder function response: status=%, body=%', response_status, response_body;
END;
$$;

-- Schedule the cron job to run daily at 11:00 AM UTC
-- Cron format: minute hour day-of-month month day-of-week
SELECT cron.schedule(
  'daily-puzzle-reminder',  -- Job name
  '0 11 * * *',             -- 11:00 AM UTC every day
  $$SELECT invoke_daily_reminder()$$
);

-- To view scheduled jobs:
-- SELECT * FROM cron.job;

-- To unschedule if needed:
-- SELECT cron.unschedule('daily-puzzle-reminder');

-- Alternative: Using Supabase's built-in cron (simpler approach)
-- If pg_cron is not available, you can use Supabase Dashboard:
-- 1. Go to Database > Cron Jobs
-- 2. Create new job with:
--    - Schedule: 0 11 * * * (11:00 AM UTC daily)
--    - Command: SELECT net.http_post(
--        url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-daily-reminder',
--        headers := '{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY", "Content-Type": "application/json"}'::jsonb,
--        body := '{}'::jsonb
--      );

COMMENT ON FUNCTION invoke_daily_reminder IS 'Invokes the send-daily-reminder Edge Function to send push notifications';
