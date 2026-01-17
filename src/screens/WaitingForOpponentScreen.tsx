import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Linking,
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

// Banners
const feedbackBannerImage = require('../../assets/images/feedback-banner.png');

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
      {/* Feedback Banner at top */}
      <TouchableOpacity
        style={styles.adBanner}
        onPress={() => Linking.openURL('mailto:hello@ballrs.net')}
        activeOpacity={0.9}
      >
        <Image
          source={feedbackBannerImage}
          style={styles.adImage}
          resizeMode="contain"
        />
      </TouchableOpacity>

      <View style={styles.content}>
        {/* Sport Badge */}
        <View style={[styles.sportBadge, { backgroundColor: sportColor }]}>
          <Image source={sportIcons[sport as Sport]} style={styles.sportIcon} resizeMode="contain" />
        </View>

        {/* Title */}
        <Text style={styles.title}>Trivia Duel</Text>

        {/* Large Spinner */}
        <View style={styles.spinnerContainer}>
          <ActivityIndicator size="large" color={sportColor} />
        </View>

        {/* Waiting Text */}
        <Text style={styles.waitingText}>Waiting for opponent...</Text>
        <Text style={styles.waitingSubtext}>
          You'll be matched with the next player who joins
        </Text>

        {/* Brief Rules */}
        <Text style={styles.rulesText}>
          5 trivia questions • Same questions{'\n'}
          Most correct answers wins
        </Text>

        {/* Cancel Button */}
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
  adBanner: {
    flex: 1,
    marginTop: 16,
    marginHorizontal: 32,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
  },
  adImage: {
    width: '100%',
    height: '100%',
  },
  content: {
    flex: 2,
    padding: 24,
    paddingTop: 24,
    alignItems: 'center',
  },
  sportBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#000000',
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
    marginBottom: 16,
  },
  sportIcon: {
    width: 32,
    height: 32,
  },
  title: {
    fontSize: 28,
    fontFamily: 'DMSans_900Black',
    color: '#1A1A1A',
    marginBottom: 40,
  },
  spinnerContainer: {
    marginBottom: 24,
    transform: [{ scale: 1.6 }],
  },
  waitingText: {
    fontSize: 22,
    fontFamily: 'DMSans_900Black',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  waitingSubtext: {
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
    color: '#888888',
    textAlign: 'center',
    marginBottom: 24,
  },
  rulesText: {
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
    color: '#888888',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
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
