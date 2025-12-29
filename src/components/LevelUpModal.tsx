import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Animated,
  Easing,
  Image,
  TouchableWithoutFeedback,
} from 'react-native';
import ConfettiCannon from 'react-native-confetti-cannon';
import * as Haptics from 'expo-haptics';
import { AnimatedButton } from './AnimatedComponents';
import { soundService } from '../lib/soundService';

// Star icon for new title
const starIcon = require('../../assets/images/icon-lightning.png');

interface Unlock {
  type: 'frame' | 'icon';
  name: string;
}

interface Props {
  visible: boolean;
  newLevel: number;
  previousLevel: number;
  unlocks?: Unlock[];
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
function getNewTitleUnlocked(previousLevel: number, newLevel: number): string | null {
  const titleLevels: Record<number, string> = {
    5: 'Rising Star',
    10: 'Pro',
    20: 'Veteran',
    30: 'Expert',
    40: 'Master',
    50: 'Legend',
    100: 'Hall of Famer',
  };

  // Check if we crossed any title threshold
  for (const [levelStr, title] of Object.entries(titleLevels)) {
    const level = parseInt(levelStr);
    if (previousLevel < level && newLevel >= level) {
      return title;
    }
  }
  return null;
}

export default function LevelUpModal({ visible, newLevel, previousLevel, unlocks = [], onClose }: Props) {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const badgeScaleAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const [showConfetti, setShowConfetti] = useState(false);
  const autoDismissTimer = useRef<NodeJS.Timeout | null>(null);

  const newTitle = getNewTitleUnlocked(previousLevel, newLevel);

  useEffect(() => {
    if (visible) {
      // Reset animations
      scaleAnim.setValue(0);
      badgeScaleAnim.setValue(0);
      pulseAnim.setValue(1);
      glowAnim.setValue(0);
      setShowConfetti(false);

      // Haptic feedback - success notification
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Play celebratory sound
      soundService.playCorrect();

      // Play entrance animation
      Animated.sequence([
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 6,
          tension: 100,
          useNativeDriver: false, // Match other animations on same view
        }),
        Animated.spring(badgeScaleAnim, {
          toValue: 1,
          friction: 4,
          tension: 80,
          useNativeDriver: false, // Match other animations on same view
        }),
      ]).start(() => {
        // Start pulse animation after entrance
        startPulseAnimation();
        startGlowAnimation();
      });

      // Trigger confetti after a short delay
      setTimeout(() => setShowConfetti(true), 200);

      // Auto-dismiss after 5 seconds
      autoDismissTimer.current = setTimeout(() => {
        handleClose();
      }, 5000);

      return () => {
        if (autoDismissTimer.current) {
          clearTimeout(autoDismissTimer.current);
        }
      };
    }
  }, [visible]);

  const startPulseAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.08,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false, // Must match glow animation driver
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false, // Must match glow animation driver
        }),
      ])
    ).start();
  };

  const startGlowAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
        Animated.timing(glowAnim, {
          toValue: 0,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
      ])
    ).start();
  };

  const handleClose = () => {
    // Light haptic on button press
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (autoDismissTimer.current) {
      clearTimeout(autoDismissTimer.current);
    }

    // Stop animations
    pulseAnim.stopAnimation();
    glowAnim.stopAnimation();

    onClose();
  };

  // Interpolate glow for shadow
  const glowShadowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.8],
  });

  const glowShadowRadius = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 15],
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <TouchableWithoutFeedback onPress={handleClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <Animated.View
              style={[
                styles.content,
                {
                  transform: [{ scale: scaleAnim }],
                },
              ]}
            >
              {/* Level Badge with pulse and glow */}
              <Animated.View
                style={[
                  styles.levelBadge,
                  {
                    transform: [
                      { scale: Animated.multiply(badgeScaleAnim, pulseAnim) },
                    ],
                    shadowOpacity: glowShadowOpacity,
                    shadowRadius: glowShadowRadius,
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
                <View style={styles.newTitleRow}>
                  <Image source={starIcon} style={styles.starIcon} />
                  <Text style={styles.newTitle}>
                    New title: {newTitle}
                  </Text>
                </View>
              )}

              {/* Unlocks */}
              {unlocks.map((unlock, index) => (
                <View key={index} style={styles.unlockRow}>
                  <Text style={styles.unlockText}>
                    Unlocked: {unlock.name}!
                  </Text>
                </View>
              ))}

              {/* Awesome Button */}
              <AnimatedButton style={styles.button} onPress={handleClose}>
                <Text style={styles.buttonText}>AWESOME!</Text>
              </AnimatedButton>
            </Animated.View>
          </TouchableWithoutFeedback>

          {/* Confetti */}
          {showConfetti && (
            <ConfettiCannon
              count={80}
              origin={{ x: -10, y: 0 }}
              autoStart={true}
              fadeOut={true}
              fallSpeed={2500}
              explosionSpeed={350}
              colors={['#F2C94C', '#1ABC9C', '#FFFFFF', '#1A1A1A', '#C57AFB']}
              onAnimationEnd={() => setShowConfetti(false)}
            />
          )}
        </View>
      </TouchableWithoutFeedback>
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
    shadowColor: '#1ABC9C',
    shadowOffset: { width: 0, height: 0 },
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
    marginBottom: 12,
  },
  newTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  starIcon: {
    width: 18,
    height: 18,
    marginRight: 6,
    tintColor: '#F2C94C',
  },
  newTitle: {
    fontSize: 16,
    fontFamily: 'DMSans_700Bold',
    color: '#F2C94C',
  },
  unlockRow: {
    marginBottom: 6,
  },
  unlockText: {
    fontSize: 14,
    fontFamily: 'DMSans_500Medium',
    color: '#1ABC9C',
  },
  button: {
    backgroundColor: '#F2C94C',
    paddingHorizontal: 40,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#000000',
    marginTop: 20,
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
