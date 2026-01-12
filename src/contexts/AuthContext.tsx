import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { registerForPushNotifications, savePushToken } from '../lib/notificationService';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAnonymous: boolean;
  hasLinkedEmail: boolean;
  username: string | null;
  profileLoading: boolean;
  refreshProfile: () => Promise<void>;
  signInAnonymously: () => Promise<{ error: Error | null }>;
  signInWithEmail: (email: string, password: string) => Promise<{ data?: { session: Session | null }; error: Error | null }>;
  linkEmail: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState<string | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  // Fetch username from profiles table
  const fetchUsername = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', userId)
        .maybeSingle();

      // maybeSingle() returns null for 0 rows instead of throwing error
      // This is expected for new users who haven't set a username yet
      if (error) {
        console.error('Error fetching username:', error);
        return null;
      }

      return data?.username || null;
    } catch (error) {
      console.error('Error fetching username:', error);
      return null;
    }
  }, []);

  // Refresh profile data (can be called after username change)
  const refreshProfile = useCallback(async () => {
    if (!user) return;
    setProfileLoading(true);
    const fetchedUsername = await fetchUsername(user.id);
    setUsername(fetchedUsername);
    setProfileLoading(false);
  }, [user, fetchUsername]);

  // Register for push notifications when user logs in
  const setupPushNotifications = async (userId: string) => {
    try {
      const token = await registerForPushNotifications();
      if (token) {
        await savePushToken(userId, token);
        console.log('Push notifications registered successfully');
      }
    } catch (error) {
      console.error('Error setting up push notifications:', error);
    }
  };

  useEffect(() => {
    // Get initial session with error handling
    supabase.auth.getSession()
      .then(async ({ data: { session }, error }) => {
        if (error) {
          console.error('Error getting session:', error);
          setLoading(false);
          setProfileLoading(false);
          return;
        }

        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        // Fetch username and register push notifications for existing session
        if (session?.user) {
          const fetchedUsername = await fetchUsername(session.user.id);
          setUsername(fetchedUsername);
          setProfileLoading(false);
          setupPushNotifications(session.user.id);
        } else {
          setProfileLoading(false);
        }
      })
      .catch((error) => {
        console.error('Critical error getting session:', error);
        setLoading(false);
        setProfileLoading(false);
      });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        // Fetch username and register push notifications on sign in
        if (event === 'SIGNED_IN' && session?.user) {
          setProfileLoading(true);
          const fetchedUsername = await fetchUsername(session.user.id);
          setUsername(fetchedUsername);
          setProfileLoading(false);
          setupPushNotifications(session.user.id);
        } else if (event === 'SIGNED_OUT') {
          setUsername(null);
          setProfileLoading(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [fetchUsername]);

  const signInAnonymously = async () => {
    const { error } = await supabase.auth.signInAnonymously();
    return { error: error as Error | null };
  };

  // Sign in with email and password (for account recovery)
  const signInWithEmail = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { data, error: error as Error | null };
  };

  // Link email to anonymous account for recovery
  const linkEmail = async (email: string, password: string) => {
    const { error } = await supabase.auth.updateUser({
      email,
      password,
    });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  // Check if user is anonymous (no email linked)
  const isAnonymous = user?.is_anonymous ?? false;

  // Check if user has linked an email (for prompts and settings display)
  const hasLinkedEmail = !!user?.email;

  const value = {
    user,
    session,
    loading,
    isAnonymous,
    hasLinkedEmail,
    username,
    profileLoading,
    refreshProfile,
    signInAnonymously,
    signInWithEmail,
    linkEmail,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
