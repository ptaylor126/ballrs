import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Animated,
  Easing,
} from 'react-native';
import ConfettiCannon from 'react-native-confetti-cannon';
import { AnimatedButton } from './AnimatedComponents';

interface Props {
  visible: boolean;
  newLevel: number;
  onClose: () => void;
}

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

// Check if a new title was unlocked at this level
function getNewTitleUnlocked(level: number): string | null {
  const titleLevels: Record<number, string> = {
    5: 'Rising Star',
    10: 'Pro',
    20: 'Veteran',
    30: 'Expert',
    40: 'Master',
    50: 'Legend',
    100: 'Hall of Famer',
  };
  return titleLevels[level] || null;
}

export default function LevelUpModal({ visible, newLevel, onClose }: Props) {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const badgeScaleAnim = useRef(new Animated.Value(0)).current;
  const [showConfetti, setShowConfetti] = useState(false);

  const newTitle = getNewTitleUnlocked(newLevel);

  useEffect(() => {
    if (visible) {
      // Reset animations
      scaleAnim.setValue(0);
      badgeScaleAnim.setValue(0);
      setShowConfetti(false);

      // Play entrance animation
      Animated.sequence([
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 6,
          tension: 100,
          useNativeDriver: true,
        }),
        Animated.spring(badgeScaleAnim, {
          toValue: 1,
          friction: 4,
          tension: 80,
          useNativeDriver: true,
        }),
      ]).start();

      // Trigger confetti after a short delay
      setTimeout(() => setShowConfetti(true), 200);
    }
  }, [visible]);

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
          {/* Level Badge */}
          <Animated.View
            style={[
              styles.levelBadge,
              {
                transform: [{ scale: badgeScaleAnim }],
              },
            ]}
          >
            <Text style={styles.levelNumber}>{newLevel}</Text>
          </Animated.View>

          {/* Level Up Title */}
          <Text style={styles.title}>LEVEL UP!</Text>

          {/* Subtitle */}
          <Text style={styles.subtitle}>
            You reached Level {newLevel}!
          </Text>

          {/* New Title Unlocked */}
          {newTitle && (
            <Text style={styles.newTitle}>
              New title: {newTitle}
            </Text>
          )}

          {/* Awesome Button */}
          <AnimatedButton style={styles.button} onPress={onClose}>
            <Text style={styles.buttonText}>AWESOME!</Text>
          </AnimatedButton>
        </Animated.View>

        {/* Confetti */}
        {showConfetti && (
          <ConfettiCannon
            count={60}
            origin={{ x: -10, y: 0 }}
            autoStart={true}
            fadeOut={true}
            fallSpeed={2500}
            explosionSpeed={300}
            colors={['#F2C94C', '#1ABC9C', '#FFFFFF', '#1A1A1A']}
            onAnimationEnd={() => setShowConfetti(false)}
          />
        )}
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
    padding: 32,
    alignItems: 'center',
    width: '100%',
    maxWidth: 300,
    shadowColor: '#000000',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  levelBadge: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#1ABC9C',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#000000',
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  levelNumber: {
    fontSize: 48,
    fontFamily: 'DMSans_900Black',
    color: '#FFFFFF',
  },
  title: {
    fontSize: 28,
    fontFamily: 'DMSans_900Black',
    color: '#1A1A1A',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 18,
    fontFamily: 'DMSans_500Medium',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  newTitle: {
    fontSize: 16,
    fontFamily: 'DMSans_500Medium',
    color: '#888888',
    marginBottom: 8,
  },
  button: {
    backgroundColor: '#F2C94C',
    paddingHorizontal: 40,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#000000',
    marginTop: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  buttonText: {
    color: '#1A1A1A',
    fontSize: 14,
    fontFamily: 'DMSans_900Black',
    letterSpacing: 0.5,
  },
});
