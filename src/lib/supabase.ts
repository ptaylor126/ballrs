import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

// TODO: Replace these with your real Supabase credentials
const SUPABASE_URL = 'https://nnnnzouwfxyzpcpynuae.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ubm56b3V3Znh5enBjcHludWFlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYyODY4MzMsImV4cCI6MjA4MTg2MjgzM30.mQoFVIOO0PPMLY9SwlldGxfk2-Wx49VbJbRgzfSBCgE';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
