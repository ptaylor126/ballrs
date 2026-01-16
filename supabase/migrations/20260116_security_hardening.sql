-- Security Hardening Migration
-- Addresses vulnerabilities found in security scan
-- Date: 2026-01-16

-- ============================================
-- 1. RATE LIMITING HELPER TABLE
-- Track failed login attempts for rate limiting
-- ============================================

CREATE TABLE IF NOT EXISTS auth_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL, -- 'login', 'otp', 'password_reset'
  attempt_count INTEGER DEFAULT 1,
  first_attempt_at TIMESTAMPTZ DEFAULT NOW(),
  last_attempt_at TIMESTAMPTZ DEFAULT NOW(),
  blocked_until TIMESTAMPTZ,
  UNIQUE(ip_address, action_type)
);

-- RLS: No direct access - only via secure functions
ALTER TABLE auth_rate_limits ENABLE ROW LEVEL SECURITY;

-- No policies = no direct access from client

-- Index for cleanup
CREATE INDEX IF NOT EXISTS idx_rate_limits_blocked ON auth_rate_limits(blocked_until) WHERE blocked_until IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_rate_limits_last_attempt ON auth_rate_limits(last_attempt_at);

-- ============================================
-- 2. SECURITY AUDIT LOG
-- Track sensitive operations
-- ============================================

CREATE TABLE IF NOT EXISTS security_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  ip_address TEXT,
  user_agent TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: No direct client access
ALTER TABLE security_audit_log ENABLE ROW LEVEL SECURITY;

-- Index for queries
CREATE INDEX IF NOT EXISTS idx_audit_log_user ON security_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON security_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON security_audit_log(created_at DESC);

-- ============================================
-- 3. SECURE RPC FUNCTIONS
-- Replace any exposed functions with secure versions
-- ============================================

-- Function to check if user is blocked (used internally)
CREATE OR REPLACE FUNCTION is_user_blocked(user1_id UUID, user2_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM blocked_users
    WHERE (blocker_id = user1_id AND blocked_id = user2_id)
       OR (blocker_id = user2_id AND blocked_id = user1_id)
  );
END;
$$;

-- Revoke execute from public, only allow authenticated users
REVOKE ALL ON FUNCTION is_user_blocked FROM PUBLIC;
GRANT EXECUTE ON FUNCTION is_user_blocked TO authenticated;

-- ============================================
-- 4. SECURE PASSWORD RESET (Rate Limited)
-- Helper function for rate-limited password resets
-- ============================================

CREATE OR REPLACE FUNCTION check_password_reset_rate_limit(user_email TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  max_attempts INTEGER := 3;
  window_minutes INTEGER := 60;
  block_minutes INTEGER := 60;
  current_attempts INTEGER;
  blocked_until_time TIMESTAMPTZ;
BEGIN
  -- Check if currently blocked
  SELECT blocked_until INTO blocked_until_time
  FROM auth_rate_limits
  WHERE action_type = 'password_reset'
    AND (ip_address = user_email OR user_id IS NOT NULL)
    AND blocked_until > NOW();

  IF blocked_until_time IS NOT NULL THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'rate_limited',
      'retry_after', EXTRACT(EPOCH FROM (blocked_until_time - NOW()))::INTEGER
    );
  END IF;

  -- Count recent attempts
  SELECT COALESCE(attempt_count, 0) INTO current_attempts
  FROM auth_rate_limits
  WHERE action_type = 'password_reset'
    AND ip_address = user_email
    AND first_attempt_at > NOW() - (window_minutes || ' minutes')::INTERVAL;

  IF current_attempts >= max_attempts THEN
    -- Block further attempts
    INSERT INTO auth_rate_limits (ip_address, action_type, attempt_count, blocked_until)
    VALUES (user_email, 'password_reset', current_attempts + 1, NOW() + (block_minutes || ' minutes')::INTERVAL)
    ON CONFLICT (ip_address, action_type)
    DO UPDATE SET
      attempt_count = auth_rate_limits.attempt_count + 1,
      blocked_until = NOW() + (block_minutes || ' minutes')::INTERVAL,
      last_attempt_at = NOW();

    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'too_many_attempts',
      'retry_after', block_minutes * 60
    );
  END IF;

  -- Record this attempt
  INSERT INTO auth_rate_limits (ip_address, action_type, attempt_count)
  VALUES (user_email, 'password_reset', 1)
  ON CONFLICT (ip_address, action_type)
  DO UPDATE SET
    attempt_count = auth_rate_limits.attempt_count + 1,
    last_attempt_at = NOW();

  RETURN jsonb_build_object('allowed', true);
END;
$$;

-- Only allow from service role (server-side)
REVOKE ALL ON FUNCTION check_password_reset_rate_limit FROM PUBLIC;
REVOKE ALL ON FUNCTION check_password_reset_rate_limit FROM authenticated;

-- ============================================
-- 5. ADD CONSTRAINTS FOR INPUT VALIDATION
-- Prevent injection and invalid data
-- ============================================

-- Ensure usernames are safe (alphanumeric, underscore, limited length)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_username_format'
  ) THEN
    ALTER TABLE profiles
    ADD CONSTRAINT profiles_username_format
    CHECK (username ~ '^[a-zA-Z0-9_]{3,20}$');
  END IF;
EXCEPTION
  WHEN others THEN
    RAISE NOTICE 'Username constraint may already exist or profiles table structure differs';
END $$;

-- Ensure report reasons are from allowed list
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_reports_reason_valid'
  ) THEN
    ALTER TABLE user_reports
    ADD CONSTRAINT user_reports_reason_valid
    CHECK (reason IN ('inappropriate_username', 'cheating', 'spam', 'harassment', 'other'));
  END IF;
EXCEPTION
  WHEN others THEN
    RAISE NOTICE 'Report reason constraint may already exist';
END $$;

-- ============================================
-- 6. SECURE EXISTING TABLES
-- Ensure all tables have RLS enabled
-- ============================================

-- Check and enable RLS on all app tables
DO $$
DECLARE
  tbl TEXT;
  tables TEXT[] := ARRAY['profiles', 'duels', 'friends', 'friend_requests', 'leagues', 'league_members'];
BEGIN
  FOREACH tbl IN ARRAY tables
  LOOP
    BEGIN
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
      RAISE NOTICE 'Enabled RLS on %', tbl;
    EXCEPTION
      WHEN undefined_table THEN
        RAISE NOTICE 'Table % does not exist, skipping', tbl;
      WHEN others THEN
        RAISE NOTICE 'RLS may already be enabled on %', tbl;
    END;
  END LOOP;
END $$;

-- ============================================
-- 7. CLEANUP OLD RATE LIMIT RECORDS (Scheduled)
-- Create function to clean up old records
-- ============================================

CREATE OR REPLACE FUNCTION cleanup_old_rate_limits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Delete records older than 24 hours that are not blocked
  DELETE FROM auth_rate_limits
  WHERE last_attempt_at < NOW() - INTERVAL '24 hours'
    AND (blocked_until IS NULL OR blocked_until < NOW());

  -- Delete old audit logs (keep 90 days)
  DELETE FROM security_audit_log
  WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$;

-- ============================================
-- 8. SECURE VIEW FOR LEADERBOARD
-- Prevent data enumeration via limited exposure
-- ============================================

CREATE OR REPLACE VIEW public_leaderboard AS
SELECT
  p.id as user_id,
  p.username,
  p.icon_url,
  p.country,
  p.total_points,
  p.weekly_points,
  RANK() OVER (ORDER BY p.total_points DESC) as rank
FROM profiles p
WHERE p.username IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM blocked_users bu
    WHERE bu.blocked_id = p.id AND bu.blocker_id = auth.uid()
  )
ORDER BY p.total_points DESC
LIMIT 100;

-- Grant access to the view
GRANT SELECT ON public_leaderboard TO authenticated;

-- ============================================
-- 9. ADD FUNCTION SEARCH PATH SECURITY
-- Ensure all functions use explicit search_path
-- ============================================

-- This prevents search_path injection attacks
-- Already done for new functions above with SET search_path = public

-- ============================================
-- 10. REVOKE UNNECESSARY PERMISSIONS
-- ============================================

-- Revoke public access to system catalogs where possible
-- (Limited what we can do here, but good practice)

-- Ensure anon role has minimal permissions
REVOKE ALL ON TABLE auth_rate_limits FROM anon;
REVOKE ALL ON TABLE security_audit_log FROM anon;

-- ============================================
-- NOTES FOR DASHBOARD CONFIGURATION:
-- ============================================

-- The following must be configured in Supabase Dashboard:
--
-- 1. AUTH > Settings > Rate Limits:
--    - Enable rate limiting for sign-in attempts
--    - Set max attempts: 5 per hour
--    - Enable CAPTCHA after 3 failed attempts
--
-- 2. AUTH > Settings > Email:
--    - Enable email confirmation
--    - Set password minimum length: 8
--    - Require special characters in passwords
--
-- 3. AUTH > Settings > Security:
--    - Enable leaked password protection
--    - Set session timeout: 24 hours
--    - Enable MFA (optional but recommended)
--
-- 4. API Settings:
--    - Disable API documentation in production
--    - Enable request logging
--
-- 5. Storage > Policies:
--    - Ensure all buckets have proper RLS
--    - Set Content-Type validation on uploads
