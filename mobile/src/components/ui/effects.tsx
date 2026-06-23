import type { ReactNode } from 'react';
import { StyleSheet, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';

import { palette } from '@/theme';
import { AppText } from './AppText';

// ---------------------------------------------------------------------------
// Clay glow shadow — used on CTA buttons and hero elements.
// ---------------------------------------------------------------------------

interface GlowOptions {
  y?: number;
  blur?: number;
  /** Negative spread tightens the halo to the element's footprint. */
  spread?: number;
  color?: string;
}

export function glowShadow({
  y = 16,
  blur = 34,
  spread = -12,
  color = 'rgba(188,94,56,0.55)',
}: GlowOptions = {}): ViewStyle {
  return { boxShadow: `0px ${y}px ${blur}px ${spread}px ${color}` } as ViewStyle;
}

// ---------------------------------------------------------------------------
// Clay gradient text via MaskedView.
// ---------------------------------------------------------------------------

interface GradientTextProps {
  children: ReactNode;
  colors?: [string, string, ...string[]];
  style?: StyleProp<TextStyle>;
}

export function GradientText({
  children,
  colors = [palette.clayBright, palette.clay],
  style,
}: GradientTextProps) {
  return (
    <MaskedView
      maskElement={
        <AppText style={[styles.maskText, style]} color="#fff">
          {children}
        </AppText>
      }
    >
      <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0.6 }}>
        <AppText style={[styles.maskText, style]} color="transparent">
          {children}
        </AppText>
      </LinearGradient>
    </MaskedView>
  );
}

// ---------------------------------------------------------------------------
// Legacy no-op — paper surfaces don't need an inset highlight line.
// ---------------------------------------------------------------------------
export function InnerHighlight(_props?: { color?: string; height?: number }) {
  return null;
}

const styles = StyleSheet.create({
  maskText: { backgroundColor: 'transparent' },
});
