import type { Ionicons } from '@expo/vector-icons';

import { palette } from '@/theme';
import type { ForecastActionKind, ReactionSeverity } from './types';
import type { Tone } from './ai/forecast';
import type { ExpiryKind, StockKind } from './shelf';

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

/** Skin Weather guidance kind → icon, accent color, and verb label. */
export const FORECAST_ACTION: Record<
  ForecastActionKind,
  { icon: keyof typeof Ionicons.glyphMap; color: string; verb: string }
> = {
  add: { icon: 'add-circle', color: palette.accent, verb: 'Add' },
  swap: { icon: 'swap-horizontal', color: palette.warning, verb: 'Swap' },
  skip: { icon: 'close-circle', color: palette.danger, verb: 'Skip' },
  maintain: { icon: 'checkmark-circle', color: palette.success, verb: 'Keep' },
};

/** Environment-reading tone → semantic color. */
export function toneColor(tone: Tone): string {
  if (tone === 'good') return palette.success;
  if (tone === 'moderate') return palette.warning;
  return palette.danger;
}

/** Shelf expiry status → semantic color. */
export function expiryColor(kind: ExpiryKind): string {
  if (kind === 'fresh') return palette.success;
  if (kind === 'expiring') return palette.warning;
  if (kind === 'expired') return palette.danger;
  return palette.textSecondary; // sealed
}

/** Shelf stock level → semantic color. */
export function stockColor(kind: StockKind): string {
  if (kind === 'ok') return palette.success;
  if (kind === 'low') return palette.warning;
  return palette.danger; // out
}

/** Reaction severity → label + semantic color. */
export const REACTION_SEVERITY: Record<ReactionSeverity, { label: string; color: string }> = {
  mild: { label: 'Mild', color: palette.warning },
  moderate: { label: 'Moderate', color: palette.accent },
  severe: { label: 'Severe', color: palette.danger },
};

/** Product category → Ionicons name, for shelf items. */
export const CATEGORY_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  cleanser: 'water-outline',
  exfoliant: 'sparkles-outline',
  toner: 'flask-outline',
  serum: 'eyedrop-outline',
  moisturizer: 'ellipse-outline',
  spf: 'sunny-outline',
  treatment: 'medkit-outline',
  mask: 'happy-outline',
  'eye-cream': 'eye-outline',
  supplement: 'nutrition-outline',
};

export function categoryIcon(category: string | null): keyof typeof Ionicons.glyphMap {
  return (category && CATEGORY_ICON[category]) || 'cube-outline';
}
