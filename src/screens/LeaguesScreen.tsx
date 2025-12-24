import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
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
import { SafeAreaView } from 'react-native-safe-area-context';

const ACCENT_COLOR = '#1ABC9C';

// Icons
const leaguesIcon = require('../../assets/images/icon-leagues.png');
const fireIcon = require('../../assets/images/icon-fire.png');
const trophyIcon = require('../../assets/images/icon-trophy.png');
const goldIcon = require('../../assets/images/icon-gold.png');
const silverIcon = require('../../assets/images/icon-silver.png');
const bronzeIcon = require('../../assets/images/icon-bronze.png');

// Sport icons
const sportIcons: Record<string, any> = {
  nba: require('../../assets/images/icon-basketball.png'),
  pl: require('../../assets/images/icon-soccer.png'),
  nfl: require('../../assets/images/icon-football.png'),
  mlb: require('../../assets/images/icon-baseball.png'),
};

type SportFilter = 'all' | 'nba' | 'pl' | 'nfl' | 'mlb';
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
  nba_total_solved: number;
  pl_total_solved: number;
  nfl_total_solved: number;
  mlb_total_solved: number;
  nba_best_streak: number;
  pl_best_streak: number;
  nfl_best_streak: number;
  mlb_best_streak: number;
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
  const [sportFilter, setSportFilter] = useState<SportFilter>('all');
  const [leagues, setLeagues] = useState<LeagueWithMemberCount[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
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
    // Fetch leaderboard data using RPC function (bypasses RLS)
    const { data, error } = await supabase
      .rpc('get_global_leaderboard', { limit_count: 50 });

    if (error) {
      console.error('Error fetching leaderboard:', error);
      return;
    }

    // Add rank to each entry based on sorted order
    const rankedData = (data || []).map((entry: LeaderboardEntry, index: number) => ({
      ...entry,
      rank: index + 1,
    }));

    setLeaderboard(rankedData);

    // Fetch total user count using RPC function
    const { data: countData, error: countError } = await supabase
      .rpc('get_total_users');

    if (!countError && countData !== null) {
      setTotalUsers(countData);
    }
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

  const getSolvedCountForEntry = (entry: LeaderboardEntry, filter: SportFilter) => {
    switch (filter) {
      case 'nba': return entry.nba_total_solved || 0;
      case 'pl': return entry.pl_total_solved || 0;
      case 'nfl': return entry.nfl_total_solved || 0;
      case 'mlb': return entry.mlb_total_solved || 0;
      default: return entry.total_solved || 0;
    }
  };

  const getSolvedCount = (entry: LeaderboardEntry) => {
    return getSolvedCountForEntry(entry, sportFilter);
  };

  const getBestStreakForEntry = (entry: LeaderboardEntry, filter: SportFilter) => {
    switch (filter) {
      case 'nba': return entry.nba_best_streak || 0;
      case 'pl': return entry.pl_best_streak || 0;
      case 'nfl': return entry.nfl_best_streak || 0;
      case 'mlb': return entry.mlb_best_streak || 0;
      default: return Math.max(
        entry.nba_best_streak || 0,
        entry.pl_best_streak || 0,
        entry.nfl_best_streak || 0,
        entry.mlb_best_streak || 0
      );
    }
  };

  const getBestStreak = (entry: LeaderboardEntry) => {
    return getBestStreakForEntry(entry, sportFilter);
  };

  // Sort and rank leaderboard based on current sport filter
  const sortedLeaderboard = [...leaderboard]
    .sort((a, b) => {
      const aCount = getSolvedCountForEntry(a, sportFilter);
      const bCount = getSolvedCountForEntry(b, sportFilter);
      if (bCount !== aCount) return bCount - aCount;
      // Tie-breaker: best streak
      const aStreak = getBestStreakForEntry(a, sportFilter);
      const bStreak = getBestStreakForEntry(b, sportFilter);
      return bStreak - aStreak;
    })
    .map((entry, index) => ({ ...entry, rank: index + 1 }));

  const getRankMedal = (rank: number) => {
    if (rank === 1) return { icon: goldIcon };
    if (rank === 2) return { icon: silverIcon };
    if (rank === 3) return { icon: bronzeIcon };
    return null;
  };

  const renderLeagueItem = ({ item }: { item: LeagueWithMemberCount }) => {
    const sportColor = getSportColor(item.sport as 'nba' | 'pl' | 'nfl');
    const status = getLeagueStatus(item);
    const countdown = getLeagueCountdown(item);
    const isCompleted = status === 'completed';
    const isPending = status === 'pending';

    return (
      <TouchableOpacity
        style={[
          styles.leagueCard,
          isCompleted && styles.completedCard,
        ]}
        onPress={() => onViewLeague(item)}
      >
        {/* Top row: Sport icon + League name + Creator badge */}
        <View style={styles.leagueTopRow}>
          <Image
            source={sportIcons[item.sport]}
            style={styles.sportIcon}
            resizeMode="contain"
          />
          <Text style={[styles.leagueName, isCompleted && styles.completedText]} numberOfLines={1}>
            {item.name}
          </Text>
          {item.is_creator && (
            <View style={styles.creatorBadge}>
              <Text style={styles.creatorBadgeText}>CREATOR</Text>
            </View>
          )}
        </View>

        {/* Second row: Sport name */}
        <Text style={styles.leagueSportText}>
          {getSportLabel(item.sport)}
        </Text>

        {/* Third row: Status badge + countdown */}
        <View style={styles.statusRow}>
          <View style={[
            styles.statusBadge,
            isPending && styles.statusBadgePending,
            status === 'active' && styles.statusBadgeActive,
            isCompleted && styles.statusBadgeCompleted,
          ]}>
            <Text style={[
              styles.statusBadgeText,
              isPending && styles.statusBadgeTextPending,
              status === 'active' && styles.statusBadgeTextActive,
              isCompleted && styles.statusBadgeTextCompleted,
            ]}>
              {getStatusLabel(status)}
            </Text>
          </View>
          <Text style={styles.countdownText}>
            {countdown.text}
          </Text>
        </View>

        {/* Bottom row: Member count + Delete */}
        <View style={styles.leagueFooter}>
          <Text style={styles.memberCount}>
            {item.member_count}/50 members
          </Text>
          {!isCompleted && (
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={(e) => {
                e.stopPropagation();
                handleLeaveLeague(item);
              }}
            >
              <Text style={styles.deleteButtonText}>
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
    const medal = getRankMedal(item.rank);

    return (
      <View style={[styles.leaderboardRow, isCurrentUser && styles.currentUserRow]}>
        <View style={styles.rankContainer}>
          {medal ? (
            <Image source={medal.icon} style={styles.medalIcon} />
          ) : (
            <Text style={styles.rank}>
              {item.rank}
            </Text>
          )}
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
        <View style={styles.statValueContainer}>
          <Text style={styles.statValueOnly}>{getSolvedCount(item)}</Text>
        </View>
        <View style={styles.statValueContainer}>
          <Text style={styles.statValueOnly}>{getBestStreak(item)}</Text>
        </View>
      </View>
    );
  };

  const renderSportFilterTabs = () => (
    <View style={styles.sportFilterContainer}>
      {(['all', 'nba', 'pl', 'nfl', 'mlb'] as SportFilter[]).map((filter) => (
        <TouchableOpacity
          key={filter}
          style={[
            styles.sportFilterTab,
            sportFilter === filter && styles.sportFilterTabActive,
          ]}
          onPress={() => setSportFilter(filter)}
        >
          <Text
            style={[
              styles.sportFilterText,
              sportFilter === filter && styles.sportFilterTextActive,
            ]}
          >
            {filter === 'all' ? 'ALL' : filter === 'pl' ? 'EPL' : filter.toUpperCase()}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderLeaderboardHeader = () => (
    <View style={styles.leaderboardHeaderRow}>
      <View style={styles.rankContainer}>
        <Text style={styles.leaderboardHeaderText}>#</Text>
      </View>
      <View style={styles.playerHeaderContainer}>
        <Text style={styles.leaderboardHeaderText}>PLAYER</Text>
      </View>
      <View style={styles.headerIconContainer}>
        <Image source={trophyIcon} style={styles.headerIconTrophy} />
      </View>
      <View style={styles.headerIconContainer}>
        <Image source={fireIcon} style={styles.headerIconFire} />
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
      {renderSportFilterTabs()}
      {/* Total Users Count */}
      {totalUsers > 0 && (
        <View style={styles.totalUsersContainer}>
          <Text style={styles.totalUsersText}>
            {totalUsers} {totalUsers === 1 ? 'player' : 'players'} worldwide
          </Text>
        </View>
      )}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <>
          {renderLeaderboardHeader()}
          <FlatList
            data={sortedLeaderboard}
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
                <Text style={styles.emptyText}>No rankings yet</Text>
                <Text style={styles.emptySubtext}>
                  Be the first to climb the ranks!
                </Text>
              </View>
            }
          />
        </>
      )}
    </>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
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
        onLayout={(e: LayoutChangeEvent) => setTabWidth((e.nativeEvent.layout.width - 10) / 2)}
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
    marginBottom: spacing.sm,
  },
  backButtonText: {
    color: '#1A1A1A',
    fontSize: 12,
    fontFamily: 'DMSans_900Black',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#000000',
    padding: 3,
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
    position: 'relative',
    overflow: 'hidden',
  },
  tabIndicator: {
    position: 'absolute',
    top: 3,
    left: 3,
    bottom: 3,
    backgroundColor: ACCENT_COLOR,
    borderRadius: 10,
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
    paddingLeft: spacing.lg,
    paddingRight: spacing.lg + 2, // Extra space for shadow offset
    paddingVertical: spacing.sm,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
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
    backgroundColor: '#F2C94C',
  },
  actionButtonText: {
    fontSize: 14,
    fontFamily: 'DMSans_900Black',
    color: '#FFFFFF',
    textTransform: 'uppercase',
    lineHeight: 18,
  },
  joinLeagueButtonText: {
    fontSize: 14,
    fontFamily: 'DMSans_900Black',
    color: '#1A1A1A',
    textTransform: 'uppercase',
    lineHeight: 18,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: spacing.lg,
    paddingTop: spacing.sm,
    paddingRight: spacing.lg + 2, // Extra space for shadow offset
    paddingBottom: 170, // Account for AdBanner + BottomNavBar
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
  leagueTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sportIcon: {
    width: 32,
    height: 32,
  },
  leagueName: {
    flex: 1,
    fontSize: 18,
    fontFamily: 'DMSans_900Black',
    color: colors.text,
  },
  creatorBadge: {
    backgroundColor: colors.pl,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  creatorBadgeText: {
    fontSize: 10,
    fontFamily: 'DMSans_900Black',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  leagueSportText: {
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
    color: '#888888',
    marginTop: 4,
    marginLeft: 42, // Align with text after icon
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusBadgePending: {
    backgroundColor: '#F2C94C',
  },
  statusBadgeActive: {
    backgroundColor: colors.success,
  },
  statusBadgeCompleted: {
    backgroundColor: '#E5E5E5',
  },
  statusBadgeText: {
    fontSize: 11,
    fontFamily: 'DMSans_700Bold',
  },
  statusBadgeTextPending: {
    color: '#1A1A1A',
  },
  statusBadgeTextActive: {
    color: '#FFFFFF',
  },
  statusBadgeTextCompleted: {
    color: '#888888',
  },
  countdownText: {
    fontSize: 13,
    fontFamily: 'DMSans_500Medium',
    color: '#666666',
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
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
  },
  memberCount: {
    fontSize: 13,
    fontFamily: 'DMSans_500Medium',
    color: '#888888',
  },
  deleteButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  deleteButtonText: {
    fontSize: 12,
    fontFamily: 'DMSans_600SemiBold',
    color: '#E53935',
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
  // Sport filter tabs
  sportFilterContainer: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: 6,
  },
  sportFilterTab: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#000000',
  },
  sportFilterTabActive: {
    backgroundColor: '#F2C94C',
  },
  sportFilterText: {
    fontSize: 11,
    fontFamily: 'DMSans_700Bold',
    color: '#1A1A1A',
  },
  sportFilterTextActive: {
    color: '#1A1A1A',
  },
  // Leaderboard styles
  leaderboardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
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
    fontSize: 10,
    fontFamily: 'DMSans_700Bold',
    color: '#888888',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  playerHeaderContainer: {
    flex: 1,
    marginLeft: 44,
  },
  headerIconContainer: {
    width: 44,
    alignItems: 'center',
  },
  headerIconTrophy: {
    width: 18,
    height: 18,
  },
  headerIconFire: {
    width: 14,
    height: 18,
  },
  leaderboardListContent: {
    paddingBottom: spacing.lg,
  },
  leaderboardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E0',
    backgroundColor: '#FFFFFF',
    marginHorizontal: spacing.lg,
    borderLeftWidth: 2,
    borderRightWidth: 2,
    borderLeftColor: '#000000',
    borderRightColor: '#000000',
  },
  currentUserRow: {
    backgroundColor: '#E0F7F4',
  },
  rankContainer: {
    width: 28,
    alignItems: 'center',
  },
  rank: {
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
    color: '#888888',
  },
  medalIcon: {
    width: 22,
    height: 22,
  },
  userAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: ACCENT_COLOR,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
    marginRight: 10,
  },
  userAvatarText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontFamily: 'DMSans_700Bold',
  },
  userInfo: {
    flex: 1,
  },
  username: {
    fontSize: 14,
    fontFamily: 'DMSans_600SemiBold',
    color: colors.text,
  },
  highlightedText: {
    color: ACCENT_COLOR,
    fontFamily: 'DMSans_700Bold',
  },
  statValueContainer: {
    width: 44,
    alignItems: 'center',
  },
  statValueOnly: {
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
    color: colors.text,
  },
  totalUsersContainer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  totalUsersText: {
    fontSize: 13,
    fontFamily: 'DMSans_600SemiBold',
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
