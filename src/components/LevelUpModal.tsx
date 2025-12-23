import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Animated,
} from 'react-native';

interface Props {
  visible: boolean;
  newLevel: number;
  onClose: () => void;
}

const colors = {
  background: '#1a1a2e',
  cardBackground: '#16213e',
  primary: '#e94560',
  accent: '#0f3460',
  textLight: '#ffffff',
  textMuted: '#94a3b8',
  gold: '#fbbf24',
  purple: '#8b5cf6',
};

export default function LevelUpModal({ visible, newLevel, onClose }: Props) {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      // Reset animations
      scaleAnim.setValue(0);
      rotateAnim.setValue(0);
      glowAnim.setValue(0);

      // Play entrance animation
      Animated.sequence([
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 4,
          tension: 100,
          useNativeDriver: true,
        }),
        Animated.parallel([
          Animated.timing(rotateAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.loop(
            Animated.sequence([
              Animated.timing(glowAnim, {
                toValue: 1,
                duration: 1000,
                useNativeDriver: true,
              }),
              Animated.timing(glowAnim, {
                toValue: 0,
                duration: 1000,
                useNativeDriver: true,
              }),
            ])
          ),
        ]),
      ]).start();
    }
  }, [visible]);

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.5, 1],
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
            },
          ]}
        >
          {/* Celebration effects */}
          <View style={styles.celebrationContainer}>
            <Text style={styles.confetti}>🎊</Text>
            <Text style={[styles.confetti, styles.confettiLeft]}>🎉</Text>
            <Text style={[styles.confetti, styles.confettiRight]}>🎉</Text>
          </View>

          <Text style={styles.title}>LEVEL UP!</Text>

          {/* Level badge */}
          <Animated.View
            style={[
              styles.levelBadge,
              {
                transform: [{ rotate: spin }],
                opacity: glowOpacity,
              },
            ]}
          >
            <View style={styles.levelBadgeInner}>
              <Text style={styles.levelNumber}>{newLevel}</Text>
            </View>
          </Animated.View>

          <Text style={styles.subtitle}>
            You reached Level {newLevel}!
          </Text>

          <Text style={styles.encouragement}>
            {newLevel < 5 && "You're just getting started!"}
            {newLevel >= 5 && newLevel < 10 && "You're on fire!"}
            {newLevel >= 10 && newLevel < 20 && "Impressive progress!"}
            {newLevel >= 20 && newLevel < 50 && "You're a legend!"}
            {newLevel >= 50 && "ULTIMATE PLAYER!"}
          </Text>

          <TouchableOpacity style={styles.button} onPress={onClose}>
            <Text style={styles.buttonText}>Awesome!</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  content: {
    backgroundColor: colors.cardBackground,
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    width: '100%',
    maxWidth: 320,
    borderWidth: 2,
    borderColor: colors.gold,
  },
  celebrationContainer: {
    position: 'absolute',
    top: -20,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  confetti: {
    fontSize: 40,
  },
  confettiLeft: {
    position: 'absolute',
    left: 20,
  },
  confettiRight: {
    position: 'absolute',
    right: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.gold,
    marginTop: 20,
    marginBottom: 24,
    textShadowColor: colors.gold,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  levelBadge: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.gold,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 20,
    elevation: 10,
  },
  levelBadgeInner: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.cardBackground,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: colors.gold,
  },
  levelNumber: {
    fontSize: 48,
    fontWeight: 'bold',
    color: colors.gold,
  },
  subtitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.textLight,
    marginBottom: 8,
  },
  encouragement: {
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: 24,
  },
  button: {
    backgroundColor: colors.gold,
    paddingHorizontal: 48,
    paddingVertical: 14,
    borderRadius: 12,
  },
  buttonText: {
    color: colors.cardBackground,
    fontSize: 18,
    fontWeight: 'bold',
  },
});
