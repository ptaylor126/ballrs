import React, { useState } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import {
  validateUsername,
  isUsernameAvailable,
  createProfile,
} from '../lib/profilesService';
import { AnimatedButton } from '../components/AnimatedComponents';
import { colors, shadows, borders, borderRadius } from '../lib/theme';

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
}

export default function SetUsernameScreen({ onComplete }: Props) {
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
    if (!signInEmail.trim() || !signInPassword) {
      setSignInError('Please enter email and password');
      return;
    }

    setSignInError('');
    setSignInLoading(true);

    const { error } = await signInWithEmail(signInEmail.trim(), signInPassword);

    if (error) {
      setSignInError(error.message || 'Invalid email or password');
      setSignInLoading(false);
    } else {
      // Success - onComplete will be called by App.tsx when it detects
      // the user now has a profile (from their existing account)
      setShowSignInModal(false);
      setSignInLoading(false);
    }
  };

  const closeSignInModal = () => {
    setShowSignInModal(false);
    setSignInEmail('');
    setSignInPassword('');
    setSignInError('');
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
          {/* Logo */}
          <Text style={styles.logo}>BALLRS</Text>

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
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
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
                  <TextInput
                    style={styles.modalInput}
                    placeholder="Enter your password"
                    placeholderTextColor="#999999"
                    value={signInPassword}
                    onChangeText={setSignInPassword}
                    secureTextEntry
                    selectionColor="#1ABC9C"
                  />
                </View>

                <View style={styles.modalButtons}>
                  <AnimatedButton
                    style={styles.cancelButton}
                    onPress={closeSignInModal}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </AnimatedButton>

                  <AnimatedButton
                    style={[
                      styles.signInButton,
                      signInLoading && styles.buttonDisabled,
                    ]}
                    onPress={handleSignIn}
                    disabled={signInLoading}
                  >
                    {signInLoading ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <Text style={styles.signInButtonText}>Sign In</Text>
                    )}
                  </AnimatedButton>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
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
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.card,
    padding: 16,
    fontSize: 16,
    fontFamily: 'DMSans_400Regular',
    color: colors.text,
    borderWidth: borders.card,
    borderColor: colors.border,
    shadowColor: '#000000',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  randomButton: {
    backgroundColor: '#F2C94C',
    borderRadius: borderRadius.card,
    width: 54,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: borders.card,
    borderColor: colors.border,
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
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
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
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
    backgroundColor: colors.surface,
    borderRadius: borderRadius.card,
    padding: 14,
    fontSize: 16,
    fontFamily: 'DMSans_400Regular',
    color: colors.text,
    borderWidth: borders.card,
    borderColor: colors.border,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: borders.button,
    borderColor: colors.border,
    ...shadows.button,
  },
  cancelButtonText: {
    color: colors.text,
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
  },
  signInButton: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: borders.button,
    borderColor: colors.border,
    ...shadows.button,
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
