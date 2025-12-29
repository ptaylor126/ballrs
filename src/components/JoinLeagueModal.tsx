import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { joinLeagueByCode, League } from '../lib/leaguesService';
import { colors, borders, borderRadius, typography, spacing, shadows } from '../lib/theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  onLeagueJoined: (league: League) => void;
}

export default function JoinLeagueModal({ visible, onClose, onLeagueJoined }: Props) {
  const { user } = useAuth();
  const [code, setCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getErrorMessage = (errorType: string): string => {
    switch (errorType) {
      case 'not_found':
        return 'Invalid code. Please check and try again.';
      case 'full':
        return 'This league is full (50 members max).';
      case 'already_member':
        return "You're already a member of this league.";
      case 'failed':
      default:
        return 'Failed to join league. Please try again.';
    }
  };

  const handleCodeChange = (text: string) => {
    const cleaned = text.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    setCode(cleaned);
    setError(null);
  };

  const handleJoin = async () => {
    if (!user) return;

    if (code.length !== 6) {
      setError('Please enter a 6-character code');
      return;
    }

    setJoining(true);
    setError(null);

    const result = await joinLeagueByCode(code, user.id);

    if (result.success) {
      onLeagueJoined(result.league);
      handleClose();
    } else {
      setError(getErrorMessage(result.error));
    }

    setJoining(false);
  };

  const handleClose = () => {
    setCode('');
    setError(null);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.modalContent}>
          <Text style={styles.title}>Join League</Text>
          <Text style={styles.subtitle}>
            Enter the 6-character invite code
          </Text>

          <TextInput
            style={styles.input}
            value={code}
            onChangeText={handleCodeChange}
            placeholder="ABCD12"
            placeholderTextColor={colors.textTertiary}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={6}
            autoFocus
            selectionColor="#1ABC9C"
          />

          {error && <Text style={styles.error}>{error}</Text>}

          <View style={styles.buttons}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleClose}
              disabled={joining}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.joinButton,
                (code.length !== 6 || joining) && styles.buttonDisabled,
              ]}
              onPress={handleJoin}
              disabled={code.length !== 6 || joining}
            >
              {joining ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={[
                  styles.joinButtonText,
                  (code.length !== 6) && styles.buttonDisabledText,
                ]}>JOIN</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.card,
    borderWidth: borders.card,
    borderColor: colors.border,
    padding: spacing.lg,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    ...shadows.card,
  },
  title: {
    ...typography.h1,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  input: {
    width: '100%',
    backgroundColor: colors.background,
    borderRadius: borderRadius.sm,
    borderWidth: borders.card,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    ...typography.stat,
    color: colors.text,
    textAlign: 'center',
    letterSpacing: 8,
  },
  error: {
    ...typography.bodySmall,
    color: colors.error,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  buttons: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
    width: '100%',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.button,
    borderWidth: borders.button,
    borderColor: colors.border,
    backgroundColor: '#F2C94C',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  cancelButtonText: {
    ...typography.button,
    color: '#1A1A1A',
    fontSize: 12,
  },
  joinButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.button,
    borderWidth: 2,
    borderColor: '#1A1A1A',
    backgroundColor: '#1ABC9C',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  buttonDisabled: {
    backgroundColor: '#A8E6CF',
    shadowOpacity: 0.4,
  },
  buttonDisabledText: {
    color: '#AAAAAA',
  },
  joinButtonText: {
    ...typography.button,
    color: '#FFFFFF',
    fontSize: 14,
  },
});
