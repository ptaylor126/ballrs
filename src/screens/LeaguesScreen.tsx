import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Image,
  Platform,
  Animated,
  Easing,
  LayoutChangeEvent,
} from 'react-native';

const ACCENT_COLOR = '#1ABC9C';

// Icons
const leaguesIcon = require('../../assets/images/icon-leagues.png');
import { useAuth } from '../contexts/AuthContext';
import { colors, shadows, getSportColor, borders, borderRadius, typography, spacing } from '../lib/theme';
import { AnimatedButton, AnimatedCard } from '../components/AnimatedComponents';
import {
  getUserLeagues,
  leaveLeague,
  deleteLeague,
  LeagueWithMemberCount,
  getLeagueCountdown,
  getLeagueStatus,
} from '../lib/leaguesService';
import { supabase } from '../lib/supabase';

interface Props {
  onBack?: () => void;
  onCreateLeague: () => void;
  onJoinLeague: () => void;
  onViewLeague: (league: LeagueWithMemberCount) => void;
}

type TabType = 'leagues' | 'global';

interface LeaderboardEntry {
  id: string;
  username: string;
  total_solved: number;
  nba_best_streak: number;
  pl_best_streak: number;
  nfl_best_streak: number;
  rank: number;
}

const getSportLabel = (sport: string) => {
  switch (sport) {
    case 'nba': return 'NBA';
    case 'pl': return 'Premier League';
    case 'nfl': return 'NFL';
    default: return 'All Sports';
  }
};

const getStatusColor = (status: 'pending' | 'active' | 'completed') => {
  switch (status) {
    case 'pending': return colors.warning;
    case 'active': return colors.success;
    case 'completed': return colors.textTertiary;
  }
};

const getStatusLabel = (status: 'pending' | 'active' | 'completed') => {
  switch (status) {
    case 'pending': return 'Starting Soon';
    case 'active': return 'Active';
    case 'completed': return 'Completed';
  }
};

const getStatusSortOrder = (status: 'pending' | 'active' | 'completed') => {
  switch (status) {
    case 'active': return 0;
    case 'pending': return 1;
    case 'completed': return 2;
  }
};

export default function LeaguesScreen({
  onBack,
  onCreateLeague,
  onJoinLeague,
  onViewLeague,
}: Props) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('leagues');
  const [leagues, setLeagues] = useState<LeagueWithMemberCount[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Animated tab indicator
  const tabIndicatorAnim = useRef(new Animated.Value(0)).current;
  const [tabWidth, setTabWidth] = useState(0);

  const loadLeagues = useCallback(async () => {
    if (!user) return;
    const userLeagues = await getUserLeagues(user.id);
    const sortedLeagues = userLeagues.sort((a, b) => {
      const statusA = getLeagueStatus(a);
      const statusB = getLeagueStatus(b);
      const orderDiff = getStatusSortOrder(statusA) - getStatusSortOrder(statusB);
      if (orderDiff !== 0) return orderDiff;
      return a.name.localeCompare(b.name);
    });
    setLeagues(sortedLeagues);
  }, [user]);

  const loadLeaderboard = useCallback(async () => {
    const { data, error } = await supabase
      .from('leaderboard')
      .select('*')
      .limit(50);

    if (error) {
      console.error('Error fetching leaderboard:', error);
      return;
    }

    setLeaderboard(data || []);
  }, []);

  const loadData = useCallback(async () => {
    if (activeTab === 'leagues') {
      await loadLeagues();
    } else {
      await loadLeaderboard();
    }
  }, [activeTab, loadLeagues, loadLeaderboard]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await loadData();
      setLoading(false);
    };
    load();
  }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const handleLeaveLeague = async (league: LeagueWithMemberCount) => {
    if (!user) return;

    const message = league.is_creator
      ? 'As the creator, leaving will delete this league for everyone. Are you sure?'
      : `Are you sure you want to leave "${league.name}"?`;

    const title = league.is_creator ? 'Delete League' : 'Leave League';

    // Handle web platform
    if (Platform.OS === 'web') {
      const confirmed = window.confirm(`${title}\n\n${message}`);
      if (confirmed) {
        let success: boolean;
        if (league.is_creator) {
          success = await deleteLeague(league.id);
        } else {
          success = await leaveLeague(league.id, user.id);
        }

        if (success) {
          await loadLeagues();
        } else {
          window.alert('Failed to leave league. Please try again.');
        }
      }
      return;
    }

    // Handle mobile platforms
    Alert.alert(
      title,
      message,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: league.is_creator ? 'Delete' : 'Leave',
          style: 'destructive',
          onPress: async () => {
            let success: boolean;
            if (league.is_creator) {
              success = await deleteLeague(league.id);
            } else {
              success = await leaveLeague(league.id, user.id);
            }

            if (success) {
              await loadLeagues();
            } else {
              Alert.alert('Error', 'Failed to leave league. Please try again.');
            }
          },
        },
      ]
    );
  };

  const getRankStyle = (rank: number) => {
    if (rank === 1) return { color: '#B45309' };
    if (rank === 2) return { color: '#6B7280' };
    if (rank === 3) return { color: '#92400E' };
    return { color: colors.textSecondary };
  };

  const getBestStreak = (entry: LeaderboardEntry) => {
    return Math.max(entry.nba_best_streak || 0, entry.pl_best_streak || 0, entry.nfl_best_streak || 0);
  };

  const renderLeagueItem = ({ item }: { item: LeagueWithMemberCount }) => {
    const sportColor = getSportColor(item.sport as 'nba' | 'pl' | 'nfl');
    const status = getLeagueStatus(item);
    const statusColor = getStatusColor(status);
    const countdown = getLeagueCountdown(item);
    const isCompleted = status === 'completed';

    return (
      <TouchableOpacity
        style={[
          styles.leagueCard,
          isCompleted && styles.completedCard,
        ]}
        onPress={() => onViewLeague(item)}
      >
        <View style={styles.leagueHeader}>
          <View style={[styles.sportBadge, { backgroundColor: sportColor }]}>
            <Text style={styles.sportBadgeText}>{item.sport.toUpperCase()}</Text>
          </View>
          <View style={styles.leagueInfo}>
            <Text style={[styles.leagueName, isCompleted && styles.completedText]}>
              {item.name}
            </Text>
            <Text style={[styles.leagueSport, { color: sportColor }]}>
              {getSportLabel(item.sport)}
            </Text>
          </View>
          <View style={styles.badgeContainer}>
            {item.is_creator && (
              <View style={styles.creatorBadge}>
                <Text style={styles.creatorBadgeText}>Creator</Text>
              </View>
            )}
            <View style={[styles.statusBadge, { backgroundColor: `${statusColor}15`, borderColor: statusColor }]}>
              <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
              <Text style={[styles.statusBadgeText, { color: statusColor }]}>
                {getStatusLabel(status)}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.countdownRow}>
          <Text style={[styles.countdownText, { color: statusColor }]}>
            {countdown.text}
          </Text>
        </View>

        <View style={styles.leagueFooter}>
          <Text style={styles.memberCount}>
            {item.member_count}/50 members
          </Text>
          {!isCompleted && (
            <TouchableOpacity
              style={styles.leaveButton}
              onPress={() => handleLeaveLeague(item)}
            >
              <Text style={styles.leaveButtonText}>
                {item.is_creator ? 'Delete' : 'Leave'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderLeaderboardItem = ({ item }: { item: LeaderboardEntry }) => {
    const isCurrentUser = user?.id === item.id;

    return (
      <View style={[styles.leaderboardRow, isCurrentUser && styles.highlightedRow]}>
        <View style={styles.rankContainer}>
          <Text style={[styles.rank, getRankStyle(item.rank)]}>
            {item.rank}
          </Text>
        </View>
        <View style={styles.userAvatar}>
          <Text style={styles.userAvatarText}>
            {item.username.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.userInfo}>
          <Text style={[styles.username, isCurrentUser && styles.highlightedText]}>
            {item.username}
            {isCurrentUser && ' (You)'}
          </Text>
        </View>
        <View style={styles.statsContainer}>
          <Text style={styles.statValue}>{item.total_solved}</Text>
          <Text style={styles.statLabel}>solved</Text>
        </View>
        <View style={styles.statsContainer}>
          <Text style={styles.statValue}>{getBestStreak(item)}</Text>
          <Text style={styles.statLabel}>streak</Text>
        </View>
      </View>
    );
  };

  const renderLeaderboardHeader = () => (
    <View style={styles.leaderboardHeaderRow}>
      <View style={styles.rankContainer}>
        <Text style={styles.leaderboardHeaderText}>#</Text>
      </View>
      <View style={styles.userInfo}>
        <Text style={styles.leaderboardHeaderText}>Player</Text>
      </View>
      <View style={styles.statsContainer}>
        <Text style={styles.leaderboardHeaderText}>Total</Text>
      </View>
      <View style={styles.statsContainer}>
        <Text style={styles.leaderboardHeaderText}>Best</Text>
      </View>
    </View>
  );

  const renderMyLeaguesContent = () => (
    <>
      <View style={styles.actions}>
        <AnimatedButton
          style={[styles.actionButton, styles.createButton]}
          onPress={onCreateLeague}
        >
          <Text style={styles.actionButtonText}>Create League</Text>
        </AnimatedButton>
        <AnimatedButton
          style={[styles.actionButton, styles.joinLeagueButton]}
          onPress={onJoinLeague}
        >
          <Text style={styles.joinLeagueButtonText}>Join League</Text>
        </AnimatedButton>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={leagues}
          renderItem={renderLeagueItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Image source={leaguesIcon} style={styles.emptyIcon} />
              <Text style={styles.emptyText}>No leagues yet</Text>
              <Text style={styles.emptySubtext}>
                Create a league or join one with an invite code
              </Text>
            </View>
          }
        />
      )}
    </>
  );

  const renderGlobalContent = () => (
    <>
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <>
          {renderLeaderboardHeader()}
          <FlatList
            data={leaderboard}
            renderItem={renderLeaderboardItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.leaderboardListContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={colors.primary}
              />
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Image source={leaguesIcon} style={styles.emptyIcon} />
                <Text style={styles.emptyText}>No players yet</Text>
                <Text style={styles.emptySubtext}>
                  Be the first to solve a puzzle!
                </Text>
              </View>
            }
          />
        </>
      )}
    </>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        {onBack && (
          <TouchableOpacity style={styles.backButton} onPress={onBack}>
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>
        )}
        <Text style={styles.title}>Leagues</Text>
        <Text style={styles.subtitle}>Compete with friends</Text>
      </View>

      {/* Tabs */}
      <View
        style={styles.tabContainer}
        onLayout={(e: LayoutChangeEvent) => setTabWidth(e.nativeEvent.layout.width / 2)}
      >
        <Animated.View
          style={[
            styles.tabIndicator,
            {
              width: tabWidth || '50%',
              transform: [{
                translateX: tabIndicatorAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, tabWidth || 0],
                }),
              }],
            },
          ]}
        />
        <TouchableOpacity
          style={styles.tab}
          onPress={() => {
            Animated.timing(tabIndicatorAnim, {
              toValue: 0,
              duration: 200,
              easing: Easing.out(Easing.ease),
              useNativeDriver: true,
            }).start();
            setActiveTab('leagues');
          }}
        >
          <Text style={[styles.tabText, activeTab === 'leagues' && styles.activeTabText]}>
            My Leagues
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.tab}
          onPress={() => {
            Animated.timing(tabIndicatorAnim, {
              toValue: 1,
              duration: 200,
              easing: Easing.out(Easing.ease),
              useNativeDriver: true,
            }).start();
            setActiveTab('global');
          }}
        >
          <Text style={[styles.tabText, activeTab === 'global' && styles.activeTabText]}>
            Global
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'leagues' ? renderMyLeaguesContent() : renderGlobalContent()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    padding: spacing.md,
    paddingBottom: spacing.sm,
  },
  backButton: {
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
  },
  backButtonText: {
    color: colors.textSecondary,
    fontSize: 16,
    fontFamily: 'DMSans_600SemiBold',
  },
  title: {
    ...typography.header,
    fontSize: 32,
    color: colors.text,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    marginVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#000000',
    padding: 4,
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
    position: 'relative',
  },
  tabIndicator: {
    position: 'absolute',
    top: 4,
    left: 4,
    bottom: 4,
    backgroundColor: ACCENT_COLOR,
    borderRadius: 12,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 12,
    zIndex: 1,
  },
  tabText: {
    fontSize: 14,
    fontFamily: 'DMSans_900Black',
    color: '#1A1A1A',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  activeTabText: {
    color: '#FFFFFF',
  },
  actions: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#000000',
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  createButton: {
    backgroundColor: ACCENT_COLOR,
  },
  joinLeagueButton: {
    backgroundColor: '#FFFFFF',
  },
  actionButtonText: {
    fontSize: 14,
    fontFamily: 'DMSans_900Black',
    color: '#FFFFFF',
    textTransform: 'uppercase',
  },
  joinLeagueButtonText: {
    fontSize: 14,
    fontFamily: 'DMSans_900Black',
    color: ACCENT_COLOR,
    textTransform: 'uppercase',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: spacing.lg,
    paddingTop: spacing.sm,
  },
  leagueCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#000000',
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  leagueHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  sportBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#000000',
    marginRight: 12,
  },
  sportBadgeText: {
    fontSize: 11,
    fontFamily: 'DMSans_900Black',
    color: '#FFFFFF',
  },
  leagueInfo: {
    flex: 1,
  },
  leagueName: {
    ...typography.h3,
    color: colors.text,
  },
  leagueSport: {
    ...typography.bodySmall,
    marginTop: 2,
  },
  badgeContainer: {
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  creatorBadge: {
    backgroundColor: colors.pl,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  creatorBadgeText: {
    ...typography.button,
    fontSize: 10,
    color: '#FFFFFF',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    gap: spacing.xs,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusBadgeText: {
    fontSize: 10,
    fontFamily: 'DMSans_600SemiBold',
  },
  countdownRow: {
    paddingBottom: spacing.sm,
  },
  countdownText: {
    ...typography.bodySmall,
    fontFamily: 'DMSans_600SemiBold',
  },
  completedCard: {
    opacity: 0.7,
  },
  completedText: {
    color: colors.textSecondary,
  },
  leagueFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    paddingTop: spacing.sm,
  },
  memberCount: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  leaveButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    borderWidth: borders.button,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  leaveButtonText: {
    ...typography.button,
    color: colors.textSecondary,
    fontSize: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 32,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#000000',
    marginHorizontal: spacing.lg,
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  emptyIcon: {
    width: 48,
    height: 48,
    tintColor: '#CCCCCC',
    marginBottom: 16,
  },
  emptyText: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  emptySubtext: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  // Leaderboard styles
  leaderboardHeaderRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    marginHorizontal: spacing.lg,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderWidth: 2,
    borderColor: '#000000',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E0',
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  leaderboardHeaderText: {
    fontSize: 12,
    fontFamily: 'DMSans_600SemiBold',
    color: '#888888',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  leaderboardListContent: {
    paddingBottom: spacing.lg,
  },
  leaderboardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E0',
    backgroundColor: '#FFFFFF',
    marginHorizontal: spacing.lg,
    borderLeftWidth: 2,
    borderRightWidth: 2,
    borderLeftColor: '#000000',
    borderRightColor: '#000000',
  },
  highlightedRow: {
    backgroundColor: '#F5F2EB',
  },
  rankContainer: {
    width: 36,
  },
  rank: {
    fontSize: 16,
    fontFamily: 'DMSans_900Black',
  },
  userAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: ACCENT_COLOR,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  userAvatarText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontFamily: 'DMSans_700Bold',
  },
  userInfo: {
    flex: 1,
  },
  username: {
    ...typography.body,
    color: colors.text,
  },
  highlightedText: {
    color: ACCENT_COLOR,
    fontFamily: 'DMSans_700Bold',
  },
  statsContainer: {
    width: 55,
    alignItems: 'center',
  },
  statValue: {
    ...typography.statSmall,
    fontSize: 16,
    color: colors.text,
  },
  statLabel: {
    ...typography.label,
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: 2,
  },
});
