import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Share,
  Alert,
  Image,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Duel, subscribeToDuel, unsubscribeFromDuel, cancelDuel } from '../lib/duelService';
import { RealtimeChannel } from '@supabase/supabase-js';
import { getSportColor, Sport } from '../lib/theme';

const TEAL_COLOR = '#1ABC9C';

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

export default function InviteFriendScreen({ duel, sport, onCancel, onOpponentJoined }: Props) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const [codeCopied, setCodeCopied] = useState(false);

  const sportColor = getSportColor(sport as Sport);

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

  const handleCopyCode = async () => {
    if (!duel.invite_code) return;
    await Clipboard.setStringAsync(duel.invite_code);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  };

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
        {/* Centered Content */}
        <View style={styles.centeredContent}>
          {/* Sport Badge */}
          <View style={[styles.sportBadge, { backgroundColor: sportColor }]}>
            <Image source={sportIcons[sport as Sport]} style={styles.sportBadgeIcon} resizeMode="contain" />
            <Text style={styles.sportBadgeText}>{sportNames[sport as Sport]}</Text>
          </View>

          {/* Title */}
          <Text style={styles.title}>Challenge Friend</Text>

          {/* Invite Code Box - Large, Tappable */}
          <View style={styles.codeSection}>
            <Text style={styles.codeLabel}>YOUR INVITE CODE</Text>
            <TouchableOpacity
              style={styles.codeBox}
              onPress={handleCopyCode}
              activeOpacity={0.8}
            >
              <Text style={styles.code}>
                {duel.invite_code || '------'}
              </Text>
              {codeCopied && (
                <View style={styles.copiedBadge}>
                  <Text style={styles.copiedText}>Copied!</Text>
                </View>
              )}
            </TouchableOpacity>
            <Text style={styles.codeHint}>Tap to copy</Text>
          </View>

          {/* Share Button */}
          <TouchableOpacity
            style={styles.shareButton}
            onPress={handleShare}
            activeOpacity={0.8}
          >
            <Text style={styles.shareButtonText}>SHARE INVITE</Text>
          </TouchableOpacity>
        </View>

        {/* Cancel Button - Anchored to bottom */}
        <TouchableOpacity style={styles.cancelButton} onPress={handleCancel} activeOpacity={0.8}>
          <Text style={styles.cancelButtonText}>CANCEL</Text>
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
    paddingBottom: 32,
  },
  centeredContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  title: {
    fontSize: 28,
    fontFamily: 'DMSans_900Black',
    color: '#1A1A1A',
    marginTop: 20,
    marginBottom: 32,
  },
  codeSection: {
    alignItems: 'center',
    marginBottom: 24,
    width: '100%',
  },
  codeLabel: {
    fontSize: 12,
    fontFamily: 'DMSans_700Bold',
    color: '#888888',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  codeBox: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#000000',
    borderRadius: 16,
    paddingHorizontal: 40,
    paddingVertical: 24,
    shadowColor: '#000000',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
    alignItems: 'center',
  },
  code: {
    fontSize: 36,
    fontFamily: 'DMSans_900Black',
    color: '#1A1A1A',
    letterSpacing: 10,
  },
  copiedBadge: {
    position: 'absolute',
    top: -12,
    right: -12,
    backgroundColor: TEAL_COLOR,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#000000',
  },
  copiedText: {
    fontSize: 12,
    fontFamily: 'DMSans_700Bold',
    color: '#FFFFFF',
  },
  codeHint: {
    fontSize: 14,
    fontFamily: 'DMSans_500Medium',
    color: '#888888',
    marginTop: 12,
  },
  shareButton: {
    backgroundColor: TEAL_COLOR,
    paddingHorizontal: 48,
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#000000',
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
    width: '100%',
    alignItems: 'center',
  },
  shareButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'DMSans_900Black',
    letterSpacing: 0.5,
  },
  cancelButton: {
    backgroundColor: '#F2C94C',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#000000',
    alignItems: 'center',
    alignSelf: 'center',
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
    letterSpacing: 0.5,
  },
});
