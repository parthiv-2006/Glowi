/**
 * Glowi design tokens — "Warm Editorial".
 * Cream paper, espresso ink, clay accent, sage/ochre/rose semantics.
 * Every screen and component derives from these; no ad-hoc colors.
 */
import { Easing } from 'react-native-reanimated';

export const palette = {
  // ── Light theme (primary) ─────────────────────────────────────────────
  bg: '#F3ECE1', // paper — screen background
  card: '#FCF8F1', // raised card fill
  well: '#EFE4D6', // sunken inputs / segmented track

  // Ink
  ink: '#2B2521',
  inkSoft: '#6F6358',
  inkFaint: '#A99C8D',

  // Lines
  line: '#E6DCCD',
  lineStrong: '#E0D4C2',

  // Clay accent
  clay: '#BC5E38',
  clayDeep: '#9A4A2C',
  clayBright: '#E0A984',

  // Semantic — warm editorial
  sage: '#75876A', // "good" / positive / improvement
  ochre: '#C2913B', // "moderate" severity
  rose: '#BC5340', // "significant" severity
  blush: '#E8C8B5', // soft fills, avatar gradients

  // ── Dark theme (scan screens, tab bar) ────────────────────────────────
  bgDark: '#211B16',
  bgDarkDeep: '#15110E',
  cardDark: '#2B2420',
  inkDark: '#EFE6D8',
  inkSoftDark: '#B6A893',
  inkFaintDark: '#8C7F6E',
  lineDark: 'rgba(255,255,255,0.08)',
  clayDark: '#D2774E',

  // ── Backward-compat aliases (existing screens use these tokens) ────────
  text: '#2B2521',
  textBody: '#6F6358',
  textSecondary: '#A99C8D',
  textTertiary: '#A99C8D',
  textOnAccent: '#FFFFFF',
  accent: '#BC5E38',
  accentBright: '#E0A984',
  accentDeep: '#9A4A2C',
  accentDim: 'rgba(188,94,56,0.12)',
  glow: 'rgba(188,94,56,0.4)',
  border: '#E6DCCD',
  borderStrong: '#E0D4C2',
  surface: '#FCF8F1',
  surfaceStrong: '#EFE4D6',
  bgElevated: '#FCF8F1',
  bgInput: '#EFE4D6',
  surfaceSunken: '#EFE4D6',
  surfaceRaised: '#FCF8F1',
  surfaceGlow: 'rgba(188,94,56,0.08)',
  danger: '#BC5340',
  warning: '#C2913B',
  success: '#75876A',
} as const;

/** 4pt spacing scale: spacing(4) = 16. */
export const spacing = (n: number): number => n * 4;

export const radii = {
  sm: 10,
  md: 16,
  lg: 20,
  xl: 26,
  full: 999,
} as const;

export const fonts = {
  // Newsreader — serif display & headlines
  serif: 'Newsreader_400Regular',
  serifMedium: 'Newsreader_500Medium',
  serifItalic: 'Newsreader_400Regular_Italic',
  serifMediumItalic: 'Newsreader_500Medium_Italic',
  // Hanken Grotesk — UI / body
  body: 'HankenGrotesk_400Regular',
  bodyMedium: 'HankenGrotesk_500Medium',
  bodySemiBold: 'HankenGrotesk_600SemiBold',
  bodyBold: 'HankenGrotesk_700Bold',
  // Space Mono — overlines, data, labels
  mono: 'SpaceMono_400Regular',
  monoBold: 'SpaceMono_700Bold',
  // Backward-compat aliases
  display: 'Newsreader_500Medium',
  displayBold: 'Newsreader_500Medium',
} as const;

export const motion = {
  fast: 160,
  base: 280,
  slow: 460,
  easing: Easing.bezier(0.22, 1, 0.36, 1),
  stagger: 70,
} as const;

/** Severity 0-100 → warm semantic color. */
export function severityColor(severity: number): string {
  if (severity <= 33) return palette.sage;
  if (severity <= 66) return palette.ochre;
  return palette.rose;
}

export function severityLabel(severity: number): string {
  if (severity <= 33) return 'Mild';
  if (severity <= 66) return 'Moderate';
  return 'Significant';
}

/** Skin score 0-100 → color (inverse: high score = good). */
export function scoreColor(score: number): string {
  if (score >= 67) return palette.sage;
  if (score >= 34) return palette.ochre;
  return palette.rose;
}

/** Named gradient pairs — warm editorial tones (articles, product cards). */
export const gradients: Record<string, [string, string]> = {
  warm: ['#FBEFE2', '#EED8C0'],
  clay: ['#E8A37A', '#C5704A'],
  sage: ['#EBF0E7', '#C8D8BC'],
  ochre: ['#F5E8C8', '#E0C880'],
  rose: ['#F5DDD8', '#E0B0A8'],
  bark: ['#D4BCA8', '#C0A088'],
  dusk: ['#D8CCBE', '#C4B0A0'],
  ember: ['#E8D0B8', '#D0A87A'],
};

export function gradientFor(name: string | null | undefined): [string, string] {
  return gradients[name ?? 'warm'] ?? gradients.warm;
}

/** Deterministic warm gradient for product/brand cards. */
export function brandGradient(brand: string): [string, string] {
  const names = Object.keys(gradients);
  let hash = 0;
  for (let i = 0; i < brand.length; i++) hash = (hash * 31 + brand.charCodeAt(i)) | 0;
  return gradients[names[Math.abs(hash) % names.length]];
}
