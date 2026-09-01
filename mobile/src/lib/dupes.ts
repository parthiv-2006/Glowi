/**
 * Pure Dupe Finder logic — ranks catalog products that share key ingredients
 * with a given product or shelf item and cost less, so a user weighing "is
 * there a cheaper version of this" gets a grounded answer instead of a
 * Reddit thread. Zero AI calls; same class as replenishment.ts and budget.ts.
 *
 * Free of I/O so it is shared by the Dupe Finder screen and unit tests.
 */
import { normalizeIngredient } from './reactions';
import type { Product, ProductCategory, ReactionLog } from './types';

/** Max ranked dupes returned. */
export const MAX_DUPES = 3;

/** The minimal shape a dupe search needs from its source product or shelf item. */
export interface DupeSource {
  category: ProductCategory | null;
  key_ingredients: string[];
  price_usd: number | null;
}

/** A cheaper catalog alternative, ranked by ingredient overlap then savings. */
export interface DupeMatch {
  product: Product;
  /** How much less this costs than the source, in USD. Always > 0. */
  savingsUsd: number;
  /** Key ingredients shared with the source (original casing from the candidate). */
  sharedIngredients: string[];
  score: number;
}

function formatSavings(savingsUsd: number): string {
  return `$${savingsUsd.toFixed(2)}`;
}

/** Plain-language rationale for a dupe match, e.g. "Shares niacinamide · saves $8.00". */
export function dupeWhy(match: Pick<DupeMatch, 'savingsUsd' | 'sharedIngredients'>): string {
  const parts: string[] = [];
  if (match.sharedIngredients.length) {
    parts.push(`Shares ${match.sharedIngredients.join(', ').toLowerCase()}`);
  }
  parts.push(`saves ${formatSavings(match.savingsUsd)}`);
  return parts.join(' · ');
}

/**
 * Ranked cheaper catalog alternatives to `source`. Candidates share its
 * category, cost strictly less, and share at least one key ingredient — that
 * shared active is what makes it a "dupe" rather than just another product in
 * the same aisle. Hard-drops anything sharing an ingredient with a logged
 * reaction, same "never again" rule as suggestReplacements — never merely
 * down-ranked.
 */
export function findDupes(
  source: DupeSource,
  catalog: Product[],
  reactions: ReactionLog[],
  excludeProductId?: string | null,
): DupeMatch[] {
  if (!source.category || source.price_usd == null || !catalog.length) return [];

  const sourceIngredients = new Set(source.key_ingredients.map(normalizeIngredient));
  if (!sourceIngredients.size) return [];

  const reactedIngredients = new Set(
    reactions.flatMap((r) => r.key_ingredients.map(normalizeIngredient)),
  );

  const scored = catalog
    .filter((p) => p.category === source.category)
    .filter((p) => p.id !== excludeProductId)
    .filter((p) => p.price_usd != null && p.price_usd < source.price_usd!)
    .filter(
      (p) => !p.key_ingredients.some((ing) => reactedIngredients.has(normalizeIngredient(ing))),
    )
    .map((product) => {
      const sharedIngredients = product.key_ingredients.filter((ing) =>
        sourceIngredients.has(normalizeIngredient(ing)),
      );
      const savingsUsd = source.price_usd! - product.price_usd!;
      return { product, savingsUsd, sharedIngredients, score: sharedIngredients.length };
    })
    .filter((m) => m.sharedIngredients.length > 0);

  scored.sort((a, b) => b.score - a.score || b.savingsUsd - a.savingsUsd);

  return scored.slice(0, MAX_DUPES);
}
