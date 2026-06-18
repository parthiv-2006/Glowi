/**
 * Pure Skin Weather logic — environment synthesis, personalized guidance, and
 * the display helpers the forecast UI reads from.
 *
 * Kept free of I/O so it is shared by the mock provider (offline forecasts) and
 * the forecast screens, and is unit-testable in isolation. The live provider's
 * edge function has its own Deno-side equivalent; see supabase/functions/
 * skin-forecast. See docs/adr/0005-skin-weather-forecasting.md.
 */
import type {
  ForecastEnvironment,
  ForecastGuidance,
  PollenLevel,
  ProductCategory,
  SkinType,
} from '../types';

/**
 * Where a forecast is computed when the caller supplies no coordinates. The AI
 * seam accepts optional coords so device GPS (expo-location) can override this
 * later without touching anything downstream.
 */
export const DEFAULT_LOCATION = {
  latitude: 37.7749,
  longitude: -122.4194,
  label: 'San Francisco, CA',
} as const;

/** Deterministic day index so a given date always yields the same weather. */
function dayOfYear(date: Date): number {
  const start = Date.UTC(date.getFullYear(), 0, 0);
  const now = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.floor((now - start) / 86_400_000);
}

/** Archetype weather days — each maps to a distinct skin-stress profile. */
const ENV_ARCHETYPES: ForecastEnvironment[] = [
  {
    uv_index: 9,
    humidity: 28,
    temp_c: 26,
    temp_swing_c: 12,
    air_quality_index: 38,
    pollen_level: 'low',
    condition: 'Clear',
  },
  {
    uv_index: 6,
    humidity: 82,
    temp_c: 29,
    temp_swing_c: 5,
    air_quality_index: 64,
    pollen_level: 'moderate',
    condition: 'Humid',
  },
  {
    uv_index: 2,
    humidity: 31,
    temp_c: 4,
    temp_swing_c: 14,
    air_quality_index: 45,
    pollen_level: 'low',
    condition: 'Cold & dry',
  },
  {
    uv_index: 5,
    humidity: 47,
    temp_c: 21,
    temp_swing_c: 9,
    air_quality_index: 142,
    pollen_level: 'high',
    condition: 'Hazy',
  },
  {
    uv_index: 4,
    humidity: 55,
    temp_c: 19,
    temp_swing_c: 7,
    air_quality_index: 32,
    pollen_level: 'low',
    condition: 'Partly cloudy',
  },
];

/**
 * Deterministic, plausible environment for a date + location — the mock weather source.
 * Coords shift the archetype index so different cities produce different readings on the same day.
 */
export function synthesizeEnvironment(
  date: Date = new Date(),
  coords?: { latitude: number; longitude: number },
): ForecastEnvironment {
  const dayIdx = dayOfYear(date) % ENV_ARCHETYPES.length;
  const locationOffset = coords
    ? Math.abs(Math.round(coords.latitude + coords.longitude)) % ENV_ARCHETYPES.length
    : 0;
  return ENV_ARCHETYPES[(dayIdx + locationOffset) % ENV_ARCHETYPES.length];
}

// ─────────────── Level helpers (label + tone for UI coloring) ───────────────

export type Tone = 'good' | 'moderate' | 'high';

export interface EnvLevel {
  label: string;
  tone: Tone;
}

export function uvLevel(uv: number): EnvLevel {
  if (uv <= 2) return { label: 'Low', tone: 'good' };
  if (uv <= 5) return { label: 'Moderate', tone: 'moderate' };
  if (uv <= 7) return { label: 'High', tone: 'high' };
  return { label: 'Very high', tone: 'high' };
}

export function humidityLevel(h: number): EnvLevel {
  if (h < 35) return { label: 'Dry air', tone: 'high' };
  if (h > 70) return { label: 'Humid', tone: 'moderate' };
  return { label: 'Comfortable', tone: 'good' };
}

export function aqiLevel(aqi: number): EnvLevel {
  if (aqi <= 50) return { label: 'Good', tone: 'good' };
  if (aqi <= 100) return { label: 'Moderate', tone: 'moderate' };
  return { label: 'Unhealthy', tone: 'high' };
}

export function swingLevel(swing: number): EnvLevel {
  if (swing < 8) return { label: 'Steady', tone: 'good' };
  if (swing < 12) return { label: 'Noticeable', tone: 'moderate' };
  return { label: 'Large swing', tone: 'high' };
}

export function pollenLevel(level: PollenLevel): EnvLevel {
  if (level === 'low') return { label: 'Low', tone: 'good' };
  if (level === 'moderate') return { label: 'Moderate', tone: 'moderate' };
  return { label: level === 'very-high' ? 'Very high' : 'High', tone: 'high' };
}

// ─────────────── Personalized forecast derivation (mock) ───────────────

/** A product the user owns, summarized for routing forecast guidance. */
export interface OwnedProduct {
  category: ProductCategory | null;
  /** Display label, e.g. "CeraVe Moisturizing Cream". */
  label: string;
}

export interface ForecastContext {
  skinType: SkinType | null;
  /** Display name of the user's most significant recent concern, if any. */
  topConcern: string | null;
  /** The user's shelf — guidance names a product they own when possible. */
  owned?: OwnedProduct[];
}

/** First owned product in a category, for "use the X you have" routing. */
function ownedIn(owned: OwnedProduct[] | undefined, category: ProductCategory): string | null {
  return owned?.find((p) => p.category === category)?.label ?? null;
}

export interface DerivedForecast {
  headline: string;
  summary: string;
  guidance: ForecastGuidance[];
}

const OILY = new Set<SkinType>(['oily', 'combination']);
const DRY = new Set<SkinType>(['dry', 'sensitive']);

/**
 * Turns an environment + the user's documented skin tendencies into a headline,
 * a personalized paragraph, and concrete routine adjustments. This is the
 * heuristic the mock provider uses; the live provider asks Claude for the same
 * shape, grounded in the full memory context.
 */
export function deriveForecast(env: ForecastEnvironment, ctx: ForecastContext): DerivedForecast {
  const guidance: ForecastGuidance[] = [];
  const skin = ctx.skinType;
  const dryAir = env.humidity < 35;
  const humid = env.humidity > 70;
  const highUv = env.uv_index >= 6;
  const poorAir = env.air_quality_index > 100;
  const highPollen = env.pollen_level === 'high' || env.pollen_level === 'very-high';
  const bigSwing = env.temp_swing_c >= 12;

  const headlineParts: string[] = [];
  if (highUv) headlineParts.push('High UV');
  if (dryAir) headlineParts.push('low humidity');
  else if (humid) headlineParts.push('high humidity');
  if (poorAir) headlineParts.push('poor air quality');
  if (!headlineParts.length) headlineParts.push('Mild, balanced conditions');
  const headline = headlineParts
    .map((p, i) => (i === 0 ? p.charAt(0).toUpperCase() + p.slice(1) : p))
    .join(' and ');

  // Summary — references the user's own documented tendencies where we have them.
  const sentences: string[] = [];
  if (dryAir && (skin === null || DRY.has(skin))) {
    sentences.push(
      'The air is pulling moisture out fast today — skin like yours tends to dehydrate and feel tight on days like this.',
    );
  } else if (humid && (skin === null || OILY.has(skin))) {
    sentences.push(
      'Warm, humid air ramps up oil production — your T-zone is the first place that shows it.',
    );
  } else if (env.temp_c <= 6) {
    sentences.push(
      'Cold, dry air weakens the barrier, which is when cheeks start to flake and look dull.',
    );
  } else {
    sentences.push('Conditions are gentle on skin today — a good day to keep things steady.');
  }
  if (highUv) {
    sentences.push('UV is strong, so sun protection does the heaviest lifting this morning.');
  }
  if (poorAir || highPollen) {
    sentences.push(
      'Air quality and pollen are elevated — particulates settle on skin and can trigger irritation, so a thorough evening cleanse matters more than usual.',
    );
  }
  if (ctx.topConcern) {
    sentences.push(`Worth watching given your ${ctx.topConcern.toLowerCase()}.`);
  }
  const summary = sentences.join(' ');

  // Guidance — concrete, ordered by impact. Where the user owns a fitting
  // product, name it ("use the X you have") instead of giving generic advice.
  const ownedSpf = ownedIn(ctx.owned, 'spf');
  const ownedMoist = ownedIn(ctx.owned, 'moisturizer');
  const ownedSerum = ownedIn(ctx.owned, 'serum');

  if (highUv) {
    guidance.push({
      kind: 'add',
      text: ownedSpf
        ? `Finish with your ${ownedSpf} and reapply midday — UV is doing the damage today.`
        : 'Finish with a broad-spectrum SPF 50 and reapply midday.',
    });
  }
  if (dryAir) {
    guidance.push({
      kind: 'swap',
      text: ownedMoist
        ? `Swap to your ${ownedMoist} and layer a hydrating serum on damp skin first.`
        : 'Swap your gel moisturizer for a richer cream, and layer hydrating serum on damp skin.',
    });
  } else if (humid) {
    guidance.push({
      kind: 'swap',
      text: 'Go lighter — a gel moisturizer and an oil-free SPF will feel better than a cream today.',
    });
  }
  if (poorAir || highPollen) {
    guidance.push({
      kind: 'add',
      text: ownedSerum
        ? `Use your ${ownedSerum} in the AM and double-cleanse tonight to clear particulates.`
        : 'Add a vitamin C antioxidant in the AM and double-cleanse tonight to clear particulates.',
    });
  }
  if (dryAir || env.temp_c <= 6 || bigSwing) {
    guidance.push({
      kind: 'skip',
      text: 'Skip tonight’s exfoliating toner — the barrier needs protecting, not stripping.',
    });
  }
  if (!guidance.length) {
    guidance.push({
      kind: 'maintain',
      text: 'Keep your usual routine — nothing in the air calls for a change today.',
    });
  }

  return { headline, summary, guidance: guidance.slice(0, 4) };
}
