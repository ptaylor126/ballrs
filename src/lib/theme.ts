// Ballrs Design System - Neubrutalist Style

export const colors = {
  // Core palette
  background: '#F5F2EB',         // Cream background
  surface: '#FFFFFF',            // White cards/surfaces
  text: '#1A1A1A',               // Dark text
  textSecondary: '#6B7280',      // Muted gray
  textTertiary: '#9CA3AF',       // Light gray

  // App accent color (non-sport-specific UI)
  accent: '#1ABC9C',             // Teal
  accentDisabled: '#E8E8E8',     // Light gray (disabled state)
  accentDisabledText: '#999999', // Gray text (disabled state)

  // Borders
  border: '#000000',             // Black borders (neubrutalist)
  borderLight: '#E5E5E0',        // Light border for subtle elements

  // Sport accent colors
  nba: '#E07A3D',                // Orange
  pl: '#A17FFF',                 // Purple
  nfl: '#3BA978',                // Green
  mlb: '#7A93D2',                // Blue

  // XP bar gradient
  xpGradientStart: '#C57AFB',    // Purple
  xpGradientEnd: '#F965B9',      // Pink

  // Status
  completed: '#A17FFF',          // Purple checkmark
  success: '#3BA978',            // Green
  error: '#DC2626',              // Red
  warning: '#F59E0B',            // Amber

  // Nav bar
  navBackground: '#FFFFFF',
  navBorder: '#000000',
  navActive: '#1ABC9C',            // Teal accent

  // Legacy mappings for compatibility
  primary: '#1ABC9C',             // Teal accent color
  navy: '#A17FFF',
  forest: '#3BA978',
  gold: '#F59E0B',
  shadow: 'rgba(0, 0, 0, 1)',
  borderStrong: '#000000',
  highlight: 'rgba(224, 122, 61, 0.1)',
};

// Neubrutalist card shadow (hard offset)
export const shadows = {
  card: {
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  cardSmall: {
    shadowColor: '#000000',
    shadowOffset: { width: 1, height: 1 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const borderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  button: 16,
  card: 8,
  full: 9999,
};

export const borders = {
  card: 3,      // Card border width
  button: 2,    // Button border width
  input: 2,     // Input border width
  nav: 2,       // Nav bar border width
};

export const typography = {
  // BALLRS header
  header: {
    fontSize: 24,
    fontWeight: '900' as const,
    fontFamily: 'DMSans_900Black',
  },
  // Sport names
  sportName: {
    fontSize: 24,
    fontWeight: '900' as const,
    fontFamily: 'DMSans_900Black',
  },
  // Button text
  button: {
    fontSize: 12,
    fontWeight: '900' as const,
    fontFamily: 'DMSans_900Black',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  // Level label
  level: {
    fontSize: 12,
    fontWeight: '500' as const,
    fontFamily: 'DMSans_500Medium',
  },
  // XP text
  xp: {
    fontSize: 12,
    fontWeight: '500' as const,
    fontFamily: 'DMSans_500Medium',
  },
  // Body text
  body: {
    fontSize: 16,
    fontWeight: '400' as const,
    fontFamily: 'DMSans_400Regular',
  },
  bodySmall: {
    fontSize: 14,
    fontWeight: '400' as const,
    fontFamily: 'DMSans_400Regular',
  },
  // Headings
  h1: {
    fontSize: 24,
    fontWeight: '700' as const,
    fontFamily: 'DMSans_700Bold',
  },
  h2: {
    fontSize: 20,
    fontWeight: '700' as const,
    fontFamily: 'DMSans_700Bold',
  },
  h3: {
    fontSize: 16,
    fontWeight: '600' as const,
    fontFamily: 'DMSans_600SemiBold',
  },
  // Labels
  label: {
    fontSize: 12,
    fontWeight: '600' as const,
    fontFamily: 'DMSans_600SemiBold',
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
  },
  // Numbers/Stats
  stat: {
    fontSize: 32,
    fontWeight: '900' as const,
    fontFamily: 'DMSans_900Black',
  },
  statSmall: {
    fontSize: 20,
    fontWeight: '700' as const,
    fontFamily: 'DMSans_700Bold',
  },
};

export type Sport = 'nba' | 'pl' | 'nfl' | 'mlb';

// Get sport accent color
export const getSportColor = (sport: Sport): string => {
  switch (sport) {
    case 'nba': return colors.nba;
    case 'pl': return colors.pl;
    case 'nfl': return colors.nfl;
    case 'mlb': return colors.mlb;
  }
};

// Get sport name
export const getSportName = (sport: Sport): string => {
  switch (sport) {
    case 'nba': return 'NBA';
    case 'pl': return 'Premier League';
    case 'nfl': return 'NFL';
    case 'mlb': return 'MLB';
  }
};

// Get sport emoji (for use until custom icons are added)
export const getSportEmoji = (sport: Sport): string => {
  switch (sport) {
    case 'nba': return '🏀';
    case 'pl': return '⚽';
    case 'nfl': return '🏈';
    case 'mlb': return '⚾';
  }
};

// Common styles for neubrutalist info cards (non-tappable)
// White background, dark text, normal case, 8px radius
export const cardStyle = {
  backgroundColor: colors.surface,
  borderWidth: borders.card,
  borderColor: colors.border,
  borderRadius: borderRadius.card,
  ...shadows.card,
};

// Common styles for buttons (tappable)
// Filled background, white text, uppercase, 16px pill radius
export const buttonStyle = {
  // Primary teal button
  primary: {
    backgroundColor: colors.accent,
    borderWidth: borders.button,
    borderColor: colors.border,
    borderRadius: borderRadius.button,
    ...shadows.card,
  },
  // Secondary button (yellow background for Back, Cancel, Skip, etc.)
  secondary: {
    backgroundColor: '#F2C94C',
    borderWidth: borders.button,
    borderColor: colors.border,
    borderRadius: borderRadius.button,
    ...shadows.card,
  },
  // White button (for use in colored containers)
  white: {
    backgroundColor: colors.surface,
    borderWidth: borders.button,
    borderColor: colors.border,
    borderRadius: borderRadius.button,
    ...shadows.card,
  },
  // Sport-colored buttons (use getSportColor for backgroundColor)
  sport: {
    borderWidth: borders.button,
    borderColor: colors.border,
    borderRadius: borderRadius.button,
    ...shadows.card,
  },
  // Disabled state
  disabled: {
    backgroundColor: colors.accentDisabled,
    borderWidth: borders.button,
    borderColor: colors.border,
    borderRadius: borderRadius.button,
    ...shadows.card,
  },
};

// Button text styles (uppercase)
export const buttonTextStyle = {
  primary: {
    color: '#FFFFFF',
    ...typography.button,
  },
  secondary: {
    color: '#1A1A1A',  // Dark text on yellow background
    ...typography.button,
  },
  white: {
    color: colors.text,
    ...typography.button,
  },
  disabled: {
    color: colors.accentDisabledText,
    ...typography.button,
  },
};
