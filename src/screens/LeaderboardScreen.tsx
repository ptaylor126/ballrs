import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import {
  getGlobalLeaderboard,
  getLeaderboardPlayerCount,
  LeaderboardEntry,
  TimePeriod,
} from '../lib/pointsService';
import { countryCodeToFlag } from '../lib/countryUtils';
import { truncateUsername } from '../lib/theme';

type SportFilter = 'all' | 'nba' | 'pl' | 'nfl' | 'mlb';

interface Props {
  onBack: () => void;
  selectedSports?: ('nba' | 'pl' | 'nfl' | 'mlb')[];
}

const colors = {
  background: '#F5F2EB',
  cardBackground: '#FFFFFF',
  primary: '#1ABC9C',
  textDark: '#1A1A1A',
  textMuted: '#888888',
  border: '#000000',
  borderLight: '#E5E5E0',
  gold: '#F2C94C',
  silver: '#C0C0C0',
  bronze: '#CD7F32',
  highlightTeal: 'rgba(26, 188, 156, 0.15)',
  rowAlt: '#FAFAF8',
};

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

// Medal icons
const goldMedal = require('../../assets/images/icon-gold.png');
const silverMedal = require('../../assets/images/icon-silver.png');
const bronzeMedal = require('../../assets/images/icon-bronze.png');

export default function LeaderboardScreen({ onBack, selectedSports }: Props) {
  const { user } = useAuth();
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [playerCount, setPlayerCount] = useState(0);
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('all_time');
  const [sportFilter, setSportFilter] = useState<SportFilter>('all');
  const [hasInitialized, setHasInitialized] = useState(false);

  // Set default sport filter based on user's selected sports (only once on mount)
  useEffect(() => {
    console.log('[LeaderboardScreen] selectedSports:', selectedSports);
    console.log('[LeaderboardScreen] hasInitialized:', hasInitialized);
    // Wait until selectedSports is loaded (not null/undefined) before initializing
    if (hasInitialized || selectedSports === null || selectedSports === undefined) {
      return;
    }
    if (selectedSports.length === 1) {
      console.log('[LeaderboardScreen] Setting sport filter to:', selectedSports[0]);
      setSportFilter(selectedSports[0]);
    }
    setHasInitialized(true);
  }, [selectedSports, hasInitialized]);

  const fetchLeaderboard = useCallback(async () => {
    const sportFilterValue = sportFilter === 'all' ? undefined : sportFilter;
    const [data, count] = await Promise.all([
      getGlobalLeaderboard(timePeriod, sportFilterValue),
      getLeaderboardPlayerCount(timePeriod, sportFilterValue),
    ]);
    setLeaderboard(data);
    setPlayerCount(count);
  }, [timePeriod, sportFilter]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await fetchLeaderboard();
      setLoading(false);
    };
    load();
  }, [fetchLeaderboard]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchLeaderboard();
    setRefreshing(false);
  }, [fetchLeaderboard]);

  const getMedalIcon = (rank: number) => {
    if (rank === 1) return goldMedal;
    if (rank === 2) return silverMedal;
    if (rank === 3) return bronzeMedal;
    return null;
  };

  const getRankStyle = (rank: number) => {
    if (rank === 1) return styles.rankGold;
    if (rank === 2) return styles.rankSilver;
    if (rank === 3) return styles.rankBronze;
    return styles.rankDefault;
  };

  const getHeaderText = () => {
    switch (timePeriod) {
      case 'weekly':
        return `${playerCount} player${playerCount !== 1 ? 's' : ''} this week`;
      case 'monthly':
        return `${playerCount} player${playerCount !== 1 ? 's' : ''} this month`;
      case 'all_time':
        return `${playerCount} player${playerCount !== 1 ? 's' : ''} worldwide`;
      default:
        return `${playerCount} player${playerCount !== 1 ? 's' : ''}`;
    }
  };

  const renderItem = ({ item, index }: { item: LeaderboardEntry; index: number }) => {
    const isCurrentUser = user?.id === item.user_id;
    const medalIcon = getMedalIcon(item.rank);
    const isAltRow = index % 2 === 1;

    return (
      <View style={[
        styles.row,
        isAltRow && styles.rowAlt,
        isCurrentUser && styles.highlightedRow,
      ]}>
        {/* Rank with Medal */}
        <View style={styles.rankContainer}>
          {medalIcon ? (
            <Image source={medalIcon} style={styles.medalIcon} resizeMode="contain" />
          ) : (
            <Text style={[styles.rank, getRankStyle(item.rank)]}>
              #{item.rank}
            </Text>
          )}
        </View>

        {/* Flag + Avatar + Username */}
        <View style={styles.userSection}>
          {item.country && (
            <Text style={styles.countryFlag}>{countryCodeToFlag(item.country)}</Text>
          )}
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {item.avatar || item.username.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.usernameContainer}>
            <Text style={styles.username} numberOfLines={1}>
              {truncateUsername(item.username)}
            </Text>
            {isCurrentUser && <Text style={styles.youLabel}>(You)</Text>}
          </View>
        </View>

        {/* Points */}
        <View style={styles.pointsContainer}>
          <Text style={styles.pointsValue}>{item.points}</Text>
          <Text style={styles.pointsLabel}>pts</Text>
        </View>
      </View>
    );
  };

  const renderTableCard = () => (
    <View style={styles.tableCard}>
      {/* Table Header */}
      <View style={styles.tableHeader}>
        <View style={styles.rankContainer}>
          <Text style={styles.tableHeaderText}>RANK</Text>
        </View>
        <View style={styles.userSection}>
          <Text style={styles.tableHeaderText}>PLAYER</Text>
        </View>
        <View style={styles.pointsContainer}>
          <Text style={styles.tableHeaderText}>POINTS</Text>
        </View>
      </View>

      {/* Table Content */}
      <FlatList
        data={leaderboard}
        renderItem={renderItem}
        keyExtractor={(item) => item.user_id}
        contentContainerStyle={styles.listContent}
        scrollEnabled={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              No players yet for {SPORT_LABELS[sportFilter]}
            </Text>
            <Text style={styles.emptySubtext}>
              {timePeriod === 'weekly'
                ? 'Be the first to earn points this week!'
                : timePeriod === 'monthly'
                ? 'Be the first to earn points this month!'
                : 'Start playing to climb the leaderboard!'}
            </Text>
          </View>
        }
      />
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <FlatList
        data={[]}
        renderItem={null}
        ListHeaderComponent={
          <>
            {/* Header */}
            <View style={styles.header}>
              <TouchableOpacity style={styles.backButton} onPress={onBack}>
                <Text style={styles.backButtonText}>← Back</Text>
              </TouchableOpacity>
              <Text style={styles.title}>Leaderboard</Text>
            </View>

            {/* Player Count Badge */}
            <View style={styles.playerCountContainer}>
              <View style={styles.playerCountBadge}>
                <Text style={styles.globeIcon}>🌍</Text>
                <Text style={styles.playerCountText}>{getHeaderText()}</Text>
              </View>
            </View>

            {/* Time Period Tabs */}
            <View style={styles.tabsContainer}>
              {TIME_PERIODS.map((period) => (
                <TouchableOpacity
                  key={period.key}
                  style={[
                    styles.tab,
                    timePeriod === period.key && styles.tabActive,
                  ]}
                  onPress={() => setTimePeriod(period.key)}
                >
                  <Text
                    style={[
                      styles.tabText,
                      timePeriod === period.key && styles.tabTextActive,
                    ]}
                  >
                    {period.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Sport Filter Pills */}
            <View style={styles.filtersContainer}>
              {SPORT_FILTERS.map((filter) => (
                <TouchableOpacity
                  key={filter.key}
                  style={[
                    styles.filterPill,
                    sportFilter === filter.key && styles.filterPillActive,
                  ]}
                  onPress={() => setSportFilter(filter.key)}
                >
                  <Text
                    style={[
                      styles.filterPillText,
                      sportFilter === filter.key && styles.filterPillTextActive,
                    ]}
                  >
                    {filter.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Loading State or Table */}
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            ) : (
              renderTableCard()
            )}
          </>
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        contentContainerStyle={styles.scrollContent}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
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
    marginBottom: 20,
  },
  backButtonText: {
    color: '#1A1A1A',
    fontSize: 12,
    fontFamily: 'DMSans_900Black',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 28,
    fontFamily: 'DMSans_900Black',
    color: colors.textDark,
    textAlign: 'center',
  },
  playerCountContainer: {
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  playerCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.cardBackground,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#000000',
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  globeIcon: {
    fontSize: 20,
  },
  playerCountText: {
    fontSize: 16,
    fontFamily: 'DMSans_900Black',
    color: colors.textDark,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tabsContainer: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 20,
    backgroundColor: colors.cardBackground,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    padding: 4,
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: colors.primary,
  },
  tabText: {
    fontSize: 12,
    fontFamily: 'DMSans_700Bold',
    color: colors.textMuted,
    letterSpacing: 0.5,
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  filtersContainer: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 24,
    gap: 10,
  },
  filterPill: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: colors.cardBackground,
    borderWidth: 2,
    borderColor: colors.border,
  },
  filterPillActive: {
    backgroundColor: colors.gold,
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  filterPillText: {
    fontSize: 12,
    fontFamily: 'DMSans_900Black',
    color: colors.textDark,
    letterSpacing: 0.5,
  },
  filterPillTextActive: {
    color: colors.textDark,
  },
  loadingContainer: {
    padding: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tableCard: {
    marginHorizontal: 20,
    backgroundColor: colors.cardBackground,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.border,
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
    paddingVertical: 14,
    backgroundColor: '#F0F0F0',
    borderBottomWidth: 2,
    borderBottomColor: colors.border,
  },
  tableHeaderText: {
    fontSize: 11,
    fontFamily: 'DMSans_900Black',
    color: colors.textMuted,
    letterSpacing: 1,
  },
  listContent: {
    // No extra padding needed
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: colors.cardBackground,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  rowAlt: {
    backgroundColor: colors.rowAlt,
  },
  highlightedRow: {
    backgroundColor: colors.highlightTeal,
  },
  rankContainer: {
    width: 48,
    alignItems: 'center',
  },
  medalIcon: {
    width: 28,
    height: 28,
  },
  rank: {
    fontSize: 14,
    fontFamily: 'DMSans_900Black',
  },
  rankGold: {
    color: '#D4A017',
  },
  rankSilver: {
    color: '#808080',
  },
  rankBronze: {
    color: '#CD7F32',
  },
  rankDefault: {
    color: colors.textMuted,
  },
  userSection: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  countryFlag: {
    fontSize: 18,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1A1A1A',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.border,
  },
  avatarText: {
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
    color: '#FFFFFF',
  },
  usernameContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  username: {
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
    color: colors.textDark,
  },
  youLabel: {
    fontSize: 12,
    color: colors.primary,
    fontFamily: 'DMSans_600SemiBold',
  },
  pointsContainer: {
    width: 60,
    alignItems: 'flex-end',
  },
  pointsValue: {
    fontSize: 18,
    fontFamily: 'DMSans_900Black',
    color: colors.textDark,
  },
  pointsLabel: {
    fontSize: 10,
    fontFamily: 'DMSans_400Regular',
    color: colors.textMuted,
    marginTop: -2,
  },
  emptyContainer: {
    padding: 48,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    fontFamily: 'DMSans_600SemiBold',
    color: colors.textMuted,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 8,
    opacity: 0.7,
  },
});
