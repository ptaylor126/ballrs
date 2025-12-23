import { supabase } from './supabase';

export interface FrameStyle {
  borderColor: string;
  borderWidth: number;
  shadowColor?: string;
  shadowOpacity?: number;
  gradient?: string[];
  animated?: boolean;
}

export interface ProfileFrame {
  id: string;
  name: string;
  frame_style: FrameStyle;
  unlock_level: number;
}

export interface ProfileIcon {
  id: string;
  name: string;
  icon_url: string; // Emoji or image URL
  unlock_type: 'level' | 'achievement' | 'default';
  unlock_level?: number;
  unlock_achievement_id?: string;
}

export interface UserProfileRewards {
  selected_icon_id: string | null;
  selected_frame_id: string | null;
}

// Fetch all available frames
export async function fetchAllFrames(): Promise<ProfileFrame[]> {
  const { data, error } = await supabase
    .from('profile_frames')
    .select('*')
    .order('unlock_level', { ascending: true });

  if (error) {
    console.error('Error fetching frames:', error);
    return [];
  }

  return data || [];
}

// Fetch all available icons
export async function fetchAllIcons(): Promise<ProfileIcon[]> {
  const { data, error } = await supabase
    .from('profile_icons')
    .select('*')
    .order('unlock_level', { ascending: true, nullsFirst: true });

  if (error) {
    console.error('Error fetching icons:', error);
    return [];
  }

  return data || [];
}

// Get user's selected icon and frame
export async function getUserProfileRewards(userId: string): Promise<UserProfileRewards | null> {
  const { data, error } = await supabase
    .from('user_stats')
    .select('selected_icon_id, selected_frame_id')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('Error fetching user profile rewards:', error);
    return null;
  }

  return data;
}

// Update user's selected icon
export async function updateSelectedIcon(userId: string, iconId: string | null): Promise<boolean> {
  const { error } = await supabase
    .from('user_stats')
    .update({ selected_icon_id: iconId })
    .eq('id', userId);

  if (error) {
    console.error('Error updating selected icon:', error);
    return false;
  }

  return true;
}

// Update user's selected frame
export async function updateSelectedFrame(userId: string, frameId: string): Promise<boolean> {
  const { error } = await supabase
    .from('user_stats')
    .update({ selected_frame_id: frameId })
    .eq('id', userId);

  if (error) {
    console.error('Error updating selected frame:', error);
    return false;
  }

  return true;
}

// Check if a frame is unlocked for a user based on their level
export function isFrameUnlocked(frame: ProfileFrame, userLevel: number): boolean {
  return userLevel >= frame.unlock_level;
}

// Check if an icon is unlocked for a user
export function isIconUnlocked(
  icon: ProfileIcon,
  userLevel: number,
  unlockedAchievementIds: string[]
): boolean {
  if (icon.unlock_type === 'default') {
    return true;
  }

  if (icon.unlock_type === 'level' && icon.unlock_level) {
    return userLevel >= icon.unlock_level;
  }

  if (icon.unlock_type === 'achievement' && icon.unlock_achievement_id) {
    return unlockedAchievementIds.includes(icon.unlock_achievement_id);
  }

  return false;
}

// Fetch user's complete profile customization data
export async function fetchProfileCustomizationData(userId: string): Promise<{
  frames: ProfileFrame[];
  icons: ProfileIcon[];
  selectedIconId: string | null;
  selectedFrameId: string | null;
  userLevel: number;
  unlockedAchievementIds: string[];
} | null> {
  try {
    // Fetch all data in parallel
    const [framesResult, iconsResult, userStatsResult, achievementsResult] = await Promise.all([
      supabase.from('profile_frames').select('*').order('unlock_level', { ascending: true }),
      supabase.from('profile_icons').select('*').order('unlock_level', { ascending: true, nullsFirst: true }),
      supabase.from('user_stats').select('selected_icon_id, selected_frame_id, level').eq('id', userId).single(),
      supabase.from('user_achievements').select('achievement_id').eq('user_id', userId),
    ]);

    if (framesResult.error || iconsResult.error) {
      console.error('Error fetching customization data');
      return null;
    }

    const frames = framesResult.data || [];
    const icons = iconsResult.data || [];
    const userStats = userStatsResult.data;
    const achievements = achievementsResult.data || [];

    return {
      frames,
      icons,
      selectedIconId: userStats?.selected_icon_id || null,
      selectedFrameId: userStats?.selected_frame_id || null,
      userLevel: userStats?.level || 1,
      unlockedAchievementIds: achievements.map(a => a.achievement_id),
    };
  } catch (error) {
    console.error('Error fetching profile customization data:', error);
    return null;
  }
}

// Get frame style for a user (returns default if none selected)
export async function getUserFrameStyle(userId: string): Promise<FrameStyle> {
  const defaultStyle: FrameStyle = {
    borderColor: '#374151',
    borderWidth: 3,
  };

  try {
    const { data, error } = await supabase
      .from('user_stats')
      .select(`
        selected_frame_id,
        profile_frames:selected_frame_id (frame_style)
      `)
      .eq('id', userId)
      .single();

    if (error || !data?.profile_frames) {
      return defaultStyle;
    }

    return (data.profile_frames as any).frame_style as FrameStyle;
  } catch {
    return defaultStyle;
  }
}

// Get user's selected icon (returns null if none selected)
export async function getUserIcon(userId: string): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('user_stats')
      .select(`
        selected_icon_id,
        profile_icons:selected_icon_id (icon_url)
      `)
      .eq('id', userId)
      .single();

    if (error || !data?.profile_icons) {
      return null;
    }

    return (data.profile_icons as any).icon_url;
  } catch {
    return null;
  }
}
