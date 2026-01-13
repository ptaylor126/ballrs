import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Image,
} from 'react-native';
import { Achievement } from '../lib/achievementsService';

interface Props {
  achievement: Achievement | null;
  visible: boolean;
  onDismiss: () => void;
}

// Achievement icon mapping - maps achievement names to icon images
// Note: icon files are spelled "acheivement" (typo in filenames)
const achievementIcons: Record<string, any> = {
  // Puzzle achievements
  'First Victory': require('../../assets/images/achievements/acheivement-first-blood.png'),
  'First Blood': require('../../assets/images/achievements/acheivement-first-blood.png'),
  'Sharp Shooter': require('../../assets/images/achievements/acheivement-sharp-shooter.png'),
  'Perfect Game': require('../../assets/images/achievements/acheivement-sharp-shooter.png'),
  'On Fire': require('../../assets/images/achievements/acheivement-unstoppable.png'),
  'Week Warrior': require('../../assets/images/achievements/acheivement-unstoppable.png'),
  'Unstoppable': require('../../assets/images/achievements/acheivement-unstoppable.png'),
  'Monthly Master': require('../../assets/images/achievements/acheivement-unstoppable.png'),
  'Century': require('../../assets/images/achievements/acheivement-century.png'),
  'Puzzle Master': require('../../assets/images/achievements/acheivement-century.png'),
  'Puzzle Expert': require('../../assets/images/achievements/acheivement-century.png'),
  'Puzzle Enthusiast': require('../../assets/images/achievements/acheivement-century.png'),
  'Globe Trotter': require('../../assets/images/achievements/acheivement-globe-trotter.png'),

  // Duel achievements
  'Challenger': require('../../assets/images/achievements/acheivement-challenger.png'),
  'Duel Debut': require('../../assets/images/achievements/acheivement-challenger.png'),
  'Duelist': require('../../assets/images/achievements/acheivement-duelist.png'),
  'Duel Champion': require('../../assets/images/achievements/acheivement-duelist.png'),
  'Duel Legend': require('../../assets/images/achievements/acheivement-duelist.png'),
  'Underdog': require('../../assets/images/achievements/acheivement-underdog.png'),

  // Social achievements
  'Squad Up': require('../../assets/images/achievements/acheivement-squad-up.png'),
  'Social Starter': require('../../assets/images/achievements/acheivement-squad-up.png'),
  'Popular Player': require('../../assets/images/achievements/acheivement-squad-up.png'),
  'Team Player': require('../../assets/images/achievements/acheivement-squad-up.png'),
  'Recruiter': require('../../assets/images/achievements/acheivement-recruiter.png'),

  // Secret achievements
  'Night Owl': require('../../assets/images/achievements/acheivement-night-owl.png'),
  'Speed Demon': require('../../assets/images/achievements/acheivement-speed-demon.png'),
  'Perfectionist': require('../../assets/images/achievements/acheivement-perfectionist.png'),

  // Level achievements
  'Rising Star': require('../../assets/images/achievements/acheivement-challenger.png'),
  'Elite Status': require('../../assets/images/achievements/acheivement-challenger.png'),
};

// Default icon for unmapped achievements
const defaultIcon = require('../../assets/images/achievements/acheivement-challenger.png');

function getAchievementIcon(achievementName: string): any {
  return achievementIcons[achievementName] || defaultIcon;
}

export default function AchievementToast({ achievement, visible, onDismiss }: Props) {
  const slideAnim = useRef(new Animated.Value(-150)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible && achievement) {
      // Slide in
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      // Auto dismiss after 4 seconds
      const timer = setTimeout(() => {
        dismissToast();
      }, 4000);

      return () => clearTimeout(timer);
    }
  }, [visible, achievement]);

  const dismissToast = () => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: -150,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onDismiss();
    });
  };

  if (!achievement) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY: slideAnim }],
          opacity: opacityAnim,
        },
      ]}
    >
      <TouchableOpacity
        style={styles.toast}
        onPress={dismissToast}
        activeOpacity={0.9}
      >
        <View style={styles.iconContainer}>
          <Image
            source={getAchievementIcon(achievement.name)}
            style={styles.icon}
          />
        </View>
        <View style={styles.content}>
          <Text style={styles.title}>Achievement Unlocked!</Text>
          <Text style={styles.achievementName}>{achievement.name}</Text>
          <Text style={styles.xpReward}>+{achievement.xp_reward} XP</Text>
        </View>
        <View style={styles.shimmer} />
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 60,
    left: 16,
    right: 16,
    zIndex: 1000,
  },
  toast: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#F2C94C',
    shadowColor: '#000000',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 8,
    overflow: 'hidden',
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#1ABC9C',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
    borderWidth: 2,
    borderColor: '#000000',
  },
  icon: {
    width: 36,
    height: 36,
    resizeMode: 'contain',
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 11,
    color: '#F2C94C',
    fontFamily: 'DMSans_900Black',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  achievementName: {
    fontSize: 18,
    color: '#1A1A1A',
    fontFamily: 'DMSans_900Black',
    marginBottom: 2,
  },
  xpReward: {
    fontSize: 14,
    color: '#1ABC9C',
    fontFamily: 'DMSans_700Bold',
  },
  shimmer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: 100,
    backgroundColor: 'transparent',
  },
});
