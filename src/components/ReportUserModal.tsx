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
  Alert,
} from 'react-native';
import { colors, borders, borderRadius, typography, spacing, shadows } from '../lib/theme';
import { reportUser, REPORT_REASONS, ReportReason } from '../lib/reportService';

interface Props {
  visible: boolean;
  onClose: () => void;
  userId: string;
  username: string;
  reporterId: string;
}

export default function ReportUserModal({
  visible,
  onClose,
  userId,
  username,
  reporterId,
}: Props) {
  console.log('[ReportUserModal] Render - visible:', visible, 'userId:', userId, 'username:', username, 'reporterId:', reporterId);

  const [selectedReason, setSelectedReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleClose = () => {
    if (submitting) return;
    setSelectedReason(null);
    setDetails('');
    onClose();
  };

  const handleSubmit = async () => {
    console.log('[ReportUserModal] handleSubmit called', { selectedReason, submitting, reporterId, userId });

    if (!selectedReason || submitting) {
      console.log('[ReportUserModal] Early return - no reason or already submitting');
      return;
    }

    setSubmitting(true);

    console.log('[ReportUserModal] Calling reportUser...', { reporterId, userId, selectedReason, details });
    const result = await reportUser(reporterId, userId, selectedReason, details);
    console.log('[ReportUserModal] reportUser result:', result);

    setSubmitting(false);

    if (result.success) {
      Alert.alert(
        'Report Submitted',
        'Thanks for helping keep Ballrs fair.',
        [{ text: 'OK', onPress: handleClose }]
      );
    } else {
      Alert.alert('Error', `Failed to submit report: ${result.error || 'Unknown error'}`);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.modalContent}>
          <Text style={styles.title}>Report {username}</Text>
          <Text style={styles.subtitle}>Why are you reporting this user?</Text>

          {/* Reason Selection */}
          <View style={styles.reasons}>
            {REPORT_REASONS.map((reason) => (
              <TouchableOpacity
                key={reason}
                style={[
                  styles.reasonButton,
                  selectedReason === reason && styles.reasonButtonSelected,
                ]}
                onPress={() => setSelectedReason(reason)}
                disabled={submitting}
              >
                <Text
                  style={[
                    styles.reasonText,
                    selectedReason === reason && styles.reasonTextSelected,
                  ]}
                >
                  {reason}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Optional Details */}
          <TextInput
            style={styles.detailsInput}
            placeholder="Additional details (optional)"
            placeholderTextColor={colors.textTertiary}
            value={details}
            onChangeText={setDetails}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            maxLength={500}
            editable={!submitting}
            selectionColor={colors.accent}
          />

          {/* Buttons */}
          <View style={styles.buttons}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleClose}
              disabled={submitting}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.submitButton,
                (!selectedReason || submitting) && styles.submitButtonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={!selectedReason || submitting}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.submitButtonText}>Submit Report</Text>
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
    maxWidth: 360,
    ...shadows.card,
  },
  title: {
    ...typography.h2,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  reasons: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  reasonButton: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.sm,
    borderWidth: borders.input,
    borderColor: colors.border,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
  },
  reasonButtonSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.border,
  },
  reasonText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  reasonTextSelected: {
    color: '#FFFFFF',
    fontFamily: 'DMSans_700Bold',
  },
  detailsInput: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.sm,
    borderWidth: borders.input,
    borderColor: colors.border,
    padding: spacing.md,
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
    color: colors.text,
    minHeight: 80,
    marginBottom: spacing.lg,
  },
  buttons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  cancelButton: {
    flex: 1,
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
  submitButton: {
    flex: 1,
    backgroundColor: colors.accent,
    borderRadius: borderRadius.button,
    borderWidth: borders.button,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    alignItems: 'center',
    ...shadows.card,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    ...typography.button,
    color: '#FFFFFF',
  },
});
