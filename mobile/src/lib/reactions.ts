/**
 * Pure Reaction Log logic — ingredient normalization and cross-referencing
 * logged reactions against the Shelf, so a formulation similar to something
 * that already burned the user gets flagged before it does it again.
 *
 * Free of I/O so it is shared by the Reaction Log UI, the Shelf warnings,
 * and unit tests.
 */
import type { ReactionLog, ShelfItem } from './types';

/** Symptom vocabulary offered when logging a reaction. */
export const REACTION_SYMPTOMS = [
  'Redness',
  'Breakout',
  'Itching',
  'Burning / stinging',
  'Dryness / flaking',
  'Swelling',
  'Rash / hives',
] as const;

/** Lowercase, trim, and collapse whitespace so ingredient names compare cleanly. */
export function normalizeIngredient(name: string): string {
  return name.toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Ingredients a shelf item shares with a logged reaction (original casing from the item). */
export function sharedRiskIngredients(
  reaction: Pick<ReactionLog, 'key_ingredients'>,
  item: Pick<ShelfItem, 'key_ingredients'>,
): string[] {
  const risky = new Set(reaction.key_ingredients.map(normalizeIngredient));
  if (!risky.size) return [];
  return item.key_ingredients.filter((i) => risky.has(normalizeIngredient(i)));
}

export interface ShelfRisk {
  item: ShelfItem;
  /** The overlapping ingredients that triggered the warning. */
  ingredients: string[];
  /** The reactions those ingredients came from. */
  reactions: ReactionLog[];
}

/**
 * Active shelf items that share at least one ingredient with any logged
 * reaction. Items the reaction was logged against are excluded — the user
 * already knows about those.
 */
export function riskyShelfItems(reactions: ReactionLog[], items: ShelfItem[]): ShelfRisk[] {
  const risks: ShelfRisk[] = [];
  for (const item of items) {
    if (item.status !== 'active') continue;
    const matched = reactions.filter(
      (r) => r.shelf_item_id !== item.id && sharedRiskIngredients(r, item).length > 0,
    );
    if (!matched.length) continue;
    const ingredients = Array.from(new Set(matched.flatMap((r) => sharedRiskIngredients(r, item))));
    risks.push({ item, ingredients, reactions: matched });
  }
  return risks;
}

/**
 * The durable 'gotcha' memory written when a reaction is logged — phrased so
 * the coach and Skin Weather treat it as a hard constraint.
 */
export function reactionMemoryContent(
  log: Pick<ReactionLog, 'product_name' | 'brand' | 'reacted_on' | 'symptoms' | 'key_ingredients'>,
): string {
  const product = [log.brand, log.product_name].filter(Boolean).join(' ');
  const symptoms = log.symptoms.length ? log.symptoms.join(', ').toLowerCase() : 'a bad reaction';
  const ingredients = log.key_ingredients.length
    ? ` Its key ingredients were ${log.key_ingredients.join(', ')} — treat similar formulations with caution.`
    : '';
  return `Reacted badly to ${product} on ${log.reacted_on} (${symptoms}). Never recommend this product again.${ingredients}`;
}
