import React from 'react';
import {
  View,
  Image,
  StyleSheet,
  TouchableOpacity,
  Linking,
} from 'react-native';

/**
 * AdBanner Component
 *
 * Custom ad banner that displays an image and opens a URL when tapped.
 * Standard banner size: 320x50 (with padding = 60px total height)
 */

// Ad banner image
const adBannerImage = require('../../assets/images/ad-banner.png');

interface AdBannerProps {
  url?: string;
}

export default function AdBanner({ url = 'https://parlaysfordays.com' }: AdBannerProps) {
  const handlePress = async () => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      }
    } catch (error) {
      console.error('Failed to open URL:', error);
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.adTouchable}
        onPress={handlePress}
        activeOpacity={0.9}
      >
        <Image
          source={adBannerImage}
          style={styles.adImage}
          resizeMode="contain"
        />
      </TouchableOpacity>
    </View>
  );
}

// Ad banner height constant for use in other components
export const AD_BANNER_HEIGHT = 60;

const styles = StyleSheet.create({
  container: {
    height: AD_BANNER_HEIGHT,
    width: '100%',
    backgroundColor: '#E8E8E8',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 16,
  },
  adTouchable: {
    height: 50,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  adImage: {
    width: '100%',
    height: 50,
  },
});
