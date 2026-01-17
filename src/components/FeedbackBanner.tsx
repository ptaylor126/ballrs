import React from 'react';
import {
  View,
  Image,
  StyleSheet,
  TouchableOpacity,
  Linking,
} from 'react-native';

/**
 * FeedbackBanner Component
 *
 * Banner that displays feedback/newsletter signup and opens a URL when tapped.
 * Standard banner size: 320x50 (with padding = 60px total height)
 */

// Toggle this to hide banners for screenshots
const HIDE_FOR_SCREENSHOTS = true;

// Feedback banner image
const feedbackBannerImage = require('../../assets/images/feedback-banner.png');

interface FeedbackBannerProps {
  url?: string;
}

export default function FeedbackBanner({ url = 'mailto:hello@ballrs.net' }: FeedbackBannerProps) {
  // Hide for App Store screenshots
  if (HIDE_FOR_SCREENSHOTS) {
    return null;
  }

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
        style={styles.bannerTouchable}
        onPress={handlePress}
        activeOpacity={0.9}
      >
        <Image
          source={feedbackBannerImage}
          style={styles.bannerImage}
          resizeMode="contain"
        />
      </TouchableOpacity>
    </View>
  );
}

// Banner height constant for use in other components
export const FEEDBACK_BANNER_HEIGHT = 60;

const styles = StyleSheet.create({
  container: {
    height: FEEDBACK_BANNER_HEIGHT,
    width: '100%',
    backgroundColor: '#F5F2EB',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 16,
  },
  bannerTouchable: {
    height: 50,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bannerImage: {
    width: '100%',
    height: 50,
  },
});
