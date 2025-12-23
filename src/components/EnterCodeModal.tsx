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

export type JoinErrorType = 'not_found' | 'expired' | 'own_duel' | 'already_joined' | 'failed';

export type JoinResult =
  | { success: true }
  | { success: false; error: JoinErrorType };

interface Props {
  visible: boolean;
  onClose: () => void;
  onJoin: (code: string) => Promise<JoinResult>;
}

const colors = {
  background: '#1a1a2e',
  cardBackground: '#16213e',
  primary: '#e94560',
  accent: '#0f3460',
  textLight: '#ffffff',
  textMuted: '#94a3b8',
  border: '#334155',
  error: '#ef4444',
};

export default function EnterCodeModal({ visible, onClose, onJoin }: Props) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCodeChange = (text: string) => {
    // Convert to uppercase and remove non-alphanumeric characters
    const cleaned = text.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    setCode(cleaned);
    setError(null);
  };

  const getErrorMessage = (errorType: JoinErrorType): string => {
    switch (errorType) {
      case 'not_found':
        return 'Invalid code. Please check and try again.';
      case 'expired':
        return 'This invite has expired (24 hour limit).';
      case 'own_duel':
        return "You can't join your own duel!";
      case 'already_joined':
        return 'This duel has already started.';
      case 'failed':
      default:
        return 'Failed to join duel. Please try again.';
    }
  };

  const handleJoin = async () => {
    if (code.length !== 6) {
      setError('Please enter a 6-character code');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await onJoin(code);
      if (!result.success) {
        setError(getErrorMessage(result.error));
      }
    } catch (err) {
      setError('Failed to join duel. Please try again.');
    } finally {
      setLoading(false);
    }
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
          <Text style={styles.title}>Enter Invite Code</Text>
          <Text style={styles.subtitle}>
            Enter the 6-character code from your friend
          </Text>

          <TextInput
            style={styles.input}
            value={code}
            onChangeText={handleCodeChange}
            placeholder="ABCD12"
            placeholderTextColor={colors.border}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={6}
            autoFocus
          />

          {error && <Text style={styles.error}>{error}</Text>}

          <View style={styles.buttons}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleClose}
              disabled={loading}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.joinButton,
                (code.length !== 6 || loading) && styles.joinButtonDisabled,
              ]}
              onPress={handleJoin}
              disabled={code.length !== 6 || loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color={colors.textLight} />
              ) : (
                <Text style={styles.joinButtonText}>Join Duel</Text>
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
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: colors.cardBackground,
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.textLight,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: 24,
  },
  input: {
    width: '100%',
    backgroundColor: colors.background,
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.textLight,
    textAlign: 'center',
    letterSpacing: 8,
    borderWidth: 2,
    borderColor: colors.border,
    fontFamily: 'monospace',
  },
  error: {
    color: colors.error,
    fontSize: 14,
    marginTop: 12,
    textAlign: 'center',
  },
  buttons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
    width: '100%',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: colors.textMuted,
    fontSize: 16,
    fontWeight: '600',
  },
  joinButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  joinButtonDisabled: {
    backgroundColor: colors.accent,
    opacity: 0.6,
  },
  joinButtonText: {
    color: colors.textLight,
    fontSize: 16,
    fontWeight: '600',
  },
});
