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
  ScrollView,
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
const globeIcon = require('../../assets/images/icon-globe.png');

// Sport icons
const sportIcons: Record<string, any> = {
  nba: require('../../assets/images/icon-basketball.png'),
  pl: require('../../assets/images/icon-soccer.png'),
  nfl: require('../../assets/images/icon-football.png'),
  mlb: require('../../assets/images/icon-baseball.png'),
};

import { useAuth } from '../contexts/AuthContext';
import { colors, shadows, getSportColor, borders, borderRadius, typography, spacing } from '../lib/theme';
import { AnimatedButton, AnimatedCard } from '../components/AnimatedComponents';
import { soundService } from '../lib/soundService';
import {
  getUserLeagues,
  leaveLeague,
  deleteLeague,
  LeagueWithMemberCount,
  getLeagueCountdown,
  getLeagueStatus,
} from '../lib/leaguesService';
import { supabase } from '../lib/supabase';
import { LeaderboardEntry, TimePeriod, getGlobalLeaderboard, getLeaderboardPlayerCount } from '../lib/pointsService';

interface Props {
  onBack?: () => void;
  onCreateLeague: () => void;
  onJoinLeague: () => void;
  onViewLeague: (league: LeagueWithMemberCount) => void;
  selectedSports?: ('nba' | 'pl' | 'nfl' | 'mlb')[];
}

type TabType = 'leagues' | 'global';
type SportFilter = 'all' | 'nba' | 'pl' | 'nfl' | 'mlb';

const TIME_PERIODS: { key: TimePeriod; label: string }[] = [
  { key: 'weekly', label: 'WEEKLY' },
  { key: 'monthly', label: 'MONTHLY' },
  { key: 'all_time', label: 'ALL-TIME' },
];

const SPORT_FILTERS: { key: SportFilter; label: string }[] = [
  { key: 'all', label: 'ALL' },
  { key: 'nba', label: 'NBA' },
  { key: 'pl', label: 'EPL' },
  { key: 'nfl', label: 'NFL' },
  { key: 'mlb', label: 'MLB' },
];

const SPORT_LABELS: Record<SportFilter, string> = {
  all: 'all sports',
  nba: 'NBA',
  pl: 'EPL',
  nfl: 'NFL',
  mlb: 'MLB',
};

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
  selectedSports,
}: Props) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('leagues');
  const [leagues, setLeagues] = useState<LeagueWithMemberCount[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('all_time');
  // Default to user's sport if they only have one selected
  const defaultSport: SportFilter = selectedSports?.length === 1 ? selectedSports[0] : 'all';
  const [sportFilter, setSportFilter] = useState<SportFilter>(defaultSport);

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
    console.log('[LeaguesScreen] Loading leaderboard with filters:', { timePeriod, sportFilter });
    const sportFilterValue = sportFilter === 'all' ? undefined : sportFilter;
    const [data, count] = await Promise.all([
      getGlobalLeaderboard(timePeriod, sportFilterValue),
      getLeaderboardPlayerCount(timePeriod, sportFilterValue),
    ]);
    console.log('[LeaguesScreen] Leaderboard loaded:', { entries: data.length, totalUsers: count });
    setLeaderboard(data);
    setTotalUsers(count);
  }, [timePeriod, sportFilter]);

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

  // Reload leaderboard when filters change
  useEffect(() => {
    if (activeTab === 'global') {
      const reload = async () => {
        setLoading(true);
        await loadLeaderboard();
        setLoading(false);
      };
      reload();
    }
  }, [timePeriod, sportFilter, activeTab, loadLeaderboard]);

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

  const getPointsForEntry = (entry: LeaderboardEntry) => {
    // Return the actual points earned from puzzle completion
    return entry.points || 0;
  };

  // Leaderboard is already sorted by points from the RPC
  const sortedLeaderboard = leaderboard;

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

  const renderLeaderboardItem = ({ item, index }: { item: LeaderboardEntry; index: number }) => {
    const isCurrentUser = user?.id === item.user_id;
    const medal = getRankMedal(item.rank);
    const isAltRow = index % 2 === 1;

    return (
      <View style={[
        styles.tableRow,
        isAltRow && styles.tableRowAlt,
        isCurrentUser && styles.tableRowHighlight,
      ]}>
        <View style={styles.rankColumn}>
          {medal ? (
            <Image source={medal.icon} style={styles.medalIcon} />
          ) : (
            <Text style={styles.rankText}>#{item.rank}</Text>
          )}
        </View>
        <View style={styles.playerColumn}>
          <View style={styles.playerAvatar}>
            <Text style={styles.playerAvatarText}>
              {item.avatar || item.username.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.playerNameContainer}>
            <Text style={styles.playerName} numberOfLines={1}>
              {item.username}
            </Text>
            {isCurrentUser && <Text style={styles.youLabel}>(You)</Text>}
          </View>
        </View>
        <View style={styles.statColumn}>
          <Text style={styles.statValue}>{getPointsForEntry(item)}</Text>
        </View>
      </View>
    );
  };

  const getHeaderText = () => {
    switch (timePeriod) {
      case 'weekly':
        return `${totalUsers} ${totalUsers === 1 ? 'player' : 'players'} this week`;
      case 'monthly':
        return `${totalUsers} ${totalUsers === 1 ? 'player' : 'players'} this month`;
      case 'all_time':
        return `${totalUsers} ${totalUsers === 1 ? 'player' : 'players'} worldwide`;
      default:
        return `${totalUsers} ${totalUsers === 1 ? 'player' : 'players'}`;
    }
  };

  const renderLeaderboardHeader = () => (
    <>
      {/* Player count row */}
      <View style={styles.tableTopRow}>
        <Image source={globeIcon} style={styles.globeIcon} resizeMode="contain" />
        <Text style={styles.tableTopRowText}>
          {getHeaderText()}
        </Text>
      </View>
      {/* Column headers */}
      <View style={styles.tableHeader}>
        <View style={styles.rankColumn}>
          <Text style={styles.tableHeaderText}>#</Text>
        </View>
        <View style={styles.playerColumn}>
          <Text style={styles.tableHeaderText}>PLAYER</Text>
        </View>
        <View style={styles.statColumn}>
          <Text style={styles.tableHeaderText}>PTS</Text>
        </View>
      </View>
    </>
  );

  const renderMyLeaguesContent = () => (
    <>
      <View style={styles.actions}>
        <AnimatedButton
          style={[styles.actionButton, styles.createButton]}
          onPress={() => {
            soundService.playButtonClick();
            onCreateLeague();
          }}
        >
          <Text style={styles.actionButtonText}>Create League</Text>
        </AnimatedButton>
        <AnimatedButton
          style={[styles.actionButton, styles.joinLeagueButton]}
          onPress={() => {
            soundService.playButtonClick();
            onJoinLeague();
          }}
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
                Create your own or join with an invite code
              </Text>
            </View>
          }
        />
      )}
    </>
  );

  const renderGlobalContent = () => (
    <ScrollView
      style={styles.globalScrollView}
      contentContainerStyle={styles.globalScrollContent}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.primary}
        />
      }
    >
      {/* Time Period Tabs */}
      <View style={styles.timePeriodContainer}>
        {TIME_PERIODS.filter(p => p.key === 'weekly' || p.key === 'all_time').map((period) => (
          <TouchableOpacity
            key={period.key}
            style={[
              styles.timePeriodTab,
              timePeriod === period.key && styles.timePeriodTabActive,
            ]}
            onPress={() => setTimePeriod(period.key)}
          >
            <Text
              style={[
                styles.timePeriodTabText,
                timePeriod === period.key && styles.timePeriodTabTextActive,
              ]}
            >
              {period.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Sport Filter Pills */}
      <View style={styles.sportFiltersContainer}>
        {SPORT_FILTERS.map((filter) => (
          <TouchableOpacity
            key={filter.key}
            style={[
              styles.sportPill,
              sportFilter === filter.key && styles.sportPillActive,
            ]}
            onPress={() => setSportFilter(filter.key)}
          >
            <Text
              style={[
                styles.sportPillText,
                sportFilter === filter.key && styles.sportPillTextActive,
              ]}
            >
              {filter.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <View style={styles.tableCard}>
          {renderLeaderboardHeader()}
          {sortedLeaderboard.length === 0 ? (
            <View style={styles.tableEmptyContainer}>
              <Text style={styles.tableEmptyText}>
                No players yet for {SPORT_LABELS[sportFilter]}
              </Text>
              <Text style={styles.tableEmptySubtext}>
                {timePeriod === 'weekly'
                  ? 'Be the first to earn points this week!'
                  : timePeriod === 'monthly'
                  ? 'Be the first to earn points this month!'
                  : 'Start playing to climb the leaderboard!'}
              </Text>
            </View>
          ) : (
            sortedLeaderboard.map((item, index) => (
              <View key={item.user_id}>
                {renderLeaderboardItem({ item, index })}
              </View>
            ))
          )}
        </View>
      )}
    </ScrollView>
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
            Leaderboard
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
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#000000',
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
  // Global leaderboard scroll view
  globalScrollView: {
    flex: 1,
  },
  globalScrollContent: {
    paddingBottom: 170, // Account for bottom nav + ad banner
  },
  // Player count top row inside table
  tableTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    backgroundColor: '#F5F5F5',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  globeIcon: {
    width: 14,
    height: 14,
  },
  tableTopRowText: {
    fontSize: 12,
    fontFamily: 'DMSans_500Medium',
    color: '#888888',
  },
  // Table card
  tableCard: {
    marginHorizontal: spacing.lg,
    marginRight: spacing.lg + 3, // Account for shadow
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#000000',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 2,
    borderBottomColor: '#000000',
  },
  tableHeaderText: {
    fontSize: 11,
    fontFamily: 'DMSans_900Black',
    color: '#888888',
    letterSpacing: 1,
  },
  tableContent: {
    // No extra padding
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E0',
  },
  tableRowAlt: {
    backgroundColor: '#FAFAF8',
  },
  tableRowHighlight: {
    backgroundColor: 'rgba(26, 188, 156, 0.15)',
  },
  tableEmptyContainer: {
    padding: 48,
    alignItems: 'center',
  },
  tableEmptyText: {
    fontSize: 16,
    fontFamily: 'DMSans_600SemiBold',
    color: '#888888',
    textAlign: 'center',
  },
  tableEmptySubtext: {
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
    color: '#888888',
    textAlign: 'center',
    marginTop: 8,
    opacity: 0.7,
  },
  rankColumn: {
    width: 48,
    alignItems: 'center',
  },
  rankText: {
    fontSize: 14,
    fontFamily: 'DMSans_900Black',
    color: '#888888',
  },
  playerColumn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  playerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1A1A1A',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#000000',
  },
  playerAvatarText: {
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
    color: '#FFFFFF',
  },
  playerNameContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  playerName: {
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
    color: '#1A1A1A',
  },
  youLabel: {
    fontSize: 12,
    fontFamily: 'DMSans_600SemiBold',
    color: ACCENT_COLOR,
  },
  statColumn: {
    width: 52,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
    color: '#1A1A1A',
  },
  medalIcon: {
    width: 28,
    height: 28,
  },
  // Time period tabs
  timePeriodContainer: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    marginTop: 12,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#000000',
    padding: 4,
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  timePeriodTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  timePeriodTabActive: {
    backgroundColor: ACCENT_COLOR,
  },
  timePeriodTabText: {
    fontSize: 12,
    fontFamily: 'DMSans_700Bold',
    color: '#888888',
    letterSpacing: 0.5,
  },
  timePeriodTabTextActive: {
    color: '#FFFFFF',
  },
  // Sport filter pills
  sportFiltersContainer: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    marginTop: 12,
    marginBottom: 20,
    gap: 10,
  },
  sportPill: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: '#000000',
  },
  sportPillActive: {
    backgroundColor: '#F2C94C',
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  sportPillText: {
    fontSize: 12,
    fontFamily: 'DMSans_900Black',
    color: '#1A1A1A',
    letterSpacing: 0.5,
  },
  sportPillTextActive: {
    color: '#1A1A1A',
  },
});
