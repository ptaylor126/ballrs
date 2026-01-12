import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  TextInput,
  Image,
  Modal,
  Animated,
  Easing,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../contexts/AuthContext';
import { fetchUserStats, UserStats } from '../lib/statsService';
import { getUserXP, getXPProgressInLevel, getXPForLevel } from '../lib/xpService';
import { colors, shadows, getSportColor, borders, borderRadius, typography, spacing } from '../lib/theme';
import { AnimatedButton, AnimatedCard } from '../components/AnimatedComponents';
import {
  FrameStyle,
  getUserFrameStyle,
  getUserIcon,
} from '../lib/profileRewardsService';
import { getProfile, updateCountry } from '../lib/profilesService';
import { countryCodeToFlag, COUNTRIES, Country } from '../lib/countryUtils';
import { soundService } from '../lib/soundService';
import FeedbackModal from '../components/FeedbackModal';
import { deleteUserAccount } from '../lib/accountService';

// Icons
const fireIcon = require('../../assets/images/icon-fire.png');
const trophyIcon = require('../../assets/images/icon-trophy.png');
const speechIcon = require('../../assets/images/icon-speech.png');

// Get level title based on level number
function getLevelTitle(level: number): string {
  if (level >= 100) return 'Hall of Famer';
  if (level >= 50) return 'Legend';
  if (level >= 40) return 'Master';
  if (level >= 30) return 'Expert';
  if (level >= 20) return 'Veteran';
  if (level >= 10) return 'Pro';
  if (level >= 5) return 'Rising Star';
  return 'Rookie';
}

interface Props {
  onBack?: () => void;
  onLogout: () => void;
  onNavigateToAchievements: () => void;
  onNavigateToCustomize: () => void;
  onReplayOnboarding?: () => void;
  onLinkEmail?: () => void;
}

export default function ProfileScreen({ onBack, onLogout, onNavigateToAchievements, onNavigateToCustomize, onReplayOnboarding, onLinkEmail }: Props) {
  const { user, signOut, isAnonymous, hasLinkedEmail, username: cachedUsername, profileLoading } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [xp, setXP] = useState(0);
  const [level, setLevel] = useState(1);

  const [frameStyle, setFrameStyle] = useState<FrameStyle>({
    borderColor: '#374151',
    borderWidth: 3,
  });
  const [profileIcon, setProfileIcon] = useState<string | null>(null);
  const [country, setCountry] = useState<string | null>(null);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [countrySearchQuery, setCountrySearchQuery] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [showFeedbackToast, setShowFeedbackToast] = useState(false);
  const feedbackToastAnim = useRef(new Animated.Value(0)).current;

  // Delete account state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [showDeletedToast, setShowDeletedToast] = useState(false);
  const deletedToastAnim = useRef(new Animated.Value(0)).current;

  // Initialize sound setting
  useEffect(() => {
    soundService.initialize().then(() => {
      setSoundEnabled(soundService.isEnabled());
    });
  }, []);

  const handleSoundToggle = async () => {
    const newValue = !soundEnabled;
    setSoundEnabled(newValue);
    await soundService.setEnabled(newValue);
  };

  const handleFeedbackSuccess = () => {
    setShowFeedbackToast(true);
    feedbackToastAnim.setValue(0);
    Animated.sequence([
      Animated.timing(feedbackToastAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.delay(2500),
      Animated.timing(feedbackToastAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShowFeedbackToast(false);
    });
  };

  // Pulsing animation for skeleton loaders
  const pulseAnim = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.4,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim]);

  const loadProfileData = useCallback(async () => {
    if (!user) return;

    setLoadingStats(true);
    const userStats = await fetchUserStats(user.id);
    setStats(userStats);

    const xpData = await getUserXP(user.id);
    if (xpData) {
      setXP(xpData.xp);
      setLevel(xpData.level);
    }

    const [frame, icon, profile] = await Promise.all([
      getUserFrameStyle(user.id),
      getUserIcon(user.id),
      getProfile(user.id),
    ]);
    setFrameStyle(frame);
    setProfileIcon(icon);
    // Username is now from AuthContext (cachedUsername), only fetch country here
    setCountry(profile?.country || null);

    setLoadingStats(false);
  }, [user]);

  useEffect(() => {
    loadProfileData();
  }, [loadProfileData]);

  const handleLogout = async () => {
    setLoggingOut(true);
    await signOut();
    onLogout();
  };

  const handleDeleteAccount = async () => {
    if (!user || deleteConfirmText.toUpperCase() !== 'DELETE') return;

    setDeleting(true);
    try {
      const success = await deleteUserAccount(user.id);
      if (success) {
        setShowDeleteConfirmModal(false);
        setShowDeleteModal(false);
        // Show toast and sign out
        setShowDeletedToast(true);
        deletedToastAnim.setValue(0);
        Animated.sequence([
          Animated.timing(deletedToastAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.delay(1500),
          Animated.timing(deletedToastAnim, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
        ]).start(async () => {
          setShowDeletedToast(false);
          await signOut();
          onLogout();
        });
      } else {
        Alert.alert('Error', 'Failed to delete account. Please try again.');
      }
    } catch (error) {
      console.error('Error deleting account:', error);
      Alert.alert('Error', 'Failed to delete account. Please try again.');
    } finally {
      setDeleting(false);
      setDeleteConfirmText('');
    }
  };

  const handleCountrySelect = async (selectedCountry: Country) => {
    if (!user) return;

    const success = await updateCountry(user.id, selectedCountry.code);
    if (success) {
      setCountry(selectedCountry.code);
    }
    setShowCountryPicker(false);
    setCountrySearchQuery('');
  };

  const filteredCountries = countrySearchQuery.trim()
    ? COUNTRIES.filter(c =>
        c.name.toLowerCase().includes(countrySearchQuery.toLowerCase()) ||
        c.code.toLowerCase().includes(countrySearchQuery.toLowerCase())
      )
    : COUNTRIES;

  const progress = getXPProgressInLevel(xp);
  const nextLevelXP = getXPForLevel(level + 1);
  const currentLevelXP = getXPForLevel(level);
  const xpIntoLevel = xp - currentLevelXP;
  const xpNeededForNext = nextLevelXP - currentLevelXP;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.content}>
        {onBack && (
          <TouchableOpacity style={styles.backButton} onPress={onBack}>
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>
        )}

        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 32 }}
        >
          <View style={styles.profileSection}>
            <View
              style={[
                styles.avatar,
                {
                  borderColor: frameStyle.borderColor,
                  borderWidth: frameStyle.borderWidth,
                },
              ]}
            >
              <Text style={styles.avatarText}>
                {profileIcon || user?.email?.charAt(0).toUpperCase() || '?'}
              </Text>
            </View>

            {/* Username with Flag */}
            <View style={styles.usernameRow}>
              {country && <Text style={styles.countryFlag}>{countryCodeToFlag(country)}</Text>}
              {profileLoading ? (
                <Animated.View
                  style={[
                    styles.usernameSkeleton,
                    { opacity: pulseAnim }
                  ]}
                />
              ) : (
                <Text style={styles.username}>
                  {cachedUsername || 'Player'}
                </Text>
              )}
            </View>

            {/* Level Badge */}
            {loadingStats ? (
              <Animated.View
                style={[
                  styles.levelBadgeSkeleton,
                  { opacity: pulseAnim }
                ]}
              />
            ) : (
              <Text style={styles.levelBadgeText2}>
                Level {level} • {getLevelTitle(level)}
              </Text>
            )}

            <AnimatedButton
              style={styles.customizeButton}
              onPress={() => {
                soundService.playButtonClick();
                onNavigateToCustomize();
              }}
            >
              <Text style={styles.customizeButtonText}>Customize</Text>
            </AnimatedButton>

            {/* XP Section */}
            {!loadingStats && (
              <View style={[styles.xpCard, shadows.card]}>
                <View style={styles.xpHeader}>
                  <View style={styles.levelBadge}>
                    <Text style={styles.levelBadgeText}>{level}</Text>
                  </View>
                  <View style={styles.levelTitleContainer}>
                    <Text style={styles.levelTitle}>Level {level}</Text>
                    <Text style={styles.totalXP}>{xp.toLocaleString()} Total XP</Text>
                  </View>
                </View>
                <View style={styles.xpProgressContainer}>
                  <View style={styles.xpBarBackground}>
                    <LinearGradient
                      colors={[colors.xpGradientStart, colors.xpGradientEnd]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={[
                        styles.xpBarFill,
                        { width: `${progress.percentage}%` },
                      ]}
                    />
                  </View>
                  <Text style={styles.xpText}>
                    {xpIntoLevel} / {xpNeededForNext} XP to next level
                  </Text>
                </View>
              </View>
            )}

            {/* Achievements Button */}
            <AnimatedCard
              style={[styles.achievementsButton, shadows.card]}
              onPress={() => {
                soundService.playButtonClick();
                onNavigateToAchievements();
              }}
            >
              <View style={styles.achievementsIconCircle}>
                <Image source={trophyIcon} style={styles.achievementsTrophyIcon} />
              </View>
              <View style={styles.achievementsButtonContent}>
                <Text style={styles.achievementsButtonTitle}>Achievements</Text>
                <Text style={styles.achievementsButtonSubtitle}>View your progress</Text>
              </View>
              <Text style={styles.achievementsButtonArrow}>→</Text>
            </AnimatedCard>

            {/* Stats Section */}
            <Text style={styles.sectionTitle}>Your Stats</Text>

            {loadingStats ? (
              <ActivityIndicator color={colors.primary} style={styles.statsLoader} />
            ) : (
              <View style={styles.statsTable}>
                {/* Header Row */}
                <View style={styles.statsHeaderRow}>
                  <View style={styles.statsSportCol}>
                    <Text style={styles.statsHeaderText}>SPORT</Text>
                  </View>
                  <View style={styles.statsNumCol}>
                    <Text style={styles.statsHeaderText}>SOLVED</Text>
                  </View>
                  <View style={styles.statsNumCol}>
                    <Text style={styles.statsHeaderText}>STREAK</Text>
                  </View>
                  <View style={styles.statsNumCol}>
                    <Text style={styles.statsHeaderText}>BEST</Text>
                  </View>
                </View>

                {/* NBA Row */}
                <View style={styles.statsDataRow}>
                  <View style={styles.statsSportCol}>
                    <View style={[styles.statsSportBadge, { backgroundColor: getSportColor('nba') }]}>
                      <Text style={styles.statsSportBadgeText}>NBA</Text>
                    </View>
                  </View>
                  <View style={styles.statsNumCol}>
                    <Text style={styles.statsNumValue}>{stats?.nba_total_solved ?? 0}</Text>
                  </View>
                  <View style={styles.statsNumCol}>
                    <Text style={styles.statsNumValue}>{stats?.nba_current_streak ?? 0}</Text>
                  </View>
                  <View style={styles.statsNumCol}>
                    <Text style={styles.statsNumValue}>{stats?.nba_best_streak ?? 0}</Text>
                  </View>
                </View>

                {/* EPL Row */}
                <View style={styles.statsDataRow}>
                  <View style={styles.statsSportCol}>
                    <View style={[styles.statsSportBadge, { backgroundColor: getSportColor('pl') }]}>
                      <Text style={styles.statsSportBadgeText}>EPL</Text>
                    </View>
                  </View>
                  <View style={styles.statsNumCol}>
                    <Text style={styles.statsNumValue}>{stats?.pl_total_solved ?? 0}</Text>
                  </View>
                  <View style={styles.statsNumCol}>
                    <Text style={styles.statsNumValue}>{stats?.pl_current_streak ?? 0}</Text>
                  </View>
                  <View style={styles.statsNumCol}>
                    <Text style={styles.statsNumValue}>{stats?.pl_best_streak ?? 0}</Text>
                  </View>
                </View>

                {/* NFL Row */}
                <View style={styles.statsDataRow}>
                  <View style={styles.statsSportCol}>
                    <View style={[styles.statsSportBadge, { backgroundColor: getSportColor('nfl') }]}>
                      <Text style={styles.statsSportBadgeText}>NFL</Text>
                    </View>
                  </View>
                  <View style={styles.statsNumCol}>
                    <Text style={styles.statsNumValue}>{stats?.nfl_total_solved ?? 0}</Text>
                  </View>
                  <View style={styles.statsNumCol}>
                    <Text style={styles.statsNumValue}>{stats?.nfl_current_streak ?? 0}</Text>
                  </View>
                  <View style={styles.statsNumCol}>
                    <Text style={styles.statsNumValue}>{stats?.nfl_best_streak ?? 0}</Text>
                  </View>
                </View>

                {/* MLB Row */}
                <View style={[styles.statsDataRow, styles.statsDataRowLast]}>
                  <View style={styles.statsSportCol}>
                    <View style={[styles.statsSportBadge, { backgroundColor: getSportColor('mlb') }]}>
                      <Text style={styles.statsSportBadgeText}>MLB</Text>
                    </View>
                  </View>
                  <View style={styles.statsNumCol}>
                    <Text style={styles.statsNumValue}>{stats?.mlb_total_solved ?? 0}</Text>
                  </View>
                  <View style={styles.statsNumCol}>
                    <Text style={styles.statsNumValue}>{stats?.mlb_current_streak ?? 0}</Text>
                  </View>
                  <View style={styles.statsNumCol}>
                    <Text style={styles.statsNumValue}>{stats?.mlb_best_streak ?? 0}</Text>
                  </View>
                </View>

                {/* Total Points Row */}
                <View style={styles.totalPointsRow}>
                  <Text style={styles.totalPointsLabel}>LEADERBOARD POINTS</Text>
                  <Text style={styles.totalPointsValue}>{stats?.points_all_time ?? 0}</Text>
                </View>
              </View>
            )}

            {/* Settings Section */}
            <Text style={styles.sectionTitle}>Settings</Text>

            <View style={[styles.settingsCard, shadows.card]}>
              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>Sound Effects</Text>
                  <Text style={styles.settingDescription}>Play sounds during duels</Text>
                </View>
                <TouchableOpacity
                  style={[
                    styles.toggleButton,
                    soundEnabled && styles.toggleButtonActive,
                  ]}
                  onPress={handleSoundToggle}
                >
                  <View style={[
                    styles.toggleKnob,
                    soundEnabled && styles.toggleKnobActive,
                  ]} />
                </TouchableOpacity>
              </View>

              {onReplayOnboarding && (
                <>
                  <View style={styles.settingDivider} />
                  <TouchableOpacity style={styles.settingRow} onPress={onReplayOnboarding}>
                    <View style={styles.settingInfo}>
                      <Text style={styles.settingLabel}>Replay Intro</Text>
                      <Text style={styles.settingDescription}>See the onboarding screens again</Text>
                    </View>
                    <Text style={styles.settingArrow}>→</Text>
                  </TouchableOpacity>
                </>
              )}

              <View style={styles.settingDivider} />
              <TouchableOpacity style={styles.settingRow} onPress={() => setShowCountryPicker(true)}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>Country</Text>
                  <Text style={styles.settingDescription}>
                    {country ? `${countryCodeToFlag(country)} ${COUNTRIES.find(c => c.code === country)?.name || country}` : 'Not set'}
                  </Text>
                </View>
                <Text style={styles.settingArrow}>→</Text>
              </TouchableOpacity>

              {/* Email: Show linked email if linked, or Link Email button if not */}
              {hasLinkedEmail ? (
                <>
                  <View style={styles.settingDivider} />
                  <View style={styles.settingRow}>
                    <View style={styles.settingInfo}>
                      <Text style={styles.settingLabel}>Email</Text>
                      <Text style={styles.settingDescription}>{user?.email}</Text>
                    </View>
                    <Text style={styles.linkedBadge}>✓ Linked</Text>
                  </View>
                </>
              ) : onLinkEmail ? (
                <>
                  <View style={styles.settingDivider} />
                  <TouchableOpacity style={styles.settingRow} onPress={onLinkEmail}>
                    <View style={styles.settingInfo}>
                      <Text style={styles.settingLabel}>Link Email</Text>
                      <Text style={styles.settingDescription}>Add email for account recovery</Text>
                    </View>
                    <Text style={styles.settingArrow}>→</Text>
                  </TouchableOpacity>
                </>
              ) : null}

              {/* Send Feedback */}
              <View style={styles.settingDivider} />
              <TouchableOpacity style={styles.settingRow} onPress={() => setShowFeedbackModal(true)}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>Send Feedback</Text>
                  <Text style={styles.settingDescription}>Tell us what you think</Text>
                </View>
                <Image source={speechIcon} style={styles.feedbackIcon} />
              </TouchableOpacity>

              {/* Delete Account */}
              <View style={styles.settingDivider} />
              <TouchableOpacity
                style={styles.deleteAccountButton}
                onPress={() => setShowDeleteModal(true)}
              >
                <Text style={styles.deleteAccountText}>Delete Account</Text>
              </TouchableOpacity>
            </View>

            {/* Member Info */}
            <Text style={styles.memberInfo}>
              Member since {user?.created_at
                ? new Date(user.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                : 'N/A'}
            </Text>

            {/* Log Out Button */}
            <AnimatedButton
              style={[styles.logoutButton, loggingOut && styles.buttonDisabled]}
              onPress={() => {
                soundService.playButtonClick();
                handleLogout();
              }}
              disabled={loggingOut}
            >
              {loggingOut ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.logoutButtonText}>Log Out</Text>
              )}
            </AnimatedButton>
          </View>
        </ScrollView>
      </View>

      {/* Country Picker Modal */}
      <Modal
        visible={showCountryPicker}
        animationType="slide"
        transparent
        onRequestClose={() => setShowCountryPicker(false)}
      >
        <View style={styles.countryModalOverlay}>
          <View style={styles.countryModalContent}>
            <View style={styles.countryModalHeader}>
              <Text style={styles.countryModalTitle}>Select Country</Text>
              <TouchableOpacity onPress={() => setShowCountryPicker(false)}>
                <Text style={styles.countryModalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.countrySearchInput}
              placeholder="Search countries..."
              placeholderTextColor="#999999"
              value={countrySearchQuery}
              onChangeText={setCountrySearchQuery}
              autoCapitalize="none"
              selectionColor="#1ABC9C"
            />
            <ScrollView style={styles.countryList} showsVerticalScrollIndicator={false}>
              {filteredCountries.map((c) => (
                <TouchableOpacity
                  key={c.code}
                  style={[
                    styles.countryOption,
                    country === c.code && styles.countryOptionSelected,
                  ]}
                  onPress={() => handleCountrySelect(c)}
                >
                  <Text style={styles.countryOptionFlag}>{countryCodeToFlag(c.code)}</Text>
                  <Text style={[
                    styles.countryOptionName,
                    country === c.code && styles.countryOptionNameSelected,
                  ]}>{c.name}</Text>
                  {country === c.code && (
                    <Text style={styles.countryOptionCheck}>✓</Text>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Feedback Modal */}
      <FeedbackModal
        visible={showFeedbackModal}
        onClose={() => setShowFeedbackModal(false)}
        userId={user?.id || null}
        username={cachedUsername || null}
        onSuccess={handleFeedbackSuccess}
      />

      {/* Feedback Success Toast */}
      {showFeedbackToast && (
        <Animated.View
          style={[
            styles.feedbackToast,
            {
              opacity: feedbackToastAnim,
              transform: [
                {
                  translateY: feedbackToastAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-50, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <Text style={styles.feedbackToastText}>Thanks for your feedback!</Text>
        </Animated.View>
      )}

      {/* Delete Account Confirmation Modal */}
      <Modal
        visible={showDeleteModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeleteModal(false)}
      >
        <View style={styles.deleteModalOverlay}>
          <View style={styles.deleteModalContent}>
            <Text style={styles.deleteModalTitle}>Delete Account?</Text>
            <Text style={styles.deleteModalBody}>
              This will permanently delete your account and all your data, including your stats, achievements, friends, and league memberships. This cannot be undone.
            </Text>
            <View style={styles.deleteModalButtons}>
              <TouchableOpacity
                style={styles.deleteModalCancelButton}
                onPress={() => setShowDeleteModal(false)}
              >
                <Text style={styles.deleteModalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteModalDeleteButton}
                onPress={() => {
                  setShowDeleteModal(false);
                  setShowDeleteConfirmModal(true);
                }}
              >
                <Text style={styles.deleteModalDeleteText}>Delete My Account</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete Account Second Confirmation Modal */}
      <Modal
        visible={showDeleteConfirmModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowDeleteConfirmModal(false);
          setDeleteConfirmText('');
        }}
      >
        <View style={styles.deleteModalOverlay}>
          <View style={styles.deleteModalContent}>
            <Text style={styles.deleteModalTitle}>Confirm Deletion</Text>
            <Text style={styles.deleteModalBody}>
              Type DELETE below to confirm you want to permanently delete your account.
            </Text>
            <TextInput
              style={styles.deleteConfirmInput}
              placeholder="Type DELETE to confirm"
              placeholderTextColor="#999999"
              value={deleteConfirmText}
              onChangeText={setDeleteConfirmText}
              autoCapitalize="characters"
              selectionColor="#E53935"
            />
            <View style={styles.deleteModalButtons}>
              <TouchableOpacity
                style={styles.deleteModalCancelButton}
                onPress={() => {
                  setShowDeleteConfirmModal(false);
                  setDeleteConfirmText('');
                }}
              >
                <Text style={styles.deleteModalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.deleteModalDeleteButton,
                  deleteConfirmText.toUpperCase() !== 'DELETE' && styles.deleteModalButtonDisabled,
                ]}
                onPress={handleDeleteAccount}
                disabled={deleteConfirmText.toUpperCase() !== 'DELETE' || deleting}
              >
                {deleting ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.deleteModalDeleteText}>Confirm Deletion</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Account Deleted Toast */}
      {showDeletedToast && (
        <Animated.View
          style={[
            styles.deletedToast,
            {
              opacity: deletedToastAnim,
              transform: [
                {
                  translateY: deletedToastAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-50, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <Text style={styles.deletedToastText}>Account deleted</Text>
        </Animated.View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 20,
  },
  backButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#F2C94C',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#000000',
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
    marginLeft: 20,
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  backButtonText: {
    color: '#1A1A1A',
    fontSize: 12,
    fontFamily: 'DMSans_900Black',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  profileSection: {
    alignItems: 'center',
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
    paddingRight: 2, // Extra space for shadow offset
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  avatarText: {
    fontSize: 40,
    fontFamily: 'DMSans_900Black',
    color: '#FFFFFF',
  },
  username: {
    fontSize: 24,
    fontFamily: 'DMSans_900Black',
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 4,
  },
  usernameSkeleton: {
    width: 120,
    height: 28,
    backgroundColor: '#E5E5E5',
    borderRadius: 6,
    marginBottom: 4,
  },
  levelBadgeText2: {
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
    color: '#666666',
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  levelBadgeSkeleton: {
    width: 140,
    height: 18,
    backgroundColor: '#E5E5E5',
    borderRadius: 6,
    marginBottom: spacing.md,
  },
  customizeButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.button,
    backgroundColor: '#F2C94C',
    borderWidth: 2,
    borderColor: '#000000',
    marginBottom: spacing.md,
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  customizeButtonText: {
    fontFamily: 'DMSans_900Black',
    fontSize: 14,
    color: '#1A1A1A',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  title: {
    ...typography.header,
    color: colors.text,
    marginBottom: spacing.lg,
  },
  memberInfo: {
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
    color: '#888888',
    textAlign: 'center',
    marginTop: spacing.xl,
  },
  sectionTitle: {
    ...typography.h2,
    color: colors.text,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
    alignSelf: 'flex-start',
  },
  xpCard: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.card,
    borderWidth: borders.card,
    borderColor: colors.border,
    padding: spacing.lg,
    marginTop: spacing.md,
  },
  xpHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  levelBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    borderWidth: borders.button,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  levelBadgeText: {
    ...typography.h1,
    color: '#FFFFFF',
  },
  levelTitleContainer: {
    flex: 1,
  },
  levelTitle: {
    ...typography.h1,
    color: colors.text,
  },
  totalXP: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: 2,
  },
  xpProgressContainer: {
    width: '100%',
  },
  xpBarBackground: {
    height: 12,
    backgroundColor: colors.borderLight,
    borderRadius: 6,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  xpBarFill: {
    height: '100%',
    borderRadius: 6,
  },
  xpText: {
    ...typography.xp,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  statsLoader: {
    marginTop: spacing.lg,
  },
  // Stats Table Styles
  statsTable: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#000000',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  statsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#F5F5F5',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E0',
  },
  statsHeaderText: {
    fontSize: 10,
    fontFamily: 'DMSans_700Bold',
    color: '#888888',
    letterSpacing: 0.5,
  },
  statsHeaderIcon: {
    width: 14,
    height: 18,
  },
  statsHeaderIconLightning: {
    width: 11,
    height: 18,
  },
  statsDataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E0',
  },
  statsDataRowLast: {
    borderBottomWidth: 0,
  },
  totalPointsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    backgroundColor: '#F5F5F0',
    borderTopWidth: 2,
    borderTopColor: '#E5E5E0',
    marginTop: 4,
  },
  totalPointsLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 0.5,
  },
  totalPointsValue: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.primary,
  },
  statsSportCol: {
    width: 70,
  },
  statsNumCol: {
    flex: 1,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 4,
  },
  statsSportBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statsSportBadgeText: {
    fontSize: 11,
    fontFamily: 'DMSans_900Black',
    color: '#FFFFFF',
  },
  statsNumValue: {
    fontSize: 18,
    fontFamily: 'DMSans_900Black',
    color: '#1A1A1A',
  },
  statsBestText: {
    fontSize: 11,
    fontFamily: 'DMSans_400Regular',
    color: '#888888',
  },
  logoutButton: {
    width: '100%',
    backgroundColor: '#E53935',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#000000',
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.lg,
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  logoutButtonText: {
    fontFamily: 'DMSans_900Black',
    fontSize: 14,
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  achievementsButton: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2C94C',
    borderRadius: borderRadius.card,
    borderWidth: 2,
    borderColor: '#000000',
    padding: spacing.md,
    marginTop: spacing.md,
  },
  achievementsIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  achievementsTrophyIcon: {
    width: 24,
    height: 24,
  },
  achievementsButtonContent: {
    flex: 1,
  },
  achievementsButtonTitle: {
    ...typography.h3,
    color: colors.text,
  },
  achievementsButtonSubtitle: {
    ...typography.bodySmall,
    color: '#1A1A1A',
    marginTop: 2,
  },
  achievementsButtonArrow: {
    fontSize: 20,
    color: '#1A1A1A',
    fontFamily: 'DMSans_700Bold',
  },
  settingsCard: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.card,
    borderWidth: borders.card,
    borderColor: colors.border,
    padding: spacing.md,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingInfo: {
    flex: 1,
  },
  settingLabel: {
    ...typography.body,
    color: colors.text,
    fontFamily: 'DMSans_700Bold',
  },
  settingDescription: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: 2,
  },
  toggleButton: {
    width: 52,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.borderLight,
    borderWidth: 2,
    borderColor: colors.border,
    padding: 2,
    justifyContent: 'center',
  },
  toggleButtonActive: {
    backgroundColor: colors.accent,
  },
  toggleKnob: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: colors.border,
  },
  toggleKnobActive: {
    alignSelf: 'flex-end',
  },
  settingDivider: {
    height: 1,
    backgroundColor: colors.borderLight,
    marginVertical: spacing.md,
  },
  settingArrow: {
    fontSize: 20,
    color: colors.textTertiary,
    fontFamily: 'DMSans_700Bold',
  },
  linkedBadge: {
    fontSize: 12,
    fontFamily: 'DMSans_700Bold',
    color: colors.success,
  },
  // Username with flag
  usernameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  countryFlag: {
    fontSize: 24,
  },
  // Country Picker Modal
  countryModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  countryModalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    borderWidth: 2,
    borderColor: '#000000',
    borderBottomWidth: 0,
  },
  countryModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  countryModalTitle: {
    fontSize: 20,
    fontFamily: 'DMSans_900Black',
    color: '#1A1A1A',
  },
  countryModalClose: {
    fontSize: 24,
    color: '#666666',
    padding: 4,
  },
  countrySearchInput: {
    margin: 16,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    fontFamily: 'DMSans_400Regular',
    color: '#1A1A1A',
    borderWidth: 2,
    borderColor: '#000000',
  },
  countryList: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  countryOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginBottom: 4,
  },
  countryOptionSelected: {
    backgroundColor: '#E8F5F1',
  },
  countryOptionFlag: {
    fontSize: 24,
    marginRight: 12,
  },
  countryOptionName: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'DMSans_500Medium',
    color: '#1A1A1A',
  },
  countryOptionNameSelected: {
    fontFamily: 'DMSans_700Bold',
    color: '#1ABC9C',
  },
  countryOptionCheck: {
    fontSize: 18,
    color: '#1ABC9C',
    fontFamily: 'DMSans_700Bold',
  },
  feedbackIcon: {
    width: 20,
    height: 20,
  },
  feedbackToast: {
    position: 'absolute',
    top: 60,
    left: 20,
    right: 20,
    backgroundColor: colors.success,
    borderRadius: borderRadius.card,
    borderWidth: borders.card,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  feedbackToastText: {
    ...typography.body,
    color: '#FFFFFF',
    fontFamily: 'DMSans_700Bold',
  },
  // Delete Account styles
  deleteAccountButton: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  deleteAccountText: {
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
    color: '#E53935',
  },
  deleteModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  deleteModalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#000000',
    padding: 24,
    width: '100%',
    maxWidth: 340,
    shadowColor: '#000000',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  deleteModalTitle: {
    fontSize: 20,
    fontFamily: 'DMSans_700Bold',
    color: '#1A1A1A',
    marginBottom: 12,
    textAlign: 'center',
  },
  deleteModalBody: {
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
    color: '#666666',
    lineHeight: 20,
    marginBottom: 20,
    textAlign: 'center',
  },
  deleteModalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  deleteModalCancelButton: {
    flex: 1,
    backgroundColor: '#F2C94C',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#000000',
    paddingVertical: 14,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  deleteModalCancelText: {
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
    color: '#1A1A1A',
  },
  deleteModalDeleteButton: {
    flex: 1,
    backgroundColor: '#E53935',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#000000',
    paddingVertical: 14,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  deleteModalButtonDisabled: {
    opacity: 0.5,
  },
  deleteModalDeleteText: {
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
    color: '#FFFFFF',
  },
  deleteConfirmInput: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#000000',
    padding: 14,
    fontSize: 16,
    fontFamily: 'DMSans_400Regular',
    color: '#1A1A1A',
    marginBottom: 20,
    textAlign: 'center',
  },
  deletedToast: {
    position: 'absolute',
    top: 60,
    left: 20,
    right: 20,
    backgroundColor: '#666666',
    borderRadius: borderRadius.card,
    borderWidth: borders.card,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  deletedToastText: {
    fontSize: 16,
    fontFamily: 'DMSans_700Bold',
    color: '#FFFFFF',
  },
});
