import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Keyboard,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import {
  validateUsername,
  isUsernameAvailable,
  createProfile,
  getProfile,
} from '../lib/profilesService';
import { AnimatedButton } from '../components/AnimatedComponents';
import { colors, shadows, borders, borderRadius } from '../lib/theme';
import { supabase } from '../lib/supabase';

// Word pools for random username generation (short words for 10 char limit)
const ADJECTIVES = [
  'Swift', 'Bold', 'Sly', 'Lucky', 'Quick', 'Slick', 'Epic', 'Prime',
  'Elite', 'Rapid', 'Wild', 'Cool', 'Chill', 'Hyper', 'Loud', 'Calm',
];

const NOUNS = [
  'Baller', 'Champ', 'Pro', 'Star', 'King', 'Queen', 'Ace', 'MVP',
  'Dunk', 'Goal', 'Slam', 'Boss', 'Flash', 'Shot', 'Win',
];

const MAX_USERNAME_LENGTH = 10;

// Generate a random sports-themed username (max 10 chars)
const generateRandomUsername = (): string => {
  const adjective = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const combined = `${adjective}${noun}`;

  // If combined is already 10 or less, no number needed
  if (combined.length >= MAX_USERNAME_LENGTH) {
    return combined.slice(0, MAX_USERNAME_LENGTH);
  }

  // Calculate how many digits we can fit
  const remainingChars = MAX_USERNAME_LENGTH - combined.length;

  if (remainingChars >= 2) {
    // Can fit 2-digit number (10-99)
    const number = Math.floor(Math.random() * 90) + 10;
    return `${combined}${number}`;
  } else if (remainingChars >= 1) {
    // Can only fit 1-digit number (1-9)
    const number = Math.floor(Math.random() * 9) + 1;
    return `${combined}${number}`;
  }

  return combined;
};

interface Props {
  onComplete: () => void;
  onSignInComplete?: () => void;
  onReplayOnboarding?: () => void;
}

// Map Supabase auth errors to user-friendly messages
function getAuthErrorMessage(error: Error | null): string {
  if (!error) return 'An unknown error occurred. Please try again.';

  const message = error.message?.toLowerCase() || '';

  // Invalid credentials
  if (message.includes('invalid login credentials') || message.includes('invalid_credentials')) {
    return 'Incorrect email or password. Please check your details and try again.';
  }

  // User not found
  if (message.includes('user not found') || message.includes('no user found')) {
    return 'No account found with this email address. Please check your email or create a new account.';
  }

  // Email not confirmed
  if (message.includes('email not confirmed') || message.includes('not confirmed')) {
    return 'Please check your email and click the confirmation link before signing in.';
  }

  // Rate limiting
  if (message.includes('too many requests') || message.includes('rate limit')) {
    return 'Too many sign-in attempts. Please wait a few minutes and try again.';
  }

  // Network errors
  if (message.includes('network') || message.includes('fetch') || message.includes('connection')) {
    return 'Network error. Please check your internet connection and try again.';
  }

  // Email format issues
  if (message.includes('invalid email') || message.includes('email')) {
    return 'Please enter a valid email address.';
  }

  // Password issues
  if (message.includes('password')) {
    return 'Password error. Please check your password and try again.';
  }

  // Return original message if no match, with fallback
  return error.message || 'Sign-in failed. Please try again.';
}

export default function SetUsernameScreen({ onComplete, onSignInComplete, onReplayOnboarding }: Props) {
  // Triple-tap on logo to reset onboarding (for testing)
  const tapCountRef = useRef(0);
  const lastTapTimeRef = useRef(0);

  const handleLogoPress = () => {
    const now = Date.now();
    // Reset count if more than 500ms since last tap
    if (now - lastTapTimeRef.current > 500) {
      tapCountRef.current = 0;
    }
    tapCountRef.current += 1;
    lastTapTimeRef.current = now;

    if (tapCountRef.current >= 3 && onReplayOnboarding) {
      tapCountRef.current = 0;
      Alert.alert(
        'Reset Onboarding',
        'Do you want to replay the onboarding screens?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Reset', onPress: onReplayOnboarding },
        ]
      );
    }
  };
  const { user, signInWithEmail, refreshProfile } = useAuth();
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Sign-in modal state
  const [showSignInModal, setShowSignInModal] = useState(false);
  const [signInEmail, setSignInEmail] = useState('');
  const [signInPassword, setSignInPassword] = useState('');
  const [signInError, setSignInError] = useState('');
  const [signInLoading, setSignInLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async () => {
    if (!user) return;

    setError('');
    const trimmedUsername = username.trim();

    // Validate format
    const validation = validateUsername(trimmedUsername);
    if (!validation.valid) {
      setError(validation.error || 'Invalid username');
      return;
    }

    setLoading(true);

    // Check availability
    const available = await isUsernameAvailable(trimmedUsername);
    if (!available) {
      setError('Username is already taken');
      setLoading(false);
      return;
    }

    // Create profile
    const profile = await createProfile(user.id, trimmedUsername);
    if (!profile) {
      setError('Failed to save username. Please try again.');
      setLoading(false);
      return;
    }

    // Refresh cached username in AuthContext
    await refreshProfile();

    setLoading(false);
    onComplete();
  };

  const handleSignIn = async () => {
    if (!signInEmail.trim()) {
      setSignInError('Please enter your email address.');
      return;
    }

    if (!signInPassword) {
      setSignInError('Please enter your password.');
      return;
    }

    setSignInError('');
    setSignInLoading(true);

    try {
      const { data, error } = await signInWithEmail(signInEmail.trim(), signInPassword);

      if (error) {
        console.error('Sign-in error from Supabase:', error.message);
        setSignInError(getAuthErrorMessage(error));
        setSignInLoading(false);
        return;
      }

      const session = data?.session;

      if (!session?.user) {
        setSignInError('Sign-in succeeded but no session was created. Please try again.');
        setSignInLoading(false);
        return;
      }

      const profile = await getProfile(session.user.id);

      if (profile) {
        await refreshProfile();
        setShowSignInModal(false);
        setSignInLoading(false);
        if (onSignInComplete) {
          onSignInComplete();
        } else {
          onComplete();
        }
        return;
      }

      // No profile found - user will need to create one
      setShowSignInModal(false);
      setSignInLoading(false);
    } catch (err: any) {
      console.error('Sign-in error (caught):', err);
      setSignInError(getAuthErrorMessage(err));
      setSignInLoading(false);
    }
  };

  const closeSignInModal = () => {
    setShowSignInModal(false);
    setSignInEmail('');
    setSignInPassword('');
    setSignInError('');
    setShowPassword(false);
  };

  const handleRandomUsername = async () => {
    setGenerating(true);
    setError('');

    // Try up to 5 times to find an available username
    for (let attempt = 0; attempt < 5; attempt++) {
      const randomName = generateRandomUsername();
      const available = await isUsernameAvailable(randomName);

      if (available) {
        setUsername(randomName);
        setGenerating(false);
        return;
      }
    }

    // If all attempts failed, just use the last generated name
    // and let normal validation catch it on submit
    setUsername(generateRandomUsername());
    setGenerating(false);
  };

  const isButtonDisabled = loading || !username.trim();

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={styles.content}>
          {/* Logo - Triple tap to reset onboarding (for testing) */}
          <TouchableOpacity onPress={handleLogoPress} activeOpacity={1}>
            <Text style={styles.logo}>BALLRS</Text>
          </TouchableOpacity>

          {/* Title */}
          <Text style={styles.title}>Choose a Username</Text>
          <Text style={styles.subtitle}>
            This will be displayed on the leaderboard
          </Text>

          {/* Input */}
          <View style={styles.inputContainer}>
            <View style={styles.inputRow}>
              <View style={styles.inputWithHint}>
                <TextInput
                  style={styles.input}
                  placeholder="Username"
                  placeholderTextColor="#999999"
                  value={username}
                  onChangeText={(text) => {
                    setUsername(text);
                    setError('');
                  }}
                  autoCapitalize="none"
                  autoCorrect={false}
                  maxLength={MAX_USERNAME_LENGTH}
                  selectionColor="#1ABC9C"
                />
                <View style={styles.hintRow}>
                  <Text style={styles.hint}>
                    3-10 characters
                  </Text>
                  <Text style={[
                    styles.charCounter,
                    username.length >= MAX_USERNAME_LENGTH && styles.charCounterLimit
                  ]}>
                    {username.length}/{MAX_USERNAME_LENGTH}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.randomButton}
                onPress={handleRandomUsername}
                disabled={generating || loading}
                activeOpacity={0.7}
              >
                {generating ? (
                  <ActivityIndicator size="small" color="#1A1A1A" />
                ) : (
                  <Text style={styles.randomButtonText}>🎲</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          {/* Continue Button */}
          <AnimatedButton
            style={[
              styles.continueButton,
              isButtonDisabled && styles.continueButtonDisabled,
            ]}
            onPress={handleSubmit}
            disabled={isButtonDisabled}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={[
                styles.continueButtonText,
                isButtonDisabled && styles.continueButtonTextDisabled,
              ]}>
                Continue
              </Text>
            )}
          </AnimatedButton>

          {/* I have an account link */}
          <TouchableOpacity
            style={styles.haveAccountLink}
            onPress={() => setShowSignInModal(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.haveAccountText}>I already have an account</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Sign In Modal */}
      <Modal
        visible={showSignInModal}
        transparent
        animationType="fade"
        onRequestClose={closeSignInModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Sign In</Text>
                <Text style={styles.modalSubtitle}>
                  Welcome back! Sign in to recover your account.
                </Text>

                {signInError ? (
                  <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>{signInError}</Text>
                  </View>
                ) : null}

                <View style={styles.modalForm}>
                  <Text style={styles.label}>EMAIL</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="Enter your email"
                    placeholderTextColor="#999999"
                    value={signInEmail}
                    onChangeText={setSignInEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    selectionColor="#1ABC9C"
                  />

                  <Text style={styles.label}>PASSWORD</Text>
                  <View style={styles.passwordContainer}>
                    <TextInput
                      style={styles.passwordInput}
                      placeholder="Enter your password"
                      placeholderTextColor="#999999"
                      value={signInPassword}
                      onChangeText={setSignInPassword}
                      secureTextEntry={!showPassword}
                      selectionColor="#1ABC9C"
                    />
                    <TouchableOpacity
                      style={styles.eyeButton}
                      onPress={() => setShowPassword(!showPassword)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.eyeIcon}>{showPassword ? '👁️' : '👁️‍🗨️'}</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.modalButtons}>
                  <AnimatedButton
                    style={styles.cancelButton}
                    onPress={closeSignInModal}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </AnimatedButton>

                  <TouchableOpacity
                    style={[
                      styles.signInButton,
                      signInLoading && styles.buttonDisabled,
                    ]}
                    onPress={handleSignIn}
                    disabled={signInLoading}
                    activeOpacity={0.8}
                  >
                    {signInLoading ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <Text style={styles.signInButtonText}>Sign In</Text>
                    )}
                  </TouchableOpacity>
                </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  logo: {
    fontSize: 32,
    fontFamily: 'DMSans_900Black',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 24,
    fontFamily: 'DMSans_900Black',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 32,
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 10,
  },
  inputWithHint: {
    flex: 1,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    height: 54,
    fontSize: 16,
    fontFamily: 'DMSans_400Regular',
    color: colors.text,
    borderWidth: 2,
    borderColor: '#000000',
  },
  randomButton: {
    backgroundColor: '#F2C94C',
    borderRadius: 8,
    width: 54,
    height: 54,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#000000',
  },
  randomButtonText: {
    fontSize: 24,
  },
  hintRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingHorizontal: 4,
  },
  hint: {
    fontSize: 12,
    fontFamily: 'DMSans_400Regular',
    color: colors.textSecondary,
  },
  charCounter: {
    fontSize: 12,
    fontFamily: 'DMSans_600SemiBold',
    color: colors.textSecondary,
  },
  charCounterLimit: {
    color: '#E53935',
  },
  error: {
    color: '#E53935',
    fontSize: 14,
    fontFamily: 'DMSans_500Medium',
    textAlign: 'center',
    marginBottom: 16,
  },
  continueButton: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    borderWidth: borders.button,
    borderColor: colors.border,
    ...shadows.button,
  },
  continueButtonDisabled: {
    backgroundColor: '#E8E8E8',
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'DMSans_900Black',
  },
  continueButtonTextDisabled: {
    color: '#999999',
  },
  haveAccountLink: {
    marginTop: 24,
    alignItems: 'center',
    paddingVertical: 8,
  },
  haveAccountText: {
    fontSize: 14,
    fontFamily: 'DMSans_600SemiBold',
    color: colors.primary,
    textDecorationLine: 'underline',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.card,
    padding: 24,
    width: '100%',
    maxWidth: 360,
    borderWidth: borders.card,
    borderColor: colors.border,
    ...shadows.card,
  },
  modalTitle: {
    fontSize: 24,
    fontFamily: 'DMSans_900Black',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
  },
  errorContainer: {
    backgroundColor: '#FFEBEE',
    borderRadius: borderRadius.card,
    padding: 12,
    marginBottom: 16,
    borderWidth: borders.card,
    borderColor: '#E53935',
  },
  errorText: {
    color: '#E53935',
    textAlign: 'center',
    fontSize: 14,
    fontFamily: 'DMSans_500Medium',
  },
  modalForm: {
    gap: 8,
  },
  label: {
    color: colors.text,
    fontSize: 12,
    fontFamily: 'DMSans_900Black',
    marginBottom: 4,
    marginTop: 8,
    textTransform: 'uppercase',
  },
  modalInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    fontFamily: 'DMSans_400Regular',
    color: colors.text,
    borderWidth: 2,
    borderColor: '#000000',
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#000000',
  },
  passwordInput: {
    flex: 1,
    padding: 14,
    fontSize: 16,
    fontFamily: 'DMSans_400Regular',
    color: colors.text,
  },
  eyeButton: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  eyeIcon: {
    fontSize: 18,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#F2C94C',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#000000',
  },
  cancelButtonText: {
    color: '#1A1A1A',
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
  },
  signInButton: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#000000',
  },
  signInButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
});
