import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { getXPForLevel } from '../lib/xpService';

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

export default function XPEarnedModal({
  visible,
  xpEarned,
  previousXP,
  newXP,
  previousLevel,
  newLevel,
  onClose,
  sportColor = '#E07A3D',
}: Props) {
  const progressAnim = useRef(new Animated.Value(0)).current;
  const xpCountAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
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
      scaleAnim.setValue(0.9);
      opacityAnim.setValue(0);
      setDisplayXP(previousXP);

      // Entrance animation - scale and fade in together
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 8,
          tension: 100,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      // Delay before XP animation starts
      setTimeout(() => {
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
      }, 300);
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
          {/* XP Earned Header */}
          <Text style={styles.xpEarnedLabel}>XP EARNED</Text>
          <Text style={[styles.xpEarnedValue, { color: sportColor }]}>
            +{xpEarned}
          </Text>

          {/* Level Badge */}
          <View style={styles.levelSection}>
            <View style={[styles.levelBadge, { borderColor: sportColor }]}>
              <Text style={[styles.levelNumber, { color: sportColor }]}>
                {newLevel}
              </Text>
            </View>
            {leveledUp && (
              <View style={styles.levelUpBadge}>
                <Text style={styles.levelUpText}>LEVEL UP!</Text>
              </View>
            )}
          </View>

          {/* Progress Bar */}
          <View style={styles.progressSection}>
            <View style={styles.progressBar}>
              <Animated.View
                style={[
                  styles.progressFillContainer,
                  { width: progressWidth },
                ]}
              >
                <LinearGradient
                  colors={['#C57AFB', '#F965B9']}
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

          {/* Continue Button */}
          <TouchableOpacity
            style={styles.button}
            onPress={onClose}
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
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  content: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#000000',
    padding: 24,
    alignItems: 'center',
    width: '100%',
    maxWidth: 320,
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  xpEarnedLabel: {
    fontSize: 12,
    fontFamily: 'DMSans_900Black',
    color: '#6B7280',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  xpEarnedValue: {
    fontSize: 48,
    fontFamily: 'DMSans_900Black',
    marginBottom: 20,
  },
  levelSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  levelBadge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  levelNumber: {
    fontSize: 32,
    fontFamily: 'DMSans_900Black',
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
    marginBottom: 24,
  },
  progressBar: {
    height: 16,
    backgroundColor: '#E8E8E8',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#000000',
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFillContainer: {
    height: '100%',
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
    fontSize: 14,
    fontFamily: 'DMSans_500Medium',
    color: '#1A1A1A',
  },
  nextLevelXP: {
    fontSize: 14,
    fontFamily: 'DMSans_500Medium',
    color: '#1A1A1A',
  },
  button: {
    backgroundColor: '#1ABC9C',
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
    fontSize: 12,
    fontFamily: 'DMSans_900Black',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
