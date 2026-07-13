import type { PropsWithChildren } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { haptics } from '@/lib/haptics';
import { motion } from '@/theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface PressableScaleProps extends PropsWithChildren<Omit<PressableProps, 'style'>> {
  style?: StyleProp<ViewStyle>;
  /** Scale at full press. */
  pressedScale?: number;
  haptic?: boolean;
}

/**
 * The press-feel of every touchable in Glowi: spring scale + soft haptic.
 *
 * Defaults `accessibilityRole` to "button" so that every touchable built on this
 * primitive is announced as one. Screens still owe it an `accessibilityLabel`
 * whenever the child isn't self-describing text (icon-only buttons, image tiles).
 */
export function PressableScale({
  children,
  style,
  pressedScale = 0.97,
  haptic = true,
  accessibilityRole = 'button',
  onPressIn,
  onPress,
  ...rest
}: PressableScaleProps) {
  const scale = useSharedValue(1);
  const reduceMotion = useReducedMotion();
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AnimatedPressable
      {...rest}
      accessibilityRole={accessibilityRole}
      style={[animatedStyle, style]}
      onPressIn={(e) => {
        if (!reduceMotion) {
          scale.value = withTiming(pressedScale, { duration: motion.fast, easing: motion.easing });
        }
        onPressIn?.(e);
      }}
      onPressOut={() => {
        if (!reduceMotion) scale.value = withSpring(1, { damping: 14, stiffness: 220 });
      }}
      onPress={(e) => {
        if (haptic) haptics.tap();
        onPress?.(e);
      }}
    >
      {children}
    </AnimatedPressable>
  );
}
