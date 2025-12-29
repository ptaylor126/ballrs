import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { colors, borders, borderRadius, typography, spacing, shadows } from '../lib/theme';
import { submitFeedback } from '../lib/feedbackService';

interface Props {
  visible: boolean;
  onClose: () => void;
  userId: string | null;
  username: string | null;
  onSuccess: () => void;
}

const MIN_MESSAGE_LENGTH = 10;

export default function FeedbackModal({ visible, onClose, userId, username, onSuccess }: Props) {
  const [message, setMessage] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isValid = message.trim().length >= MIN_MESSAGE_LENGTH;

  const handlePickImage = async () => {
    try {
      // Request permission
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        setError('Permission to access photos is required.');
        return;
      }

      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setImageUri(result.assets[0].uri);
        setError(null);
      }
    } catch (err) {
      console.error('Error picking image:', err);
      setError('Failed to select image.');
    }
  };

  const handleRemoveImage = () => {
    setImageUri(null);
  };

  const handleSubmit = async () => {
    if (!isValid || submitting) return;

    setSubmitting(true);
    setError(null);

    const result = await submitFeedback(userId, username, message.trim(), imageUri);

    setSubmitting(false);

    if (result.success) {
      // Reset form
      setMessage('');
      setImageUri(null);
      onSuccess();
      onClose();
    } else {
      setError(result.error || 'Failed to submit feedback.');
    }
  };

  const handleClose = () => {
    if (submitting) return;
    setMessage('');
    setImageUri(null);
    setError(null);
    onClose();
  };

  const charactersRemaining = MIN_MESSAGE_LENGTH - message.trim().length;

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
          <Text style={styles.title}>Send Feedback</Text>
          <Text style={styles.subtitle}>
            We'd love to hear from you! Tell us what's on your mind.
          </Text>

          <ScrollView
            style={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Message Input */}
            <TextInput
              style={styles.textInput}
              placeholder="Tell us what's on your mind..."
              placeholderTextColor={colors.textTertiary}
              value={message}
              onChangeText={setMessage}
              multiline
              numberOfLines={5}
              textAlignVertical="top"
              maxLength={1000}
              editable={!submitting}
              selectionColor={colors.accent}
            />

            {/* Character count */}
            {charactersRemaining > 0 && (
              <Text style={styles.charCount}>
                {charactersRemaining} more character{charactersRemaining !== 1 ? 's' : ''} needed
              </Text>
            )}

            {/* Image Attachment Section */}
            {imageUri ? (
              <View style={styles.imagePreviewContainer}>
                <Image source={{ uri: imageUri }} style={styles.imagePreview} />
                <TouchableOpacity
                  style={styles.removeImageButton}
                  onPress={handleRemoveImage}
                  disabled={submitting}
                >
                  <Text style={styles.removeImageText}>×</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.attachButton}
                onPress={handlePickImage}
                disabled={submitting}
              >
                <Text style={styles.attachButtonIcon}>📷</Text>
                <Text style={styles.attachButtonText}>Attach Image (optional)</Text>
              </TouchableOpacity>
            )}

            {/* Error message */}
            {error && <Text style={styles.errorText}>{error}</Text>}
          </ScrollView>

          {/* Buttons */}
          <View style={styles.buttons}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleClose}
              disabled={submitting}
            >
              <Text style={styles.cancelButtonText}>CANCEL</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.submitButton,
                (!isValid || submitting) && styles.submitButtonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={!isValid || submitting}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={[
                  styles.submitButtonText,
                  !isValid && styles.submitButtonTextDisabled,
                ]}>SUBMIT</Text>
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
    maxWidth: 400,
    maxHeight: '80%',
    ...shadows.card,
  },
  title: {
    ...typography.h1,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  scrollContent: {
    flexGrow: 0,
  },
  textInput: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.sm,
    borderWidth: borders.input,
    borderColor: colors.border,
    padding: spacing.md,
    fontSize: 16,
    fontFamily: 'DMSans_400Regular',
    color: colors.text,
    minHeight: 120,
    maxHeight: 200,
  },
  charCount: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    marginTop: spacing.xs,
    textAlign: 'right',
  },
  attachButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    borderRadius: borderRadius.sm,
    borderWidth: borders.input,
    borderColor: colors.border,
    borderStyle: 'dashed',
    padding: spacing.md,
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  attachButtonIcon: {
    fontSize: 20,
  },
  attachButtonText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  imagePreviewContainer: {
    marginTop: spacing.md,
    position: 'relative',
    alignSelf: 'flex-start',
  },
  imagePreview: {
    width: 120,
    height: 120,
    borderRadius: borderRadius.sm,
    borderWidth: borders.input,
    borderColor: colors.border,
  },
  removeImageButton: {
    position: 'absolute',
    top: -10,
    right: -10,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.error,
    borderWidth: 2,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeImageText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    lineHeight: 20,
  },
  errorText: {
    ...typography.bodySmall,
    color: colors.error,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  buttons: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.button,
    borderWidth: borders.button,
    borderColor: colors.border,
    backgroundColor: '#F2C94C',
    alignItems: 'center',
    ...shadows.button,
  },
  cancelButtonText: {
    ...typography.button,
    color: '#1A1A1A',
  },
  submitButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.button,
    borderWidth: borders.button,
    borderColor: colors.border,
    backgroundColor: colors.accent,
    alignItems: 'center',
    ...shadows.button,
  },
  submitButtonDisabled: {
    backgroundColor: '#A8E6CF',
  },
  submitButtonText: {
    ...typography.button,
    color: '#FFFFFF',
  },
  submitButtonTextDisabled: {
    color: '#FFFFFF',
  },
});
