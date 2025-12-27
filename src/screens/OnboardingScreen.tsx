import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  ScrollView,
  Animated,
  Easing,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
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

// Medal icons for leaderboard
const medalIcons = {
  gold: require('../../assets/images/icon-gold.png'),
  silver: require('../../assets/images/icon-silver.png'),
  bronze: require('../../assets/images/icon-bronze.png'),
};

// Helper function to get level title
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

// Ball with expanding background (for screen 1 - slide up + fade in + bounce)
function BallWithExpandingBackground({
  delay,
  icon,
  backgroundColor,
  isActive = true,
}: {
  delay: number;
  icon: any;
  backgroundColor: string;
  isActive?: boolean;
}) {
  const bgScale = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(30)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!isActive) {
      // Reset animations when not active
      bgScale.setValue(0);
      translateY.setValue(30);
      opacity.setValue(0);
      return;
    }

    const timeout = setTimeout(() => {
      Animated.parallel([
        // Fade in
        Animated.timing(opacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        // Slide up with bounce
        Animated.spring(translateY, {
          toValue: 0,
          friction: 6,
          tension: 80,
          useNativeDriver: true,
        }),
        // Background scale
        Animated.timing(bgScale, {
          toValue: 1,
          duration: 400,
          easing: Easing.out(Easing.back(1.2)),
          useNativeDriver: true,
        }),
      ]).start();
    }, delay);

    return () => clearTimeout(timeout);
  }, [delay, isActive]);

  return (
    <Animated.View
      style={[
        styles.ballWrapper,
        {
          opacity,
          transform: [{ translateY }],
        },
      ]}
    >
      {/* Colored background that scales up */}
      <Animated.View
        style={[
          styles.ballBackground,
          {
            backgroundColor,
            transform: [{ scale: bgScale }],
          },
        ]}
      />
      {/* Icon */}
      <Image source={icon} style={styles.ballIcon} />
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

// Screen 1: Welcome - seamless transition from splash
function WelcomeScreen() {
  const textOpacity = useRef(new Animated.Value(0)).current;
  const textTranslateY = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    // Fade in text after backgrounds have animated in
    const timeout = setTimeout(() => {
      Animated.parallel([
        Animated.timing(textOpacity, {
          toValue: 1,
          duration: 400,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(textTranslateY, {
          toValue: 0,
          duration: 400,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    }, 500); // After backgrounds animate in

    return () => clearTimeout(timeout);
  }, []);

  return (
    <View style={styles.screen1}>
      {/* BALLRS logo - positioned to match splash screen exactly */}
      <View style={styles.screen1LogoContainer}>
        <Text style={styles.logo}>BALLRS</Text>
      </View>

      {/* Sport balls - icons visible, colored backgrounds scale up */}
      <View style={styles.screen1BallsContainer}>
        <BallWithExpandingBackground
          delay={0}
          icon={sportIcons.nba}
          backgroundColor={colors.nba}
        />
        <BallWithExpandingBackground
          delay={80}
          icon={sportIcons.pl}
          backgroundColor={colors.pl}
        />
        <BallWithExpandingBackground
          delay={160}
          icon={sportIcons.nfl}
          backgroundColor={colors.nfl}
        />
        <BallWithExpandingBackground
          delay={240}
          icon={sportIcons.mlb}
          backgroundColor={colors.mlb}
        />
      </View>

      {/* Title and subtitle */}
      <Animated.View
        style={[
          styles.screen1TextContainer,
          {
            opacity: textOpacity,
            transform: [{ translateY: textTranslateY }],
          },
        ]}
      >
        <Text style={styles.title}>Guess the mystery athlete</Text>
        <Text style={styles.subtitle}>New clues revealed until you solve it</Text>
      </Animated.View>
    </View>
  );
}

// Screen 2: Daily Puzzle
function DailyChallengeScreen({ isActive }: { isActive?: boolean }) {
  const cardTranslateY = useRef(new Animated.Value(50)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const badgeOpacity = useRef(new Animated.Value(0)).current;
  const infoCardsOpacity = useRef(new Animated.Value(0)).current;
  const infoCardsTranslateY = useRef(new Animated.Value(15)).current;
  const hasAnimated = useRef(false);

  useEffect(() => {
    // Only animate when screen becomes active and hasn't animated yet
    if (!isActive || hasAnimated.current) return;
    hasAnimated.current = true;

    // Reset all values
    cardTranslateY.setValue(50);
    cardOpacity.setValue(0);
    badgeOpacity.setValue(0);
    infoCardsOpacity.setValue(0);
    infoCardsTranslateY.setValue(15);

    // 100ms delay → clue card animates (300ms, ease-out)
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(cardOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(cardTranslateY, {
          toValue: 0,
          duration: 300,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(() => {
        // 200ms delay after card settles → badge fades in
        setTimeout(() => {
          Animated.timing(badgeOpacity, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }).start();

          // 100ms delay after badge visible → info cards fade in (250ms)
          setTimeout(() => {
            Animated.parallel([
              Animated.timing(infoCardsOpacity, {
                toValue: 1,
                duration: 250,
                useNativeDriver: true,
              }),
              Animated.timing(infoCardsTranslateY, {
                toValue: 0,
                duration: 250,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: true,
              }),
            ]).start();
          }, 100);
        }, 200);
      });
    }, 100);
  }, [isActive]);

  return (
    <View style={styles.screen}>
      {/* Header */}
      <FadeIn delay={0}>
        <Text style={styles.heroTitle}>DAILY PUZZLE</Text>
        <Text style={styles.heroSubtitle}>Fewer clues, higher score</Text>
      </FadeIn>

      {/* Clue Card Mockup - slides up from bottom */}
      <Animated.View
        style={[
          styles.clueCardContainer,
          {
            opacity: cardOpacity,
            transform: [{ translateY: cardTranslateY }],
          },
        ]}
      >
        <View style={styles.clueCardTeal}>
          <View style={styles.clueNumberCircle}>
            <Text style={styles.clueNumberCircleText}>1</Text>
          </View>
          <Text style={styles.clueCardTextWhite}>
            Born in the Bronx and became a star at Penn State
          </Text>
          <Animated.View style={[styles.cluePointsBadge, { opacity: badgeOpacity }]}>
            <Text style={styles.cluePointsText}>6 pts</Text>
          </Animated.View>
        </View>
      </Animated.View>

      {/* Key Points - fade in after clue card */}
      <Animated.View
        style={[
          styles.keyPointsRow,
          {
            opacity: infoCardsOpacity,
            transform: [{ translateY: infoCardsTranslateY }],
          },
        ]}
      >
        <View style={styles.keyPointCard}>
          <Text style={styles.keyPointNumber}>6</Text>
          <Text style={styles.keyPointLabel}>clues to guess</Text>
        </View>
        <View style={styles.keyPointCard}>
          <Text style={styles.keyPointNumber}>4</Text>
          <Text style={styles.keyPointLabel}>sports daily</Text>
        </View>
      </Animated.View>
    </View>
  );
}

// Screen 3: Level Up
function LevelUpScreen({ isActive }: { isActive?: boolean }) {
  const progressAnim = useRef(new Animated.Value(0)).current;
  const [displayXP, setDisplayXP] = useState(0);
  const rankOpacity = useRef(new Animated.Value(0)).current;
  const rankTranslateY = useRef(new Animated.Value(20)).current;
  const hasAnimated = useRef(false);

  useEffect(() => {
    // Only animate when screen becomes active and hasn't animated yet
    if (!isActive || hasAnimated.current) return;
    hasAnimated.current = true;

    // Reset values
    progressAnim.setValue(0);
    setDisplayXP(0);
    rankOpacity.setValue(0);
    rankTranslateY.setValue(20);

    // Start XP bar animation after short delay
    const timeout = setTimeout(() => {
      // Listen to animation progress to update XP text
      const listenerId = progressAnim.addListener(({ value }) => {
        setDisplayXP(Math.round(value * 1000));
      });

      Animated.timing(progressAnim, {
        toValue: 0.65,
        duration: 1000,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start(() => {
        // Rank progression fades in after XP animation completes
        Animated.parallel([
          Animated.timing(rankOpacity, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.spring(rankTranslateY, {
            toValue: 0,
            friction: 8,
            tension: 80,
            useNativeDriver: true,
          }),
        ]).start();

        progressAnim.removeListener(listenerId);
      });
    }, 400);

    return () => clearTimeout(timeout);
  }, [isActive]);

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  const ranks = ['Rookie', 'Rising Star', 'Pro', 'Legend'];

  return (
    <View style={styles.screen}>
      {/* Header */}
      <FadeIn delay={0}>
        <Text style={styles.heroTitle}>LEVEL UP</Text>
        <Text style={styles.heroSubtitle}>Earn XP and climb the ranks</Text>
      </FadeIn>

      {/* Level Badge - Exact same component as home page */}
      <FadeIn delay={200} style={styles.levelBadgeContainer}>
        <View style={styles.combinedLevelBadge}>
          <View style={styles.levelSection_left}>
            <Text style={styles.levelBadgeText}>LEVEL 12</Text>
          </View>
          <View style={styles.levelDivider} />
          <View style={styles.levelSection_middle}>
            <Text style={styles.levelTitleText}>{getLevelTitle(12)}</Text>
          </View>
          <View style={styles.levelDivider} />
          <View style={styles.levelSection_right}>
            <Image source={fireIcon} style={styles.levelFireIcon} resizeMode="contain" />
            <Text style={styles.levelStreakText}>7</Text>
          </View>
        </View>

        {/* XP Bar - animated with counting text */}
        <Text style={styles.xpLabel}>{displayXP}/1000 XP</Text>
        <View style={styles.xpBarOuter}>
          <Animated.View style={[styles.xpBarFillContainer, { width: progressWidth }]}>
            <LinearGradient
              colors={[colors.xpGradientStart, colors.xpGradientEnd]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.xpBarFill}
            />
          </Animated.View>
        </View>
      </FadeIn>

      {/* Rank Progression - fades in after XP animation */}
      <Animated.View
        style={[
          styles.rankProgressionContainer,
          {
            opacity: rankOpacity,
            transform: [{ translateY: rankTranslateY }],
          },
        ]}
      >
        {ranks.map((rank, index) => (
          <View key={rank} style={styles.rankItem}>
            <Text style={[
              styles.rankText,
              rank === 'Pro' && styles.rankTextHighlighted
            ]}>
              {rank}
            </Text>
            {index < ranks.length - 1 && (
              <Text style={styles.rankArrow}>→</Text>
            )}
          </View>
        ))}
      </Animated.View>

      {/* Simple text lines */}
      <FadeIn delay={600} style={styles.levelUpTextContainer}>
        <Text style={styles.levelUpTextBold}>Play puzzles and duels</Text>
        <Text style={styles.levelUpTextGray}>Level up and unlock rewards</Text>
      </FadeIn>
    </View>
  );
}

// Animated Leaderboard Row Component
function AnimatedLeaderboardRow({
  player,
  index,
  isFirst,
  isLast,
  delay,
}: {
  player: { rank: number; medal: string; name: string; flag: string; points: number; isYou: boolean };
  index: number;
  isFirst: boolean;
  isLast: boolean;
  delay: number;
}) {
  const translateX = useRef(new Animated.Value(-100)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const glowOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const timeout = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 300,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(translateX, {
          toValue: 0,
          duration: 300,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(() => {
        // If this is the "You" row, start the glow pulse
        if (player.isYou) {
          Animated.loop(
            Animated.sequence([
              Animated.timing(glowOpacity, {
                toValue: 0.4,
                duration: 800,
                easing: Easing.inOut(Easing.ease),
                useNativeDriver: true,
              }),
              Animated.timing(glowOpacity, {
                toValue: 0,
                duration: 800,
                easing: Easing.inOut(Easing.ease),
                useNativeDriver: true,
              }),
            ])
          ).start();
        }
      });
    }, delay);

    return () => clearTimeout(timeout);
  }, [delay, player.isYou]);

  return (
    <Animated.View
      style={[
        styles.leaderboardMockupRow,
        isFirst && styles.leaderboardMockupRowFirst,
        isLast && styles.leaderboardMockupRowLast,
        {
          opacity,
          transform: [{ translateX }],
        },
      ]}
    >
      {/* Teal glow overlay for "You" row */}
      {player.isYou && (
        <Animated.View
          style={[
            styles.leaderboardRowGlow,
            { opacity: glowOpacity },
          ]}
        />
      )}
      <Image
        source={medalIcons[player.medal as keyof typeof medalIcons]}
        style={styles.leaderboardMedalIcon}
      />
      <View style={styles.leaderboardAvatar}>
        <Text style={styles.leaderboardAvatarText}>
          {player.name.charAt(0).toUpperCase()}
        </Text>
      </View>
      <Text style={[
        styles.leaderboardName,
        player.isYou && styles.leaderboardNameHighlighted
      ]}>
        {player.name}
      </Text>
      <Text style={styles.leaderboardFlag}>{player.flag}</Text>
      <Text style={styles.leaderboardPoints}>{player.points} pts</Text>
    </Animated.View>
  );
}

// Screen 4: Compete
function CompeteScreen() {
  const leaderboardData = [
    { rank: 1, medal: 'gold', name: 'player1', flag: '🇺🇸', points: 245, isYou: false },
    { rank: 2, medal: 'silver', name: 'player2', flag: '🇬🇧', points: 198, isYou: false },
    { rank: 3, medal: 'bronze', name: 'You', flag: '🇦🇺', points: 186, isYou: true },
  ];

  const infoOpacity = useRef(new Animated.Value(0)).current;
  const infoTranslateY = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    // Info rows fade in after leaderboard (3 rows * 150ms delay + 300ms animation + 200ms buffer)
    const timeout = setTimeout(() => {
      Animated.parallel([
        Animated.timing(infoOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(infoTranslateY, {
          toValue: 0,
          friction: 8,
          tension: 80,
          useNativeDriver: true,
        }),
      ]).start();
    }, 850);

    return () => clearTimeout(timeout);
  }, []);

  return (
    <View style={styles.screen}>
      {/* Header */}
      <FadeIn delay={0}>
        <Text style={styles.heroTitle}>COMPETE</Text>
        <Text style={styles.heroSubtitle}>Prove who knows ball</Text>
      </FadeIn>

      {/* Leaderboard Mockup - rows slide in staggered */}
      <View style={styles.leaderboardMockup}>
        {leaderboardData.map((player, index) => (
          <AnimatedLeaderboardRow
            key={player.rank}
            player={player}
            index={index}
            isFirst={index === 0}
            isLast={index === leaderboardData.length - 1}
            delay={200 + index * 150}
          />
        ))}
      </View>

      {/* Icon + Text Rows - fade in after leaderboard */}
      <Animated.View
        style={[
          styles.competeInfoRows,
          {
            opacity: infoOpacity,
            transform: [{ translateY: infoTranslateY }],
          },
        ]}>
        <View style={styles.competeInfoRow}>
          <Image
            source={require('../../assets/images/icon-trophy.png')}
            style={styles.competeInfoIcon}
          />
          <Text style={styles.competeInfoText}>Weekly leaderboards</Text>
        </View>
        <View style={styles.competeInfoRow}>
          <Image
            source={require('../../assets/images/icon-friends.png')}
            style={styles.competeInfoIcon}
          />
          <Text style={styles.competeInfoText}>Private leagues</Text>
        </View>
      </Animated.View>

      {/* Bottom Text */}
      <Animated.View
        style={[
          styles.competeBottomTextContainer,
          {
            opacity: infoOpacity,
            transform: [{ translateY: infoTranslateY }],
          },
        ]}
      >
        <Text style={styles.competeBottomText}>
          Compete with friends and fans worldwide
        </Text>
      </Animated.View>
    </View>
  );
}

// Screen 5: Duel
function DuelScreen({ isActive }: { isActive?: boolean }) {
  // Avatar animations - slide in from sides
  const leftAvatarX = useRef(new Animated.Value(-80)).current;
  const rightAvatarX = useRef(new Animated.Value(80)).current;
  const avatarOpacity = useRef(new Animated.Value(0)).current;

  // VS badge animation - scale up with bounce
  const vsScale = useRef(new Animated.Value(0)).current;
  const vsOpacity = useRef(new Animated.Value(0)).current;

  // Trivia question card animation
  const triviaOpacity = useRef(new Animated.Value(0)).current;
  const triviaTranslateY = useRef(new Animated.Value(20)).current;

  // Bottom text animation
  const bottomOpacity = useRef(new Animated.Value(0)).current;

  const hasAnimated = useRef(false);

  useEffect(() => {
    // Only animate when screen becomes active and hasn't animated yet
    if (!isActive || hasAnimated.current) return;
    hasAnimated.current = true;

    // Reset all values
    leftAvatarX.setValue(-80);
    rightAvatarX.setValue(80);
    avatarOpacity.setValue(0);
    vsScale.setValue(0);
    vsOpacity.setValue(0);
    triviaOpacity.setValue(0);
    triviaTranslateY.setValue(20);
    bottomOpacity.setValue(0);

    // Avatars slide in first (300ms, ease-out)
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(avatarOpacity, {
          toValue: 1,
          duration: 300,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(leftAvatarX, {
          toValue: 0,
          duration: 300,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(rightAvatarX, {
          toValue: 0,
          duration: 300,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    }, 200);

    // VS badge bounces in after avatars (scale 0 → 1.1 → 1.0)
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(vsOpacity, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.timing(vsScale, {
            toValue: 1.1,
            duration: 200,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(vsScale, {
            toValue: 1,
            duration: 100,
            easing: Easing.inOut(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
      ]).start();
    }, 500);

    // Trivia question card fades in + slides up (200ms delay after VS)
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(triviaOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(triviaTranslateY, {
          toValue: 0,
          duration: 300,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    }, 800);

    // Bottom text fades in last
    setTimeout(() => {
      Animated.timing(bottomOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }, 1000);
  }, [isActive]);

  return (
    <View style={styles.screen}>
      {/* Header */}
      <FadeIn delay={0}>
        <Text style={styles.heroTitle}>DUEL</Text>
        <Text style={styles.heroSubtitle}>Challenge friends or other fans</Text>
      </FadeIn>

      {/* VS Mockup Card */}
      <View style={styles.vsMockupCard}>
        <View style={styles.vsMockupContent}>
          {/* You - slides in from left */}
          <Animated.View
            style={[
              styles.vsPlayerContainer,
              {
                opacity: avatarOpacity,
                transform: [{ translateX: leftAvatarX }],
              },
            ]}
          >
            <View style={[styles.vsAvatar, styles.vsAvatarYou]}>
              <Text style={styles.vsAvatarText}>Y</Text>
            </View>
            <Text style={styles.vsPlayerLabel}>YOU</Text>
          </Animated.View>

          {/* VS Badge - yellow, scales up with bounce */}
          <Animated.View
            style={[
              styles.vsBadgeYellow,
              {
                opacity: vsOpacity,
                transform: [{ scale: vsScale }],
              },
            ]}
          >
            <Text style={styles.vsBadgeTextYellow}>VS</Text>
          </Animated.View>

          {/* Opponent - slides in from right */}
          <Animated.View
            style={[
              styles.vsPlayerContainer,
              {
                opacity: avatarOpacity,
                transform: [{ translateX: rightAvatarX }],
              },
            ]}
          >
            <View style={[styles.vsAvatar, styles.vsAvatarOpponent]}>
              <Text style={styles.vsAvatarText}>?</Text>
            </View>
            <Text style={styles.vsPlayerLabel}>OPPONENT</Text>
          </Animated.View>
        </View>
      </View>

      {/* Trivia Question Mockup */}
      <Animated.View
        style={[
          styles.triviaQuestionCard,
          {
            opacity: triviaOpacity,
            transform: [{ translateY: triviaTranslateY }],
          },
        ]}
      >
        {/* Timer badge */}
        <View style={styles.triviaTimerBadge}>
          <Text style={styles.triviaTimerText}>10s</Text>
        </View>

        {/* Question */}
        <Text style={styles.triviaQuestionText}>
          Which club has won the most Premier League titles?
        </Text>

        {/* Answer options - 2x2 grid */}
        <View style={styles.triviaAnswersGrid}>
          <View style={[styles.triviaAnswer, styles.triviaAnswerCorrect]}>
            <Text style={styles.triviaAnswerTextCorrect}>Manchester United</Text>
          </View>
          <View style={styles.triviaAnswer}>
            <Text style={styles.triviaAnswerText}>Liverpool</Text>
          </View>
          <View style={styles.triviaAnswer}>
            <Text style={styles.triviaAnswerText}>Chelsea</Text>
          </View>
          <View style={styles.triviaAnswer}>
            <Text style={styles.triviaAnswerText}>Arsenal</Text>
          </View>
        </View>
      </Animated.View>

      {/* Bottom Text */}
      <Animated.View
        style={[
          styles.competeBottomTextContainer,
          { opacity: bottomOpacity },
        ]}
      >
        <Text style={styles.competeBottomText}>
          Play anytime. Results when both finish.
        </Text>
      </Animated.View>
    </View>
  );
}

export default function OnboardingScreen({ onComplete }: OnboardingScreenProps) {
  const [currentPage, setCurrentPage] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);
  const scrollX = useRef(new Animated.Value(0)).current;

  // Interpolate back button opacity: 0 at page 0, fade in during scroll to page 1
  const backButtonOpacity = scrollX.interpolate({
    inputRange: [0, width * 0.5, width],
    outputRange: [0, 0, 1],
    extrapolate: 'clamp',
  });

  // Interpolate skip button opacity: 1 until page 3, fade out during scroll to page 4
  const skipButtonOpacity = scrollX.interpolate({
    inputRange: [width * 3, width * 3.5, width * 4],
    outputRange: [1, 0.5, 0],
    extrapolate: 'clamp',
  });

  // Interpolate button width: normal until page 3.5, then expand to full width
  const buttonWidth = scrollX.interpolate({
    inputRange: [width * 3, width * 4],
    outputRange: [150, width - 48],
    extrapolate: 'clamp',
  });

  // Interpolate button text opacity for crossfade
  const nextTextOpacity = scrollX.interpolate({
    inputRange: [width * 3.5, width * 4],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const getStartedTextOpacity = scrollX.interpolate({
    inputRange: [width * 3.5, width * 4],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const handleScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { x: scrollX } } }],
    {
      useNativeDriver: false,
      listener: (event: any) => {
        const offsetX = event.nativeEvent.contentOffset.x;
        const page = Math.round(offsetX / width);
        if (page >= 0 && page <= 4 && page !== currentPage) {
          setCurrentPage(page);
        }
      },
    }
  );

  const handleNext = () => {
    if (currentPage < 4) {
      const nextPage = currentPage + 1;
      scrollViewRef.current?.scrollTo({ x: nextPage * width, animated: true });
    } else {
      handleComplete();
    }
  };

  const handleBack = () => {
    if (currentPage > 0) {
      const prevPage = currentPage - 1;
      scrollViewRef.current?.scrollTo({ x: prevPage * width, animated: true });
    }
  };

  const handleComplete = async () => {
    await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    onComplete();
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Back Button - fades in based on scroll position */}
      <Animated.View
        style={[
          styles.backButtonContainer,
          { opacity: backButtonOpacity },
        ]}
        pointerEvents={currentPage > 0 ? 'auto' : 'none'}
      >
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* Skip Button - fades out based on scroll position */}
      <Animated.View
        style={[
          styles.skipButtonContainer,
          { opacity: skipButtonOpacity },
        ]}
        pointerEvents={currentPage < 4 ? 'auto' : 'none'}
      >
        <TouchableOpacity style={styles.skipButton} onPress={handleComplete}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* Swipeable Screens */}
      <Animated.ScrollView
        ref={scrollViewRef as any}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        bounces={false}
      >
        <WelcomeScreen />
        <DailyChallengeScreen isActive={currentPage === 1} />
        <LevelUpScreen isActive={currentPage === 2} />
        <CompeteScreen />
        <DuelScreen isActive={currentPage === 4} />
      </Animated.ScrollView>

      {/* Bottom Section */}
      <View style={styles.bottomSection}>
        {/* Dot Indicators */}
        <View style={styles.dotsContainer}>
          {[0, 1, 2, 3, 4].map((i) => (
            <AnimatedDot key={i} active={currentPage === i} />
          ))}
        </View>

        {/* Next/Get Started Button with crossfade text */}
        <TouchableOpacity
          onPress={handleNext}
          activeOpacity={0.8}
        >
          <Animated.View style={[styles.button, { width: buttonWidth }]}>
            <View style={styles.buttonTextContainer}>
              <Animated.Text style={[styles.buttonText, styles.buttonTextAbsolute, { opacity: nextTextOpacity }]} numberOfLines={1}>
                Next
              </Animated.Text>
              <Animated.Text style={[styles.buttonText, styles.buttonTextAbsolute, { opacity: getStartedTextOpacity }]} numberOfLines={1}>
                Get Started
              </Animated.Text>
            </View>
          </Animated.View>
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
  backButtonContainer: {
    position: 'absolute',
    top: 56,
    left: 20,
    zIndex: 10,
  },
  backButton: {
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
  skipButtonContainer: {
    position: 'absolute',
    top: 56,
    right: 20,
    zIndex: 10,
  },
  skipButton: {
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

  // Screen 1: Welcome - special layout for seamless splash transition
  screen1: {
    width,
    flex: 1,
    backgroundColor: colors.background,
  },
  screen1LogoContainer: {
    position: 'absolute',
    top: 180,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  screen1BallsContainer: {
    position: 'absolute',
    top: 290,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  ballWrapper: {
    width: 70,
    height: 70,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ballBackground: {
    position: 'absolute',
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: borders.card,
    borderColor: colors.border,
    ...shadows.card,
  },
  screen1TextContainer: {
    position: 'absolute',
    top: 400,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
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

  // Clue Card Mockup - Teal style matching actual game
  clueCardContainer: {
    marginVertical: spacing.lg,
    width: width * 0.85,
  },
  clueCardTeal: {
    backgroundColor: '#1ABC9C',
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: borderRadius.card,
    padding: spacing.lg,
    paddingTop: 56,
    paddingLeft: spacing.lg,
    position: 'relative',
    shadowColor: '#000000',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  clueNumberCircle: {
    position: 'absolute',
    top: 14,
    left: 14,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  clueNumberCircleText: {
    fontSize: 16,
    fontFamily: 'DMSans_900Black',
    color: '#1ABC9C',
  },
  clueCardTextWhite: {
    fontSize: 18,
    fontFamily: 'DMSans_600SemiBold',
    color: '#FFFFFF',
    lineHeight: 26,
    marginBottom: spacing.md,
  },
  cluePointsBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
  },
  cluePointsText: {
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
    color: '#FFFFFF',
  },

  // Key Points Row
  keyPointsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginVertical: spacing.lg,
    width: width * 0.85,
  },
  keyPointCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: borderRadius.card,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    height: 90,
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  keyPointNumber: {
    fontSize: 32,
    fontFamily: 'DMSans_900Black',
    color: '#1ABC9C',
    marginBottom: 4,
  },
  keyPointLabel: {
    fontSize: 12,
    fontFamily: 'DMSans_500Medium',
    color: colors.textSecondary,
    textAlign: 'center',
  },

  // Level Up Screen
  levelBadgeContainer: {
    marginVertical: spacing.lg,
    width: width * 0.85,
    alignItems: 'center',
  },
  // Combined level badge - exact match to home screen
  combinedLevelBadge: {
    alignSelf: 'flex-start',
    marginBottom: -4,
    flexDirection: 'row',
    alignItems: 'stretch',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#000000',
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  levelSection_left: {
    backgroundColor: '#F2C94C',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderTopLeftRadius: 6,
    borderBottomLeftRadius: 6,
  },
  levelDivider: {
    width: 2,
    backgroundColor: '#000000',
  },
  levelSection_middle: {
    backgroundColor: '#F5F2EB',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  levelSection_right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F5F2EB',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderTopRightRadius: 6,
    borderBottomRightRadius: 6,
  },
  levelFireIcon: {
    width: 16,
    height: 18,
  },
  levelStreakText: {
    fontSize: 14,
    fontFamily: 'DMSans_900Black',
    color: '#1A1A1A',
  },
  levelBadgeText: {
    fontSize: 14,
    fontFamily: 'DMSans_900Black',
    color: '#1A1A1A',
  },
  levelTitleText: {
    fontSize: 14,
    fontFamily: 'DMSans_900Black',
    color: '#1A1A1A',
  },
  // XP Label - positioned above bar, right aligned (matches home screen)
  xpLabel: {
    fontSize: 12,
    fontFamily: 'DMSans_900Black',
    color: '#1A1A1A',
    textAlign: 'right',
    alignSelf: 'flex-end',
    marginBottom: 6,
  },
  levelBadgeYellow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2C94C',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: colors.border,
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
    marginBottom: spacing.md,
  },
  levelBadgeYellowText: {
    fontSize: 14,
    fontFamily: 'DMSans_900Black',
    color: colors.text,
    letterSpacing: 0.5,
  },
  levelBadgeYellowDivider: {
    width: 2,
    height: 16,
    backgroundColor: colors.border,
    marginHorizontal: 12,
  },
  xpBarOuter: {
    width: '100%',
    height: 16,
    backgroundColor: '#E8E8E8',
    borderWidth: 2,
    borderColor: '#000000',
    borderRadius: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  xpBarFillContainer: {
    height: '100%',
    borderRadius: 6,
    overflow: 'visible',
  },
  xpBarFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 6,
  },
  xpBarIndicator: {
    position: 'absolute',
    right: -6,
    top: -3,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.xpGradientEnd,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  levelUpTextContainer: {
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  levelUpTextBold: {
    fontSize: 16,
    fontFamily: 'DMSans_700Bold',
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  levelUpTextGray: {
    fontSize: 14,
    fontFamily: 'DMSans_500Medium',
    color: colors.textSecondary,
    textAlign: 'center',
  },
  rankProgressionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
    flexWrap: 'wrap',
  },
  rankItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rankText: {
    fontSize: 13,
    fontFamily: 'DMSans_500Medium',
    color: colors.textSecondary,
  },
  rankTextHighlighted: {
    fontFamily: 'DMSans_700Bold',
    color: '#1ABC9C',
  },
  rankArrow: {
    fontSize: 12,
    color: colors.textSecondary,
    marginHorizontal: 6,
  },

  // Compete Screen - Leaderboard Mockup
  leaderboardMockup: {
    width: width * 0.85,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: borderRadius.card,
    marginVertical: spacing.lg,
    shadowColor: '#000000',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
    overflow: 'hidden',
  },
  leaderboardMockupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E8',
    position: 'relative',
  },
  leaderboardRowGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#1ABC9C',
    borderRadius: 0,
  },
  leaderboardMockupRowFirst: {
    borderTopLeftRadius: borderRadius.card - 2,
    borderTopRightRadius: borderRadius.card - 2,
  },
  leaderboardMockupRowLast: {
    borderBottomWidth: 0,
    borderBottomLeftRadius: borderRadius.card - 2,
    borderBottomRightRadius: borderRadius.card - 2,
  },
  leaderboardMedalIcon: {
    width: 24,
    height: 24,
    marginRight: 10,
  },
  leaderboardAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1A1A1A',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  leaderboardAvatarText: {
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
    color: '#FFFFFF',
  },
  leaderboardName: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'DMSans_600SemiBold',
    color: colors.text,
  },
  leaderboardNameHighlighted: {
    color: '#1ABC9C',
    fontFamily: 'DMSans_700Bold',
  },
  leaderboardFlag: {
    fontSize: 16,
    marginRight: 10,
  },
  leaderboardPoints: {
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
    color: colors.text,
  },
  competeInfoRows: {
    alignItems: 'center',
    gap: 16,
    marginVertical: spacing.lg,
  },
  competeInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  competeInfoIcon: {
    width: 25,
    height: 22,
    resizeMode: 'contain',
  },
  competeInfoText: {
    fontSize: 16,
    fontFamily: 'DMSans_700Bold',
    color: colors.text,
  },
  competeBottomTextContainer: {
    marginTop: spacing.md,
  },
  competeBottomText: {
    fontSize: 14,
    fontFamily: 'DMSans_500Medium',
    color: colors.textSecondary,
    textAlign: 'center',
  },

  // Duel Screen - VS Mockup
  vsMockupCard: {
    width: width * 0.85,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: borderRadius.card,
    marginVertical: spacing.lg,
    padding: spacing.xl,
    shadowColor: '#000000',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  vsMockupContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  vsPlayerContainer: {
    alignItems: 'center',
    flex: 1,
  },
  vsAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.border,
    marginBottom: 8,
  },
  vsAvatarYou: {
    backgroundColor: '#1ABC9C',
  },
  vsAvatarOpponent: {
    backgroundColor: '#1A1A1A',
  },
  vsAvatarText: {
    fontSize: 24,
    fontFamily: 'DMSans_900Black',
    color: '#FFFFFF',
  },
  vsPlayerLabel: {
    fontSize: 12,
    fontFamily: 'DMSans_700Bold',
    color: colors.text,
    letterSpacing: 0.5,
  },
  vsBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1ABC9C',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.border,
    marginHorizontal: spacing.md,
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  vsBadgeText: {
    fontSize: 14,
    fontFamily: 'DMSans_900Black',
    color: '#FFFFFF',
  },
  vsBadgeYellow: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F2C94C',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.border,
    marginHorizontal: spacing.md,
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  vsBadgeTextYellow: {
    fontSize: 16,
    fontFamily: 'DMSans_900Black',
    color: '#1A1A1A',
  },

  // Trivia Question Card for Duel Screen
  triviaQuestionCard: {
    width: width * 0.85,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: borderRadius.card,
    padding: spacing.md,
    paddingTop: spacing.lg,
    shadowColor: '#000000',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
    position: 'relative',
  },
  triviaTimerBadge: {
    position: 'absolute',
    top: -12,
    right: 16,
    backgroundColor: '#F2C94C',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    shadowColor: '#000000',
    shadowOffset: { width: 1, height: 1 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  triviaTimerText: {
    fontSize: 12,
    fontFamily: 'DMSans_900Black',
    color: '#1A1A1A',
  },
  triviaQuestionText: {
    fontSize: 15,
    fontFamily: 'DMSans_600SemiBold',
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.md,
    lineHeight: 22,
  },
  triviaAnswersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8,
  },
  triviaAnswer: {
    width: '48%',
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  triviaAnswerCorrect: {
    backgroundColor: '#1ABC9C',
  },
  triviaAnswerText: {
    fontSize: 12,
    fontFamily: 'DMSans_600SemiBold',
    color: colors.text,
    textAlign: 'center',
  },
  triviaAnswerTextCorrect: {
    fontSize: 12,
    fontFamily: 'DMSans_600SemiBold',
    color: '#FFFFFF',
    textAlign: 'center',
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
  buttonTextContainer: {
    height: 20,
    width: 100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonTextAbsolute: {
    position: 'absolute',
    width: 100,
    textAlign: 'center',
  },
});
