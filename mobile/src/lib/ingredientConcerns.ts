/**
 * Ingredient → concern targeting map — which concerns an active ingredient
 * plausibly treats, used to explain *why* a correlation insight (see
 * correlation.ts) lines up with a routine change.
 *
 * Concern slugs below must exist in supabase/seed/0001_concerns_and_tips.sql
 * — never invent a slug that isn't seeded.
 *
 * ⚠ Lockstep: mirror of supabase/functions/_shared/ingredientConcerns.ts —
 * change both or neither.
 */

const CONCERN = {
  ACNE: 'acne',
  BLACKHEADS: 'blackheads-congestion',
  DRYNESS: 'dryness',
  OILINESS: 'oiliness',
  REDNESS: 'redness-rosacea',
  HYPERPIGMENTATION: 'hyperpigmentation',
  FINE_LINES: 'fine-lines-wrinkles',
  DARK_CIRCLES: 'dark-circles',
  SENSITIVITY: 'sensitivity-eczema',
  SUN_DAMAGE: 'sun-damage',
  PORES: 'enlarged-pores',
  DULLNESS: 'dullness',
} as const;

interface IngredientEntry {
  /** Whole-word/phrase matches against the normalized ingredient string. */
  keywords: string[];
  concerns: string[];
}

const INGREDIENT_MAP: IngredientEntry[] = [
  {
    keywords: ['niacinamide'],
    concerns: [CONCERN.OILINESS, CONCERN.PORES, CONCERN.HYPERPIGMENTATION],
  },
  {
    keywords: ['retinol', 'retinal', 'retinaldehyde', 'adapalene', 'tretinoin', 'retinoid'],
    concerns: [CONCERN.FINE_LINES, CONCERN.ACNE, CONCERN.HYPERPIGMENTATION, CONCERN.PORES],
  },
  {
    keywords: ['salicylic acid', 'betaine salicylate', 'bha', 'lha'],
    concerns: [CONCERN.ACNE, CONCERN.BLACKHEADS, CONCERN.PORES, CONCERN.OILINESS],
  },
  {
    keywords: ['glycolic acid', 'lactic acid', 'mandelic acid', 'pha', 'aha'],
    concerns: [CONCERN.DULLNESS, CONCERN.HYPERPIGMENTATION, CONCERN.FINE_LINES],
  },
  {
    keywords: ['azelaic acid'],
    concerns: [CONCERN.HYPERPIGMENTATION, CONCERN.ACNE, CONCERN.REDNESS],
  },
  {
    keywords: ['vitamin c', 'ascorbic acid'],
    concerns: [CONCERN.HYPERPIGMENTATION, CONCERN.DULLNESS, CONCERN.SUN_DAMAGE],
  },
  { keywords: ['ferulic acid'], concerns: [CONCERN.SUN_DAMAGE] },
  { keywords: ['hyaluronic acid'], concerns: [CONCERN.DRYNESS, CONCERN.DULLNESS] },
  { keywords: ['ceramide'], concerns: [CONCERN.DRYNESS, CONCERN.SENSITIVITY] },
  { keywords: ['zinc pca', 'zinc picolinate'], concerns: [CONCERN.OILINESS, CONCERN.ACNE] },
  {
    keywords: [
      'zinc oxide',
      'titanium dioxide',
      'avobenzone',
      'homosalate',
      'helioplex',
      'uv filter',
    ],
    concerns: [CONCERN.SUN_DAMAGE],
  },
  { keywords: ['benzoyl peroxide'], concerns: [CONCERN.ACNE] },
  { keywords: ['caffeine'], concerns: [CONCERN.DARK_CIRCLES, CONCERN.OILINESS] },
  { keywords: ['tranexamic acid'], concerns: [CONCERN.HYPERPIGMENTATION] },
  { keywords: ['alpha arbutin', 'arbutin'], concerns: [CONCERN.HYPERPIGMENTATION] },
  { keywords: ['licorice'], concerns: [CONCERN.HYPERPIGMENTATION, CONCERN.REDNESS] },
  { keywords: ['tea tree'], concerns: [CONCERN.ACNE, CONCERN.OILINESS] },
  { keywords: ['witch hazel'], concerns: [CONCERN.OILINESS, CONCERN.PORES] },
  { keywords: ['panthenol', 'vitamin b5'], concerns: [CONCERN.DRYNESS, CONCERN.SENSITIVITY] },
  { keywords: ['squalane'], concerns: [CONCERN.DRYNESS] },
  { keywords: ['glycerin'], concerns: [CONCERN.DRYNESS] },
  { keywords: ['urea'], concerns: [CONCERN.DRYNESS] },
  { keywords: ['colloidal oatmeal', 'oat'], concerns: [CONCERN.SENSITIVITY, CONCERN.DRYNESS] },
  {
    keywords: ['madecassoside', 'centella', 'cica'],
    concerns: [CONCERN.REDNESS, CONCERN.SENSITIVITY],
  },
  { keywords: ['green tea', 'egcg'], concerns: [CONCERN.OILINESS, CONCERN.REDNESS] },
  { keywords: ['snail secretion'], concerns: [CONCERN.HYPERPIGMENTATION, CONCERN.DULLNESS] },
  { keywords: ['propolis'], concerns: [CONCERN.ACNE, CONCERN.REDNESS] },
  { keywords: ['matrixyl', 'argirelox', 'peptide', 'collagen'], concerns: [CONCERN.FINE_LINES] },
  {
    keywords: ['thermal spring water', 'thermal water'],
    concerns: [CONCERN.SENSITIVITY, CONCERN.REDNESS],
  },
  {
    keywords: ['shea butter', 'petrolatum', 'sorbitol', 'mineral oil'],
    concerns: [CONCERN.DRYNESS],
  },
];

/** Lowercases, trims, and strips concentration/dose noise (%, mg, IU, x5, …). */
export function normalizeIngredient(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/\d+(\.\d+)?\s*%/g, '')
    .replace(/\b\d+(\.\d+)?\s*(mg|mcg|iu)\b/g, '')
    .replace(/\bx\d+\b/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hasKeyword(normalized: string, keyword: string): boolean {
  return new RegExp(`\\b${escapeRegExp(keyword)}\\b`).test(normalized);
}

/** Which seeded concern slugs a single ingredient plausibly targets. */
function concernsForIngredient(ingredient: string): string[] {
  const normalized = normalizeIngredient(ingredient);
  if (!normalized) return [];
  const concerns = new Set<string>();
  for (const entry of INGREDIENT_MAP) {
    if (entry.keywords.some((kw) => hasKeyword(normalized, kw))) {
      for (const c of entry.concerns) concerns.add(c);
    }
  }
  return [...concerns];
}

/** Union of concern slugs targeted by any ingredient in the list. Unknown ingredients contribute nothing. */
export function concernsTargetedBy(ingredients: string[]): string[] {
  const concerns = new Set<string>();
  for (const ingredient of ingredients) {
    for (const c of concernsForIngredient(ingredient)) concerns.add(c);
  }
  return [...concerns];
}
