/**
 * Pure Smart Replenishment logic — turns the Shelf's expiry/stock signals into
 * ranked "what to get next" suggestions from the catalog. Zero AI calls; the
 * ranking is deterministic domain logic, same class as budget.ts.
 *
 * Free of I/O so it is shared by the Shelf screen, the replenish screen, and
 * unit tests.
 */
import { concernsTargetedBy } from './ingredientConcerns';
import { normalizeIngredient } from './reactions';
import { expiryStatus, stockStatus } from './shelf';
import type { Product, ReactionLog, Scan, ShelfItem, SkinType } from './types';

/**
 * Max ranked replacement suggestions returned per trigger. Must match the
 * replenishment-copy edge function's MAX_CANDIDATES (F1) — the AI copy
 * batch is sized to however many suggestions this produces.
 */
export const MAX_SUGGESTIONS = 3;

/** A shelf item that warrants replacement, and why. */
export interface ReplenishmentTrigger {
  item: ShelfItem;
  reason: 'expiring' | 'expired' | 'low_stock' | 'out';
}

/**
 * Shelf items needing replacement, worst-first. An item can only trigger one
 * reason at a time — priority is expired > out of stock > expiring > low
 * stock, since a fully depleted product is more urgent than one still on a
 * countdown.
 */
export function replenishmentTriggers(
  items: ShelfItem[],
  today: Date = new Date(),
): ReplenishmentTrigger[] {
  const triggers: ReplenishmentTrigger[] = [];
  for (const item of items) {
    const expiry = expiryStatus(item, today);
    const stock = stockStatus(item.amount_remaining);

    if (expiry.kind === 'expired') {
      triggers.push({ item, reason: 'expired' });
    } else if (stock === 'out') {
      triggers.push({ item, reason: 'out' });
    } else if (expiry.kind === 'expiring') {
      triggers.push({ item, reason: 'expiring' });
    } else if (stock === 'low') {
      triggers.push({ item, reason: 'low_stock' });
    }
  }
  return triggers;
}

/** Catalog candidates to replace a triggered item, best first (max 3). */
export interface ReplacementSuggestion {
  product: Product;
  /** Plain-language why, e.g. "Targets post-breakout marks · similar price". */
  why: string;
  score: number;
}

function composeWhy(concernNames: string[], skinTypeMatch: boolean, priceMatch: boolean): string {
  const parts: string[] = [];
  const uniqueConcernNames = [...new Set(concernNames)];
  if (uniqueConcernNames.length) {
    parts.push(`Targets ${uniqueConcernNames.join(', ').toLowerCase()}`);
  }
  if (skinTypeMatch) parts.push('matches your skin type');
  if (priceMatch) parts.push('similar price');
  return parts.length ? parts.join(' · ') : 'Same category as what you already own';
}

/**
 * Ranked catalog replacements for a triggered shelf item. Candidates share the
 * triggered item's category, exclude what the user already owns, and hard-drop
 * anything sharing an ingredient with a logged reaction (a reacted ingredient
 * is a "never again", per ADR-0009) — never merely down-ranked.
 */
export function suggestReplacements(
  trigger: ReplenishmentTrigger,
  catalog: Product[],
  latestScan: Scan | null,
  reactions: ReactionLog[],
  shelf: ShelfItem[],
  skinType: SkinType | null,
): ReplacementSuggestion[] {
  const { item } = trigger;
  if (!item.category || !catalog.length) return [];

  const ownedProductIds = new Set<string>();
  for (const shelfItem of shelf) {
    if (shelfItem.status === 'active' && shelfItem.product_id) {
      ownedProductIds.add(shelfItem.product_id);
    }
  }
  if (item.product_id) ownedProductIds.add(item.product_id);

  const reactedIngredients = new Set(
    reactions.flatMap((r) => r.key_ingredients.map(normalizeIngredient)),
  );

  const scanConcernNames = new Map(
    (latestScan?.concerns ?? []).map((c) => [c.concern_slug, c.display_name]),
  );

  const scored = catalog
    .filter((p) => p.category === item.category && !ownedProductIds.has(p.id))
    .filter(
      (p) => !p.key_ingredients.some((ing) => reactedIngredients.has(normalizeIngredient(ing))),
    )
    .map((product) => {
      const matchedConcernNames = concernsTargetedBy(product.key_ingredients)
        .map((slug) => scanConcernNames.get(slug))
        .filter((name): name is string => !!name);
      const skinTypeMatch = !!skinType && product.skin_types.includes(skinType);
      const priceMatch =
        product.price_usd != null && item.price_usd != null && product.price_usd <= item.price_usd;

      const score = matchedConcernNames.length * 2 + (skinTypeMatch ? 1 : 0) + (priceMatch ? 1 : 0);

      return {
        product,
        score,
        why: composeWhy(matchedConcernNames, skinTypeMatch, priceMatch),
        priceSort: product.price_usd ?? Number.POSITIVE_INFINITY,
      };
    });

  scored.sort((a, b) => b.score - a.score || a.priceSort - b.priceSort);

  return scored
    .slice(0, MAX_SUGGESTIONS)
    .map(({ product, score, why }) => ({ product, score, why }));
}
