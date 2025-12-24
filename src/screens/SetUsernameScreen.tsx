import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import {
  validateUsername,
  isUsernameAvailable,
  createProfile,
} from '../lib/profilesService';
import { AnimatedButton } from '../components/AnimatedComponents';

interface Props {
  onComplete: () => void;
  onLogin?: () => void;
}

export default function SetUsernameScreen({ onComplete, onLogin }: Props) {
  const { user } = useAuth();
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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

    setLoading(false);
    onComplete();
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
              maxLength={20}
            />
            <Text style={styles.hint}>
              3-20 characters, letters and numbers only
            </Text>
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

          {/* Login Section */}
          {onLogin && (
            <>
              <View style={styles.dividerContainer}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>or</Text>
                <View style={styles.dividerLine} />
              </View>

              <AnimatedButton style={styles.loginButton} onPress={onLogin}>
                <Text style={styles.loginButtonText}>
                  Already have an account? Log in
                </Text>
              </AnimatedButton>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F2EB',
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
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 24,
    fontFamily: 'DMSans_900Black',
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
    color: '#666666',
    textAlign: 'center',
    marginBottom: 32,
  },
  inputContainer: {
    marginBottom: 16,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    fontFamily: 'DMSans_400Regular',
    color: '#1A1A1A',
    borderWidth: 2,
    borderColor: '#000000',
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  hint: {
    fontSize: 12,
    fontFamily: 'DMSans_400Regular',
    color: '#666666',
    marginTop: 8,
    textAlign: 'center',
  },
  error: {
    color: '#E53935',
    fontSize: 14,
    fontFamily: 'DMSans_500Medium',
    textAlign: 'center',
    marginBottom: 16,
  },
  continueButton: {
    backgroundColor: '#1ABC9C',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    borderWidth: 2,
    borderColor: '#000000',
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  continueButtonDisabled: {
    backgroundColor: '#E8E8E8',
    shadowOffset: { width: 2, height: 2 },
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'DMSans_900Black',
  },
  continueButtonTextDisabled: {
    color: '#999999',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#CCCCCC',
  },
  dividerText: {
    fontSize: 12,
    fontFamily: 'DMSans_400Regular',
    color: '#666666',
    paddingHorizontal: 16,
  },
  loginButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#000000',
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  loginButtonText: {
    color: '#1A1A1A',
    fontSize: 14,
    fontFamily: 'DMSans_900Black',
  },
});
