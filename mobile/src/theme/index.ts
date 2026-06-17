/**
 * Glowi design tokens — "clinical luxe".
 * Near-black depths, glass surfaces, a single jade glow accent.
 * Every screen and component derives from these; no ad-hoc colors.
 */
import { Easing } from 'react-native-reanimated';

export const palette = {
  // Depths
  bg: '#07090B',
  bgElevated: '#0C0F13',
  bgInput: 'rgba(255,255,255,0.06)',

  // Glass surfaces
  surface: 'rgba(255,255,255,0.05)',
  surfaceStrong: 'rgba(255,255,255,0.09)',
  border: 'rgba(255,255,255,0.08)',
  borderStrong: 'rgba(255,255,255,0.16)',

  // Ink
  text: '#F2F5F4',
  textBody: '#C4CBC7', // primary reading copy — body paragraphs, card descriptions, chat text
  textSecondary: '#9BA6A2',
  textTertiary: '#646E6A',
  textOnAccent: '#04211C',

  // The accent — jade/teal glow
  accent: '#2DD4BF',
  accentBright: '#5EEAD4',
  accentDeep: '#0F766E',
  accentDim: 'rgba(45,212,191,0.14)',
  glow: 'rgba(94,234,212,0.45)',

  // Surface tiers — every card declares one (see GlassCard `tier`)
  surfaceSunken: '#0B0F0E', // recessed wells: inputs, search bars, empty-state interiors
  surfaceRaised: 'rgba(255,255,255,0.055)', // default card fill
  surfaceGlow: 'rgba(94,234,212,0.13)', // hero/active cards — one per screen, max

  // Semantic
  danger: '#FB7185',
  warning: '#FBBF24',
  success: '#34D399',
} as const;

/** 4pt spacing scale: spacing(4) = 16. */
export const spacing = (n: number): number => n * 4;

export const radii = {
  sm: 10,
  md: 16,
  lg: 22,
  xl: 28,
  full: 999,
} as const;

export const fonts = {
  display: 'Fraunces_600SemiBold',
  displayBold: 'Fraunces_700Bold',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodySemiBold: 'Inter_600SemiBold',
  bodyBold: 'Inter_700Bold',
} as const;

export const motion = {
  fast: 160,
  base: 280,
  slow: 460,
  /** The Glowi ease — fast start, long luxurious settle. */
  easing: Easing.bezier(0.22, 1, 0.36, 1),
  /** Stagger interval between sibling entrances. */
  stagger: 70,
} as const;

/** Severity 0-100 → semantic color (calm jade → amber → rose). */
export function severityColor(severity: number): string {
  if (severity <= 33) return palette.success;
  if (severity <= 66) return palette.warning;
  return palette.danger;
}

export function severityLabel(severity: number): string {
  if (severity <= 33) return 'Mild';
  if (severity <= 66) return 'Moderate';
  return 'Significant';
}

/** Skin score 0-100 → color (inverse of severity: high score is good). */
export function scoreColor(score: number): string {
  if (score >= 67) return palette.success;
  if (score >= 34) return palette.warning;
  return palette.danger;
}

/** Named gradient pairs (articles, product cards, hero panels). */
export const gradients: Record<string, [string, string]> = {
  jade: ['#134E4A', '#07090B'],
  amber: ['#78350F', '#07090B'],
  rose: ['#881337', '#07090B'],
  violet: ['#4C1D95', '#07090B'],
  ocean: ['#0C4A6E', '#07090B'],
  ember: ['#7C2D12', '#07090B'],
  moss: ['#1A2E05', '#07090B'],
  slate: ['#1E293B', '#07090B'],
};

export function gradientFor(name: string | null | undefined): [string, string] {
  return gradients[name ?? 'jade'] ?? gradients.jade;
}

/** Deterministic gradient for product cards, keyed by brand name. */
export function brandGradient(brand: string): [string, string] {
  const names = Object.keys(gradients);
  let hash = 0;
  for (let i = 0; i < brand.length; i++) hash = (hash * 31 + brand.charCodeAt(i)) | 0;
  return gradients[names[Math.abs(hash) % names.length]];
}
