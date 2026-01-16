/**
 * Error Sanitizer
 * Prevents sensitive information leakage in error messages
 * Security measure for client-side error handling
 */

// Patterns that indicate sensitive information
const SENSITIVE_PATTERNS = [
  /password/i,
  /secret/i,
  /key/i,
  /token/i,
  /credential/i,
  /auth/i,
  /bearer/i,
  /api[_-]?key/i,
  /connection.*string/i,
  /database.*url/i,
  /supabase.*key/i,
  /jwt/i,
  /session/i,
  /cookie/i,
  /postgresql:\/\//i,
  /postgres:\/\//i,
  /\b[A-Za-z0-9+/]{40,}\b/, // Long base64 strings (potential tokens)
  /eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+/, // JWT pattern
];

// SQL error patterns to sanitize
const SQL_ERROR_PATTERNS = [
  /relation ".*" does not exist/i,
  /column ".*" does not exist/i,
  /permission denied for/i,
  /violates.*constraint/i,
  /duplicate key value/i,
  /syntax error at/i,
  /ERROR:\s+\d+/i,
];

// Generic user-friendly error messages
const USER_FRIENDLY_ERRORS: Record<string, string> = {
  'Invalid login credentials': 'Invalid email or password. Please try again.',
  'Email not confirmed': 'Please check your email to confirm your account.',
  'User already registered': 'An account with this email already exists.',
  'Password should be at least': 'Password must be at least 8 characters.',
  'rate limit': 'Too many attempts. Please try again later.',
  'network': 'Network error. Please check your connection.',
  'timeout': 'Request timed out. Please try again.',
  'duplicate key': 'This item already exists.',
  'foreign key': 'This action is not allowed.',
  'permission denied': 'You do not have permission to perform this action.',
  'not found': 'The requested item was not found.',
};

/**
 * Sanitize an error message to prevent information leakage
 */
export function sanitizeErrorMessage(error: unknown): string {
  // Get error message
  let message = '';

  if (error instanceof Error) {
    message = error.message;
  } else if (typeof error === 'string') {
    message = error;
  } else if (error && typeof error === 'object' && 'message' in error) {
    message = String((error as { message: unknown }).message);
  } else {
    return 'An unexpected error occurred. Please try again.';
  }

  // Check for sensitive patterns and redact
  for (const pattern of SENSITIVE_PATTERNS) {
    if (pattern.test(message)) {
      console.warn('[Security] Sensitive information detected in error, sanitizing');
      return 'An error occurred. Please try again.';
    }
  }

  // Check for SQL errors
  for (const pattern of SQL_ERROR_PATTERNS) {
    if (pattern.test(message)) {
      console.warn('[Security] SQL error details detected, sanitizing');
      return 'A database error occurred. Please try again.';
    }
  }

  // Map to user-friendly messages
  for (const [pattern, friendly] of Object.entries(USER_FRIENDLY_ERRORS)) {
    if (message.toLowerCase().includes(pattern.toLowerCase())) {
      return friendly;
    }
  }

  // If message is too long or looks technical, sanitize it
  if (message.length > 200 || /\{|\[|<|>|;|--|\/\*/.test(message)) {
    return 'An error occurred. Please try again.';
  }

  // Return original if it passes all checks
  return message;
}

/**
 * Log error securely (full details for debugging, but not exposed to user)
 */
export function logSecureError(context: string, error: unknown): void {
  // In production, you might send this to a secure logging service
  // For now, we log to console but could be configured differently
  if (__DEV__) {
    console.error(`[${context}] Error:`, error);
  } else {
    // In production, log minimal info
    console.error(`[${context}] Error occurred`);
    // Could send to error tracking service here (Sentry, etc.)
  }
}

/**
 * Safe error handler that sanitizes and logs
 */
export function handleError(context: string, error: unknown): string {
  logSecureError(context, error);
  return sanitizeErrorMessage(error);
}

/**
 * Type guard to check if something is an Error
 */
export function isError(value: unknown): value is Error {
  return value instanceof Error;
}

/**
 * Extract error code if available (for programmatic handling)
 */
export function getErrorCode(error: unknown): string | null {
  if (error && typeof error === 'object') {
    if ('code' in error && typeof (error as { code: unknown }).code === 'string') {
      return (error as { code: string }).code;
    }
    if ('status' in error && typeof (error as { status: unknown }).status === 'number') {
      return String((error as { status: number }).status);
    }
  }
  return null;
}
