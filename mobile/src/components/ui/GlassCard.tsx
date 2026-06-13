import type { PropsWithChildren } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';

import { palette, radii, spacing } from '@/theme';

interface GlassCardProps extends PropsWithChildren {
  style?: StyleProp<ViewStyle>;
  /** Stronger surface for emphasized cards. */
  emphasized?: boolean;
  /** Jade glow halo (hero cards, active states). */
  glow?: boolean;
  padded?: boolean;
}

/**
 * Frosted glass surface — the standard Glowi container.
 * Real blur on iOS; translucent fill elsewhere (Android blur is costly).
 */
export function GlassCard({ children, style, emphasized, glow, padded = true }: GlassCardProps) {
  const surface = (
    <View
      style={[
        styles.inner,
        { backgroundColor: emphasized ? palette.surfaceStrong : palette.surface },
        padded && styles.padding,
      ]}
    >
      {children}
    </View>
  );

  return (
    <View style={[styles.outer, glow && styles.glow, style]}>
      {Platform.OS === 'ios' ? (
        <BlurView intensity={28} tint="dark" style={styles.blur}>
          {surface}
        </BlurView>
      ) : (
        surface
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
    overflow: 'hidden',
    backgroundColor: Platform.OS === 'ios' ? 'transparent' : palette.bgElevated,
  },
  blur: { borderRadius: radii.lg },
  inner: { borderRadius: radii.lg },
  padding: { padding: spacing(4) },
  glow: {
    shadowColor: palette.accentBright,
    shadowOpacity: 0.35,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
    borderColor: 'rgba(94,234,212,0.25)',
  },
});
