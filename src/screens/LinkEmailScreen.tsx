import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
  Alert,
  TouchableOpacity,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { AnimatedButton } from '../components/AnimatedComponents';
import { colors, shadows, borders, borderRadius } from '../lib/theme';

// Eye icons for password visibility toggle
const eyeOpenIcon = require('../../assets/images/icon-eye-open.png');
const eyeClosedIcon = require('../../assets/images/icon-eye-closed.png');

interface Props {
  onBack: () => void;
  onSuccess: () => void;
}

// Map Supabase auth errors to user-friendly messages
function getLinkEmailErrorMessage(error: Error | null): string {
  if (!error) return 'An unknown error occurred. Please try again.';

  const message = error.message?.toLowerCase() || '';

  // Email already in use
  if (message.includes('already registered') || message.includes('already exists') || message.includes('duplicate')) {
    return 'This email is already linked to another account. Please use a different email address.';
  }

  // Invalid email format
  if (message.includes('invalid email') || message.includes('valid email')) {
    return 'Please enter a valid email address.';
  }

  // Rate limiting
  if (message.includes('too many requests') || message.includes('rate limit')) {
    return 'Too many attempts. Please wait a few minutes and try again.';
  }

  // Network errors
  if (message.includes('network') || message.includes('fetch') || message.includes('connection')) {
    return 'Network error. Please check your internet connection and try again.';
  }

  // Password too weak
  if (message.includes('password') && (message.includes('weak') || message.includes('short'))) {
    return 'Password is too weak. Please use a stronger password.';
  }

  // Return original message if no match, with fallback
  return error.message || 'Failed to link email. Please try again.';
}

export default function LinkEmailScreen({ onBack, onSuccess }: Props) {
  const { linkEmail } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [confirmPasswordFocused, setConfirmPasswordFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const validateEmail = (email: string) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  };

  const handleLinkEmail = async () => {
    setError('');

    if (!email || !password || !confirmPassword) {
      setError('Please fill in all fields');
      return;
    }

    if (!validateEmail(email)) {
      setError('Please enter a valid email address');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    const { error } = await linkEmail(email, password);

    setLoading(false);

    if (error) {
      console.error('Link email error:', error.message);
      setError(getLinkEmailErrorMessage(error));
    } else {
      Alert.alert(
        'Email Linked!',
        'Your account is now linked to your email. You can use this to recover your account.',
        [{ text: 'OK', onPress: onSuccess }]
      );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Back Button */}
          <AnimatedButton style={styles.backButton} onPress={onBack}>
            <Text style={styles.backButtonText}>← Back</Text>
          </AnimatedButton>

          <View style={styles.content}>
            {/* Title */}
            <Text style={styles.title}>Link Email</Text>
            <Text style={styles.subtitle}>
              Add an email to your account for recovery.{'\n'}
              This lets you sign in on other devices.
            </Text>

            {error ? (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <View style={styles.form}>
              <Text style={styles.label}>EMAIL</Text>
              <TextInput
                style={[styles.input, emailFocused && styles.inputFocused]}
                value={email}
                onChangeText={setEmail}
                placeholder="Enter your email"
                placeholderTextColor="#999999"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                onFocus={() => setEmailFocused(true)}
                onBlur={() => setEmailFocused(false)}
                selectionColor="#1ABC9C"
              />

              <Text style={styles.label}>PASSWORD</Text>
              <View style={[styles.passwordContainer, passwordFocused && styles.inputFocused]}>
                <TextInput
                  style={styles.passwordInput}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Create a password"
                  placeholderTextColor="#999999"
                  secureTextEntry={!showPassword}
                  onFocus={() => setPasswordFocused(true)}
                  onBlur={() => setPasswordFocused(false)}
                  selectionColor="#1ABC9C"
                />
                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() => setShowPassword(!showPassword)}
                  activeOpacity={0.7}
                >
                  <Image
                    source={showPassword ? eyeOpenIcon : eyeClosedIcon}
                    style={styles.eyeIcon}
                  />
                </TouchableOpacity>
              </View>

              <Text style={styles.label}>CONFIRM PASSWORD</Text>
              <View style={[styles.passwordContainer, confirmPasswordFocused && styles.inputFocused]}>
                <TextInput
                  style={styles.passwordInput}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Confirm your password"
                  placeholderTextColor="#999999"
                  secureTextEntry={!showConfirmPassword}
                  onFocus={() => setConfirmPasswordFocused(true)}
                  onBlur={() => setConfirmPasswordFocused(false)}
                  selectionColor="#1ABC9C"
                />
                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  activeOpacity={0.7}
                >
                  <Image
                    source={showConfirmPassword ? eyeOpenIcon : eyeClosedIcon}
                    style={styles.eyeIcon}
                  />
                </TouchableOpacity>
              </View>

              <AnimatedButton
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handleLinkEmail}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.buttonText}>Link Email</Text>
                )}
              </AnimatedButton>
            </View>

            <Text style={styles.infoText}>
              Your current progress and stats will be preserved.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
  scrollContent: {
    flexGrow: 1,
    padding: 24,
  },
  backButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#F2C94C',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: borders.card,
    borderColor: colors.border,
    ...shadows.card,
    marginBottom: 24,
  },
  backButtonText: {
    color: colors.text,
    fontSize: 12,
    fontFamily: 'DMSans_900Black',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
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
    lineHeight: 20,
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
  form: {
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
  input: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.card,
    padding: 16,
    fontSize: 16,
    fontFamily: 'DMSans_400Regular',
    color: colors.text,
    borderWidth: borders.card,
    borderColor: colors.border,
    ...shadows.card,
  },
  inputFocused: {
    borderColor: colors.primary,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.card,
    borderWidth: borders.card,
    borderColor: colors.border,
    ...shadows.card,
  },
  passwordInput: {
    flex: 1,
    padding: 16,
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
    width: 24,
    height: 24,
    tintColor: '#666666',
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 24,
    borderWidth: borders.card,
    borderColor: colors.border,
    ...shadows.card,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: 'DMSans_900Black',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoText: {
    fontSize: 12,
    fontFamily: 'DMSans_400Regular',
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 24,
  },
});
