import type { Ionicons } from '@expo/vector-icons';

/** Medical disclaimer — shown at onboarding and on every results surface. */
export const DISCLAIMER =
  'Glowi provides informational guidance only and is not a substitute for professional medical advice. For persistent, painful, or worsening skin conditions — or any concern about a mole or lesion — see a board-certified dermatologist.';

/** Concern icon slug (from the DB) → Ionicons name. */
export const CONCERN_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  flame: 'flame-outline',
  grid: 'grid-outline',
  'droplet-off': 'water-outline',
  droplet: 'water',
  thermometer: 'thermometer-outline',
  contrast: 'contrast-outline',
  waves: 'pulse-outline',
  moon: 'moon-outline',
  'shield-alert': 'shield-outline',
  sun: 'sunny-outline',
  'circle-dot': 'ellipse-outline',
  sparkles: 'sparkles-outline',
};

export function concernIcon(icon: string): keyof typeof Ionicons.glyphMap {
  return CONCERN_ICON[icon] ?? 'ellipse-outline';
}

export const CATEGORY_LABEL: Record<string, string> = {
  cleanser: 'Cleanser',
  exfoliant: 'Exfoliant',
  toner: 'Toner',
  serum: 'Serum',
  moisturizer: 'Moisturizer',
  spf: 'SPF',
  treatment: 'Treatment',
  mask: 'Mask',
  'eye-cream': 'Eye care',
  supplement: 'Supplement',
};

/** Onboarding goal options → memory goal slugs. */
export const GOAL_OPTIONS = [
  { id: 'clear-acne', label: 'Clear up breakouts', icon: 'flame-outline' as const },
  { id: 'even-tone', label: 'Even out my tone', icon: 'contrast-outline' as const },
  { id: 'anti-aging', label: 'Soften fine lines', icon: 'pulse-outline' as const },
  { id: 'hydration', label: 'Deep hydration', icon: 'water-outline' as const },
  { id: 'glow', label: 'Get my glow back', icon: 'sparkles-outline' as const },
  { id: 'calm', label: 'Calm sensitivity', icon: 'shield-outline' as const },
  { id: 'pores', label: 'Refine my pores', icon: 'ellipse-outline' as const },
  { id: 'simplify', label: 'Simplify my routine', icon: 'layers-outline' as const },
];

export const SKIN_TYPE_OPTIONS = [
  { id: 'normal', label: 'Normal', blurb: 'Balanced, rarely reactive' },
  { id: 'dry', label: 'Dry', blurb: 'Tight, flaky, or rough' },
  { id: 'oily', label: 'Oily', blurb: 'Shiny, prone to breakouts' },
  { id: 'combination', label: 'Combination', blurb: 'Oily T-zone, drier cheeks' },
  { id: 'sensitive', label: 'Sensitive', blurb: 'Stings or flushes easily' },
] as const;
