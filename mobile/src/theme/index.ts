/**
 * Glowi design tokens — "Warm Editorial".
 * Cream paper, espresso ink, clay accent, sage/ochre/rose semantics.
 * Every screen and component derives from these; no ad-hoc colors.
 *
 * Contrast contract (WCAG 2.1 AA, verified by `theme/__tests__/contrast.test.ts`):
 * every token used as *text* clears 4.5:1 against every surface it renders on
 * (`bg`, `card`, `well` in light; `bgDark` in dark). `clayBright` and `blush` are
 * glow/highlight/fill tokens only — they are too light to be legible as text on
 * paper; use `clay` when an accent needs to be read.
 */
import { Easing } from 'react-native-reanimated';

export const palette = {
  // ── Light theme (primary) ─────────────────────────────────────────────
  bg: '#F3ECE1', // paper — screen background
  card: '#FCF8F1', // raised card fill
  well: '#EFE4D6', // sunken inputs / segmented track

  // Ink — the three-step ramp; all three are AA-legible on paper
  ink: '#2B2521', // 12.9:1 on bg — headings
  inkSoft: '#63584F', // 5.9:1 on bg — body
  inkFaint: '#726556', // 4.8:1 on bg — captions, overlines, placeholders, icon tints

  // Lines
  line: '#E6DCCD',
  lineStrong: '#E0D4C2',

  // Clay accent — `clay` is the text/CTA-safe accent (white on it clears AA);
  // `clayBright` is a glow/highlight fill only, never text on paper.
  clay: '#A75432',
  clayDeep: '#9A4A2C',
  clayBright: '#E0A984',

  // Semantic — warm editorial (all AA-legible as text on bg and card)
  sage: '#617058', // "good" / positive / improvement
  ochre: '#886529', // "moderate" severity
  rose: '#AF4D3C', // "significant" severity
  blush: '#E8C8B5', // soft fills, avatar gradients — never text

  // ── Dark theme (scan screens, tab bar) ────────────────────────────────
  bgDark: '#211B16',
  bgDarkDeep: '#15110E',
  cardDark: '#2B2420',
  inkDark: '#EFE6D8',
  inkSoftDark: '#B6A893',
  inkFaintDark: '#8F8270',
  lineDark: 'rgba(255,255,255,0.08)',
  clayDark: '#D2774E',

  // ── Backward-compat aliases (existing screens use these tokens) ────────
  text: '#2B2521',
  textBody: '#63584F',
  textSecondary: '#726556',
  textTertiary: '#726556',
  textOnAccent: '#FFFFFF',
  accent: '#A75432',
  accentBright: '#E0A984',
  accentDeep: '#9A4A2C',
  accentDim: 'rgba(167,84,50,0.12)',
  glow: 'rgba(167,84,50,0.4)',
  border: '#E6DCCD',
  borderStrong: '#E0D4C2',
  surface: '#FCF8F1',
  surfaceStrong: '#EFE4D6',
  bgElevated: '#FCF8F1',
  bgInput: '#EFE4D6',
  surfaceSunken: '#EFE4D6',
  surfaceRaised: '#FCF8F1',
  surfaceGlow: 'rgba(167,84,50,0.08)',
  danger: '#AF4D3C',
  warning: '#886529',
  success: '#617058',
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
