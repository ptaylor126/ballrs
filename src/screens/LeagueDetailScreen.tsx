import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Share,
  Alert,
  Platform,
  Image,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import {
  getLeagueLeaderboard,
  leaveLeague,
  subscribeToLeague,
  unsubscribeFromLeague,
  LeagueMember,
  LeagueWithMemberCount,
  getLeagueCountdown,
  getLeagueStatus,
  DURATION_OPTIONS,
} from '../lib/leaguesService';
import { RealtimeChannel } from '@supabase/supabase-js';
import UserProfileIcon from '../components/UserProfileIcon';
import InviteToLeagueModal from '../components/InviteToLeagueModal';
import { countryCodeToFlag } from '../lib/countryUtils';

interface Props {
  league: LeagueWithMemberCount;
  onBack: () => void;
  onLeaveLeague: () => void;
}


// Sport icon images
const sportIcons: Record<string, any> = {
  nba: require('../../assets/images/icon-basketball.png'),
  pl: require('../../assets/images/icon-soccer.png'),
  nfl: require('../../assets/images/icon-football.png'),
  mlb: require('../../assets/images/icon-baseball.png'),
  all: require('../../assets/images/icon-basketball.png'), // Use basketball as default for 'all' leagues
};

// Sport colors (neubrutalist palette)
const sportColors: Record<string, string> = {
  nba: '#E07A3D',
  pl: '#A17FFF',
  nfl: '#3BA978',
  mlb: '#7A93D2',
  all: '#1ABC9C',
};

const getSportColor = (sport: string) => sportColors[sport] || sportColors.all;

export default function LeagueDetailScreen({ league, onBack, onLeaveLeague }: Props) {
  const { user } = useAuth();
  const [members, setMembers] = useState<LeagueMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);

  const sportColor = getSportColor(league.sport);

  // Get countdown info
  const countdown = getLeagueCountdown(league);
  const currentStatus = getLeagueStatus(league);
  const isCompleted = currentStatus === 'completed';

  // Get status badge text
  const getStatusBadgeText = () => {
    switch (countdown.type) {
      case 'pending': return 'Starting Soon';
      case 'active': return 'Active';
      case 'completed': return 'Completed';
    }
  };

  // Get duration label
  const getDurationLabel = () => {
    const option = DURATION_OPTIONS.find(o => o.value === league.duration);
    return option?.label || league.duration;
  };

  const loadMembers = useCallback(async () => {
    const leaderboard = await getLeagueLeaderboard(league.id, 'all_time');
    setMembers(leaderboard);
  }, [league.id]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await loadMembers();
      setLoading(false);
    };
    load();
  }, [loadMembers]);

  // Subscribe to realtime updates
  useEffect(() => {
    channelRef.current = subscribeToLeague(league.id, (updatedMembers) => {
      const sorted = [...updatedMembers].sort((a, b) => {
        return (b.points_all_time || 0) - (a.points_all_time || 0);
      });
      setMembers(sorted);
    });

    return () => {
      if (channelRef.current) {
        unsubscribeFromLeague(channelRef.current);
      }
    };
  }, [league.id]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadMembers();
    setRefreshing(false);
  }, [loadMembers]);

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Join my Ballrs league "${league.name}"!\n\nInvite code: ${league.invite_code}\n\nballrs://league/${league.invite_code}`,
      });
    } catch (err) {
      console.error('Error sharing:', err);
    }
  };

  const handleLeaveLeague = () => {
    if (!user) return;

    const message = `Are you sure you want to leave "${league.name}"?`;

    if (Platform.OS === 'web') {
      const confirmed = window.confirm(`Leave League\n\n${message}`);
      if (confirmed) {
        leaveLeague(league.id, user.id).then((success) => {
          if (success) {
            onLeaveLeague();
          } else {
            window.alert('Failed to leave league. Please try again.');
          }
        });
      }
      return;
    }

    Alert.alert(
      'Leave League',
      message,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            const success = await leaveLeague(league.id, user.id);
            if (success) {
              onLeaveLeague();
            } else {
              Alert.alert('Error', 'Failed to leave league. Please try again.');
            }
          },
        },
      ]
    );
  };

  // Sort members by points
  const sortedMembers = [...members].sort((a, b) => {
    return (b.points_all_time || 0) - (a.points_all_time || 0);
  });

  const renderMemberItem = ({ item, index }: { item: LeagueMember; index: number }) => {
    const rank = index + 1;
    const isCurrentUser = user?.id === item.user_id;
    const isFirst = rank === 1;

    return (
      <View style={[styles.memberRow, isCurrentUser && styles.highlightedRow]}>
        <View style={[styles.rankCell, isFirst && styles.rankCellFirst]}>
          <Text style={[styles.rankText, isFirst && styles.rankTextFirst]}>
            {rank}
          </Text>
        </View>
        <View style={styles.usernameCell}>
          <UserProfileIcon
            iconUrl={item.icon_url}
            size={28}
            fallbackText={item.username || '?'}
          />
          <Text style={[styles.usernameText, isCurrentUser && styles.highlightedText]}>
            {item.username}{item.country ? ` ${countryCodeToFlag(item.country)}` : ''}
            {isCurrentUser && ' (You)'}
          </Text>
        </View>
        <View style={styles.pointsCell}>
          <Text style={styles.pointsText}>
            {item.points_all_time}
          </Text>
        </View>
      </View>
    );
  };

  const renderTableHeader = () => (
    <View style={styles.tableHeader}>
      <View style={styles.rankCell}>
        <Text style={styles.headerText}>#</Text>
      </View>
      <View style={styles.usernameCell}>
        <Text style={styles.headerText}>PLAYER</Text>
      </View>
      <View style={styles.pointsCell}>
        <Text style={styles.headerText}>PTS</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#1ABC9C"
            colors={['#1ABC9C']}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={onBack}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
        </View>

        {/* League Info Card */}
        <View style={styles.leagueCard}>
          <View style={[styles.sportIconContainer, { backgroundColor: sportColor }]}>
            {sportIcons[league.sport] ? (
              <Image
                source={sportIcons[league.sport]}
                style={styles.sportIcon}
                resizeMode="contain"
              />
            ) : (
              <Text style={styles.sportIconFallback}>🏆</Text>
            )}
          </View>

          <Text style={styles.leagueName}>{league.name}</Text>
          <Text style={styles.memberCount}>{league.member_count} members</Text>

          {/* Status Badge */}
          <View style={styles.statusBadge}>
            <Text style={styles.statusText}>{getStatusBadgeText()}</Text>
          </View>

          {/* Countdown */}
          {!isCompleted && countdown.text && (
            <Text style={styles.countdownText}>{countdown.text}</Text>
          )}

          {/* Duration */}
          <Text style={styles.durationText}>{getDurationLabel()} League</Text>
        </View>

        {/* Invite Code Card */}
        <View style={styles.inviteCard}>
          <View style={styles.inviteCodeSection}>
            <Text style={styles.inviteCodeLabel}>INVITE CODE</Text>
            <Text style={[styles.inviteCodeText, { color: sportColor }]}>
              {league.invite_code}
            </Text>
          </View>
          <View style={styles.inviteButtons}>
            <TouchableOpacity
              style={[styles.shareButton, { backgroundColor: sportColor }]}
              onPress={handleShare}
            >
              <Text style={styles.shareButtonText}>Share</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.inviteFriendsButton}
              onPress={() => setShowInviteModal(true)}
            >
              <Text style={styles.inviteFriendsButtonText}>Invite</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Final Standings Header */}
        {isCompleted && (
          <View style={styles.finalStandingsHeader}>
            <Text style={styles.finalStandingsText}>FINAL STANDINGS</Text>
          </View>
        )}

        {/* Leaderboard Table */}
        <View style={styles.tableCard}>
          {renderTableHeader()}

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#1ABC9C" />
            </View>
          ) : sortedMembers.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No members yet</Text>
            </View>
          ) : (
            sortedMembers.map((member, index) => (
              <View key={member.id}>
                {renderMemberItem({ item: member, index })}
              </View>
            ))
          )}
        </View>

        {/* Leave Button */}
        {!league.is_creator && !isCompleted && (
          <TouchableOpacity
            style={styles.leaveButton}
            onPress={handleLeaveLeague}
          >
            <Text style={styles.leaveButtonText}>Leave League</Text>
          </TouchableOpacity>
        )}

        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Invite Friends Modal */}
      <InviteToLeagueModal
        visible={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        leagueId={league.id}
        leagueName={league.name}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F2EB',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    padding: 16,
  },
  backButton: {
    backgroundColor: '#F2C94C',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#000000',
    alignSelf: 'flex-start',
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
  leagueCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#000000',
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  sportIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 3,
    borderColor: '#000000',
    overflow: 'hidden',
  },
  sportIcon: {
    width: 40,
    height: 40,
  },
  sportIconFallback: {
    fontSize: 32,
  },
  leagueName: {
    fontSize: 24,
    fontFamily: 'DMSans_900Black',
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 4,
  },
  memberCount: {
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
    color: '#6B7280',
    marginBottom: 12,
  },
  statusBadge: {
    backgroundColor: '#F2C94C',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#000000',
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
    marginBottom: 12,
  },
  statusText: {
    fontSize: 12,
    fontFamily: 'DMSans_900Black',
    color: '#1A1A1A',
  },
  countdownText: {
    fontSize: 14,
    fontFamily: 'DMSans_500Medium',
    color: '#1ABC9C',
    marginBottom: 8,
  },
  durationText: {
    fontSize: 12,
    fontFamily: 'DMSans_400Regular',
    color: '#6B7280',
  },
  inviteCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#000000',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  inviteCodeSection: {
    flex: 1,
  },
  inviteCodeLabel: {
    fontSize: 10,
    fontFamily: 'DMSans_900Black',
    color: '#6B7280',
    letterSpacing: 1,
    marginBottom: 4,
  },
  inviteCodeText: {
    fontSize: 24,
    fontFamily: 'DMSans_900Black',
    letterSpacing: 2,
  },
  shareButton: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#000000',
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  shareButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'DMSans_900Black',
  },
  inviteButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  inviteFriendsButton: {
    backgroundColor: '#F2C94C',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#000000',
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  inviteFriendsButtonText: {
    color: '#1A1A1A',
    fontSize: 14,
    fontFamily: 'DMSans_900Black',
  },
  finalStandingsHeader: {
    backgroundColor: '#6B7280',
    marginHorizontal: 16,
    marginTop: 20,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#000000',
    alignItems: 'center',
  },
  finalStandingsText: {
    fontSize: 14,
    fontFamily: 'DMSans_900Black',
    color: '#FFFFFF',
    letterSpacing: 2,
  },
  tableCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 20,
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
  tableHeader: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F5F2EB',
    borderBottomWidth: 2,
    borderBottomColor: '#000000',
  },
  headerText: {
    fontSize: 12,
    fontFamily: 'DMSans_900Black',
    color: '#6B7280',
  },
  rankCell: {
    width: 36,
    alignItems: 'center',
  },
  rankCellFirst: {},
  usernameCell: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 8,
    gap: 8,
  },
  pointsCell: {
    width: 44,
    alignItems: 'center',
  },
  loadingContainer: {
    padding: 48,
    alignItems: 'center',
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E0',
  },
  highlightedRow: {
    backgroundColor: '#E0F7F4',
  },
  rankText: {
    fontSize: 14,
    fontFamily: 'DMSans_900Black',
    color: '#1A1A1A',
  },
  rankTextFirst: {
    color: '#F2C94C',
  },
  usernameText: {
    fontSize: 14,
    fontFamily: 'DMSans_500Medium',
    color: '#1A1A1A',
  },
  highlightedText: {
    fontFamily: 'DMSans_900Black',
  },
  pointsText: {
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
    color: '#1A1A1A',
  },
  emptyContainer: {
    padding: 48,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    fontFamily: 'DMSans_400Regular',
    color: '#6B7280',
  },
  leaveButton: {
    marginHorizontal: 16,
    marginTop: 24,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#DC2626',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  leaveButtonText: {
    color: '#DC2626',
    fontSize: 16,
    fontFamily: 'DMSans_700Bold',
  },
  bottomPadding: {
    height: 32,
  },
});
