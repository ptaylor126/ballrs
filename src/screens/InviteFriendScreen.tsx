import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Easing,
  Share,
  Alert,
  Image,
} from 'react-native';
import { Duel, subscribeToDuel, unsubscribeFromDuel, cancelDuel } from '../lib/duelService';
import { RealtimeChannel } from '@supabase/supabase-js';
import { getSportColor, Sport } from '../lib/theme';

// Sport icons
const sportIcons: Record<Sport, any> = {
  nba: require('../../assets/images/icon-basketball.png'),
  pl: require('../../assets/images/icon-soccer.png'),
  nfl: require('../../assets/images/icon-football.png'),
  mlb: require('../../assets/images/icon-baseball.png'),
};

const sportNames: Record<Sport, string> = {
  nba: 'NBA',
  pl: 'Premier League',
  nfl: 'NFL',
  mlb: 'MLB',
};

interface Props {
  duel: Duel;
  sport: 'nba' | 'pl' | 'nfl' | 'mlb';
  onCancel: () => void;
  onOpponentJoined: (duel: Duel) => void;
}

export default function InviteFriendScreen({ duel, sport, onCancel, onOpponentJoined }: Props) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const sportColor = getSportColor(sport as Sport);

  useEffect(() => {
    // Start pulse animation
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();

    return () => pulse.stop();
  }, [pulseAnim]);

  useEffect(() => {
    // Subscribe to duel updates
    channelRef.current = subscribeToDuel(duel.id, (updatedDuel) => {
      if (updatedDuel.status === 'active' && updatedDuel.player2_id) {
        onOpponentJoined(updatedDuel);
      }
    });

    return () => {
      if (channelRef.current) {
        unsubscribeFromDuel(channelRef.current);
      }
    };
  }, [duel.id, onOpponentJoined]);

  const handleShare = async () => {
    const inviteCode = duel.invite_code;
    if (!inviteCode) return;

    try {
      await Share.share({
        message: `Think you can beat me at Ballrs trivia? Join my duel: ${inviteCode}\n\nballrs://duel/${inviteCode}`,
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to share invite');
    }
  };

  const handleCancel = async () => {
    await cancelDuel(duel.id);
    onCancel();
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Sport Icon */}
        <Animated.View style={[styles.iconContainer, { backgroundColor: sportColor, transform: [{ scale: pulseAnim }] }]}>
          <Image source={sportIcons[sport as Sport]} style={styles.sportIcon} />
        </Animated.View>

        <Text style={styles.title}>Challenge Friend</Text>
        <Text style={[styles.sportLabel, { color: sportColor }]}>{sportNames[sport as Sport]}</Text>

        {/* Invite Code Section */}
        <View style={styles.codeSection}>
          <Text style={styles.codeLabel}>YOUR INVITE CODE</Text>
          <View style={styles.codeBox}>
            <Text style={[styles.code, { color: sportColor }]}>
              {duel.invite_code || '------'}
            </Text>
          </View>
          <Text style={styles.codeHint}>Share this code with a friend</Text>
        </View>

        {/* Share Button */}
        <TouchableOpacity
          style={[styles.shareButton, { backgroundColor: sportColor }]}
          onPress={handleShare}
          activeOpacity={0.8}
        >
          <Text style={styles.shareButtonText}>Share Invite</Text>
        </TouchableOpacity>

        {/* Waiting Status */}
        <View style={styles.waitingContainer}>
          <ActivityIndicator size="small" color={sportColor} />
          <Text style={styles.waitingText}>Waiting for friend to join...</Text>
        </View>

        {/* How it works Card */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>How it works</Text>
          <Text style={styles.infoText}>
            Share the code with a friend. They can enter it in the app{'\n'}
            to join your trivia duel. Answer correctly and fastest to win!
          </Text>
        </View>

        {/* Cancel Button */}
        <TouchableOpacity style={styles.cancelButton} onPress={handleCancel} activeOpacity={0.8}>
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F2EB',
  },
  content: {
    flex: 1,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 3,
    borderColor: '#000000',
    shadowColor: '#000000',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  sportIcon: {
    width: 48,
    height: 48,
    tintColor: '#FFFFFF',
  },
  title: {
    fontSize: 24,
    fontFamily: 'DMSans_900Black',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  sportLabel: {
    fontSize: 16,
    fontFamily: 'DMSans_900Black',
    marginBottom: 32,
  },
  codeSection: {
    alignItems: 'center',
    marginBottom: 24,
    width: '100%',
  },
  codeLabel: {
    fontSize: 12,
    fontFamily: 'DMSans_900Black',
    color: '#888888',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  codeBox: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#000000',
    borderRadius: 8,
    paddingHorizontal: 32,
    paddingVertical: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  code: {
    fontSize: 32,
    fontFamily: 'DMSans_900Black',
    letterSpacing: 8,
  },
  codeHint: {
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
    color: '#888888',
    marginTop: 12,
  },
  shareButton: {
    paddingHorizontal: 48,
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#000000',
    marginBottom: 24,
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  shareButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'DMSans_900Black',
  },
  waitingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 32,
  },
  waitingText: {
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
    color: '#888888',
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 20,
    width: '100%',
    marginBottom: 32,
    borderWidth: 2,
    borderColor: '#000000',
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  infoTitle: {
    fontSize: 14,
    fontFamily: 'DMSans_900Black',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
    color: '#1A1A1A',
    lineHeight: 22,
  },
  cancelButton: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 32,
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
  cancelButtonText: {
    color: '#1A1A1A',
    fontSize: 14,
    fontFamily: 'DMSans_900Black',
  },
});
