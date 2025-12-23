import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Animated,
  Easing,
  Image,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, shadows, spacing, borderRadius, borders, typography } from '../lib/theme';

const { width } = Dimensions.get('window');
const ONBOARDING_KEY = '@ballrs_onboarding_complete';

// Sport icons
const sportIcons = {
  nba: require('../../assets/images/icon-basketball.png'),
  pl: require('../../assets/images/icon-soccer.png'),
  nfl: require('../../assets/images/icon-football.png'),
  mlb: require('../../assets/images/icon-baseball.png'),
};

// Fire icon for streak
const fireIcon = require('../../assets/images/icon-fire.png');

interface OnboardingScreenProps {
  onComplete: () => void;
}

// Animated Dot Component
function AnimatedDot({ active }: { active: boolean }) {
  const scaleAnim = useRef(new Animated.Value(active ? 1.4 : 1)).current;
  const opacityAnim = useRef(new Animated.Value(active ? 1 : 0.4)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: active ? 1.4 : 1,
        friction: 5,
        tension: 100,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: active ? 1 : 0.4,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, [active]);

  return (
    <Animated.View
      style={[
        styles.dot,
        {
          transform: [{ scale: scaleAnim }],
          opacity: opacityAnim,
        },
      ]}
    />
  );
}

// Floating Ball Component (continuous bobbing)
function FloatingBall({
  delay,
  children,
  style,
}: {
  delay: number;
  children: React.ReactNode;
  style?: any;
}) {
  const translateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animate = () => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(translateY, {
            toValue: -8,
            duration: 1200,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(translateY, {
            toValue: 8,
            duration: 1200,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ])
      ).start();
    };

    // Start from a random position in the cycle based on delay
    translateY.setValue(delay % 2 === 0 ? -4 : 4);
    const timeout = setTimeout(animate, delay);
    return () => clearTimeout(timeout);
  }, [delay]);

  return (
    <Animated.View style={[style, { transform: [{ translateY }] }]}>
      {children}
    </Animated.View>
  );
}

// Fade In Component
function FadeIn({
  delay = 0,
  children,
  style,
}: {
  delay?: number;
  children: React.ReactNode;
  style?: any;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    const timeout = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.spring(translateY, {
          toValue: 0,
          friction: 8,
          tension: 100,
          useNativeDriver: true,
        }),
      ]).start();
    }, delay);

    return () => clearTimeout(timeout);
  }, [delay]);

  return (
    <Animated.View style={[style, { opacity, transform: [{ translateY }] }]}>
      {children}
    </Animated.View>
  );
}

// Pulsing Element Component
function PulsingElement({ children, style }: { children: React.ReactNode; style?: any }) {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 1.1,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  return (
    <Animated.View style={[style, { transform: [{ scale }] }]}>
      {children}
    </Animated.View>
  );
}

// Bouncing Icon Component
function BouncingIcon({
  delay = 0,
  children,
  style,
}: {
  delay?: number;
  children: React.ReactNode;
  style?: any;
}) {
  const scale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const timeout = setTimeout(() => {
      Animated.spring(scale, {
        toValue: 1,
        friction: 4,
        tension: 100,
        useNativeDriver: true,
      }).start();
    }, delay);

    return () => clearTimeout(timeout);
  }, [delay]);

  return (
    <Animated.View style={[style, { transform: [{ scale }] }]}>
      {children}
    </Animated.View>
  );
}

// Animated Button Component with press effect
function AnimatedButton({
  onPress,
  children,
  style,
}: {
  onPress: () => void;
  children: React.ReactNode;
  style?: any;
}) {
  const pressAnim = useRef(new Animated.Value(0)).current;

  const handlePressIn = () => {
    Animated.timing(pressAnim, {
      toValue: 1,
      duration: 100,
      useNativeDriver: false,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(pressAnim, {
      toValue: 0,
      friction: 5,
      tension: 100,
      useNativeDriver: false,
    }).start();
  };

  const translateX = pressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 2],
  });

  const translateY = pressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 2],
  });

  const shadowOffsetX = pressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [2, 0],
  });

  const shadowOffsetY = pressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [2, 0],
  });

  return (
    <TouchableOpacity
      activeOpacity={1}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      <Animated.View
        style={[
          styles.button,
          style,
          {
            transform: [{ translateX }, { translateY }],
            shadowOffset: { width: shadowOffsetX as any, height: shadowOffsetY as any },
          },
        ]}
      >
        <Text style={styles.buttonText}>{children}</Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

// Screen 1: Welcome
function WelcomeScreen() {
  return (
    <View style={styles.screen}>
      <FadeIn delay={0} style={styles.logoContainer}>
        <Text style={styles.logo}>BALLRS</Text>
      </FadeIn>

      <View style={styles.ballsContainer}>
        <FloatingBall delay={0} style={[styles.ball, styles.ballNBA]}>
          <Image source={sportIcons.nba} style={styles.ballIcon} />
        </FloatingBall>
        <FloatingBall delay={300} style={[styles.ball, styles.ballPL]}>
          <Image source={sportIcons.pl} style={styles.ballIcon} />
        </FloatingBall>
        <FloatingBall delay={600} style={[styles.ball, styles.ballNFL]}>
          <Image source={sportIcons.nfl} style={styles.ballIcon} />
        </FloatingBall>
        <FloatingBall delay={900} style={[styles.ball, styles.ballMLB]}>
          <Image source={sportIcons.mlb} style={styles.ballIcon} />
        </FloatingBall>
      </View>

      <FadeIn delay={300} style={styles.textContainer}>
        <Text style={styles.title}>Who's the player?</Text>
        <Text style={styles.subtitle}>New mystery athlete every day</Text>
      </FadeIn>
    </View>
  );
}

// Screen 2: Daily Challenge (HERO SCREEN)
function DailyChallengeScreen() {
  const clueRevealAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Animate clues revealing one by one
    Animated.timing(clueRevealAnim, {
      toValue: 1,
      duration: 2000,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start();
  }, []);

  return (
    <View style={styles.screen}>
      <FadeIn delay={0}>
        <Text style={styles.heroTitle}>GUESS THE PLAYER</Text>
        <Text style={styles.heroSubtitle}>A new mystery athlete every day</Text>
      </FadeIn>

      <FadeIn delay={100} style={styles.heroCardContainer}>
        <View style={styles.heroCard}>
          <PulsingElement>
            <View style={styles.heroSilhouette}>
              <Text style={styles.heroQuestionMark}>?</Text>
            </View>
          </PulsingElement>

          <View style={styles.clueProgressContainer}>
            {[1, 2, 3, 4, 5, 6].map((num) => (
              <BouncingIcon key={num} delay={200 + num * 100}>
                <View style={[
                  styles.clueBox,
                  num <= 2 && styles.clueBoxRevealed
                ]}>
                  <Text style={[
                    styles.clueBoxText,
                    num <= 2 && styles.clueBoxTextRevealed
                  ]}>{num}</Text>
                </View>
              </BouncingIcon>
            ))}
          </View>
        </View>
      </FadeIn>

      <FadeIn delay={400} style={styles.bulletPointsContainer}>
        <View style={styles.bulletPoint}>
          <Text style={styles.bulletIcon}>🎯</Text>
          <Text style={styles.bulletText}>6 clues to guess the athlete</Text>
        </View>
        <View style={styles.bulletPoint}>
          <Text style={styles.bulletIcon}>⚡</Text>
          <Text style={styles.bulletText}>Fewer clues = more points</Text>
        </View>
        <View style={styles.bulletPoint}>
          <Text style={styles.bulletIcon}>🌙</Text>
          <Text style={styles.bulletText}>New puzzle at midnight</Text>
        </View>
      </FadeIn>

      <FadeIn delay={600}>
        <View style={styles.sportIconsRow}>
          <BouncingIcon delay={700}>
            <View style={[styles.sportIcon, { backgroundColor: colors.nba }]}>
              <Image source={sportIcons.nba} style={styles.sportIconImage} />
            </View>
          </BouncingIcon>
          <BouncingIcon delay={800}>
            <View style={[styles.sportIcon, { backgroundColor: colors.pl }]}>
              <Image source={sportIcons.pl} style={styles.sportIconImage} />
            </View>
          </BouncingIcon>
          <BouncingIcon delay={900}>
            <View style={[styles.sportIcon, { backgroundColor: colors.nfl }]}>
              <Image source={sportIcons.nfl} style={styles.sportIconImage} />
            </View>
          </BouncingIcon>
          <BouncingIcon delay={1000}>
            <View style={[styles.sportIcon, { backgroundColor: colors.mlb }]}>
              <Image source={sportIcons.mlb} style={styles.sportIconImage} />
            </View>
          </BouncingIcon>
        </View>
        <Text style={styles.sportLabel}>4 sports. 4 daily puzzles.</Text>
      </FadeIn>
    </View>
  );
}

// Screen 3: Build Your Streak
function StreakScreen() {
  const streakCount = useRef(new Animated.Value(0)).current;
  const [displayCount, setDisplayCount] = useState(0);

  useEffect(() => {
    const listener = streakCount.addListener(({ value }) => {
      setDisplayCount(Math.round(value));
    });

    Animated.timing(streakCount, {
      toValue: 12,
      duration: 1500,
      easing: Easing.out(Easing.ease),
      useNativeDriver: false,
    }).start();

    return () => streakCount.removeListener(listener);
  }, []);

  return (
    <View style={styles.screen}>
      <FadeIn delay={0}>
        <Text style={styles.screenTitle}>Build Your Streak</Text>
        <Text style={styles.screenSubtitle}>Play every day. Don't break the chain!</Text>
      </FadeIn>

      <FadeIn delay={200} style={styles.streakContainer}>
        <View style={styles.streakCard}>
          <FloatingBall delay={0}>
            <Image source={fireIcon} style={styles.streakFireIcon} />
          </FloatingBall>
          <Text style={styles.streakNumber}>{displayCount}</Text>
          <Text style={styles.streakLabel}>DAY STREAK</Text>
        </View>
      </FadeIn>

      <FadeIn delay={400} style={styles.streakDaysContainer}>
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, index) => (
          <BouncingIcon key={index} delay={500 + index * 80}>
            <View style={[
              styles.streakDay,
              index < 5 && styles.streakDayComplete
            ]}>
              <Text style={[
                styles.streakDayText,
                index < 5 && styles.streakDayTextComplete
              ]}>{day}</Text>
              {index < 5 && <Text style={styles.streakDayCheck}>✓</Text>}
            </View>
          </BouncingIcon>
        ))}
      </FadeIn>

      <FadeIn delay={800} style={styles.textContainer}>
        <View style={styles.streakInfoCard}>
          <Text style={styles.streakInfoText}>
            Everyone plays the same puzzle each day
          </Text>
          <Text style={styles.streakInfoSubtext}>
            Compare scores with friends!
          </Text>
        </View>
      </FadeIn>
    </View>
  );
}

// Screen 4: Challenge Friends
function ChallengeFriendsScreen() {
  return (
    <View style={styles.screen}>
      <FadeIn delay={0}>
        <Text style={styles.screenTitle}>Challenge Friends</Text>
      </FadeIn>

      <FadeIn delay={100} style={styles.vsContainer}>
        <View style={styles.playerCard}>
          <Text style={styles.playerEmoji}>👤</Text>
          <Text style={styles.playerLabel}>YOU</Text>
        </View>
        <PulsingElement style={styles.vsCircle}>
          <Text style={styles.vsText}>VS</Text>
        </PulsingElement>
        <View style={styles.playerCard}>
          <Text style={styles.playerEmoji}>👤</Text>
          <Text style={styles.playerLabel}>FRIEND</Text>
        </View>
      </FadeIn>

      <FadeIn delay={200} style={styles.bulletPointsContainer}>
        <View style={styles.bulletPoint}>
          <Text style={styles.bulletIcon}>⚔️</Text>
          <Text style={styles.bulletText}>Head-to-head trivia duels</Text>
        </View>
        <View style={styles.bulletPoint}>
          <Text style={styles.bulletIcon}>🏆</Text>
          <Text style={styles.bulletText}>Create or join leagues</Text>
        </View>
        <View style={styles.bulletPoint}>
          <Text style={styles.bulletIcon}>📊</Text>
          <Text style={styles.bulletText}>Climb the leaderboards</Text>
        </View>
      </FadeIn>

      <View style={styles.statsRow}>
        <BouncingIcon delay={400}>
          <View style={styles.statBadge}>
            <Text style={styles.statBadgeEmoji}>⭐</Text>
            <Text style={styles.statBadgeText}>Earn XP</Text>
          </View>
        </BouncingIcon>
        <BouncingIcon delay={500}>
          <View style={styles.statBadge}>
            <Text style={styles.statBadgeEmoji}>📈</Text>
            <Text style={styles.statBadgeText}>Level Up</Text>
          </View>
        </BouncingIcon>
        <BouncingIcon delay={600}>
          <View style={styles.statBadge}>
            <Text style={styles.statBadgeEmoji}>🎖️</Text>
            <Text style={styles.statBadgeText}>Achievements</Text>
          </View>
        </BouncingIcon>
      </View>
    </View>
  );
}

// Screen 5: Get Started
function GetStartedScreen() {
  const checkScale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(checkScale, {
      toValue: 1,
      friction: 4,
      tension: 100,
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <View style={styles.screen}>
      <FadeIn delay={0}>
        <Text style={styles.screenTitle}>Ready to Play?</Text>
      </FadeIn>

      <View style={styles.celebrationContainer}>
        <Animated.View style={[styles.checkmarkCircle, { transform: [{ scale: checkScale }] }]}>
          <Text style={styles.checkmarkEmoji}>✓</Text>
        </Animated.View>

        <FloatingBall delay={200} style={styles.confetti1}>
          <Text style={styles.confettiEmoji}>🎉</Text>
        </FloatingBall>
        <FloatingBall delay={400} style={styles.confetti2}>
          <Text style={styles.confettiEmoji}>🎊</Text>
        </FloatingBall>
        <FloatingBall delay={600} style={styles.confetti3}>
          <Text style={styles.confettiEmoji}>⭐</Text>
        </FloatingBall>
      </View>

      <FadeIn delay={200} style={styles.textContainer}>
        <Text style={styles.getStartedText}>Today's puzzle is waiting</Text>
        <Text style={styles.finalSubtitle}>Join thousands of sports fans playing daily</Text>
      </FadeIn>
    </View>
  );
}

export default function OnboardingScreen({ onComplete }: OnboardingScreenProps) {
  const [currentPage, setCurrentPage] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);

  const handleScroll = (event: any) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const page = Math.round(offsetX / width);
    if (page >= 0 && page <= 4 && page !== currentPage) {
      setCurrentPage(page);
    }
  };

  const handleNext = () => {
    if (currentPage < 4) {
      const nextPage = currentPage + 1;
      scrollViewRef.current?.scrollTo({ x: nextPage * width, animated: true });
      setCurrentPage(nextPage);
    } else {
      handleComplete();
    }
  };

  const handleBack = () => {
    if (currentPage > 0) {
      const prevPage = currentPage - 1;
      scrollViewRef.current?.scrollTo({ x: prevPage * width, animated: true });
      setCurrentPage(prevPage);
    }
  };

  const handleComplete = async () => {
    await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    onComplete();
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Back Button */}
      {currentPage > 0 && (
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
      )}

      {/* Skip Button */}
      <TouchableOpacity style={styles.skipButton} onPress={handleComplete}>
        <Text style={styles.skipText}>Skip</Text>
      </TouchableOpacity>

      {/* Swipeable Screens */}
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        onMomentumScrollEnd={handleScroll}
        scrollEventThrottle={16}
        bounces={false}
      >
        <WelcomeScreen />
        <DailyChallengeScreen />
        <StreakScreen />
        <ChallengeFriendsScreen />
        <GetStartedScreen />
      </ScrollView>

      {/* Bottom Section */}
      <View style={styles.bottomSection}>
        {/* Dot Indicators */}
        <View style={styles.dotsContainer}>
          {[0, 1, 2, 3, 4].map((i) => (
            <AnimatedDot key={i} active={currentPage === i} />
          ))}
        </View>

        {/* Next/Get Started Button */}
        <TouchableOpacity
          style={[styles.button, currentPage === 4 && styles.getStartedButton]}
          onPress={handleNext}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonText}>
            {currentPage === 4 ? 'Get Started' : 'Next'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  backButton: {
    position: 'absolute',
    top: 56,
    left: 20,
    zIndex: 10,
    backgroundColor: '#F2C94C',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#000000',
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  backText: {
    color: '#1A1A1A',
    fontSize: 12,
    fontFamily: 'DMSans_900Black',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  skipButton: {
    position: 'absolute',
    top: 56,
    right: 20,
    zIndex: 10,
    backgroundColor: '#F2C94C',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#000000',
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  skipText: {
    color: '#1A1A1A',
    fontSize: 12,
    fontFamily: 'DMSans_900Black',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  screen: {
    width,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: 60,
  },

  // Logo & Welcome
  logoContainer: {
    marginBottom: spacing.xl,
  },
  logo: {
    fontSize: 48,
    fontFamily: 'DMSans_900Black',
    color: colors.text,
    letterSpacing: 2,
  },

  // Floating Balls
  ballsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: spacing.xl,
    height: 120,
  },
  ball: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: spacing.sm,
    borderWidth: borders.card,
    borderColor: colors.border,
    ...shadows.card,
  },
  ballNBA: { backgroundColor: colors.nba },
  ballPL: { backgroundColor: colors.pl },
  ballNFL: { backgroundColor: colors.nfl },
  ballMLB: { backgroundColor: colors.mlb },
  ballIcon: {
    width: 36,
    height: 36,
  },

  // Text
  textContainer: {
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  title: {
    ...typography.h1,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  screenTitle: {
    fontSize: 28,
    fontFamily: 'DMSans_900Black',
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  screenSubtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  description: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  descriptionBold: {
    ...typography.h3,
    color: colors.text,
    textAlign: 'center',
  },
  finalSubtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  getStartedText: {
    fontSize: 20,
    fontFamily: 'DMSans_700Bold',
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },

  // Hero Screen (Daily Challenge)
  heroTitle: {
    fontSize: 32,
    fontFamily: 'DMSans_900Black',
    color: colors.text,
    textAlign: 'center',
    letterSpacing: 1,
  },
  heroSubtitle: {
    fontSize: 16,
    fontFamily: 'DMSans_500Medium',
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  heroCardContainer: {
    marginVertical: spacing.md,
  },
  heroCard: {
    backgroundColor: colors.surface,
    borderWidth: borders.card,
    borderColor: colors.border,
    borderRadius: borderRadius.card,
    padding: spacing.lg,
    alignItems: 'center',
    width: width * 0.8,
    ...shadows.card,
  },
  heroSilhouette: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
    borderWidth: 3,
    borderColor: colors.border,
  },
  heroQuestionMark: {
    fontSize: 50,
    fontFamily: 'DMSans_900Black',
    color: colors.accent,
  },
  clueProgressContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  clueBox: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  clueBoxRevealed: {
    backgroundColor: colors.accent,
  },
  clueBoxText: {
    fontSize: 16,
    fontFamily: 'DMSans_700Bold',
    color: colors.textSecondary,
  },
  clueBoxTextRevealed: {
    color: colors.surface,
  },

  // Bullet Points
  bulletPointsContainer: {
    marginVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  bulletPoint: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.xs,
  },
  bulletIcon: {
    fontSize: 20,
    marginRight: spacing.sm,
    width: 28,
  },
  bulletText: {
    fontSize: 15,
    fontFamily: 'DMSans_500Medium',
    color: colors.text,
  },

  // Sport Label
  sportLabel: {
    fontSize: 14,
    fontFamily: 'DMSans_600SemiBold',
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },

  // Streak Screen
  streakContainer: {
    marginVertical: spacing.lg,
  },
  streakCard: {
    backgroundColor: colors.surface,
    borderWidth: borders.card,
    borderColor: colors.border,
    borderRadius: borderRadius.card,
    padding: spacing.xl,
    alignItems: 'center',
    width: width * 0.6,
    ...shadows.card,
  },
  streakFireIcon: {
    width: 60,
    height: 66,
    marginBottom: spacing.sm,
  },
  streakNumber: {
    fontSize: 64,
    fontFamily: 'DMSans_900Black',
    color: colors.text,
    lineHeight: 70,
  },
  streakLabel: {
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
    color: colors.textSecondary,
    letterSpacing: 1,
  },
  streakDaysContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: spacing.lg,
  },
  streakDay: {
    width: 40,
    height: 50,
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  streakDayComplete: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  streakDayText: {
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
    color: colors.textSecondary,
  },
  streakDayTextComplete: {
    color: colors.surface,
  },
  streakDayCheck: {
    fontSize: 12,
    color: colors.surface,
    marginTop: 2,
  },
  streakInfoCard: {
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: borderRadius.card,
    padding: spacing.md,
    alignItems: 'center',
    ...shadows.cardSmall,
  },
  streakInfoText: {
    fontSize: 14,
    fontFamily: 'DMSans_600SemiBold',
    color: colors.text,
    textAlign: 'center',
  },
  streakInfoSubtext: {
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
  },

  // Sport Icons
  sportIconsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing.lg,
  },
  sportIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: spacing.sm,
    borderWidth: 2,
    borderColor: colors.border,
    ...shadows.cardSmall,
  },
  sportIconImage: {
    width: 26,
    height: 26,
  },

  // VS Screen
  vsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: spacing.xl,
  },
  playerCard: {
    backgroundColor: colors.surface,
    borderWidth: borders.card,
    borderColor: colors.border,
    borderRadius: borderRadius.card,
    padding: spacing.md,
    alignItems: 'center',
    width: 100,
    ...shadows.card,
  },
  playerEmoji: {
    fontSize: 40,
    marginBottom: spacing.xs,
  },
  playerLabel: {
    ...typography.label,
    color: colors.text,
  },
  vsCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: spacing.md,
    borderWidth: borders.card,
    borderColor: colors.border,
    ...shadows.card,
  },
  vsText: {
    fontSize: 20,
    fontFamily: 'DMSans_900Black',
    color: colors.surface,
  },

  // Timer
  timerContainer: {
    marginVertical: spacing.md,
  },
  timerCard: {
    backgroundColor: colors.surface,
    borderWidth: borders.card,
    borderColor: colors.border,
    borderRadius: borderRadius.card,
    padding: spacing.md,
    alignItems: 'center',
    ...shadows.card,
  },
  timerNumber: {
    fontSize: 48,
    fontFamily: 'DMSans_900Black',
    color: colors.accent,
  },
  timerLabel: {
    ...typography.label,
    color: colors.textSecondary,
  },

  // Leaderboard
  leaderboardContainer: {
    alignItems: 'center',
    marginVertical: spacing.lg,
  },
  trophyContainer: {
    marginBottom: spacing.md,
  },
  trophyEmoji: {
    fontSize: 60,
  },
  leaderboardCard: {
    backgroundColor: colors.surface,
    borderWidth: borders.card,
    borderColor: colors.border,
    borderRadius: borderRadius.card,
    padding: spacing.md,
    width: width * 0.7,
    ...shadows.card,
  },
  leaderboardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.xs,
  },
  rankNumber: {
    ...typography.h3,
    color: colors.text,
    width: 30,
  },
  leaderboardBar: {
    height: 20,
    borderRadius: 4,
    marginLeft: spacing.sm,
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing.lg,
  },
  statBadge: {
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: borderRadius.card,
    padding: spacing.sm,
    alignItems: 'center',
    marginHorizontal: spacing.sm,
    minWidth: 70,
    ...shadows.cardSmall,
  },
  statBadgeEmoji: {
    fontSize: 24,
    marginBottom: 4,
  },
  statBadgeText: {
    ...typography.label,
    fontSize: 10,
    color: colors.textSecondary,
  },

  // Celebration
  celebrationContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 200,
    position: 'relative',
  },
  checkmarkCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: borders.card,
    borderColor: colors.border,
    ...shadows.card,
  },
  checkmarkEmoji: {
    fontSize: 50,
    color: colors.surface,
    fontWeight: '900',
  },
  confetti1: {
    position: 'absolute',
    top: 10,
    left: 50,
  },
  confetti2: {
    position: 'absolute',
    top: 30,
    right: 50,
  },
  confetti3: {
    position: 'absolute',
    bottom: 20,
    left: 80,
  },
  confettiEmoji: {
    fontSize: 30,
  },

  // Bottom Section
  bottomSection: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    alignItems: 'center',
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.border,
    marginHorizontal: 5,
  },

  // Button
  button: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.button,
    borderWidth: borders.button,
    borderColor: colors.border,
    minWidth: 150,
    alignItems: 'center',
    shadowColor: colors.border,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  getStartedButton: {
    width: width - spacing.lg * 2,
  },
  buttonText: {
    ...typography.button,
    color: colors.surface,
  },
});
