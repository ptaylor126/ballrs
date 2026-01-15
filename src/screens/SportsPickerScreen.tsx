import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { AnimatedButton, AnimatedCard } from '../components/AnimatedComponents';
import { colors, shadows, getSportColor, getSportName, Sport, borders, borderRadius, spacing, typography } from '../lib/theme';
import { createUserPreferences, ALL_SPORTS } from '../lib/userPreferencesService';

// Sport icon images
const sportIcons: Record<Sport, any> = {
  nba: require('../../assets/images/icon-basketball.png'),
  pl: require('../../assets/images/icon-soccer.png'),
  nfl: require('../../assets/images/icon-football.png'),
  mlb: require('../../assets/images/icon-baseball.png'),
};

// Check icon for selected sports
const checkIcon = require('../../assets/images/icon-check.png');

interface Props {
  onComplete: (selectedSports: Sport[]) => void;
  initialSelection?: Sport[];
  isOnboarding?: boolean;
}

export default function SportsPickerScreen({ onComplete, initialSelection, isOnboarding = true }: Props) {
  const { user } = useAuth();
  const [selectedSports, setSelectedSports] = useState<Sport[]>(initialSelection || []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleToggleSport = (sport: Sport) => {
    setError(null);
    setSelectedSports(prev => {
      if (prev.includes(sport)) {
        return prev.filter(s => s !== sport);
      } else {
        return [...prev, sport];
      }
    });
  };

  const handleContinue = async () => {
    console.log('SportsPickerScreen: handleContinue called with', selectedSports);
    if (selectedSports.length === 0) {
      setError('Please select at least one sport');
      return;
    }

    if (!user) {
      console.error('SportsPickerScreen: No user found');
      onComplete(selectedSports);
      return;
    }

    setSaving(true);
    setError(null);

    console.log('SportsPickerScreen: Creating preferences for user', user.id, 'with sports', selectedSports);
    const result = await createUserPreferences(user.id, selectedSports);
    console.log('SportsPickerScreen: createUserPreferences result', result);

    setSaving(false);

    if (!result) {
      console.error('SportsPickerScreen: Failed to save sports preferences');
      // Continue anyway - preferences will be saved on next update
    }

    console.log('SportsPickerScreen: Calling onComplete with', selectedSports);
    onComplete(selectedSports);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Header */}
        <Text style={styles.logo}>BALLRS</Text>
        <Text style={styles.title}>Which sports interest you?</Text>
        <Text style={styles.subtitle}>
          Select all that apply
        </Text>

        {/* Sports Grid */}
        <View style={styles.sportsGrid}>
          {ALL_SPORTS.map((sport) => {
            const sportColor = getSportColor(sport);
            const isSelected = selectedSports.includes(sport);

            return (
              <TouchableOpacity
                key={sport}
                style={styles.sportCardWrapper}
                onPress={() => handleToggleSport(sport)}
                activeOpacity={0.7}
              >
                <AnimatedCard
                  style={[
                    styles.sportCard,
                    isSelected && { borderColor: sportColor, borderWidth: 4 },
                  ]}
                >
                  {/* Selection Indicator - matches home screen style */}
                  {isSelected && (
                    <View style={styles.checkBadge}>
                      <Image source={checkIcon} style={[styles.checkIcon, { tintColor: sportColor }]} />
                    </View>
                  )}

                  {/* Sport Icon */}
                  <View style={styles.sportIconContainer}>
                    <Image source={sportIcons[sport]} style={styles.sportIcon} />
                  </View>

                  {/* Sport Name */}
                  <Text style={[
                    styles.sportName,
                    isSelected && { color: sportColor },
                  ]}>
                    {sport === 'pl' ? 'EPL' : getSportName(sport)}
                  </Text>
                </AnimatedCard>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Error Message */}
        {error && (
          <Text style={styles.errorText}>{error}</Text>
        )}

        {/* Helper Text */}
        {isOnboarding && (
          <Text style={styles.helperText}>
            You can change this anytime in settings
          </Text>
        )}

        {/* Continue Button */}
        <AnimatedButton
          style={[
            styles.continueButton,
            selectedSports.length === 0 && styles.continueButtonDisabled,
          ]}
          onPress={handleContinue}
          disabled={selectedSports.length === 0 || saving}
        >
          {saving ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={[
              styles.continueButtonText,
              selectedSports.length === 0 && styles.continueButtonTextDisabled,
            ]}>
              Continue
            </Text>
          )}
        </AnimatedButton>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    padding: 24,
  },
  logo: {
    fontSize: 32,
    fontFamily: 'DMSans_900Black',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontFamily: 'DMSans_900Black',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 32,
  },
  sportsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 16,
  },
  sportCardWrapper: {
    width: '47%',
  },
  sportCard: {
    backgroundColor: colors.surface,
    borderWidth: borders.card,
    borderColor: colors.border,
    borderRadius: borderRadius.card,
    padding: 20,
    alignItems: 'center',
    position: 'relative',
    ...shadows.card,
  },
  checkBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 1,
  },
  checkIcon: {
    width: 20,
    height: 20,
  },
  sportIconContainer: {
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  sportIcon: {
    width: 50,
    height: 50,
  },
  sportName: {
    fontSize: 18,
    fontFamily: 'DMSans_700Bold',
    color: colors.text,
    textAlign: 'center',
  },
  errorText: {
    color: colors.error,
    fontSize: 14,
    fontFamily: 'DMSans_500Medium',
    textAlign: 'center',
    marginTop: 16,
  },
  helperText: {
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 24,
  },
  continueButton: {
    backgroundColor: colors.accent,
    borderRadius: borderRadius.button,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: borders.button,
    borderColor: colors.border,
    marginTop: 'auto',
    ...shadows.card,
  },
  continueButtonDisabled: {
    backgroundColor: '#E8E8E8',
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'DMSans_900Black',
  },
  continueButtonTextDisabled: {
    color: '#999999',
  },
});
