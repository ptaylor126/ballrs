import React from 'react';
import { View, StyleSheet, Platform, ViewStyle, StyleProp } from 'react-native';

/**
 * ShadowView - Cross-platform neo-brutalist shadow component
 *
 * On iOS: Uses native shadow properties
 * On Android: Renders a pseudo-shadow element behind the content
 *
 * Usage:
 * <ShadowView shadowOffset={2} borderRadius={16}>
 *   <YourContent />
 * </ShadowView>
 */

interface ShadowViewProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  shadowOffset?: number;
  shadowColor?: string;
  borderRadius?: number;
}

export default function ShadowView({
  children,
  style,
  shadowOffset = 2,
  shadowColor = '#000000',
  borderRadius = 0,
}: ShadowViewProps) {
  if (Platform.OS === 'ios') {
    // iOS uses native shadows
    return (
      <View
        style={[
          {
            shadowColor,
            shadowOffset: { width: shadowOffset, height: shadowOffset },
            shadowOpacity: 1,
            shadowRadius: 0,
          },
          style,
        ]}
      >
        {children}
      </View>
    );
  }

  // Android: render pseudo-shadow
  return (
    <View style={[styles.container, style]}>
      {/* Shadow layer */}
      <View
        style={[
          styles.shadow,
          {
            backgroundColor: shadowColor,
            borderRadius,
            top: shadowOffset,
            left: shadowOffset,
          },
        ]}
      />
      {/* Content layer */}
      <View style={[styles.content, { borderRadius }]}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  shadow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: -2,
    bottom: -2,
    zIndex: 0,
  },
  content: {
    position: 'relative',
    zIndex: 1,
    overflow: 'hidden',
  },
});
