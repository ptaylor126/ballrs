import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CRASH_LOG_KEY = '@ballrs_crash_log';
const MAX_LOGS = 10;

interface CrashLog {
  timestamp: string;
  platform: string;
  error: string;
  stack?: string;
  phase: 'startup' | 'runtime' | 'render';
}

/**
 * Log a startup error to AsyncStorage for later retrieval
 * This helps debug crashes that happen before the UI is visible
 */
export async function logStartupError(error: Error | string, phase: 'startup' | 'runtime' | 'render' = 'startup'): Promise<void> {
  try {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    const crashLog: CrashLog = {
      timestamp: new Date().toISOString(),
      platform: Platform.OS,
      error: errorMessage,
      stack: errorStack,
      phase,
    };

    // Get existing logs
    const existingLogsJson = await AsyncStorage.getItem(CRASH_LOG_KEY);
    const existingLogs: CrashLog[] = existingLogsJson ? JSON.parse(existingLogsJson) : [];

    // Add new log at the beginning
    existingLogs.unshift(crashLog);

    // Keep only the last MAX_LOGS
    const trimmedLogs = existingLogs.slice(0, MAX_LOGS);

    await AsyncStorage.setItem(CRASH_LOG_KEY, JSON.stringify(trimmedLogs));
    console.error(`[CrashLogger] ${phase} error logged:`, errorMessage);
  } catch (loggingError) {
    // If we can't log, at least print to console
    console.error('[CrashLogger] Failed to log error:', loggingError);
    console.error('[CrashLogger] Original error:', error);
  }
}

/**
 * Get recent crash logs (useful for debugging)
 */
export async function getCrashLogs(): Promise<CrashLog[]> {
  try {
    const logsJson = await AsyncStorage.getItem(CRASH_LOG_KEY);
    return logsJson ? JSON.parse(logsJson) : [];
  } catch {
    return [];
  }
}

/**
 * Clear all crash logs
 */
export async function clearCrashLogs(): Promise<void> {
  try {
    await AsyncStorage.removeItem(CRASH_LOG_KEY);
  } catch {
    // Ignore errors
  }
}

/**
 * Get the most recent crash log
 */
export async function getLastCrashLog(): Promise<CrashLog | null> {
  const logs = await getCrashLogs();
  return logs.length > 0 ? logs[0] : null;
}

/**
 * Set up global error handlers for uncaught exceptions
 * Call this early in app initialization
 */
export function setupGlobalErrorHandlers(): void {
  // Handle unhandled promise rejections
  if (typeof global !== 'undefined') {
    const originalHandler = (global as any).onunhandledrejection;
    (global as any).onunhandledrejection = (event: any) => {
      const error = event?.reason || 'Unknown promise rejection';
      logStartupError(error, 'runtime');
      if (originalHandler) {
        originalHandler(event);
      }
    };
  }

  // Handle uncaught errors (React Native specific)
  if (typeof ErrorUtils !== 'undefined') {
    const originalHandler = ErrorUtils.getGlobalHandler();
    ErrorUtils.setGlobalHandler((error: Error, isFatal?: boolean) => {
      logStartupError(error, isFatal ? 'startup' : 'runtime');
      if (originalHandler) {
        originalHandler(error, isFatal);
      }
    });
  }

  console.log('[CrashLogger] Global error handlers installed');
}
