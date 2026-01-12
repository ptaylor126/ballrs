import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  Dimensions,
  Image,
  ImageSourcePropType,
} from 'react-native';
import { colors, shadows, borders } from '../lib/theme';
import { Sport } from '../lib/theme';
import teamColorsData from '../../data/team-colors.json';

const { width } = Dimensions.get('window');

// Jersey template images
const jerseyImages: Record<Sport, ImageSourcePropType> = {
  nba: require('../../assets/images/jersey-nba.png'),
  nfl: require('../../assets/images/jersey-nfl.png'),
  pl: require('../../assets/images/jersey-epl.png'),
  mlb: require('../../assets/images/jersey-mlb.png'),
};

interface TeamColors {
  primary: string;
  secondary: string;
  text: string;
}

interface JerseyRevealProps {
  playerName: string;
  jerseyNumber: string | number;
  teamName: string;
  sport: Sport;
  isCorrect?: boolean;
  onAnimationComplete?: () => void;
  showPlayerInfo?: boolean; // Whether to show player name and team below jersey
  embedded?: boolean; // If true, removes the wrapper card styling (for embedding in another card)
}

// Team abbreviation to full name mapping for PL
const plTeamMap: Record<string, string> = {
  'ARS': 'Arsenal',
  'AVL': 'Aston Villa',
  'BOU': 'AFC Bournemouth',
  'BRE': 'Brentford',
  'BHA': 'Brighton & Hove Albion',
  'CHE': 'Chelsea',
  'CRY': 'Crystal Palace',
  'EVE': 'Everton',
  'FUL': 'Fulham',
  'IPS': 'Ipswich Town',
  'LEI': 'Leicester City',
  'LIV': 'Liverpool',
  'MCI': 'Manchester City',
  'MUN': 'Manchester United',
  'NEW': 'Newcastle United',
  'NFO': 'Nottingham Forest',
  'SOU': 'Southampton',
  'TOT': 'Tottenham Hotspur',
  'WHU': 'West Ham United',
  'WOL': 'Wolverhampton Wanderers',
};

// Team abbreviation to full name mapping for NBA
const nbaTeamMap: Record<string, string> = {
  'ATL': 'Atlanta Hawks',
  'BOS': 'Boston Celtics',
  'BKN': 'Brooklyn Nets',
  'CHA': 'Charlotte Hornets',
  'CHI': 'Chicago Bulls',
  'CLE': 'Cleveland Cavaliers',
  'DAL': 'Dallas Mavericks',
  'DEN': 'Denver Nuggets',
  'DET': 'Detroit Pistons',
  'GSW': 'Golden State Warriors',
  'HOU': 'Houston Rockets',
  'IND': 'Indiana Pacers',
  'LAC': 'LA Clippers',
  'LAL': 'Los Angeles Lakers',
  'MEM': 'Memphis Grizzlies',
  'MIA': 'Miami Heat',
  'MIL': 'Milwaukee Bucks',
  'MIN': 'Minnesota Timberwolves',
  'NOP': 'New Orleans Pelicans',
  'NYK': 'New York Knicks',
  'OKC': 'Oklahoma City Thunder',
  'ORL': 'Orlando Magic',
  'PHI': 'Philadelphia 76ers',
  'PHX': 'Phoenix Suns',
  'POR': 'Portland Trail Blazers',
  'SAC': 'Sacramento Kings',
  'SAS': 'San Antonio Spurs',
  'TOR': 'Toronto Raptors',
  'UTA': 'Utah Jazz',
  'WAS': 'Washington Wizards',
};

// Team abbreviation to full name mapping for MLB
const mlbTeamMap: Record<string, string> = {
  'ARI': 'Arizona Diamondbacks',
  'ATL': 'Atlanta Braves',
  'BAL': 'Baltimore Orioles',
  'BOS': 'Boston Red Sox',
  'CHC': 'Chicago Cubs',
  'CWS': 'Chicago White Sox',
  'CIN': 'Cincinnati Reds',
  'CLE': 'Cleveland Guardians',
  'COL': 'Colorado Rockies',
  'DET': 'Detroit Tigers',
  'HOU': 'Houston Astros',
  'KC': 'Kansas City Royals',
  'KCR': 'Kansas City Royals',
  'LAA': 'Los Angeles Angels',
  'LAD': 'Los Angeles Dodgers',
  'MIA': 'Miami Marlins',
  'MIL': 'Milwaukee Brewers',
  'MIN': 'Minnesota Twins',
  'NYM': 'New York Mets',
  'NYY': 'New York Yankees',
  'OAK': 'Oakland Athletics',
  'PHI': 'Philadelphia Phillies',
  'PIT': 'Pittsburgh Pirates',
  'SD': 'San Diego Padres',
  'SDP': 'San Diego Padres',
  'SF': 'San Francisco Giants',
  'SFG': 'San Francisco Giants',
  'SEA': 'Seattle Mariners',
  'STL': 'St. Louis Cardinals',
  'TB': 'Tampa Bay Rays',
  'TBR': 'Tampa Bay Rays',
  'TEX': 'Texas Rangers',
  'TOR': 'Toronto Blue Jays',
  'WSH': 'Washington Nationals',
  'WAS': 'Washington Nationals',
};

// Team abbreviation to full name mapping for NFL
const nflTeamMap: Record<string, string> = {
  'ARI': 'Arizona Cardinals',
  'ATL': 'Atlanta Falcons',
  'BAL': 'Baltimore Ravens',
  'BUF': 'Buffalo Bills',
  'CAR': 'Carolina Panthers',
  'CHI': 'Chicago Bears',
  'CIN': 'Cincinnati Bengals',
  'CLE': 'Cleveland Browns',
  'DAL': 'Dallas Cowboys',
  'DEN': 'Denver Broncos',
  'DET': 'Detroit Lions',
  'GB': 'Green Bay Packers',
  'HOU': 'Houston Texans',
  'IND': 'Indianapolis Colts',
  'JAX': 'Jacksonville Jaguars',
  'KC': 'Kansas City Chiefs',
  'LV': 'Las Vegas Raiders',
  'LAC': 'Los Angeles Chargers',
  'LAR': 'Los Angeles Rams',
  'MIA': 'Miami Dolphins',
  'MIN': 'Minnesota Vikings',
  'NE': 'New England Patriots',
  'NO': 'New Orleans Saints',
  'NYG': 'New York Giants',
  'NYJ': 'New York Jets',
  'PHI': 'Philadelphia Eagles',
  'PIT': 'Pittsburgh Steelers',
  'SF': 'San Francisco 49ers',
  'SEA': 'Seattle Seahawks',
  'TB': 'Tampa Bay Buccaneers',
  'TEN': 'Tennessee Titans',
  'WAS': 'Washington Commanders',
};

// Get team map for sport
const getTeamMap = (sport: Sport): Record<string, string> | null => {
  switch (sport) {
    case 'pl': return plTeamMap;
    case 'nba': return nbaTeamMap;
    case 'mlb': return mlbTeamMap;
    case 'nfl': return nflTeamMap;
    default: return null;
  }
};

// Get team colors from the data file
const getTeamColors = (sport: Sport, teamName: string): TeamColors => {
  const sportKey = sport as keyof typeof teamColorsData;
  const sportTeams = teamColorsData[sportKey] as Record<string, TeamColors> | undefined;

  // Try direct match first
  if (sportTeams && sportTeams[teamName]) {
    return sportTeams[teamName];
  }

  // Try mapping abbreviation to full name
  const teamMap = getTeamMap(sport);
  if (teamMap && teamMap[teamName]) {
    const fullName = teamMap[teamName];
    if (sportTeams && sportTeams[fullName]) {
      return sportTeams[fullName];
    }
  }

  // Default colors if team not found
  return {
    primary: colors.accent,
    secondary: colors.border,
    text: '#FFFFFF',
  };
};

// Get full team name for display
export const getFullTeamName = (sport: Sport, teamName: string): string => {
  const teamMap = getTeamMap(sport);
  if (teamMap && teamMap[teamName]) {
    return teamMap[teamName];
  }
  return teamName;
};

// Get last name from full name
const getLastName = (fullName: string): string => {
  const parts = fullName.trim().split(' ');
  return parts[parts.length - 1].toUpperCase();
};

// Check if a hex color is light (R, G, B all > 230)
const isLightColor = (hexColor: string): boolean => {
  // Remove # if present
  const hex = hexColor.replace('#', '');

  // Parse RGB values
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  // Check if all RGB values are above 230 (very light)
  return r > 230 && g > 230 && b > 230;
};

// Confetti particle component
function ConfettiParticle({ delay, color, startX }: { delay: number; color: string; startX: number }) {
  const translateY = useRef(new Animated.Value(-50)).current;
  const translateX = useRef(new Animated.Value(startX)).current;
  const rotate = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const timeout = setTimeout(() => {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 300,
          duration: 2000,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(translateX, {
          toValue: startX + (Math.random() - 0.5) * 100,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(rotate, {
          toValue: 360 * (Math.random() > 0.5 ? 1 : -1),
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 2000,
          delay: 1000,
          useNativeDriver: true,
        }),
      ]).start();
    }, delay);

    return () => clearTimeout(timeout);
  }, []);

  const spin = rotate.interpolate({
    inputRange: [0, 360],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.View
      style={[
        styles.confettiParticle,
        {
          backgroundColor: color,
          transform: [
            { translateY },
            { translateX },
            { rotate: spin },
          ],
          opacity,
        },
      ]}
    />
  );
}

// Get dynamic font size based on name length
const getNameFontSize = (name: string): number => {
  if (name.length >= 12) return 9;
  if (name.length >= 10) return 10;
  if (name.length >= 8) return 11;
  return 14;
};

// Jersey component with image template and color tinting
function Jersey({
  sport,
  primaryColor,
  textColor,
  playerName,
  jerseyNumber,
}: {
  sport: Sport;
  primaryColor: string;
  textColor: string;
  playerName: string;
  jerseyNumber: string | number;
}) {
  const lastName = getLastName(playerName);
  const jerseyImage = jerseyImages[sport];
  const needsOutline = isLightColor(primaryColor);
  const nameFontSize = getNameFontSize(lastName);

  return (
    <View style={styles.jerseyContainer}>
      {/* Black outline layer for light jerseys (rendered underneath) */}
      {needsOutline && (
        <Image
          source={jerseyImage}
          style={[styles.jerseyImageOutline, { tintColor: '#000000' }]}
          resizeMode="contain"
        />
      )}

      {/* Jersey image with team color tint */}
      <Image
        source={jerseyImage}
        style={[styles.jerseyImage, { tintColor: primaryColor }]}
        resizeMode="contain"
      />

      {/* Player name overlay */}
      <View style={styles.nameOverlay}>
        <Text
          style={[styles.playerNameOnJersey, { color: textColor, fontSize: nameFontSize }]}
          numberOfLines={1}
        >
          {lastName}
        </Text>
      </View>

      {/* Jersey number overlay */}
      <View style={styles.numberOverlay}>
        <Text style={[styles.jerseyNumber, { color: textColor }]}>
          {jerseyNumber}
        </Text>
      </View>
    </View>
  );
}

export default function JerseyReveal({
  playerName,
  jerseyNumber,
  teamName,
  sport,
  isCorrect = false,
  onAnimationComplete,
  showPlayerInfo = true,
  embedded = false,
}: JerseyRevealProps) {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  const teamColors = getTeamColors(sport, teamName);
  const displayTeamName = getFullTeamName(sport, teamName);

  useEffect(() => {
    // Bounce animation: scale from 0 to 1.1 to 1.0
    Animated.parallel([
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.1,
          duration: 200,
          easing: Easing.out(Easing.back(1.5)),
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 100,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      if (onAnimationComplete) {
        onAnimationComplete();
      }
    });
  }, []);

  // Generate confetti particles (only for correct guesses)
  const confettiColors = ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7'];
  const confettiParticles = isCorrect
    ? Array.from({ length: 25 }, (_, i) => ({
        id: i,
        color: confettiColors[i % confettiColors.length],
        delay: i * 40,
        startX: (Math.random() - 0.5) * width * 0.8,
      }))
    : [];

  return (
    <View style={styles.container}>
      {/* Confetti (only for correct guesses) */}
      {isCorrect && (
        <View style={styles.confettiContainer}>
          {confettiParticles.map((particle) => (
            <ConfettiParticle
              key={particle.id}
              delay={particle.delay}
              color={particle.color}
              startX={particle.startX}
            />
          ))}
        </View>
      )}

      <Animated.View
        style={[
          styles.revealContainer,
          {
            transform: [{ scale: scaleAnim }],
            opacity: opacityAnim,
          },
        ]}
      >
        {/* Jersey card */}
        <View style={embedded ? styles.jerseyEmbedded : styles.jerseyWrapper}>
          <Jersey
            sport={sport}
            primaryColor={teamColors.primary}
            textColor={teamColors.text}
            playerName={playerName}
            jerseyNumber={jerseyNumber}
          />
        </View>

        {/* Player info below jersey (optional) */}
        {showPlayerInfo && (
          <View style={styles.playerInfo}>
            <Text style={styles.playerFullName}>{playerName}</Text>
            <Text style={styles.teamNameText}>{displayTeamName}</Text>
          </View>
        )}
      </Animated.View>
    </View>
  );
}

const JERSEY_WIDTH = 180;
const JERSEY_HEIGHT = 220;

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  confettiContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    overflow: 'visible',
    zIndex: 10,
  },
  confettiParticle: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 2,
  },
  revealContainer: {
    alignItems: 'center',
  },
  jerseyWrapper: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: borders.card,
    borderColor: colors.border,
    padding: 16,
    // Neubrutalist shadow
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  jerseyEmbedded: {
    // No card styling when embedded in another card
    padding: 0,
  },
  jerseyContainer: {
    width: JERSEY_WIDTH,
    height: JERSEY_HEIGHT,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  jerseyImage: {
    width: JERSEY_WIDTH,
    height: JERSEY_HEIGHT,
    position: 'absolute',
  },
  jerseyImageOutline: {
    width: JERSEY_WIDTH + 4,
    height: JERSEY_HEIGHT + 4,
    position: 'absolute',
    left: -2,
    top: -2,
  },
  nameOverlay: {
    position: 'absolute',
    top: '28%',
    left: 20,
    right: 20,
    alignItems: 'center',
  },
  playerNameOnJersey: {
    fontSize: 14,
    fontFamily: 'DMSans_900Black',
    textAlign: 'center',
    letterSpacing: 1,
    textTransform: 'uppercase',
    // Text shadow for readability
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  numberOverlay: {
    position: 'absolute',
    top: '42%',
    left: 20,
    right: 20,
    alignItems: 'center',
  },
  jerseyNumber: {
    fontSize: 48,
    fontFamily: 'DMSans_900Black',
    textAlign: 'center',
    // Text shadow for readability
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  playerInfo: {
    marginTop: 16,
    alignItems: 'center',
  },
  playerFullName: {
    fontSize: 24,
    fontFamily: 'DMSans_900Black',
    color: colors.text,
    textAlign: 'center',
  },
  teamNameText: {
    fontSize: 16,
    fontFamily: 'DMSans_500Medium',
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
  },
});
