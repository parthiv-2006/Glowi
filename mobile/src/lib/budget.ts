/**
 * Pure Shelf budget logic — shelf value, quarterly spend, and cost-per-use,
 * computed from the prices users attach to their shelf items. Only priced
 * items participate; everything else is excluded rather than guessed.
 *
 * Free of I/O so it is shared by the budget screen and unit tests.
 */
import type { ShelfItem } from './types';

const QUARTER_DAYS = 90;
const DAY_MS = 86_400_000;

/** Price ÷ uses. Null when the item is unpriced or has never been used. */
export function costPerUse(item: Pick<ShelfItem, 'price_usd' | 'times_used'>): number | null {
  if (item.price_usd == null || item.times_used <= 0) return null;
  return item.price_usd / item.times_used;
}

/** Total price of the priced items currently on the shelf (any status but archived arrives filtered upstream). */
export function shelfValue(items: Pick<ShelfItem, 'price_usd'>[]): number {
  return items.reduce((sum, i) => sum + (i.price_usd ?? 0), 0);
}

/** Spend on priced items added in the last 90 days. */
export function quarterSpend(
  items: Pick<ShelfItem, 'price_usd' | 'created_at'>[],
  today: Date = new Date(),
): number {
  const cutoff = today.getTime() - QUARTER_DAYS * DAY_MS;
  return items.reduce((sum, i) => {
    if (i.price_usd == null) return sum;
    return new Date(i.created_at).getTime() >= cutoff ? sum + i.price_usd : sum;
  }, 0);
}

export interface ValueEntry {
  item: ShelfItem;
  costPerUse: number;
}

/** Priced, used items ranked best value (lowest cost-per-use) first. */
export function valueLeaderboard(items: ShelfItem[]): ValueEntry[] {
  return items
    .map((item) => ({ item, costPerUse: costPerUse(item) }))
    .filter((e): e is ValueEntry => e.costPerUse != null)
    .sort((a, b) => a.costPerUse - b.costPerUse);
}

/** "$4.20" / "$0.85" — cost figures read best with cents. */
export function formatUsd(amount: number): string {
  return `$${amount.toFixed(2)}`;
}
