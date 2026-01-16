import React from 'react';
import { View, Image, Text, StyleSheet } from 'react-native';

// Profile icon images mapping
const profileIconImages: Record<string, any> = {
  'basketball': require('../../assets/images/icon-basketball.png'),
  'soccer': require('../../assets/images/icon-soccer.png'),
  'football': require('../../assets/images/icon-football.png'),
  'baseball': require('../../assets/images/icon-baseball.png'),
  'heart': require('../../assets/images/profile-icons/icon-profile-heart.png'),
  'glasses': require('../../assets/images/profile-icons/icon-profile-glasses.png'),
  'ghost': require('../../assets/images/profile-icons/icon-profile-ghost.png'),
  'cactus': require('../../assets/images/profile-icons/icon-profile-cactus.png'),
  'pizza': require('../../assets/images/profile-icons/icon-profile-pizza.png'),
  'donut': require('../../assets/images/profile-icons/icon-profile-donut.png'),
  'unicorn': require('../../assets/images/profile-icons/icon-profile-unicorn.png'),
  'alien': require('../../assets/images/profile-icons/icon-profile-alien.png'),
  'robot': require('../../assets/images/profile-icons/icon-profile-robot.png'),
  'ninja': require('../../assets/images/profile-icons/icon-profile-ninja.png'),
};


interface UserProfileIconProps {
  iconUrl: string | null | undefined;
  size?: number;
  fallbackText?: string;
}

export default function UserProfileIcon({
  iconUrl,
  size = 32,
  fallbackText = '?',
}: UserProfileIconProps) {
  const iconImage = iconUrl ? profileIconImages[iconUrl] : null;

  // If user has an icon, display it
  if (iconImage) {
    return (
      <Image
        source={iconImage}
        style={{
          width: size,
          height: size,
        }}
        resizeMode="contain"
      />
    );
  }

  // Fallback: show initial in a black circle with white text
  return (
    <View
      style={[
        styles.fallbackContainer,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
        },
      ]}
    >
      <Text
        style={[
          styles.fallbackText,
          { fontSize: size * 0.4 },
        ]}
      >
        {fallbackText.charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fallbackContainer: {
    backgroundColor: '#1A1A1A',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#000000',
  },
  fallbackText: {
    fontFamily: 'DMSans_900Black',
    color: '#FFFFFF',
  },
});
