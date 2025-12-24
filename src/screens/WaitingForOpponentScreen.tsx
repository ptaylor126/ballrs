import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Easing,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
  pl: 'EPL',
  nfl: 'NFL',
  mlb: 'MLB',
};

interface Props {
  duel: Duel;
  sport: 'nba' | 'pl' | 'nfl' | 'mlb';
  onCancel: () => void;
  onOpponentJoined: (duel: Duel) => void;
}

export default function WaitingForOpponentScreen({ duel, sport, onCancel, onOpponentJoined }: Props) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Start pulse animation
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
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

  const handleCancel = async () => {
    await cancelDuel(duel.id);
    onCancel();
  };

  const sportColor = getSportColor(sport as Sport);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Sport Icon */}
        <Animated.View style={[styles.iconContainer, { backgroundColor: sportColor, transform: [{ scale: pulseAnim }] }]}>
          <Image source={sportIcons[sport as Sport]} style={styles.sportIcon} />
        </Animated.View>

        <View style={[styles.sportBadge, { backgroundColor: sportColor }]}>
          <Image source={sportIcons[sport as Sport]} style={styles.sportBadgeIcon} resizeMode="contain" />
          <Text style={styles.sportBadgeText}>{sportNames[sport as Sport]}</Text>
        </View>
        <Text style={styles.title}>Trivia Duel</Text>

        <View style={styles.waitingContainer}>
          <ActivityIndicator size="large" color={sportColor} />
          <Text style={styles.waitingText}>Waiting for opponent...</Text>
          <Text style={styles.waitingSubtext}>
            You'll be matched with the next player who joins
          </Text>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>How it works</Text>
          <Text style={styles.infoText}>
            • Both players answer the same trivia question{'\n'}
            • You have 10 seconds to answer{'\n'}
            • Correct answer + fastest time wins{'\n'}
            • Winner earns 75 XP, loser earns 25 XP
          </Text>
        </View>

        <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
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
    marginTop: 12,
    marginBottom: 32,
  },
  sportBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  },
  sportBadgeIcon: {
    width: 20,
    height: 20,
  },
  sportBadgeText: {
    fontSize: 14,
    fontFamily: 'DMSans_900Black',
    color: '#FFFFFF',
  },
  waitingContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  waitingText: {
    fontSize: 20,
    fontFamily: 'DMSans_900Black',
    color: '#1A1A1A',
    marginTop: 24,
  },
  waitingSubtext: {
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
    color: '#888888',
    marginTop: 8,
    textAlign: 'center',
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
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
    color: '#1A1A1A',
    lineHeight: 22,
  },
  cancelButton: {
    backgroundColor: '#F2C94C',
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
    fontSize: 12,
    fontFamily: 'DMSans_900Black',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
