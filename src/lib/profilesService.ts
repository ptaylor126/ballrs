import { supabase } from './supabase';

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

// Create profile with username
export async function createProfile(userId: string, username: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .insert({ id: userId, username })
    .select()
    .single();

  if (error) {
    console.error('Error creating profile:', error);
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
