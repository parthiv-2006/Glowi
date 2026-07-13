import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { fonts, motion, palette, radii, spacing } from '@/theme';
import { AppText } from './AppText';
import { PressableScale } from './PressableScale';
import { glowShadow } from './effects';

interface GlowButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'ghost' | 'danger';
  loading?: boolean;
  disabled?: boolean;
  /** Slow diagonal sheen sweep on the primary button — hero CTAs. */
  sheen?: boolean;
  style?: ViewStyle;
  icon?: React.ReactNode;
}

/** Clay gradient CTA — spring press, optional sheen sweep. */
export function GlowButton({
  label,
  onPress,
  variant = 'primary',
  loading,
  disabled,
  sheen,
  style,
  icon,
}: GlowButtonProps) {
  const inactive = disabled || loading;
  const reduceMotion = useReducedMotion();

  const content = (
    <View style={styles.content}>
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? '#FFFFFF' : palette.clay} />
      ) : (
        <>
          {icon}
          <AppText
            variant="heading"
            style={[
              styles.label,
              variant === 'primary' && { color: '#FFFFFF' },
              variant === 'ghost' && { color: palette.clay },
              variant === 'danger' && { color: palette.rose },
            ]}
          >
            {label}
          </AppText>
        </>
      )}
    </View>
  );

  return (
    <PressableScale
      onPress={onPress}
      disabled={inactive}
      style={[
        styles.base,
        variant === 'primary' &&
          glowShadow({ y: 16, blur: 34, spread: -12, color: 'rgba(167,84,50,0.55)' }),
        inactive && styles.disabled,
        style,
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
    >
      {variant === 'primary' ? (
        // clay → clayDeep. The old clayBright → clay ramp put the white label on a
        // light peach at ~2:1 — the primary CTA was the app's worst contrast failure.
        <LinearGradient
          colors={[palette.clay, palette.clayDeep]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.fill}
        >
          {content}
          {sheen && !inactive && !reduceMotion ? <Sheen /> : null}
        </LinearGradient>
      ) : (
        <View style={[styles.fill, styles.ghostFill, variant === 'danger' && styles.dangerFill]}>
          {content}
        </View>
      )}
    </PressableScale>
  );
}

/** Diagonal light sweep across the button face (hero CTAs). */
function Sheen() {
  const [width, setWidth] = useState(0);
  const x = useSharedValue(-120);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: (x.value / 100) * (width || 1) }],
  }));

  if (width === 0) {
    x.value = withDelay(
      400,
      withRepeat(withTiming(220, { duration: 4000, easing: motion.easing }), -1, false),
    );
  }

  return (
    <Animated.View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={[StyleSheet.absoluteFill, styles.sheenClip]}
    >
      <Animated.View style={[styles.sheenBand, animatedStyle]}>
        <LinearGradient
          colors={['transparent', 'rgba(255,255,255,0.32)', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: radii.full, overflow: 'hidden', minHeight: 56 },
  fill: {
    flex: 1,
    paddingHorizontal: spacing(6),
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostFill: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: palette.clay,
    borderRadius: radii.full,
  },
  dangerFill: { borderColor: palette.rose },
  content: { flexDirection: 'row', alignItems: 'center', gap: spacing(2) },
  label: { fontFamily: fonts.bodySemiBold, fontSize: 16 },
  sheenClip: { overflow: 'hidden', pointerEvents: 'none' },
  sheenBand: { position: 'absolute', top: 0, bottom: 0, width: 60 },
  disabled: { opacity: 0.45 },
});
