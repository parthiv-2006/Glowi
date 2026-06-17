import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle,
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
  /** Slow diagonal sheen sweep (primary only) — e.g. the onboarding CTA (§4). */
  sheen?: boolean;
  style?: ViewStyle;
  icon?: React.ReactNode;
}

/** Primary CTA: jade gradient, negative-spread glow, spring press (§4). */
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

  const content = (
    <View style={styles.content}>
      {loading ? (
        <ActivityIndicator
          color={variant === 'primary' ? palette.textOnAccent : palette.accentBright}
        />
      ) : (
        <>
          {icon}
          <AppText
            variant="heading"
            style={[
              styles.label,
              variant === 'primary' && { color: palette.textOnAccent },
              variant === 'ghost' && { color: palette.accentBright },
              variant === 'danger' && { color: palette.danger },
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
        variant === 'primary' && glowShadow({ y: 12, blur: 34, spread: -8, color: palette.glow }),
        inactive && styles.disabled,
        style,
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {variant === 'primary' ? (
        <LinearGradient
          colors={[palette.accentBright, palette.accent]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.fill}
        >
          {content}
          {sheen && !inactive ? <Sheen /> : null}
        </LinearGradient>
      ) : (
        <View style={[styles.fill, styles.ghostFill, variant === 'danger' && styles.dangerFill]}>
          {content}
        </View>
      )}
    </PressableScale>
  );
}

/** A 60px band of light sweeping across the button face, looping (§4 g-sheen). */
function Sheen() {
  const [width, setWidth] = useState(0);
  const x = useSharedValue(-120);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: (x.value / 100) * (width || 1) }],
  }));

  if (width === 0) {
    // Measure once, then kick off the loop (-120% → 220% over 4s, §8).
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
          colors={['transparent', 'rgba(255,255,255,0.4)', 'transparent']}
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
    backgroundColor: palette.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.borderStrong,
    borderRadius: radii.full,
  },
  dangerFill: { borderColor: 'rgba(251,113,133,0.35)' },
  content: { flexDirection: 'row', alignItems: 'center', gap: spacing(2) },
  label: { fontFamily: fonts.bodySemiBold, fontSize: 16 },
  sheenClip: { overflow: 'hidden', pointerEvents: 'none' },
  sheenBand: { position: 'absolute', top: 0, bottom: 0, width: 60 },
  disabled: { opacity: 0.45 },
});
