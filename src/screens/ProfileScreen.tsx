import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
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
import {
  getFriends,
  addFriend,
  removeFriend,
  searchUsersByUsername,
  FriendWithProfile,
  UserProfile,
  areFriends,
} from '../lib/friendsService';
import { getProfile } from '../lib/profilesService';

// Get level title based on level number
function getLevelTitle(level: number): string {
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
}

export default function ProfileScreen({ onBack, onLogout, onNavigateToAchievements, onNavigateToCustomize }: Props) {
  const { user, signOut } = useAuth();
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
  const [username, setUsername] = useState<string | null>(null);

  const [friends, setFriends] = useState<FriendWithProfile[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [searching, setSearching] = useState(false);
  const [addingFriend, setAddingFriend] = useState<string | null>(null);

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
    setUsername(profile?.username || null);

    setLoadingStats(false);
  }, [user]);

  useEffect(() => {
    loadProfileData();
  }, [loadProfileData]);

  const loadFriends = useCallback(async () => {
    if (user) {
      setLoadingFriends(true);
      const friendsList = await getFriends(user.id);
      setFriends(friendsList);
      setLoadingFriends(false);
    }
  }, [user]);

  useEffect(() => {
    loadFriends();
  }, [loadFriends]);

  useEffect(() => {
    const searchUsers = async () => {
      if (!user || searchQuery.trim().length < 2) {
        setSearchResults([]);
        return;
      }

      setSearching(true);
      const results = await searchUsersByUsername(searchQuery, user.id);
      setSearchResults(results);
      setSearching(false);
    };

    const debounce = setTimeout(searchUsers, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery, user]);

  const handleAddFriend = async (userToAdd: UserProfile) => {
    if (!user) return;

    setAddingFriend(userToAdd.id);

    const alreadyFriends = await areFriends(user.id, userToAdd.id);
    if (alreadyFriends) {
      Alert.alert('Already Friends', `You're already friends with ${userToAdd.username}`);
      setAddingFriend(null);
      return;
    }

    const success = await addFriend(user.id, userToAdd.id);
    if (success) {
      setSearchQuery('');
      setSearchResults([]);
      await loadFriends();
      Alert.alert('Friend Added', `${userToAdd.username} has been added as a friend!`);
    } else {
      Alert.alert('Error', 'Failed to add friend. Please try again.');
    }
    setAddingFriend(null);
  };

  const handleRemoveFriend = async (friend: FriendWithProfile) => {
    if (!user) return;

    Alert.alert(
      'Remove Friend',
      `Are you sure you want to remove ${friend.username} as a friend?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            const success = await removeFriend(user.id, friend.friendUserId);
            if (success) {
              await loadFriends();
            } else {
              Alert.alert('Error', 'Failed to remove friend. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    await signOut();
    onLogout();
  };

  const progress = getXPProgressInLevel(xp);
  const nextLevelXP = getXPForLevel(level + 1);
  const currentLevelXP = getXPForLevel(level);
  const xpIntoLevel = xp - currentLevelXP;
  const xpNeededForNext = nextLevelXP - currentLevelXP;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {onBack && (
          <TouchableOpacity style={styles.backButton} onPress={onBack}>
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>
        )}

        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
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

            {/* Username */}
            <Text style={styles.username}>
              {username || 'Player'}
            </Text>

            {/* Level Badge */}
            <Text style={styles.levelBadgeText2}>
              Level {level} • {getLevelTitle(level)}
            </Text>

            <AnimatedButton
              style={styles.customizeButton}
              onPress={onNavigateToCustomize}
            >
              <Text style={styles.customizeButtonText}>Customize</Text>
            </AnimatedButton>

            <View style={[styles.infoCard, shadows.card]}>
              <Text style={styles.label}>Email</Text>
              <Text style={styles.value}>{user?.email || 'Not available'}</Text>
            </View>

            <View style={[styles.infoCard, shadows.card]}>
              <Text style={styles.label}>Account Created</Text>
              <Text style={styles.value}>
                {user?.created_at
                  ? new Date(user.created_at).toLocaleDateString()
                  : 'Not available'}
              </Text>
            </View>

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
              onPress={onNavigateToAchievements}
            >
              <View style={styles.achievementsIconCircle}>
                <Text style={styles.achievementsIcon}>A</Text>
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
              <>
                {/* NBA Stats */}
                <View style={[styles.statsCard, shadows.card]}>
                  <View style={[styles.sportBadge, { backgroundColor: getSportColor('nba') }]}>
                    <Text style={styles.sportBadgeText}>NBA</Text>
                  </View>
                  <View style={styles.statsRow}>
                    <View style={styles.statItem}>
                      <Text style={styles.statValue}>{stats?.nba_total_solved ?? 0}</Text>
                      <Text style={styles.statLabel}>Solved</Text>
                    </View>
                    <View style={styles.statItem}>
                      <Text style={styles.statValue}>{stats?.nba_current_streak ?? 0}</Text>
                      <Text style={styles.statLabel}>Current</Text>
                    </View>
                    <View style={styles.statItem}>
                      <Text style={styles.statValue}>{stats?.nba_best_streak ?? 0}</Text>
                      <Text style={styles.statLabel}>Best</Text>
                    </View>
                  </View>
                </View>

                {/* Premier League Stats */}
                <View style={[styles.statsCard, shadows.card]}>
                  <View style={[styles.sportBadge, { backgroundColor: getSportColor('pl') }]}>
                    <Text style={styles.sportBadgeText}>PL</Text>
                  </View>
                  <View style={styles.statsRow}>
                    <View style={styles.statItem}>
                      <Text style={styles.statValue}>{stats?.pl_total_solved ?? 0}</Text>
                      <Text style={styles.statLabel}>Solved</Text>
                    </View>
                    <View style={styles.statItem}>
                      <Text style={styles.statValue}>{stats?.pl_current_streak ?? 0}</Text>
                      <Text style={styles.statLabel}>Current</Text>
                    </View>
                    <View style={styles.statItem}>
                      <Text style={styles.statValue}>{stats?.pl_best_streak ?? 0}</Text>
                      <Text style={styles.statLabel}>Best</Text>
                    </View>
                  </View>
                </View>

                {/* NFL Stats */}
                <View style={[styles.statsCard, shadows.card]}>
                  <View style={[styles.sportBadge, { backgroundColor: getSportColor('nfl') }]}>
                    <Text style={styles.sportBadgeText}>NFL</Text>
                  </View>
                  <View style={styles.statsRow}>
                    <View style={styles.statItem}>
                      <Text style={styles.statValue}>{stats?.nfl_total_solved ?? 0}</Text>
                      <Text style={styles.statLabel}>Solved</Text>
                    </View>
                    <View style={styles.statItem}>
                      <Text style={styles.statValue}>{stats?.nfl_current_streak ?? 0}</Text>
                      <Text style={styles.statLabel}>Current</Text>
                    </View>
                    <View style={styles.statItem}>
                      <Text style={styles.statValue}>{stats?.nfl_best_streak ?? 0}</Text>
                      <Text style={styles.statLabel}>Best</Text>
                    </View>
                  </View>
                </View>

                {/* MLB Stats */}
                <View style={[styles.statsCard, shadows.card]}>
                  <View style={[styles.sportBadge, { backgroundColor: getSportColor('mlb') }]}>
                    <Text style={styles.sportBadgeText}>MLB</Text>
                  </View>
                  <View style={styles.statsRow}>
                    <View style={styles.statItem}>
                      <Text style={styles.statValue}>{stats?.mlb_total_solved ?? 0}</Text>
                      <Text style={styles.statLabel}>Solved</Text>
                    </View>
                    <View style={styles.statItem}>
                      <Text style={styles.statValue}>{stats?.mlb_current_streak ?? 0}</Text>
                      <Text style={styles.statLabel}>Current</Text>
                    </View>
                    <View style={styles.statItem}>
                      <Text style={styles.statValue}>{stats?.mlb_best_streak ?? 0}</Text>
                      <Text style={styles.statLabel}>Best</Text>
                    </View>
                  </View>
                </View>
              </>
            )}

            {/* Friends Section */}
            <Text style={styles.sectionTitle}>Friends</Text>

            <View style={styles.searchContainer}>
              <TextInput
                style={styles.searchInput}
                placeholder="Search by username..."
                placeholderTextColor={colors.textTertiary}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {searching && (
                <ActivityIndicator
                  size="small"
                  color={colors.primary}
                  style={styles.searchSpinner}
                />
              )}
            </View>

            {searchResults.length > 0 && (
              <View style={[styles.searchResults, shadows.card]}>
                {searchResults.map((result) => (
                  <View key={result.id} style={styles.searchResultItem}>
                    <View style={styles.resultAvatar}>
                      <Text style={styles.resultAvatarText}>
                        {result.username.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <Text style={styles.resultUsername}>{result.username}</Text>
                    <TouchableOpacity
                      style={styles.addButton}
                      onPress={() => handleAddFriend(result)}
                      disabled={addingFriend === result.id}
                    >
                      {addingFriend === result.id ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Text style={styles.addButtonText}>Add</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            {loadingFriends ? (
              <ActivityIndicator color={colors.primary} style={styles.friendsLoader} />
            ) : friends.length === 0 ? (
              <View style={[styles.noFriendsContainer, shadows.card]}>
                <Text style={styles.noFriendsText}>No friends yet</Text>
                <Text style={styles.noFriendsSubtext}>
                  Search for users above to add friends
                </Text>
              </View>
            ) : (
              <View style={styles.friendsList}>
                {friends.map((friend) => (
                  <View key={friend.id} style={[styles.friendItem, shadows.card]}>
                    <View style={styles.friendAvatar}>
                      <Text style={styles.friendAvatarText}>
                        {friend.username.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <Text style={styles.friendUsername}>{friend.username}</Text>
                    <TouchableOpacity
                      style={styles.removeButton}
                      onPress={() => handleRemoveFriend(friend)}
                    >
                      <Text style={styles.removeButtonText}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            {/* Log Out Button */}
            <AnimatedButton
              style={[styles.logoutButton, loggingOut && styles.buttonDisabled]}
              onPress={handleLogout}
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
    padding: spacing.lg,
  },
  scrollView: {
    flex: 1,
  },
  backButton: {
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  backButtonText: {
    color: colors.textSecondary,
    fontSize: 16,
    fontFamily: 'DMSans_600SemiBold',
  },
  profileSection: {
    alignItems: 'center',
    paddingBottom: spacing.lg,
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
  levelBadgeText2: {
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
    color: '#666666',
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  customizeButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.button,
    backgroundColor: colors.surface,
    borderWidth: borders.button,
    borderColor: colors.border,
    marginBottom: spacing.md,
    ...shadows.cardSmall,
  },
  customizeButtonText: {
    ...typography.button,
    color: colors.text,
  },
  title: {
    ...typography.header,
    color: colors.text,
    marginBottom: spacing.lg,
  },
  infoCard: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.card,
    borderWidth: borders.card,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  label: {
    ...typography.label,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  value: {
    ...typography.body,
    color: colors.text,
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
  statsCard: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.card,
    borderWidth: borders.card,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.sm,
  },
  sportBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  sportBadgeText: {
    ...typography.button,
    color: '#FFFFFF',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    ...typography.stat,
    color: colors.text,
  },
  statLabel: {
    ...typography.label,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  logoutButton: {
    width: '100%',
    backgroundColor: colors.error,
    borderRadius: borderRadius.button,
    borderWidth: borders.button,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.xl,
    marginBottom: spacing.lg,
    ...shadows.cardSmall,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  logoutButtonText: {
    ...typography.button,
    color: '#FFFFFF',
    fontSize: 16,
  },
  searchContainer: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  searchInput: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.card,
    borderWidth: borders.input,
    borderColor: colors.border,
    padding: spacing.md,
    ...typography.body,
    color: colors.text,
  },
  searchSpinner: {
    position: 'absolute',
    right: spacing.md,
  },
  searchResults: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.card,
    borderWidth: borders.card,
    borderColor: colors.border,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  resultAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.pl,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  resultAvatarText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'DMSans_700Bold',
  },
  resultUsername: {
    flex: 1,
    ...typography.body,
    color: colors.text,
  },
  addButton: {
    backgroundColor: colors.success,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
    borderWidth: borders.button,
    borderColor: colors.border,
    minWidth: 60,
    alignItems: 'center',
  },
  addButtonText: {
    ...typography.button,
    color: '#FFFFFF',
    fontSize: 14,
  },
  friendsLoader: {
    marginTop: spacing.lg,
    marginBottom: spacing.lg,
  },
  noFriendsContainer: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.card,
    borderWidth: borders.card,
    borderColor: colors.border,
    padding: spacing.lg,
    alignItems: 'center',
  },
  noFriendsText: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  noFriendsSubtext: {
    ...typography.bodySmall,
    color: colors.textTertiary,
  },
  friendsList: {
    width: '100%',
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.card,
    borderWidth: borders.card,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  friendAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.success,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  friendAvatarText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontFamily: 'DMSans_700Bold',
  },
  friendUsername: {
    flex: 1,
    ...typography.body,
    color: colors.text,
  },
  removeButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    borderWidth: borders.button,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  removeButtonText: {
    ...typography.button,
    color: colors.textSecondary,
    fontSize: 12,
  },
  achievementsButton: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.card,
    borderWidth: borders.card,
    borderColor: colors.border,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  achievementsIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.warning,
    borderWidth: borders.button,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  achievementsIcon: {
    fontSize: 20,
    fontFamily: 'DMSans_900Black',
    color: '#FFFFFF',
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
    color: colors.textSecondary,
    marginTop: 2,
  },
  achievementsButtonArrow: {
    fontSize: 20,
    color: colors.textTertiary,
    fontFamily: 'DMSans_700Bold',
  },
});
