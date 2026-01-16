import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Image,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import {
  Achievement,
  UserStatsForAchievements,
  fetchAchievementsWithStatus,
  getAchievementProgress,
  AchievementProgress,
} from '../lib/achievementsService';

interface Props {
  onBack: () => void;
}

const categoryLabels: Record<string, string> = {
  puzzle: 'Puzzle',
  duel: 'Duel',
  social: 'Social',
  secret: 'Secret',
};

// Achievement icon mapping - maps achievement names to icon images
// Note: icon files are spelled "acheivement" (typo in filenames)
const achievementIcons: Record<string, any> = {
  // Puzzle achievements
  'First Victory': require('../../assets/images/achievements/acheivement-first-blood.png'),
  'First Blood': require('../../assets/images/achievements/acheivement-first-blood.png'),
  'Sharp Shooter': require('../../assets/images/achievements/acheivement-sharp-shooter.png'),
  'Perfect Game': require('../../assets/images/achievements/acheivement-sharp-shooter.png'),
  'On Fire': require('../../assets/images/achievements/acheivement-unstoppable.png'), // Using unstoppable as fallback
  'Week Warrior': require('../../assets/images/achievements/acheivement-unstoppable.png'),
  'Unstoppable': require('../../assets/images/achievements/acheivement-unstoppable.png'),
  'Monthly Master': require('../../assets/images/achievements/acheivement-unstoppable.png'),
  'Century': require('../../assets/images/achievements/acheivement-century.png'),
  'Puzzle Master': require('../../assets/images/achievements/acheivement-century.png'),
  'Puzzle Expert': require('../../assets/images/achievements/acheivement-century.png'),
  'Puzzle Enthusiast': require('../../assets/images/achievements/acheivement-century.png'),
  'Globe Trotter': require('../../assets/images/achievements/acheivement-globe-trotter.png'),

  // Duel achievements
  'Challenger': require('../../assets/images/achievements/acheivement-challenger.png'),
  'Duel Debut': require('../../assets/images/achievements/acheivement-challenger.png'),
  'Duelist': require('../../assets/images/achievements/acheivement-duelist.png'),
  'Duel Champion': require('../../assets/images/achievements/acheivement-duelist.png'),
  'Duel Legend': require('../../assets/images/achievements/acheivement-duelist.png'),
  'Underdog': require('../../assets/images/achievements/acheivement-underdog.png'),

  // Social achievements
  'Squad Up': require('../../assets/images/achievements/acheivement-squad-up.png'),
  'Social Starter': require('../../assets/images/achievements/acheivement-squad-up.png'),
  'Popular Player': require('../../assets/images/achievements/acheivement-squad-up.png'),
  'Team Player': require('../../assets/images/achievements/acheivement-squad-up.png'),
  'Recruiter': require('../../assets/images/achievements/acheivement-recruiter.png'),

  // Secret achievements
  'Night Owl': require('../../assets/images/achievements/acheivement-night-owl.png'),
  'Speed Demon': require('../../assets/images/achievements/acheivement-speed-demon.png'),
  'Perfectionist': require('../../assets/images/achievements/acheivement-perfectionist.png'),

  // Level achievements - use challenger as fallback
  'Rising Star': require('../../assets/images/achievements/acheivement-challenger.png'),
  'Elite Status': require('../../assets/images/achievements/acheivement-challenger.png'),
};

// Default icon for unmapped achievements
const defaultIcon = require('../../assets/images/achievements/acheivement-challenger.png');

// Padlock icon for locked achievements
const padlockIcon = require('../../assets/images/icon-padlock.png');

// Secret achievement names
const secretAchievementNames = ['Night Owl', 'Speed Demon', 'Perfectionist'];

// Progress labels for countable achievements
const progressLabels: Record<string, { label: string; target: number }> = {
  'Century': { label: 'puzzles', target: 100 },
  'Puzzle Master': { label: 'puzzles', target: 100 },
  'Puzzle Expert': { label: 'puzzles', target: 50 },
  'Puzzle Enthusiast': { label: 'puzzles', target: 10 },
  'On Fire': { label: 'days', target: 7 },
  'Week Warrior': { label: 'days', target: 7 },
  'Unstoppable': { label: 'days', target: 30 },
  'Monthly Master': { label: 'days', target: 30 },
  'Duelist': { label: 'duels', target: 10 },
  'Duel Champion': { label: 'duels', target: 10 },
  'Duel Legend': { label: 'duels', target: 50 },
  'Globe Trotter': { label: 'sports', target: 3 },
  'Perfectionist': { label: 'in a row', target: 5 },
  'Popular Player': { label: 'friends', target: 10 },
};

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function getAchievementIcon(achievementName: string): any {
  return achievementIcons[achievementName] || defaultIcon;
}

export default function AchievementsScreen({ onBack }: Props) {
  const { user } = useAuth();
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [unlockedMap, setUnlockedMap] = useState<Map<string, string>>(new Map());
  const [stats, setStats] = useState<UserStatsForAchievements | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedAchievement, setSelectedAchievement] = useState<Achievement | null>(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    loadAchievements();
  }, [user]);

  async function loadAchievements() {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      const result = await fetchAchievementsWithStatus(user.id);
      setAchievements(result.achievements);
      setUnlockedMap(result.unlockedMap);
      setStats(result.stats);
    } catch (error) {
      console.error('Error loading achievements:', error);
    } finally {
      setLoading(false);
    }
  }

  function handleAchievementPress(achievement: Achievement) {
    setSelectedAchievement(achievement);
    setShowModal(true);
  }

  function getProgress(achievement: Achievement): AchievementProgress | null {
    if (!stats) return null;
    return getAchievementProgress(achievement.name, stats);
  }

  function isSecretAchievement(achievementName: string): boolean {
    return secretAchievementNames.includes(achievementName);
  }

  const unlockedCount = unlockedMap.size;
  const totalCount = achievements.length;

  // Group achievements by category
  const groupedAchievements = achievements.reduce((acc, achievement) => {
    const category = achievement.category || 'other';
    if (!acc[category]) acc[category] = [];
    acc[category].push(achievement);
    return acc;
  }, {} as Record<string, Achievement[]>);

  const categoryOrder = ['puzzle', 'duel', 'social', 'secret'];
  const sortedCategories = Object.keys(groupedAchievements).sort(
    (a, b) => categoryOrder.indexOf(a) - categoryOrder.indexOf(b)
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1ABC9C" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack} activeOpacity={0.8}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Achievements</Text>
        <Text style={styles.subtitle}>
          {unlockedCount}/{totalCount} Unlocked
        </Text>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {sortedCategories.map((category) => (
          <View key={category} style={styles.categorySection}>
            <View style={styles.categoryHeader}>
              <Text style={styles.categoryTitle}>
                {categoryLabels[category] || category.charAt(0).toUpperCase() + category.slice(1)}
              </Text>
            </View>
            <View style={styles.categoryDivider} />

            <View style={styles.achievementsGrid}>
              {groupedAchievements[category].map((achievement) => {
                const isUnlocked = unlockedMap.has(achievement.id);
                const isSecret = (achievement.is_secret || isSecretAchievement(achievement.name)) && !isUnlocked;
                const progress = !isUnlocked ? getProgress(achievement) : null;
                const progressConfig = progressLabels[achievement.name];

                return (
                  <View key={achievement.id} style={styles.achievementCardWrapper}>
                    <TouchableOpacity
                      style={[
                        styles.achievementCard,
                        !isUnlocked && styles.achievementCardLocked,
                      ]}
                      onPress={() => handleAchievementPress(achievement)}
                      activeOpacity={0.8}
                    >
                      {/* Padlock for locked achievements */}
                      {!isUnlocked && (
                        <View style={styles.lockedBadge}>
                          <Image source={padlockIcon} style={styles.padlockIcon} />
                        </View>
                      )}

                      {/* Checkmark for unlocked achievements */}
                      {isUnlocked && (
                        <View style={styles.unlockedBadge}>
                          <Text style={styles.unlockedCheck}>✓</Text>
                        </View>
                      )}

                      {/* Icon */}
                      <View
                        style={[
                          styles.iconContainer,
                          !isUnlocked && styles.iconContainerLocked,
                        ]}
                      >
                        {isSecret ? (
                          <Image source={padlockIcon} style={styles.secretIcon} />
                        ) : (
                          <Image
                            source={getAchievementIcon(achievement.name)}
                            style={[
                              styles.achievementIcon,
                              !isUnlocked && styles.iconGrayscale,
                            ]}
                          />
                        )}
                      </View>

                      {/* Title */}
                      <Text
                        style={[
                          styles.achievementName,
                          !isUnlocked && styles.textLocked,
                        ]}
                        numberOfLines={2}
                      >
                        {isSecret ? '???' : achievement.name}
                      </Text>

                      {/* Description */}
                      <Text
                        style={[
                          styles.achievementDescription,
                          isUnlocked && styles.achievementDescriptionUnlocked,
                          !isUnlocked && styles.textLocked,
                        ]}
                        numberOfLines={2}
                      >
                        {isSecret ? 'Secret achievement' : achievement.description}
                      </Text>

                      {/* Progress bar for locked countable achievements */}
                      {!isUnlocked && !isSecret && progress && progressConfig && (
                        <View style={styles.progressContainer}>
                          <View style={styles.progressBar}>
                            <View
                              style={[
                                styles.progressFill,
                                {
                                  width: `${Math.min((progress.current / progress.target) * 100, 100)}%`,
                                },
                              ]}
                            />
                          </View>
                          <Text style={styles.progressText}>
                            {progress.current}/{progress.target} {progressConfig.label}
                          </Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Achievement Detail Modal */}
      <Modal
        visible={showModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowModal(false)}
        >
          <TouchableOpacity
            style={styles.modalContent}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            {selectedAchievement && (
              <>
                {(() => {
                  const isUnlocked = unlockedMap.has(selectedAchievement.id);
                  const unlockDate = unlockedMap.get(selectedAchievement.id);
                  const progress = !isUnlocked ? getProgress(selectedAchievement) : null;
                  const isSecret = (selectedAchievement.is_secret || isSecretAchievement(selectedAchievement.name)) && !isUnlocked;
                  const progressConfig = progressLabels[selectedAchievement.name];

                  return (
                    <>
                      <View
                        style={[
                          styles.modalIconContainer,
                          !isUnlocked && styles.modalIconContainerLocked,
                        ]}
                      >
                        {isSecret ? (
                          <Image source={padlockIcon} style={styles.modalSecretIcon} />
                        ) : (
                          <Image
                            source={getAchievementIcon(selectedAchievement.name)}
                            style={[
                              styles.modalAchievementIcon,
                              !isUnlocked && styles.iconGrayscale,
                            ]}
                          />
                        )}
                      </View>

                      <Text style={[styles.modalTitle, !isUnlocked && styles.modalTitleLocked]}>
                        {isSecret ? '???' : selectedAchievement.name}
                      </Text>

                      <View style={styles.categoryBadge}>
                        <Text style={styles.categoryBadgeText}>
                          {selectedAchievement.category.toUpperCase()}
                        </Text>
                      </View>

                      <Text style={[styles.modalDescription, !isUnlocked && styles.modalDescriptionLocked]}>
                        {isSecret
                          ? 'Complete a secret challenge to unlock this achievement!'
                          : selectedAchievement.description}
                      </Text>

                      <View style={styles.xpRewardContainer}>
                        <Text style={styles.xpRewardLabel}>XP REWARD</Text>
                        <Text style={styles.xpRewardValue}>
                          +{selectedAchievement.xp_reward} XP
                        </Text>
                      </View>

                      {isUnlocked && unlockDate && (
                        <View style={styles.unlockedInfo}>
                          <Text style={styles.unlockedLabel}>UNLOCKED</Text>
                          <Text style={styles.unlockedValue}>{formatDate(unlockDate)}</Text>
                        </View>
                      )}

                      {!isUnlocked && !isSecret && progress && (
                        <View style={styles.modalProgressContainer}>
                          <Text style={styles.progressLabel}>PROGRESS</Text>
                          <View style={styles.modalProgressBar}>
                            <View
                              style={[
                                styles.modalProgressFill,
                                {
                                  width: `${Math.min((progress.current / progress.target) * 100, 100)}%`,
                                },
                              ]}
                            />
                          </View>
                          <Text style={styles.modalProgressText}>
                            {progress.current} / {progress.target}
                            {progressConfig ? ` ${progressConfig.label}` : ''}
                          </Text>
                        </View>
                      )}
                    </>
                  );
                })()}
              </>
            )}

            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowModal(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F2EB',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    paddingVertical: 16,
    paddingTop: 16,
  },
  backButton: {
    position: 'absolute',
    left: 16,
    top: 16,
    backgroundColor: '#F2C94C',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#000000',
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  backButtonText: {
    color: '#1A1A1A',
    fontSize: 12,
    fontFamily: 'DMSans_900Black',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 24,
    fontFamily: 'DMSans_900Black',
    color: '#1A1A1A',
    marginTop: 40,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
    color: '#888888',
    marginTop: 4,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  categorySection: {
    marginBottom: 24,
  },
  categoryHeader: {
    marginBottom: 8,
  },
  categoryTitle: {
    fontSize: 16,
    fontFamily: 'DMSans_900Black',
    color: '#1A1A1A',
  },
  categoryDivider: {
    height: 1,
    backgroundColor: '#E5E5E0',
    marginBottom: 16,
  },
  achievementsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
  },
  achievementCardWrapper: {
    width: '50%',
    paddingHorizontal: 6,
    marginBottom: 12,
  },
  achievementCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#000000',
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
    minHeight: 160,
  },
  achievementCardLocked: {
    backgroundColor: '#F5F5F5',
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#1ABC9C',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    marginTop: 4,
    alignSelf: 'center',
    overflow: 'hidden',
  },
  iconContainerLocked: {
    backgroundColor: '#E0E0E0',
  },
  achievementIcon: {
    width: 40,
    height: 40,
    resizeMode: 'contain',
  },
  iconGrayscale: {
    opacity: 0.4,
    // Note: True grayscale requires native module on RN
    // Using opacity as fallback
    tintColor: Platform.OS === 'ios' ? undefined : '#888888',
  },
  secretIcon: {
    width: 28,
    height: 28,
    resizeMode: 'contain',
    tintColor: '#888888',
  },
  achievementName: {
    fontSize: 13,
    fontFamily: 'DMSans_900Black',
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 4,
  },
  achievementDescription: {
    fontSize: 11,
    fontFamily: 'DMSans_400Regular',
    color: '#888888',
    textAlign: 'center',
    minHeight: 28,
  },
  achievementDescriptionUnlocked: {
    color: '#1ABC9C',
  },
  textLocked: {
    color: '#AAAAAA',
  },
  lockedBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  padlockIcon: {
    width: 14,
    height: 14,
    resizeMode: 'contain',
    tintColor: '#AAAAAA',
  },
  unlockedBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#3BA978',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#000000',
  },
  unlockedCheck: {
    color: '#FFFFFF',
    fontSize: 11,
    fontFamily: 'DMSans_900Black',
  },
  // Progress bar styles for cards
  progressContainer: {
    width: '100%',
    marginTop: 6,
    alignItems: 'center',
  },
  progressBar: {
    width: '100%',
    height: 6,
    backgroundColor: '#E5E5E0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#1ABC9C',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 9,
    fontFamily: 'DMSans_500Medium',
    color: '#888888',
    marginTop: 3,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#000000',
    padding: 24,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  modalIconContainer: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#1ABC9C',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 3,
    borderColor: '#000000',
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
    overflow: 'hidden',
  },
  modalIconContainerLocked: {
    backgroundColor: '#E0E0E0',
  },
  modalAchievementIcon: {
    width: 56,
    height: 56,
    resizeMode: 'contain',
  },
  modalSecretIcon: {
    width: 40,
    height: 40,
    resizeMode: 'contain',
    tintColor: '#888888',
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: 'DMSans_900Black',
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 8,
  },
  modalTitleLocked: {
    color: '#888888',
  },
  categoryBadge: {
    backgroundColor: '#F5F2EB',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E5E0',
  },
  categoryBadgeText: {
    fontSize: 11,
    fontFamily: 'DMSans_900Black',
    color: '#888888',
    letterSpacing: 1,
  },
  modalDescription: {
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
    color: '#1ABC9C',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  modalDescriptionLocked: {
    color: '#888888',
  },
  xpRewardContainer: {
    backgroundColor: '#F5F2EB',
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 16,
    width: '100%',
    borderWidth: 2,
    borderColor: '#000000',
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  xpRewardLabel: {
    fontSize: 11,
    fontFamily: 'DMSans_900Black',
    color: '#888888',
    letterSpacing: 1,
    marginBottom: 4,
  },
  xpRewardValue: {
    fontSize: 24,
    fontFamily: 'DMSans_900Black',
    color: '#1ABC9C',
  },
  unlockedInfo: {
    alignItems: 'center',
    marginBottom: 16,
  },
  unlockedLabel: {
    fontSize: 11,
    fontFamily: 'DMSans_900Black',
    color: '#888888',
    letterSpacing: 1,
  },
  unlockedValue: {
    fontSize: 16,
    fontFamily: 'DMSans_700Bold',
    color: '#3BA978',
    marginTop: 4,
  },
  modalProgressContainer: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 16,
  },
  progressLabel: {
    fontSize: 11,
    fontFamily: 'DMSans_900Black',
    color: '#888888',
    letterSpacing: 1,
    marginBottom: 8,
  },
  modalProgressBar: {
    width: '100%',
    height: 12,
    backgroundColor: '#E5E5E0',
    borderRadius: 6,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#000000',
  },
  modalProgressFill: {
    height: '100%',
    backgroundColor: '#1ABC9C',
    borderRadius: 4,
  },
  modalProgressText: {
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
    color: '#1A1A1A',
    marginTop: 8,
  },
  closeButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#000000',
    paddingVertical: 14,
    paddingHorizontal: 32,
    width: '100%',
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  closeButtonText: {
    color: '#1A1A1A',
    fontSize: 14,
    fontFamily: 'DMSans_900Black',
  },
});
