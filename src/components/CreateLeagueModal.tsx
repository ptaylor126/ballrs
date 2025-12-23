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
  Share,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { createLeague, League, LeagueSport, LeagueDuration, DURATION_OPTIONS, calculateLeagueDates } from '../lib/leaguesService';
import { colors, borders, borderRadius, typography, spacing, shadows } from '../lib/theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  onLeagueCreated: (league: League) => void;
}

type Step = 'form' | 'success';

export default function CreateLeagueModal({ visible, onClose, onLeagueCreated }: Props) {
  const { user } = useAuth();
  const [step, setStep] = useState<Step>('form');
  const [name, setName] = useState('');
  const [sport, setSport] = useState<LeagueSport>('all');
  const [duration, setDuration] = useState<LeagueDuration>('1_week');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdLeague, setCreatedLeague] = useState<League | null>(null);

  const handleCreate = async () => {
    if (!user || !name.trim()) {
      setError('Please enter a league name');
      return;
    }

    if (name.trim().length < 3) {
      setError('League name must be at least 3 characters');
      return;
    }

    if (name.trim().length > 30) {
      setError('League name must be 30 characters or less');
      return;
    }

    setCreating(true);
    setError(null);

    const league = await createLeague(user.id, name.trim(), sport, duration);

    if (league) {
      setCreatedLeague(league);
      setStep('success');
    } else {
      setError('Failed to create league. Please try again.');
    }

    setCreating(false);
  };

  const handleShare = async () => {
    if (!createdLeague) return;

    try {
      await Share.share({
        message: `Join my Ballrs league "${createdLeague.name}"!\n\nInvite code: ${createdLeague.invite_code}\n\nballrs://league/${createdLeague.invite_code}`,
      });
    } catch (err) {
      console.error('Error sharing:', err);
    }
  };

  const handleDone = () => {
    if (createdLeague) {
      onLeagueCreated(createdLeague);
    }
    handleClose();
  };

  const handleClose = () => {
    setStep('form');
    setName('');
    setSport('all');
    setDuration('1_week');
    setError(null);
    setCreatedLeague(null);
    onClose();
  };

  // Format date for display
  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Get preview dates based on current duration selection
  const getPreviewDates = () => {
    const { starts_at, ends_at } = calculateLeagueDates(duration);
    return `${formatDate(starts_at)} - ${formatDate(ends_at)}`;
  };

  const sportOptions: { value: LeagueSport; label: string; color: string }[] = [
    { value: 'nba', label: 'NBA', color: colors.nba },
    { value: 'pl', label: 'PL', color: colors.pl },
    { value: 'nfl', label: 'NFL', color: colors.nfl },
    { value: 'mlb', label: 'MLB', color: colors.mlb },
    { value: 'all', label: 'All', color: colors.success },
  ];

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
          {step === 'form' ? (
            <>
              <Text style={styles.title}>Create League</Text>
              <Text style={styles.subtitle}>
                Start a private league and invite friends
              </Text>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>League Name</Text>
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={(text) => {
                    setName(text);
                    setError(null);
                  }}
                  placeholder="My Awesome League"
                  placeholderTextColor={colors.textTertiary}
                  maxLength={30}
                  autoFocus
                />
              </View>

              <View style={styles.sportContainer}>
                <Text style={styles.label}>Sport</Text>
                <View style={styles.sportOptions}>
                  {sportOptions.map((option) => (
                    <TouchableOpacity
                      key={option.value}
                      style={[
                        styles.sportOption,
                        sport === option.value && {
                          borderColor: option.color,
                          backgroundColor: `${option.color}20`,
                        },
                      ]}
                      onPress={() => setSport(option.value)}
                    >
                      <Text
                        style={[
                          styles.sportLabel,
                          sport === option.value && { color: option.color },
                        ]}
                      >
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.durationContainer}>
                <Text style={styles.label}>Duration</Text>
                <View style={styles.durationOptions}>
                  {DURATION_OPTIONS.map((option) => (
                    <TouchableOpacity
                      key={option.value}
                      style={[
                        styles.durationOption,
                        duration === option.value && {
                          borderColor: colors.pl,
                          backgroundColor: `${colors.pl}20`,
                        },
                      ]}
                      onPress={() => setDuration(option.value)}
                    >
                      <Text
                        style={[
                          styles.durationLabel,
                          duration === option.value && { color: colors.pl },
                        ]}
                      >
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={styles.durationPreview}>
                  Starts in 2 days ({getPreviewDates()})
                </Text>
              </View>

              {error && <Text style={styles.error}>{error}</Text>}

              <View style={styles.buttons}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={handleClose}
                  disabled={creating}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.createButton,
                    (!name.trim() || creating) && styles.buttonDisabled,
                  ]}
                  onPress={handleCreate}
                  disabled={!name.trim() || creating}
                >
                  {creating ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.createButtonText}>Create</Text>
                  )}
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              <View style={styles.successIconCircle}>
                <Text style={styles.successIcon}>L</Text>
              </View>
              <Text style={styles.title}>League Created!</Text>
              <Text style={styles.subtitle}>
                Share the invite code with friends
              </Text>

              <View style={styles.codeContainer}>
                <Text style={styles.codeLabel}>Invite Code</Text>
                <View style={styles.codeBox}>
                  <Text style={styles.code}>{createdLeague?.invite_code}</Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.shareButton}
                onPress={handleShare}
              >
                <Text style={styles.shareButtonText}>SHARE INVITE</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.doneButton}
                onPress={handleDone}
              >
                <Text style={styles.doneButtonText}>Done</Text>
              </TouchableOpacity>
            </>
          )}
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
  inputContainer: {
    width: '100%',
    marginBottom: spacing.lg,
  },
  label: {
    ...typography.label,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.sm,
    borderWidth: borders.input,
    borderColor: colors.border,
    padding: spacing.md,
    ...typography.body,
    color: colors.text,
  },
  sportContainer: {
    width: '100%',
    marginBottom: spacing.lg,
  },
  sportOptions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  sportOption: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
    borderWidth: borders.button,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  sportLabel: {
    ...typography.button,
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  durationContainer: {
    width: '100%',
    marginBottom: spacing.lg,
  },
  durationOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  durationOption: {
    width: '48%',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.sm,
    borderWidth: borders.button,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  durationLabel: {
    ...typography.button,
    fontSize: 12,
    color: colors.textSecondary,
  },
  durationPreview: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  error: {
    ...typography.bodySmall,
    color: colors.error,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  buttons: {
    flexDirection: 'row',
    gap: spacing.sm,
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
  createButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.button,
    borderWidth: borders.button,
    borderColor: colors.border,
    backgroundColor: colors.nba,
    alignItems: 'center',
    ...shadows.cardSmall,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  createButtonText: {
    ...typography.button,
    color: '#FFFFFF',
    fontSize: 14,
  },
  successIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.success,
    borderWidth: borders.button,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  successIcon: {
    ...typography.h1,
    color: '#FFFFFF',
  },
  codeContainer: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  codeLabel: {
    ...typography.label,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  codeBox: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderWidth: borders.card,
    borderColor: colors.nba,
  },
  code: {
    ...typography.stat,
    color: colors.nba,
    letterSpacing: 6,
  },
  shareButton: {
    backgroundColor: colors.nba,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.button,
    borderWidth: borders.button,
    borderColor: colors.border,
    marginBottom: spacing.sm,
    width: '100%',
    alignItems: 'center',
    ...shadows.cardSmall,
  },
  shareButtonText: {
    ...typography.button,
    color: '#FFFFFF',
    fontSize: 14,
  },
  doneButton: {
    paddingVertical: spacing.md,
    width: '100%',
    alignItems: 'center',
  },
  doneButtonText: {
    ...typography.button,
    color: colors.textSecondary,
    fontSize: 14,
  },
});
