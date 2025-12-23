import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
} from 'react-native';
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

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
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
                const isSecret = achievement.is_secret && !isUnlocked;

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
                      <View
                        style={[
                          styles.iconContainer,
                          !isUnlocked && styles.iconContainerLocked,
                        ]}
                      >
                        <Text style={[styles.icon, !isUnlocked && styles.iconLocked]}>
                          {isSecret ? '?' : achievement.icon}
                        </Text>
                      </View>

                      <Text
                        style={[styles.achievementName, !isUnlocked && styles.textLocked]}
                        numberOfLines={2}
                      >
                        {isSecret ? '???' : achievement.name}
                      </Text>

                      <Text
                        style={[styles.achievementDescription, !isUnlocked && styles.textLocked]}
                        numberOfLines={2}
                      >
                        {isSecret ? '???' : achievement.description}
                      </Text>

                      {isUnlocked && (
                        <View style={styles.unlockedBadge}>
                          <Text style={styles.unlockedCheck}>✓</Text>
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
                  const isSecret = selectedAchievement.is_secret && !isUnlocked;

                  return (
                    <>
                      <View
                        style={[
                          styles.modalIconContainer,
                          !isUnlocked && styles.modalIconContainerLocked,
                        ]}
                      >
                        <Text style={[styles.modalIcon, !isUnlocked && styles.iconLocked]}>
                          {isSecret ? '?' : selectedAchievement.icon}
                        </Text>
                      </View>

                      <Text style={styles.modalTitle}>
                        {isSecret ? '???' : selectedAchievement.name}
                      </Text>

                      <View style={styles.categoryBadge}>
                        <Text style={styles.categoryBadgeText}>
                          {selectedAchievement.category.toUpperCase()}
                        </Text>
                      </View>

                      <Text style={styles.modalDescription}>
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

                      {!isUnlocked && progress && (
                        <View style={styles.modalProgressContainer}>
                          <Text style={styles.progressLabel}>PROGRESS</Text>
                          <View style={styles.modalProgressBar}>
                            <View
                              style={[
                                styles.modalProgressFill,
                                {
                                  width: `${(progress.current / progress.target) * 100}%`,
                                },
                              ]}
                            />
                          </View>
                          <Text style={styles.modalProgressText}>
                            {progress.current} / {progress.target}
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
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
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
    fontSize: 14,
    fontFamily: 'DMSans_900Black',
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
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  achievementCardLocked: {
    backgroundColor: '#F0F0F0',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#1ABC9C',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    alignSelf: 'center',
  },
  iconContainerLocked: {
    backgroundColor: '#CCCCCC',
  },
  icon: {
    fontSize: 24,
  },
  iconLocked: {
    opacity: 0.5,
  },
  achievementName: {
    fontSize: 14,
    fontFamily: 'DMSans_900Black',
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 4,
  },
  achievementDescription: {
    fontSize: 12,
    fontFamily: 'DMSans_400Regular',
    color: '#888888',
    textAlign: 'center',
    minHeight: 32,
  },
  textLocked: {
    color: '#AAAAAA',
  },
  unlockedBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#3BA978',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#000000',
  },
  unlockedCheck: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: 'DMSans_900Black',
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
    width: 80,
    height: 80,
    borderRadius: 40,
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
  },
  modalIconContainerLocked: {
    backgroundColor: '#CCCCCC',
  },
  modalIcon: {
    fontSize: 40,
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: 'DMSans_900Black',
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 8,
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
    color: '#666666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
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
