import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { FrameStyle } from '../lib/profileRewardsService';

interface LeaderboardEntry {
  id: string;
  username: string;
  nba_total_solved: number;
  pl_total_solved: number;
  nfl_total_solved: number;
  total_solved: number;
  nba_best_streak: number;
  pl_best_streak: number;
  nfl_best_streak: number;
  rank: number;
  icon_url?: string;
  frame_style?: FrameStyle;
}

interface Props {
  onBack: () => void;
}

const colors = {
  background: '#1a1a2e',
  cardBackground: '#16213e',
  primary: '#e94560',
  accent: '#0f3460',
  textLight: '#ffffff',
  textMuted: '#94a3b8',
  border: '#334155',
  gold: '#fbbf24',
  silver: '#9ca3af',
  bronze: '#cd7c32',
  highlight: '#1e3a5f',
};

export default function LeaderboardScreen({ onBack }: Props) {
  const { user } = useAuth();
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchLeaderboard = useCallback(async () => {
    // First fetch the basic leaderboard
    const { data: leaderboardData, error } = await supabase
      .from('leaderboard')
      .select('*')
      .limit(50);

    if (error) {
      console.error('Error fetching leaderboard:', error);
      return;
    }

    if (!leaderboardData || leaderboardData.length === 0) {
      setLeaderboard([]);
      return;
    }

    // Fetch user customization data (icons and frames)
    const userIds = leaderboardData.map(entry => entry.id);
    const { data: customizationData } = await supabase
      .from('user_stats')
      .select(`
        id,
        selected_icon_id,
        selected_frame_id,
        profile_icons:selected_icon_id (icon_url),
        profile_frames:selected_frame_id (frame_style)
      `)
      .in('id', userIds);

    // Create a map of user customizations
    const customizationMap = new Map<string, { icon_url?: string; frame_style?: FrameStyle }>();
    customizationData?.forEach((item: any) => {
      customizationMap.set(item.id, {
        icon_url: item.profile_icons?.icon_url,
        frame_style: item.profile_frames?.frame_style,
      });
    });

    // Merge customization data with leaderboard entries
    const enrichedLeaderboard = leaderboardData.map(entry => ({
      ...entry,
      icon_url: customizationMap.get(entry.id)?.icon_url,
      frame_style: customizationMap.get(entry.id)?.frame_style,
    }));

    setLeaderboard(enrichedLeaderboard);
  }, []);

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

  const getRankStyle = (rank: number) => {
    if (rank === 1) return { color: colors.gold };
    if (rank === 2) return { color: colors.silver };
    if (rank === 3) return { color: colors.bronze };
    return { color: colors.textMuted };
  };

  const getBestStreak = (entry: LeaderboardEntry) => {
    return Math.max(entry.nba_best_streak, entry.pl_best_streak, entry.nfl_best_streak || 0);
  };

  const getDefaultFrameStyle = (): FrameStyle => ({
    borderColor: colors.border,
    borderWidth: 2,
  });

  const renderItem = ({ item }: { item: LeaderboardEntry }) => {
    const isCurrentUser = user?.id === item.id;
    const frameStyle = item.frame_style || getDefaultFrameStyle();

    return (
      <View style={[styles.row, isCurrentUser && styles.highlightedRow]}>
        <View style={styles.rankContainer}>
          <Text style={[styles.rank, getRankStyle(item.rank)]}>
            {item.rank}
          </Text>
        </View>
        <View
          style={[
            styles.userAvatar,
            {
              borderColor: frameStyle.borderColor,
              borderWidth: frameStyle.borderWidth,
              shadowColor: frameStyle.shadowColor,
              shadowOpacity: frameStyle.shadowOpacity || 0,
              shadowRadius: 4,
              shadowOffset: { width: 0, height: 0 },
            },
          ]}
        >
          <Text style={styles.userAvatarText}>
            {item.icon_url || item.username.charAt(0).toUpperCase()}
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

  const renderHeader = () => (
    <View style={styles.headerRow}>
      <View style={styles.rankContainer}>
        <Text style={styles.headerText}>#</Text>
      </View>
      <View style={styles.userInfo}>
        <Text style={styles.headerText}>Player</Text>
      </View>
      <View style={styles.statsContainer}>
        <Text style={styles.headerText}>Total</Text>
      </View>
      <View style={styles.statsContainer}>
        <Text style={styles.headerText}>Best</Text>
      </View>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={onBack}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Leaderboard</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Leaderboard</Text>
        <Text style={styles.subtitle}>Top 50 Players</Text>
      </View>

      {renderHeader()}

      <FlatList
        data={leaderboard}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No players on the leaderboard yet</Text>
            <Text style={styles.emptySubtext}>Be the first to solve a puzzle!</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    padding: 16,
    paddingBottom: 8,
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
    marginBottom: 8,
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
    fontWeight: 'bold',
    color: colors.textLight,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.cardBackground,
  },
  headerText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  listContent: {
    paddingBottom: 24,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  highlightedRow: {
    backgroundColor: colors.highlight,
  },
  rankContainer: {
    width: 36,
  },
  rank: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  userAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  userAvatarText: {
    fontSize: 16,
    color: colors.textLight,
  },
  userInfo: {
    flex: 1,
  },
  username: {
    fontSize: 16,
    color: colors.textLight,
    fontWeight: '500',
  },
  highlightedText: {
    color: colors.primary,
    fontWeight: 'bold',
  },
  statsContainer: {
    width: 60,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textLight,
  },
  statLabel: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 2,
  },
  emptyContainer: {
    padding: 48,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: colors.textMuted,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 8,
    opacity: 0.7,
  },
});
