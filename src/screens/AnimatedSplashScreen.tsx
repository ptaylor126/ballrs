import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  Image,
} from 'react-native';

const { width, height } = Dimensions.get('window');

// Sport icons
const sportIcons = [
  require('../../assets/images/icon-basketball.png'),
  require('../../assets/images/icon-soccer.png'),
  require('../../assets/images/icon-football.png'),
  require('../../assets/images/icon-baseball.png'),
];

interface Props {
  onAnimationComplete: () => void;
}

export default function AnimatedSplashScreen({ onAnimationComplete }: Props) {
  // Letter animations - each letter slides in from the left
  const letters = ['B', 'A', 'L', 'L', 'R', 'S'];
  const letterAnims = useRef(letters.map(() => new Animated.Value(-100))).current;
  const letterOpacities = useRef(letters.map(() => new Animated.Value(0))).current;

  // Icon animations - each icon bounces up from below
  const iconAnims = useRef(sportIcons.map(() => new Animated.Value(100))).current;
  const iconOpacities = useRef(sportIcons.map(() => new Animated.Value(0))).current;
  const iconScales = useRef(sportIcons.map(() => new Animated.Value(0.5))).current;

  // Fade out animation
  const fadeOut = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Animate letters sequentially
    const letterAnimations = letters.map((_, index) => {
      return Animated.parallel([
        Animated.timing(letterAnims[index], {
          toValue: 0,
          duration: 300,
          delay: index * 80,
          useNativeDriver: true,
        }),
        Animated.timing(letterOpacities[index], {
          toValue: 1,
          duration: 300,
          delay: index * 80,
          useNativeDriver: true,
        }),
      ]);
    });

    // Animate icons with bounce effect
    const iconAnimations = sportIcons.map((_, index) => {
      return Animated.parallel([
        Animated.spring(iconAnims[index], {
          toValue: 0,
          tension: 50,
          friction: 7,
          delay: 500 + index * 100,
          useNativeDriver: true,
        }),
        Animated.timing(iconOpacities[index], {
          toValue: 1,
          duration: 200,
          delay: 500 + index * 100,
          useNativeDriver: true,
        }),
        Animated.spring(iconScales[index], {
          toValue: 1,
          tension: 50,
          friction: 7,
          delay: 500 + index * 100,
          useNativeDriver: true,
        }),
      ]);
    });

    // Run all animations
    Animated.sequence([
      Animated.parallel(letterAnimations),
      Animated.parallel(iconAnimations),
      Animated.delay(800),
      Animated.timing(fadeOut, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onAnimationComplete();
    });
  }, []);

  return (
    <Animated.View style={[styles.container, { opacity: fadeOut }]}>
      {/* BALLRS Text */}
      <View style={styles.textContainer}>
        {letters.map((letter, index) => (
          <Animated.Text
            key={index}
            style={[
              styles.letter,
              {
                transform: [{ translateX: letterAnims[index] }],
                opacity: letterOpacities[index],
              },
            ]}
          >
            {letter}
          </Animated.Text>
        ))}
      </View>

      {/* Sport Icons Row */}
      <View style={styles.iconsContainer}>
        {sportIcons.map((icon, index) => (
          <Animated.View
            key={index}
            style={[
              styles.iconWrapper,
              {
                transform: [
                  { translateY: iconAnims[index] },
                  { scale: iconScales[index] },
                ],
                opacity: iconOpacities[index],
              },
            ]}
          >
            <Image source={icon} style={styles.icon} resizeMode="contain" />
          </Animated.View>
        ))}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: width,
    height: height,
    backgroundColor: '#F5F2EB',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  textContainer: {
    flexDirection: 'row',
    marginBottom: 32,
  },
  letter: {
    fontSize: 56,
    fontFamily: 'DMSans_900Black',
    color: '#1A1A1A',
    marginHorizontal: 2,
  },
  iconsContainer: {
    flexDirection: 'row',
    gap: 16,
  },
  iconWrapper: {
    width: 40,
    height: 40,
  },
  icon: {
    width: 40,
    height: 40,
  },
});
