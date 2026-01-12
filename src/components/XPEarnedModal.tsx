import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Animated,
  Platform,
  Image,
  Linking,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { getXPForLevel } from '../lib/xpService';
import { soundService } from '../lib/soundService';

// Get level title based on level number
function getLevelTitle(level: number): string {
  if (level >= 100) return 'Hall of Famer';
  if (level >= 50) return 'Legend';
  if (level >= 40) return 'Master';
  if (level >= 30) return 'Expert';
  if (level >= 20) return 'Veteran';
  if (level >= 10) return 'Pro';
  if (level >= 5) return 'Rising Star';
  return 'Rookie';
}

interface Props {
  visible: boolean;
  xpEarned: number;
  previousXP: number;
  newXP: number;
  previousLevel: number;
  newLevel: number;
  onClose: () => void;
  sportColor?: string;
}

const TEAL_COLOR = '#1ABC9C';
const GRADIENT_COLORS = ['#C57AFB', '#F965B9'] as const;

export default function XPEarnedModal({
  visible,
  xpEarned,
  previousXP,
  newXP,
  previousLevel,
  newLevel,
  onClose,
}: Props) {
  const progressAnim = useRef(new Animated.Value(0)).current;
  const xpCountAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const xpBounceAnim = useRef(new Animated.Value(0)).current;
  const levelPulseAnim = useRef(new Animated.Value(1)).current;
  const [displayXP, setDisplayXP] = useState(previousXP);

  const leveledUp = newLevel > previousLevel;

  // Calculate progress within level
  const currentLevelXP = getXPForLevel(newLevel);
  const nextLevelXP = getXPForLevel(newLevel + 1);
  const xpIntoLevel = newXP - currentLevelXP;
  const xpNeededForNext = nextLevelXP - currentLevelXP;
  const progressPercent = Math.min(100, (xpIntoLevel / xpNeededForNext) * 100);

  // Previous progress (for animation start)
  const prevLevelXP = getXPForLevel(previousLevel);
  const prevNextLevelXP = getXPForLevel(previousLevel + 1);
  const prevXpIntoLevel = previousXP - prevLevelXP;
  const prevXpNeeded = prevNextLevelXP - prevLevelXP;
  const prevProgressPercent = leveledUp ? 0 : Math.min(100, (prevXpIntoLevel / prevXpNeeded) * 100);

  useEffect(() => {
    if (visible) {
      // Reset animations
      progressAnim.setValue(prevProgressPercent / 100);
      xpCountAnim.setValue(0);
      scaleAnim.setValue(0.8);
      opacityAnim.setValue(0);
      xpBounceAnim.setValue(0);
      levelPulseAnim.setValue(1);
      setDisplayXP(previousXP);

      // Haptic feedback
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      // Play sound will be triggered when bar starts filling

      // Entrance animation - scale and fade in together
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 6,
          tension: 100,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      // XP bounce animation (after modal appears)
      setTimeout(() => {
        Animated.sequence([
          Animated.spring(xpBounceAnim, {
            toValue: 1.2,
            friction: 3,
            tension: 200,
            useNativeDriver: true,
          }),
          Animated.spring(xpBounceAnim, {
            toValue: 1,
            friction: 4,
            useNativeDriver: true,
          }),
        ]).start();
      }, 200);

      // Delay before XP counter animation starts
      setTimeout(() => {
        // Play XP sound when bar starts filling
        soundService.playXP();

        // Animate XP counter
        Animated.timing(xpCountAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: false,
        }).start();

        // Animate progress bar
        Animated.timing(progressAnim, {
          toValue: progressPercent / 100,
          duration: 1000,
          useNativeDriver: false,
        }).start();

        // Pulse the level badge when bar fills
        if (leveledUp) {
          setTimeout(() => {
            // Play level up sound
            soundService.playLevelUp();

            Animated.sequence([
              Animated.timing(levelPulseAnim, {
                toValue: 1.15,
                duration: 150,
                useNativeDriver: true,
              }),
              Animated.spring(levelPulseAnim, {
                toValue: 1,
                friction: 4,
                useNativeDriver: true,
              }),
            ]).start();
          }, 800);
        }
      }, 400);
    }
  }, [visible]);

  // Update display XP as animation progresses
  useEffect(() => {
    const listener = xpCountAnim.addListener(({ value }) => {
      const currentXP = Math.round(previousXP + (newXP - previousXP) * value);
      setDisplayXP(currentXP);
    });
    return () => xpCountAnim.removeListener(listener);
  }, [previousXP, newXP]);

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  const xpScale = xpBounceAnim.interpolate({
    inputRange: [0, 1, 1.2],
    outputRange: [0.5, 1, 1.2],
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Animated.View
          style={[
            styles.content,
            {
              transform: [{ scale: scaleAnim }],
              opacity: opacityAnim,
            },
          ]}
        >
          {/* XP Earned Header with bounce animation */}
          <Text style={styles.xpEarnedLabel}>XP EARNED</Text>
          <Animated.Text
            style={[
              styles.xpEarnedValue,
              {
                transform: [{ scale: xpScale }],
              },
            ]}
          >
            +{xpEarned}
          </Animated.Text>

          {/* Level Badge with title */}
          <Animated.View
            style={[
              styles.levelSection,
              {
                transform: [{ scale: levelPulseAnim }],
              },
            ]}
          >
            <View style={styles.levelBadge}>
              <Text style={styles.levelLabel}>LEVEL</Text>
              <Text style={styles.levelNumber}>{newLevel}</Text>
            </View>
            <Text style={styles.levelTitle}>{getLevelTitle(newLevel)}</Text>
            {leveledUp && (
              <View style={styles.levelUpBadge}>
                <Text style={styles.levelUpText}>LEVEL UP!</Text>
              </View>
            )}
          </Animated.View>

          {/* Progress Bar - Matching home page style */}
          <View style={styles.progressSection}>
            <View style={styles.progressBar}>
              <Animated.View style={[styles.progressFillContainer, { width: progressWidth }]}>
                <LinearGradient
                  colors={[...GRADIENT_COLORS]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.progressFill}
                />
              </Animated.View>
            </View>
            <View style={styles.xpLabels}>
              <Text style={styles.currentXP}>{displayXP.toLocaleString()} XP</Text>
              <Text style={styles.nextLevelXP}>
                {nextLevelXP.toLocaleString()} XP
              </Text>
            </View>
          </View>

          {/* Presented By Ad Banner */}
          <View style={styles.presentedByContainer}>
            <Text style={styles.presentedByText}>Results presented by</Text>
            <TouchableOpacity
              style={styles.presentedByAdBanner}
              onPress={() => Linking.openURL('https://parlaysfordays.com')}
              activeOpacity={0.9}
            >
              <Image
                source={require('../../assets/images/ad-banner-parlays.png')}
                style={styles.presentedByAdImage}
                resizeMode="contain"
              />
            </TouchableOpacity>
          </View>

          {/* Continue Button */}
          <TouchableOpacity
            style={styles.button}
            onPress={() => {
              soundService.playButtonClick();
              onClose();
            }}
          >
            <Text style={styles.buttonText}>Continue</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  content: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#000000',
    padding: 28,
    alignItems: 'center',
    width: '100%',
    maxWidth: 320,
    shadowColor: '#000000',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  xpEarnedLabel: {
    fontSize: 12,
    fontFamily: 'DMSans_700Bold',
    color: '#888888',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  xpEarnedValue: {
    fontSize: 56,
    fontFamily: 'DMSans_900Black',
    color: TEAL_COLOR,
    marginBottom: 20,
  },
  levelSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  levelBadge: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 3,
    borderColor: '#000000',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  levelLabel: {
    fontSize: 10,
    fontFamily: 'DMSans_700Bold',
    color: '#888888',
    letterSpacing: 1,
    marginBottom: -2,
  },
  levelNumber: {
    fontSize: 36,
    fontFamily: 'DMSans_900Black',
    color: '#1A1A1A',
  },
  levelTitle: {
    fontSize: 16,
    fontFamily: 'DMSans_700Bold',
    color: '#666666',
    marginTop: 8,
  },
  levelUpBadge: {
    backgroundColor: '#F2C94C',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#000000',
    marginTop: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  levelUpText: {
    color: '#1A1A1A',
    fontSize: 14,
    fontFamily: 'DMSans_900Black',
    letterSpacing: 0.5,
  },
  progressSection: {
    width: '100%',
    marginBottom: 16,
  },
  progressBar: {
    height: 16,
    backgroundColor: '#E8E8E8',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#000000',
    marginBottom: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  progressFillContainer: {
    height: '100%',
    overflow: 'hidden',
    borderRadius: 6,
  },
  progressFill: {
    flex: 1,
    borderRadius: 6,
  },
  xpLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  currentXP: {
    fontSize: 13,
    fontFamily: 'DMSans_600SemiBold',
    color: '#1A1A1A',
  },
  nextLevelXP: {
    fontSize: 13,
    fontFamily: 'DMSans_500Medium',
    color: '#888888',
  },
  // Presented By Ad Banner styles
  presentedByContainer: {
    alignItems: 'center',
    marginBottom: 20,
    width: '100%',
  },
  presentedByText: {
    fontSize: 12,
    fontFamily: 'DMSans_400Regular',
    color: '#888888',
    marginBottom: 8,
  },
  presentedByAdBanner: {
    width: 280,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  presentedByAdImage: {
    width: 280,
    height: 44,
  },
  button: {
    backgroundColor: TEAL_COLOR,
    paddingHorizontal: 48,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#000000',
    width: '100%',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'DMSans_900Black',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
