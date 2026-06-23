import type { PropsWithChildren } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { palette, radii, spacing } from '@/theme';

type Tier = 'sunken' | 'raised' | 'glow';

interface GlassCardProps extends PropsWithChildren {
  style?: StyleProp<ViewStyle>;
  /** Depth tier — sunken (wells/inputs), raised (default card), glow (hero/active, one per screen). */
  tier?: Tier;
  /** Raised: slightly stronger border variant. */
  strong?: boolean;
  /** Glow: selected state — clayBright border highlight. */
  selected?: boolean;
  padded?: boolean;
}

// Style keys that arrange children — must go on the inner wrapper, not the outer frame.
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

/**
 * Warm paper surface — the standard Glowi container, in three depth tiers.
 * Replaces the old frosted-glass GlassCard; surfaces are now opaque paper.
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
    return <View style={[styles.base, styles.sunken, outerStyle]}>{inner}</View>;
  }

  if (tier === 'glow') {
    // Hero card — warm gradient fill, hero radius
    return (
      <View style={[styles.base, styles.hero, selected && styles.heroSelected, outerStyle]}>
        <LinearGradient
          colors={['#FBEFE2', '#F1D8C6']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroGradient}
        >
          {inner}
        </LinearGradient>
      </View>
    );
  }

  // raised (default) — opaque paper card
  return (
    <View style={[styles.base, styles.raised, strong && styles.raisedStrong, outerStyle]}>
      {inner}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.line,
    overflow: 'hidden',
  },
  raised: {
    backgroundColor: palette.card,
  },
  raisedStrong: {
    borderColor: palette.lineStrong,
  },
  sunken: {
    backgroundColor: palette.well,
  },
  hero: {
    borderRadius: radii.xl,
    borderColor: '#E8D4C2',
    overflow: 'hidden',
  },
  heroSelected: {
    borderColor: palette.clayBright,
  },
  heroGradient: {
    borderRadius: radii.xl,
  },
  padding: {
    padding: spacing(4),
    alignSelf: 'stretch',
    minWidth: 0,
  },
});
