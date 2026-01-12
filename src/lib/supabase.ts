import { createClient, SupabaseClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Supabase credentials - these are public anon keys, safe to include in client code
const SUPABASE_URL = 'https://nnnnzouwfxyzpcpynuae.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ubm56b3V3Znh5enBjcHludWFlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYyODY4MzMsImV4cCI6MjA4MTg2MjgzM30.mQoFVIOO0PPMLY9SwlldGxfk2-Wx49VbJbRgzfSBCgE';

// Initialize Supabase with error handling for Android
let supabaseInstance: SupabaseClient | null = null;

function initializeSupabase(): SupabaseClient {
  if (supabaseInstance) {
    return supabaseInstance;
  }

  try {
    // Validate credentials are present
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      throw new Error('Supabase credentials are missing');
    }

    supabaseInstance = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });

    console.log('[Supabase] Initialized successfully');
    return supabaseInstance;
  } catch (error) {
    console.error('[Supabase] Initialization failed:', error);
    // Return a minimal client that will fail gracefully
    // This prevents the app from crashing on startup
    throw error;
  }
}

// Export the initialized client
export const supabase = initializeSupabase();
