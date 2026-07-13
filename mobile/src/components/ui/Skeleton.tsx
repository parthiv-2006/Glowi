import { useEffect } from 'react';
import { type DimensionValue, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { palette, radii } from '@/theme';

interface SkeletonProps {
  width?: DimensionValue;
  height?: number;
  radius?: number;
  style?: ViewStyle;
}

/**
 * Breathing placeholder shimmer for loading states. The pulse is an infinite
 * animation, so it stops entirely under reduce-motion.
 *
 * Hidden from assistive tech: a skeleton is a picture of content that isn't there
 * yet, and announcing a row of empty boxes is worse than announcing nothing.
 */
export function Skeleton({ width = '100%', height = 16, radius = radii.sm, style }: SkeletonProps) {
  const opacity = useSharedValue(0.4);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (reduceMotion) {
      opacity.value = 0.65;
      return;
    }
    opacity.value = withRepeat(
      withSequence(withTiming(0.9, { duration: 700 }), withTiming(0.4, { duration: 700 })),
      -1,
    );
  }, [opacity, reduceMotion]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        { width, height, borderRadius: radius, backgroundColor: palette.surfaceStrong },
        animatedStyle,
        style,
      ]}
    />
  );
}
