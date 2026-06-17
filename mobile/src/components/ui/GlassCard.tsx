import type { PropsWithChildren } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

import { palette, radii, spacing } from '@/theme';
import { InnerHighlight, glowShadow } from './effects';

type Tier = 'sunken' | 'raised' | 'glow';

interface GlassCardProps extends PropsWithChildren {
  style?: StyleProp<ViewStyle>;
  /** Depth tier — sunken (wells), raised (default card), glow (hero/active, one per screen). */
  tier?: Tier;
  /** Raised: the slightly stronger latest-scan-strip variant (§3). */
  strong?: boolean;
  /** Glow: a selected list row — brighter border (§3). */
  selected?: boolean;
  padded?: boolean;
}

// Style keys that arrange {children} rather than position the card itself.
// These must go on the content wrapper, never the outer frame — the outer
// frame always has exactly one child (the gradient/blur surface), which
// relies on column-direction cross-axis stretch to fill the card's width;
// forwarding flexDirection/alignItems onto it would flip that axis and let
// the surface shrink to its own content, clipped by the outer's
// overflow: hidden.
const ARRANGEMENT_KEYS = [
  'flexDirection',
  'alignItems',
  'justifyContent',
  'flexWrap',
  'gap',
  'rowGap',
  'columnGap',
] as const;

function splitArrangementStyle(style: StyleProp<ViewStyle>): [ViewStyle, ViewStyle] {
  const flat = { ...(StyleSheet.flatten(style) ?? {}) } as Record<string, unknown>;
  const arrangement: Record<string, unknown> = {};
  for (const key of ARRANGEMENT_KEYS) {
    if (flat[key] !== undefined) {
      arrangement[key] = flat[key];
      delete flat[key];
    }
  }
  return [flat as ViewStyle, arrangement as ViewStyle];
}

// Exact §3 gradient stops, per tier.
const RAISED_FILL: [string, string] = ['rgba(255,255,255,0.05)', 'rgba(255,255,255,0.018)'];
const RAISED_STRONG_FILL: [string, string] = ['rgba(255,255,255,0.06)', 'rgba(255,255,255,0.02)'];
const GLOW_FILL: [string, string] = ['rgba(94,234,212,0.14)', 'rgba(94,234,212,0.03)'];

/**
 * Frosted glass surface — the standard Glowi container, in three depth tiers
 * (DESIGN_PRINCIPLES §1, exact values COMPONENT_FIDELITY §3). Real blur on iOS;
 * translucent fill elsewhere (Android blur is costly). Every Raised/Glow card
 * carries the inner top highlight that makes it read as lit glass.
 */
export function GlassCard({
  children,
  style,
  tier = 'raised',
  strong = false,
  selected = false,
  padded = true,
}: GlassCardProps) {
  const [outerStyle, arrangement] = splitArrangementStyle(style);
  const inner = <View style={[padded && styles.padding, arrangement]}>{children}</View>;

  if (tier === 'sunken') {
    return <View style={[styles.outer, styles.sunken, outerStyle]}>{inner}</View>;
  }

  const isGlow = tier === 'glow';
  const fill = isGlow ? GLOW_FILL : strong ? RAISED_STRONG_FILL : RAISED_FILL;
  const highlightColor = isGlow
    ? 'rgba(255,255,255,0.1)'
    : strong
      ? 'rgba(255,255,255,0.06)'
      : 'rgba(255,255,255,0.05)';

  const surface = (
    <LinearGradient colors={fill} style={styles.inner}>
      {inner}
      <InnerHighlight color={highlightColor} />
    </LinearGradient>
  );

  const tierStyle: ViewStyle = isGlow
    ? {
        borderColor: selected ? 'rgba(94,234,212,0.4)' : 'rgba(94,234,212,0.28)',
        ...glowShadow({ y: 14, blur: 36, spread: -14, color: 'rgba(45,212,191,0.4)' }),
      }
    : { borderColor: strong ? 'rgba(255,255,255,0.09)' : palette.border };

  return (
    <View style={[styles.outer, tierStyle, outerStyle]}>
      {Platform.OS === 'ios' ? (
        <BlurView intensity={isGlow ? 14 : 22} tint="dark" style={styles.blur}>
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
    overflow: 'hidden',
    backgroundColor: Platform.OS === 'ios' ? 'transparent' : palette.bgElevated,
  },
  blur: { borderRadius: radii.lg, alignSelf: 'stretch', minWidth: 0 },
  inner: { borderRadius: radii.lg, alignSelf: 'stretch', minWidth: 0 },
  padding: { padding: spacing(4), alignSelf: 'stretch', minWidth: 0 },
  sunken: {
    backgroundColor: palette.surfaceSunken,
    borderColor: 'rgba(255,255,255,0.06)',
  },
});
