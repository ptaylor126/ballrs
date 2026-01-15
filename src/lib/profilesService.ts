import { supabase } from './supabase';
import { Filter } from 'bad-words';

// Initialize profanity filter
const profanityFilter = new Filter();

// Common letter substitutions for bypassing filters
const letterSubstitutions: Record<string, string> = {
  '@': 'a',
  '4': 'a',
  '8': 'b',
  '3': 'e',
  '1': 'i',
  '!': 'i',
  '0': 'o',
  '5': 's',
  '$': 's',
  '7': 't',
  '+': 't',
};

// Normalize text by replacing common letter substitutions
function normalizeText(text: string): string {
  let normalized = text.toLowerCase();
  for (const [sub, letter] of Object.entries(letterSubstitutions)) {
    normalized = normalized.split(sub).join(letter);
  }
  return normalized;
}

// Check if username contains profanity (case-insensitive, handles substitutions)
export function containsProfanity(text: string): boolean {
  // Check original text
  if (profanityFilter.isProfane(text)) {
    return true;
  }

  // Check normalized text (with letter substitutions converted)
  const normalized = normalizeText(text);
  if (profanityFilter.isProfane(normalized)) {
    return true;
  }

  return false;
}

export interface Profile {
  id: string;
  username: string;
  country?: string | null;
  created_at: string;
}

// Check if username is available
export async function isUsernameAvailable(username: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('profiles')
    .select('username')
    .eq('username', username)
    .single();

  // If no row found, username is available
  if (error?.code === 'PGRST116') {
    return true;
  }

  return !data;
}

// Get user's profile
export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // No profile exists
    }
    console.error('Error fetching profile:', error);
    return null;
  }

  return data;
}

// Create or update profile with username
export async function createProfile(userId: string, username: string): Promise<Profile | null> {
  // Use upsert to handle case where DB trigger already created a profile with default username
  const { data, error } = await supabase
    .from('profiles')
    .upsert({ id: userId, username }, { onConflict: 'id' })
    .select()
    .single();

  if (error) {
    console.error('Error creating/updating profile:', error);
    return null;
  }

  return data;
}

// Update username
export async function updateUsername(userId: string, username: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .update({ username })
    .eq('id', userId)
    .select()
    .single();

  if (error) {
    console.error('Error updating username:', error);
    return null;
  }

  return data;
}

// Validate username format
export function validateUsername(username: string): { valid: boolean; error?: string } {
  if (username.length < 3) {
    return { valid: false, error: 'Username must be at least 3 characters' };
  }

  if (username.length > 10) {
    return { valid: false, error: 'Username must be 10 characters or less' };
  }

  if (!/^[a-zA-Z0-9]+$/.test(username)) {
    return { valid: false, error: 'Username can only contain letters and numbers' };
  }

  // Check for profanity (case-insensitive, handles common letter substitutions)
  if (containsProfanity(username)) {
    return { valid: false, error: 'This username is not allowed' };
  }

  return { valid: true };
}

// Update country
export async function updateCountry(userId: string, country: string | null): Promise<boolean> {
  const { error } = await supabase
    .from('profiles')
    .update({ country })
    .eq('id', userId);

  if (error) {
    console.error('Error updating country:', error);
    return false;
  }

  return true;
}

// Update last_active timestamp (for online status tracking)
export async function updateLastActive(userId: string): Promise<boolean> {
  const { error } = await supabase
    .from('profiles')
    .update({ last_active: new Date().toISOString() })
    .eq('id', userId);

  if (error) {
    console.error('Error updating last_active:', error);
    return false;
  }

  return true;
}
