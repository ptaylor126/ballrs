import React, { useRef, useEffect, useState } from 'react';
import {
  Animated,
  TouchableWithoutFeedback,
  TouchableOpacity,
  View,
  StyleSheet,
  ViewStyle,
  ImageStyle,
  StyleProp,
  Easing,
  Image,
  ImageSourcePropType,
} from 'react-native';

// ============================================
// ANIMATED BUTTON
// Press animation: button moves into shadow
// Cross-platform shadow using background View
// ============================================

interface AnimatedButtonProps {
  children: React.ReactNode;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  shadowColor?: string;
  shadowOffset?: number;
}

export function AnimatedButton({
  children,
  onPress,
  style,
  disabled = false,
  shadowColor = '#000000',
  shadowOffset = 2,
}: AnimatedButtonProps) {
  const pressAnim = useRef(new Animated.Value(0)).current;

  const handlePressIn = () => {
    Animated.timing(pressAnim, {
      toValue: 1,
      duration: 100,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.timing(pressAnim, {
      toValue: 0,
      duration: 100,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  };

  const translateX = pressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, shadowOffset],
  });

  const translateY = pressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, shadowOffset],
  });

  // Extract style properties
  const flatStyle = StyleSheet.flatten(style) || {};
  const containerStyle: any = {};
  const innerStyle: any = { ...flatStyle };

  // Move layout properties to container, remove from inner view
  if (flatStyle.width) {
    containerStyle.width = flatStyle.width;
    delete innerStyle.width;
  }
  if (flatStyle.flex) {
    containerStyle.flex = flatStyle.flex;
    delete innerStyle.flex;
  }
  if (flatStyle.alignSelf) {
    containerStyle.alignSelf = flatStyle.alignSelf;
    delete innerStyle.alignSelf;
  }
  if (flatStyle.marginBottom) {
    containerStyle.marginBottom = flatStyle.marginBottom;
    delete innerStyle.marginBottom;
  }
  if (flatStyle.marginTop) {
    containerStyle.marginTop = flatStyle.marginTop;
    delete innerStyle.marginTop;
  }
  if (flatStyle.marginLeft) {
    containerStyle.marginLeft = flatStyle.marginLeft;
    delete innerStyle.marginLeft;
  }
  if (flatStyle.marginRight) {
    containerStyle.marginRight = flatStyle.marginRight;
    delete innerStyle.marginRight;
  }
  if (flatStyle.margin) {
    containerStyle.margin = flatStyle.margin;
    delete innerStyle.margin;
  }

  // Get border radius for shadow
  const borderRadius = flatStyle.borderRadius || 8;

  return (
    <TouchableOpacity
      onPress={disabled ? undefined : onPress}
      onPressIn={disabled ? undefined : handlePressIn}
      onPressOut={disabled ? undefined : handlePressOut}
      activeOpacity={1}
      disabled={disabled}
      style={[containerStyle, { position: 'relative' }]}
    >
      {/* Shadow layer - positioned behind */}
      <View
        style={{
          position: 'absolute',
          top: shadowOffset,
          left: shadowOffset,
          right: -shadowOffset,
          bottom: -shadowOffset,
          backgroundColor: shadowColor,
          borderRadius: borderRadius,
        }}
      />
      {/* Content layer */}
      <Animated.View
        style={[
          innerStyle,
          {
            transform: [{ translateX }, { translateY }],
          },
          disabled && { opacity: 0.6 },
        ]}
      >
        {children}
      </Animated.View>
    </TouchableOpacity>
  );
}

// ============================================
// ANIMATED CARD
// Scale animation on press
// Cross-platform shadow using background View
// ============================================

interface AnimatedCardProps {
  children: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  shadowColor?: string;
  shadowOffset?: number;
}

export function AnimatedCard({
  children,
  onPress,
  style,
  disabled = false,
  shadowColor = '#000000',
  shadowOffset = 2,
}: AnimatedCardProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.timing(scaleAnim, {
      toValue: 0.98,
      duration: 150,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 5,
      tension: 100,
      useNativeDriver: true,
    }).start();
  };

  // Extract style properties
  const flatStyle = StyleSheet.flatten(style) || {};
  const containerStyle: any = {};
  const innerStyle: any = { ...flatStyle };

  // Move layout properties to container
  if (flatStyle.marginBottom) {
    containerStyle.marginBottom = flatStyle.marginBottom;
    delete innerStyle.marginBottom;
  }
  if (flatStyle.marginTop) {
    containerStyle.marginTop = flatStyle.marginTop;
    delete innerStyle.marginTop;
  }
  if (flatStyle.margin) {
    containerStyle.margin = flatStyle.margin;
    delete innerStyle.margin;
  }
  if (flatStyle.width) {
    containerStyle.width = flatStyle.width;
    delete innerStyle.width;
  }
  if (flatStyle.alignSelf) {
    containerStyle.alignSelf = flatStyle.alignSelf;
    delete innerStyle.alignSelf;
  }

  // Get border radius for shadow
  const borderRadius = flatStyle.borderRadius || 12;

  // Remove iOS shadow props from inner style (they're replaced by fake shadow)
  delete innerStyle.shadowColor;
  delete innerStyle.shadowOffset;
  delete innerStyle.shadowOpacity;
  delete innerStyle.shadowRadius;
  delete innerStyle.elevation;

  const cardContent = (
    <View style={[containerStyle, { position: 'relative' }]}>
      {/* Shadow layer - positioned behind */}
      <View
        style={{
          position: 'absolute',
          top: shadowOffset,
          left: shadowOffset,
          right: -shadowOffset,
          bottom: -shadowOffset,
          backgroundColor: shadowColor,
          borderRadius: borderRadius,
        }}
      />
      {/* Content layer */}
      <View style={innerStyle}>
        {children}
      </View>
    </View>
  );

  if (!onPress) {
    return cardContent;
  }

  return (
    <TouchableWithoutFeedback
      onPress={disabled ? undefined : onPress}
      onPressIn={disabled ? undefined : handlePressIn}
      onPressOut={disabled ? undefined : handlePressOut}
    >
      <Animated.View
        style={[
          containerStyle,
          { position: 'relative' },
          { transform: [{ scale: scaleAnim }] },
        ]}
      >
        {/* Shadow layer - positioned behind */}
        <View
          style={{
            position: 'absolute',
            top: shadowOffset,
            left: shadowOffset,
            right: -shadowOffset,
            bottom: -shadowOffset,
            backgroundColor: shadowColor,
            borderRadius: borderRadius,
          }}
        />
        {/* Content layer */}
        <View style={innerStyle}>
          {children}
        </View>
      </Animated.View>
    </TouchableWithoutFeedback>
  );
}

// ============================================
// CARD (Non-animated)
// Simple card with cross-platform shadow
// ============================================

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  shadowColor?: string;
  shadowOffset?: number;
}

export function Card({
  children,
  style,
  shadowColor = '#000000',
  shadowOffset = 2,
}: CardProps) {
  // Extract style properties
  const flatStyle = StyleSheet.flatten(style) || {};
  const containerStyle: any = {};
  const innerStyle: any = { ...flatStyle };

  // Move layout properties to container
  if (flatStyle.marginBottom) {
    containerStyle.marginBottom = flatStyle.marginBottom;
    delete innerStyle.marginBottom;
  }
  if (flatStyle.marginTop) {
    containerStyle.marginTop = flatStyle.marginTop;
    delete innerStyle.marginTop;
  }
  if (flatStyle.margin) {
    containerStyle.margin = flatStyle.margin;
    delete innerStyle.margin;
  }

  // Get border radius for shadow
  const borderRadius = flatStyle.borderRadius || 12;

  // Remove iOS shadow props
  delete innerStyle.shadowColor;
  delete innerStyle.shadowOffset;
  delete innerStyle.shadowOpacity;
  delete innerStyle.shadowRadius;
  delete innerStyle.elevation;

  return (
    <View style={[containerStyle, { position: 'relative' }]}>
      {/* Shadow layer - positioned behind */}
      <View
        style={{
          position: 'absolute',
          top: shadowOffset,
          left: shadowOffset,
          right: -shadowOffset,
          bottom: -shadowOffset,
          backgroundColor: shadowColor,
          borderRadius: borderRadius,
        }}
      />
      {/* Content layer */}
      <View style={innerStyle}>
        {children}
      </View>
    </View>
  );
}

// ============================================
// ANIMATED NAV ICON
// Pop effect on tap
// ============================================

interface AnimatedNavIconProps {
  children: React.ReactNode;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}

export function AnimatedNavIcon({
  children,
  onPress,
  style,
}: AnimatedNavIconProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.9,
        duration: 50,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 5,
        tension: 200,
        useNativeDriver: true,
      }),
    ]).start();

    onPress();
  };

  return (
    <TouchableWithoutFeedback
      onPress={handlePress}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      accessible={false}
    >
      <Animated.View
        style={[
          style,
          {
            transform: [{ scale: scaleAnim }],
            minWidth: 44,
            minHeight: 44,
            justifyContent: 'center',
            alignItems: 'center',
          },
        ]}
      >
        {children}
      </Animated.View>
    </TouchableWithoutFeedback>
  );
}

// ============================================
// ANIMATED CHECKMARK
// Bounce-in effect (scale 0 -> 1.2 -> 1.0)
// ============================================

interface AnimatedCheckmarkProps {
  visible: boolean;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  delay?: number;
}

export function AnimatedCheckmark({
  visible,
  children,
  style,
  delay = 0,
}: AnimatedCheckmarkProps) {
  const scaleAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      scaleAnim.setValue(0);
      Animated.sequence([
        Animated.delay(delay),
        Animated.spring(scaleAnim, {
          toValue: 1.2,
          friction: 6,
          tension: 150,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 100,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      scaleAnim.setValue(0);
    }
  }, [visible, delay]);

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        style,
        {
          transform: [{ scale: scaleAnim }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

// ============================================
// PULSING ICON
// Pulse animation for streak fire icon
// ============================================

interface PulsingIconProps {
  source: ImageSourcePropType;
  style?: StyleProp<ImageStyle>;
  active?: boolean;
  pulseScale?: number;
  duration?: number;
}

export function PulsingIcon({
  source,
  style,
  active = true,
  pulseScale = 1.1,
  duration = 2000,
}: PulsingIconProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (active) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(scaleAnim, {
            toValue: pulseScale,
            duration: duration / 2,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 1,
            duration: duration / 2,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      scaleAnim.setValue(1);
    }
  }, [active, pulseScale, duration]);

  return (
    <Animated.Image
      source={source}
      style={[
        style,
        {
          transform: [{ scale: scaleAnim }],
        },
      ]}
    />
  );
}

// ============================================
// ANIMATED XP BAR
// Smooth width animation
// ============================================

interface AnimatedXPBarProps {
  progress: number; // 0-100
  style?: StyleProp<ViewStyle>;
  fillStyle?: StyleProp<ViewStyle>;
  duration?: number;
}

export function AnimatedXPBar({
  progress,
  style,
  fillStyle,
  duration = 500,
}: AnimatedXPBarProps) {
  const widthAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(widthAnim, {
      toValue: progress,
      duration,
      easing: Easing.out(Easing.ease),
      useNativeDriver: false,
    }).start();
  }, [progress, duration]);

  const width = widthAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={style}>
      <Animated.View style={[fillStyle, { width }]} />
    </View>
  );
}

// ============================================
// ANIMATED TOAST
// Slide in from top with bounce, fade out
// ============================================

interface AnimatedToastProps {
  visible: boolean;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  duration?: number;
  onDismiss?: () => void;
}

export function AnimatedToast({
  visible,
  children,
  style,
  duration = 2000,
  onDismiss,
}: AnimatedToastProps) {
  const slideAnim = useRef(new Animated.Value(-100)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      // Slide in with bounce
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      // Auto dismiss
      const timer = setTimeout(() => {
        Animated.parallel([
          Animated.timing(slideAnim, {
            toValue: -100,
            duration: 300,
            easing: Easing.in(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnim, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
        ]).start(() => {
          onDismiss?.();
        });
      }, duration);

      return () => clearTimeout(timer);
    } else {
      slideAnim.setValue(-100);
      opacityAnim.setValue(0);
    }
  }, [visible, duration, onDismiss]);

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        style,
        {
          transform: [{ translateY: slideAnim }],
          opacity: opacityAnim,
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

// ============================================
// ANIMATED TAB INDICATOR
// Smooth sliding indicator
// ============================================

interface AnimatedTabIndicatorProps {
  activeIndex: number;
  tabCount: number;
  tabWidth: number;
  style?: StyleProp<ViewStyle>;
  indicatorStyle?: StyleProp<ViewStyle>;
}

export function AnimatedTabIndicator({
  activeIndex,
  tabCount,
  tabWidth,
  style,
  indicatorStyle,
}: AnimatedTabIndicatorProps) {
  const translateXAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(translateXAnim, {
      toValue: activeIndex * tabWidth,
      duration: 200,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, [activeIndex, tabWidth]);

  return (
    <View style={[style, { width: tabWidth * tabCount }]}>
      <Animated.View
        style={[
          indicatorStyle,
          {
            width: tabWidth,
            transform: [{ translateX: translateXAnim }],
          },
        ]}
      />
    </View>
  );
}

// ============================================
// COUNT UP ANIMATION
// For level up modal numbers
// ============================================

interface CountUpProps {
  end: number;
  start?: number;
  duration?: number;
  style?: StyleProp<ViewStyle>;
  renderText: (value: number) => React.ReactNode;
}

export function CountUp({
  end,
  start = 0,
  duration = 500,
  renderText,
}: CountUpProps) {
  const [currentValue, setCurrentValue] = useState(start);
  const animValue = useRef(new Animated.Value(start)).current;

  useEffect(() => {
    animValue.setValue(start);

    const listener = animValue.addListener(({ value }) => {
      setCurrentValue(Math.round(value));
    });

    Animated.timing(animValue, {
      toValue: end,
      duration,
      easing: Easing.out(Easing.ease),
      useNativeDriver: false,
    }).start();

    return () => {
      animValue.removeListener(listener);
    };
  }, [end, start, duration]);

  return <>{renderText(currentValue)}</>;
}

// ============================================
// SLIDE UP MODAL
// For level up and other modals
// ============================================

interface SlideUpModalProps {
  visible: boolean;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function SlideUpModal({
  visible,
  children,
  style,
}: SlideUpModalProps) {
  const slideAnim = useRef(new Animated.Value(300)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      slideAnim.setValue(300);
      opacityAnim.setValue(0);
    }
  }, [visible]);

  return (
    <Animated.View
      style={[
        style,
        {
          transform: [{ translateY: slideAnim }],
          opacity: opacityAnim,
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

// ============================================
// LOADING SPINNER
// Smooth rotation with sport color
// ============================================

interface LoadingSpinnerProps {
  color?: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
}

export function LoadingSpinner({
  color = '#1ABC9C',
  size = 40,
  style,
}: LoadingSpinnerProps) {
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const spin = Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 1000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    spin.start();
    return () => spin.stop();
  }, []);

  const rotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 3,
          borderColor: color,
          borderTopColor: 'transparent',
          transform: [{ rotate }],
        },
        style,
      ]}
    />
  );
}
