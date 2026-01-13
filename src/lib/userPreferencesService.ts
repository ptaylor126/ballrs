import { supabase } from './supabase';
import { Sport } from './theme';

export interface UserPreferences {
  id: string;
  selected_sports: Sport[];
  dismissed_new_sport_prompts: Sport[];
  created_at: string;
  updated_at: string;
}

// All available sports
export const ALL_SPORTS: Sport[] = ['nba', 'pl', 'nfl', 'mlb'];

// Get default sports (all sports)
export function getDefaultSports(): Sport[] {
  return [...ALL_SPORTS];
}

// Get user preferences
export async function getUserPreferences(userId: string): Promise<UserPreferences | null> {
  const { data, error } = await supabase
    .from('user_preferences')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // No preferences exist yet
    }
    console.error('Error fetching user preferences:', error);
    return null;
  }

  return data;
}

// Create initial preferences (called during onboarding)
export async function createUserPreferences(
  userId: string,
  selectedSports: Sport[]
): Promise<UserPreferences | null> {
  // Ensure at least one sport is selected
  if (selectedSports.length === 0) {
    console.error('At least one sport must be selected');
    return null;
  }

  const { data, error } = await supabase
    .from('user_preferences')
    .insert({
      id: userId,
      selected_sports: selectedSports,
      dismissed_new_sport_prompts: [],
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating user preferences:', error);
    return null;
  }

  return data;
}

// Update selected sports
export async function updateSelectedSports(
  userId: string,
  selectedSports: Sport[]
): Promise<boolean> {
  // Ensure at least one sport is selected
  if (selectedSports.length === 0) {
    console.error('At least one sport must be selected');
    return false;
  }

  // Check if preferences exist
  const existing = await getUserPreferences(userId);

  if (!existing) {
    // Create new preferences if they don't exist
    const created = await createUserPreferences(userId, selectedSports);
    return created !== null;
  }

  // Update existing preferences
  const { error } = await supabase
    .from('user_preferences')
    .update({ selected_sports: selectedSports })
    .eq('id', userId);

  if (error) {
    console.error('Error updating selected sports:', error);
    return false;
  }

  return true;
}

// Dismiss new sport prompt
export async function dismissNewSportPrompt(
  userId: string,
  sport: Sport
): Promise<boolean> {
  // Get current preferences
  const existing = await getUserPreferences(userId);

  if (!existing) {
    // Create preferences with default sports and this dismissed prompt
    const { error } = await supabase
      .from('user_preferences')
      .insert({
        id: userId,
        selected_sports: getDefaultSports(),
        dismissed_new_sport_prompts: [sport],
      });

    if (error) {
      console.error('Error creating preferences with dismissed prompt:', error);
      return false;
    }
    return true;
  }

  // Update existing - add sport to dismissed list if not already there
  const currentDismissed = existing.dismissed_new_sport_prompts || [];
  if (currentDismissed.includes(sport)) {
    return true; // Already dismissed
  }

  const { error } = await supabase
    .from('user_preferences')
    .update({
      dismissed_new_sport_prompts: [...currentDismissed, sport],
    })
    .eq('id', userId);

  if (error) {
    console.error('Error dismissing new sport prompt:', error);
    return false;
  }

  return true;
}

// Check if user has dismissed prompt for a sport
export async function hasUserDismissedPrompt(
  userId: string,
  sport: Sport
): Promise<boolean> {
  const preferences = await getUserPreferences(userId);

  if (!preferences) {
    return false;
  }

  return preferences.dismissed_new_sport_prompts?.includes(sport) ?? false;
}

// Add sport to user's selection (for "Add Sport" from new sport modal)
export async function addSportToSelection(
  userId: string,
  sport: Sport
): Promise<boolean> {
  const existing = await getUserPreferences(userId);

  if (!existing) {
    // Create with default sports plus the new one
    return await createUserPreferences(userId, [...getDefaultSports(), sport]) !== null;
  }

  // Add sport if not already selected
  if (existing.selected_sports.includes(sport)) {
    return true; // Already selected
  }

  return await updateSelectedSports(userId, [...existing.selected_sports, sport]);
}
