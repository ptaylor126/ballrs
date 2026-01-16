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
import InviteToLeagueModal from './InviteToLeagueModal';

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
  const [inputFocused, setInputFocused] = useState(false);
  const [showInviteFriendsModal, setShowInviteFriendsModal] = useState(false);

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

  const sportOptions: { value: LeagueSport; label: string }[] = [
    { value: 'nba', label: 'NBA' },
    { value: 'pl', label: 'EPL' },
    { value: 'nfl', label: 'NFL' },
    { value: 'mlb', label: 'MLB' },
    { value: 'all', label: 'All' },
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
                  style={[
                    styles.input,
                    (inputFocused || name) && styles.inputFocused
                  ]}
                  value={name}
                  onChangeText={(text) => {
                    setName(text);
                    setError(null);
                  }}
                  onFocus={() => setInputFocused(true)}
                  onBlur={() => setInputFocused(false)}
                  placeholder="Slam Dunk Squad"
                  placeholderTextColor={colors.textTertiary}
                  maxLength={30}
                  autoFocus
                  selectionColor="#1ABC9C"
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
                        sport === option.value && styles.sportOptionSelected,
                      ]}
                      onPress={() => setSport(option.value)}
                    >
                      <Text
                        style={[
                          styles.sportLabel,
                          sport === option.value && styles.sportLabelSelected,
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
                        duration === option.value && styles.durationOptionSelected,
                      ]}
                      onPress={() => setDuration(option.value)}
                    >
                      <Text
                        style={[
                          styles.durationLabel,
                          duration === option.value && styles.durationLabelSelected,
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
                    (!name.trim() || creating) && styles.createButtonDisabled,
                  ]}
                  onPress={handleCreate}
                  disabled={!name.trim() || creating}
                >
                  {creating ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={[
                      styles.createButtonText,
                      (!name.trim() || creating) && styles.createButtonTextDisabled,
                    ]}>Create</Text>
                  )}
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
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
                style={styles.inviteFriendsButton}
                onPress={() => setShowInviteFriendsModal(true)}
              >
                <Text style={styles.inviteFriendsButtonText}>INVITE FRIENDS</Text>
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

      {/* Invite Friends Modal */}
      <InviteToLeagueModal
        visible={showInviteFriendsModal}
        onClose={() => setShowInviteFriendsModal(false)}
        leagueId={createdLeague?.id || ''}
        leagueName={createdLeague?.name || ''}
      />
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
    borderWidth: 2,
    borderColor: colors.border,
    padding: spacing.md,
    ...typography.body,
    color: colors.text,
  },
  inputFocused: {
    borderColor: '#1ABC9C',
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
    borderWidth: 2,
    borderColor: '#1A1A1A',
    backgroundColor: '#FFFFFF',
  },
  sportOptionSelected: {
    backgroundColor: '#1ABC9C',
    borderColor: '#1A1A1A',
  },
  sportLabel: {
    ...typography.button,
    fontSize: 12,
    color: '#1A1A1A',
    textAlign: 'center',
  },
  sportLabelSelected: {
    color: '#FFFFFF',
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
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.sm,
    borderWidth: 2,
    borderColor: '#1A1A1A',
    backgroundColor: '#FFFFFF',
  },
  durationOptionSelected: {
    backgroundColor: '#1ABC9C',
    borderColor: '#1A1A1A',
  },
  durationLabel: {
    ...typography.button,
    fontSize: 12,
    color: '#1A1A1A',
  },
  durationLabelSelected: {
    color: '#FFFFFF',
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
  createButtonDisabled: {
    backgroundColor: '#F9EECC',
    borderColor: '#000000',
    shadowOpacity: 0.4,
    elevation: 1,
  },
  createButtonText: {
    ...typography.button,
    color: '#FFFFFF',
    fontSize: 14,
  },
  createButtonTextDisabled: {
    color: '#AAAAAA',
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
    borderWidth: 2,
    borderColor: '#1ABC9C',
  },
  code: {
    ...typography.stat,
    color: '#1ABC9C',
    letterSpacing: 6,
  },
  shareButton: {
    backgroundColor: '#1ABC9C',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.button,
    borderWidth: 2,
    borderColor: '#1A1A1A',
    marginBottom: spacing.sm,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  shareButtonText: {
    ...typography.button,
    color: '#FFFFFF',
    fontSize: 14,
  },
  inviteFriendsButton: {
    backgroundColor: '#F2C94C',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.button,
    borderWidth: 2,
    borderColor: '#1A1A1A',
    marginBottom: spacing.sm,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  inviteFriendsButtonText: {
    ...typography.button,
    color: '#1A1A1A',
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
