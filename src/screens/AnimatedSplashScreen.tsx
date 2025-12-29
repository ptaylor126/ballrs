import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  Image,
} from 'react-native';
import * as SplashScreen from 'expo-splash-screen';

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
  const letterAnims = useRef(letters.map(() => new Animated.Value(-50))).current;
  const letterOpacities = useRef(letters.map(() => new Animated.Value(0))).current;

  // Icon animations - fade in only (no colored backgrounds)
  const iconOpacities = useRef(sportIcons.map(() => new Animated.Value(0))).current;
  const iconScales = useRef(sportIcons.map(() => new Animated.Value(0.8))).current;

  // Fade out animation
  const fadeOut = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Hide the native splash screen as our animated version takes over
    SplashScreen.hideAsync();

    // Animate letters sequentially sliding in from left
    const letterAnimations = letters.map((_, index) => {
      return Animated.parallel([
        Animated.timing(letterAnims[index], {
          toValue: 0,
          duration: 250,
          delay: index * 60,
          useNativeDriver: true,
        }),
        Animated.timing(letterOpacities[index], {
          toValue: 1,
          duration: 250,
          delay: index * 60,
          useNativeDriver: true,
        }),
      ]);
    });

    // Animate icons fading in with slight stagger
    const iconAnimations = sportIcons.map((_, index) => {
      return Animated.parallel([
        Animated.timing(iconOpacities[index], {
          toValue: 1,
          duration: 300,
          delay: 400 + index * 80,
          useNativeDriver: true,
        }),
        Animated.spring(iconScales[index], {
          toValue: 1,
          tension: 50,
          friction: 7,
          delay: 400 + index * 80,
          useNativeDriver: true,
        }),
      ]);
    });

    // Run all animations
    Animated.sequence([
      Animated.parallel(letterAnimations),
      Animated.parallel(iconAnimations),
      Animated.delay(600),
      Animated.timing(fadeOut, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onAnimationComplete();
    });
  }, []);

  return (
    <Animated.View style={[styles.container, { opacity: fadeOut }]}>
      {/* BALLRS Text - letters slide in from left */}
      <View style={styles.logoContainer}>
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
      </View>

      {/* Sport Icons - just icons, no colored backgrounds */}
      <View style={styles.iconsContainer}>
        {sportIcons.map((icon, index) => (
          <Animated.View
            key={index}
            style={[
              styles.iconWrapper,
              {
                opacity: iconOpacities[index],
                transform: [{ scale: iconScales[index] }],
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
    zIndex: 1000,
  },
  logoContainer: {
    position: 'absolute',
    top: 180,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  textContainer: {
    flexDirection: 'row',
  },
  letter: {
    fontSize: 48,
    fontFamily: 'DMSans_900Black',
    color: '#1A1A1A',
    letterSpacing: 2,
  },
  iconsContainer: {
    position: 'absolute',
    top: 290,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  iconWrapper: {
    width: 70,
    height: 70,
    justifyContent: 'center',
    alignItems: 'center',
  },
  icon: {
    width: 36,
    height: 36,
  },
});
