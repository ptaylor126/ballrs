import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
} from 'react-native';
import { colors, borders, borderRadius, typography, spacing, shadows } from '../lib/theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  username: string;
  onBlock: () => void;
  onReport: () => void;
}

export default function UserActionsModal({
  visible,
  onClose,
  username,
  onBlock,
  onReport,
}: Props) {
  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <View style={styles.modalContent}>
          <Text style={styles.title}>{username}</Text>

          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={onBlock}
            >
              <Text style={styles.actionText}>Block User</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={onReport}
            >
              <Text style={styles.actionText}>Report User</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
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
    maxWidth: 320,
    ...shadows.card,
  },
  title: {
    ...typography.h2,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  actions: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  actionButton: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.sm,
    borderWidth: borders.input,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  actionText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  cancelButton: {
    backgroundColor: '#F2C94C',
    borderRadius: borderRadius.button,
    borderWidth: borders.button,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    alignItems: 'center',
    ...shadows.card,
  },
  cancelButtonText: {
    ...typography.button,
    color: colors.text,
  },
});
