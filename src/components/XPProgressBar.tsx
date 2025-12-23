import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
} from 'react-native';
import { getXPProgressInLevel, getXPForLevel } from '../lib/xpService';

interface Props {
  xp: number;
  level: number;
  showDetails?: boolean;
  compact?: boolean;
}

const colors = {
  background: '#1a1a2e',
  cardBackground: '#16213e',
  primary: '#e94560',
  accent: '#0f3460',
  textLight: '#ffffff',
  textMuted: '#94a3b8',
  gold: '#fbbf24',
  progressBg: '#334155',
};

export function getLevelTitle(level: number): string {
  if (level <= 5) return 'Rookie';
  if (level <= 10) return 'Starter';
  if (level <= 15) return 'Pro';
  if (level <= 20) return 'All-Star';
  if (level <= 25) return 'MVP';
  if (level <= 30) return 'Legend';
  return 'GOAT';
}

export function getLevelColor(level: number): string {
  if (level <= 5) return '#94a3b8'; // Gray - Rookie
  if (level <= 10) return '#22c55e'; // Green - Starter
  if (level <= 15) return '#3b82f6'; // Blue - Pro
  if (level <= 20) return '#8b5cf6'; // Purple - All-Star
  if (level <= 25) return '#f97316'; // Orange - MVP
  if (level <= 30) return '#fbbf24'; // Gold - Legend
  return '#ef4444'; // Red - GOAT
}

export default function XPProgressBar({ xp, level, showDetails = true, compact = false }: Props) {
  const progressAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const prevXPRef = useRef(xp);

  const progress = getXPProgressInLevel(xp);
  const nextLevelXP = getXPForLevel(level + 1);
  const currentLevelXP = getXPForLevel(level);
  const xpIntoLevel = xp - currentLevelXP;
  const xpNeededForNext = nextLevelXP - currentLevelXP;
  const levelColor = getLevelColor(level);

  useEffect(() => {
    const targetProgress = progress.percentage / 100;

    // If XP increased, animate with glow effect
    if (xp > prevXPRef.current) {
      // Glow animation
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: false,
        }),
        Animated.timing(glowAnim, {
          toValue: 0,
          duration: 500,
          useNativeDriver: false,
        }),
      ]).start();
    }

    // Progress bar animation
    Animated.timing(progressAnim, {
      toValue: targetProgress,
      duration: 500,
      useNativeDriver: false,
    }).start();

    prevXPRef.current = xp;
  }, [xp, progress.percentage]);

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.6],
  });

  if (compact) {
    return (
      <View style={styles.compactContainer}>
        <View style={styles.compactLevelBadge}>
          <Text style={[styles.compactLevelText, { color: levelColor }]}>{level}</Text>
        </View>
        <View style={styles.compactBarContainer}>
          <View style={styles.compactProgressBg}>
            <Animated.View
              style={[
                styles.compactProgressFill,
                {
                  width: progressWidth,
                  backgroundColor: levelColor,
                },
              ]}
            />
          </View>
          {showDetails && (
            <Text style={styles.compactXPText}>
              {xpIntoLevel}/{xpNeededForNext} XP
            </Text>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.levelContainer}>
          <Text style={styles.levelLabel}>Level</Text>
          <Text style={[styles.levelNumber, { color: levelColor }]}>{level}</Text>
        </View>
        {showDetails && (
          <View style={styles.xpContainer}>
            <Text style={styles.xpText}>
              {xpIntoLevel} / {xpNeededForNext} XP
            </Text>
          </View>
        )}
      </View>

      <View style={styles.progressContainer}>
        <View style={styles.progressBg}>
          <Animated.View
            style={[
              styles.progressFill,
              {
                width: progressWidth,
                backgroundColor: levelColor,
              },
            ]}
          />
          <Animated.View
            style={[
              styles.progressGlow,
              {
                width: progressWidth,
                backgroundColor: levelColor,
                opacity: glowOpacity,
              },
            ]}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 8,
  },
  levelContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  levelLabel: {
    fontSize: 14,
    color: colors.textMuted,
    fontWeight: '500',
  },
  levelNumber: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  xpContainer: {
    alignItems: 'flex-end',
  },
  xpText: {
    fontSize: 14,
    color: colors.textMuted,
    fontWeight: '500',
  },
  progressContainer: {
    position: 'relative',
  },
  progressBg: {
    height: 12,
    backgroundColor: colors.progressBg,
    borderRadius: 6,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 6,
  },
  progressGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: '100%',
    borderRadius: 6,
    shadowColor: '#fff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 10,
  },
  // Compact styles
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  compactLevelBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  compactLevelText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  compactBarContainer: {
    flex: 1,
  },
  compactProgressBg: {
    height: 8,
    backgroundColor: colors.progressBg,
    borderRadius: 4,
    overflow: 'hidden',
  },
  compactProgressFill: {
    height: '100%',
    borderRadius: 4,
  },
  compactXPText: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 4,
  },
});
