import type { ReactNode } from 'react';
import { StyleSheet, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';

import { palette } from '@/theme';
import { AppText } from './AppText';

/**
 * The five COMPONENT_FIDELITY §0 effects that React Native can't express
 * natively, built as the prescribed shared primitives. A flat `rgba()` fill is
 * never an acceptable substitute for any of these — that flatness is the exact
 * "vibe-coded" tell the redesign exists to kill.
 *
 *  - InnerHighlight — the 1px lit-glass top edge (the inset highlight trick).
 *  - glowShadow     — the negative-spread colored glow (RN 0.85 `boxShadow`).
 *  - GradientText   — jade gradient text via MaskedView.
 *
 * BlurView glass lives in GlassCard/TabBar; the aurora lives in
 * AuroraBackground (Skia). Both already use real techniques.
 */

// ---------------------------------------------------------------------------
// Inner top highlight — "50% of the lit-glass read" (§0). A thin gradient band
// pinned to a card's top edge, fading downward, clipped by the parent's radius
// + overflow:hidden. NOT a flat hairline border.
// ---------------------------------------------------------------------------

interface InnerHighlightProps {
  /** Top-edge color at full strength (fades to transparent). */
  color?: string;
  /** Band height in px — keep small; this is a sheen, not a glare. */
  height?: number;
}

export function InnerHighlight({
  color = 'rgba(255,255,255,0.12)',
  height = 5,
}: InnerHighlightProps) {
  return (
    <LinearGradient
      colors={[color, 'transparent']}
      style={[styles.highlight, { height, pointerEvents: 'none' }]}
    />
  );
}

// ---------------------------------------------------------------------------
// Colored glow — negative-spread box shadow (§0). RN 0.85's `boxShadow` style
// prop renders this faithfully on web and New-Architecture native alike, so the
// jade halo no longer disappears on Android the way `shadowColor` did.
// ---------------------------------------------------------------------------

interface GlowOptions {
  y?: number;
  blur?: number;
  /** Negative spread tightens the halo to the element's footprint. */
  spread?: number;
  color?: string;
}

export function glowShadow({
  y = 12,
  blur = 34,
  spread = -8,
  color = 'rgba(45,212,191,0.6)',
}: GlowOptions = {}): ViewStyle {
  return { boxShadow: `0px ${y}px ${blur}px ${spread}px ${color}` } as ViewStyle;
}

// ---------------------------------------------------------------------------
// Gradient text — no native gradient-fill on text; mask a gradient with the
// glyphs (§0). Used for the jade emphasis word, "Guest", the Glowi wordmark.
// ---------------------------------------------------------------------------

interface GradientTextProps {
  children: ReactNode;
  /** Gradient fill stops (default = the jade button gradient). */
  colors?: [string, string, ...string[]];
  style?: StyleProp<TextStyle>;
}

export function GradientText({
  children,
  colors = [palette.accentBright, palette.accent],
  style,
}: GradientTextProps) {
  return (
    <MaskedView
      maskElement={
        // White glyphs: web masks by luminance (white = visible), native by
        // alpha — opaque white satisfies both, black would hide the fill on web.
        <AppText style={[styles.maskText, style]} color="#fff">
          {children}
        </AppText>
      }
    >
      <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0.6 }}>
        {/* Invisible sizer: gives the gradient the text's exact footprint. */}
        <AppText style={[styles.maskText, style]} color="transparent">
          {children}
        </AppText>
      </LinearGradient>
    </MaskedView>
  );
}

const styles = StyleSheet.create({
  highlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  // The mask glyphs must be fully opaque so the gradient shows through them;
  // background must be transparent so the surrounding area is cut away.
  maskText: { backgroundColor: 'transparent' },
});
