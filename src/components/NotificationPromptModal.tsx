import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { colors, borders, borderRadius, typography, spacing } from '../lib/theme';

interface Props {
  visible: boolean;
  opponentUsername: string;
  loading?: boolean;
  onEnable: () => void;
  onDismiss: () => void;
}

export default function NotificationPromptModal({
  visible,
  opponentUsername,
  loading = false,
  onEnable,
  onDismiss,
}: Props) {
  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onDismiss}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContent}>
          {/* Bell icon */}
          <View style={styles.iconCircle}>
            <Text style={styles.iconText}>🔔</Text>
          </View>

          <Text style={styles.title}>
            Want to know when {opponentUsername} finishes?
          </Text>

          <Text style={styles.subtitle}>
            Get notified when your duel results are ready
          </Text>

          <View style={styles.buttons}>
            <TouchableOpacity
              style={styles.dismissButton}
              onPress={onDismiss}
              disabled={loading}
            >
              <Text style={styles.dismissButtonText}>No thanks</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.enableButton}
              onPress={onEnable}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.enableButtonText}>Yes, notify me</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
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
    borderWidth: 2,
    borderColor: '#1A1A1A',
    padding: spacing.lg,
    width: '100%',
    maxWidth: 320,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFF9E6',
    borderWidth: 2,
    borderColor: '#1A1A1A',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  iconText: {
    fontSize: 28,
  },
  title: {
    ...typography.h2,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  buttons: {
    flexDirection: 'row',
    gap: spacing.sm,
    width: '100%',
  },
  dismissButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.button,
    borderWidth: 2,
    borderColor: '#1A1A1A',
    backgroundColor: '#F2C94C',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  dismissButtonText: {
    ...typography.button,
    color: '#1A1A1A',
    fontSize: 13,
  },
  enableButton: {
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
  enableButtonText: {
    ...typography.button,
    color: '#FFFFFF',
    fontSize: 13,
  },
});
