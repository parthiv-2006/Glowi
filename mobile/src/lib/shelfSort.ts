/**
 * Pure Shelf sort — orders a list of shelf items by one of a few keys a user
 * might want while browsing a crowded cabinet. "Attention" (expired/expiring/
 * low-stock first) is the screen's existing default and lives in
 * `app/shelf/index.tsx`; this module covers the other explicit sort choices.
 * Free of I/O so it is shared by the Shelf screen and unit tests.
 */
import { expiryStatus } from './shelf';
import type { ShelfItem } from './types';

export type ShelfSortKey = 'attention' | 'name' | 'expiry' | 'price';

export const SHELF_SORT_OPTIONS: { key: ShelfSortKey; label: string }[] = [
  { key: 'attention', label: 'Needs attention' },
  { key: 'name', label: 'Name' },
  { key: 'expiry', label: 'Expiry' },
  { key: 'price', label: 'Price' },
];

/** Days left on the PAO clock; sealed/unopened items sort after everything with a clock running. */
function expiryRank(item: ShelfItem, today?: Date): number {
  const days = expiryStatus(item, today).daysLeft;
  return days ?? Number.POSITIVE_INFINITY;
}

function priceRank(item: ShelfItem): number {
  return item.price_usd ?? Number.POSITIVE_INFINITY;
}

/**
 * Sorts `items` by `key`. 'attention' is a no-op here — the screen already
 * hands in its attention-ranked order, and re-sorting it would just be
 * re-deriving the same thing this module doesn't own.
 */
export function sortShelfItems(items: ShelfItem[], key: ShelfSortKey, today?: Date): ShelfItem[] {
  if (key === 'attention') return items;

  const sorted = [...items];
  if (key === 'name') {
    sorted.sort((a, b) => a.name.localeCompare(b.name));
  } else if (key === 'expiry') {
    sorted.sort((a, b) => expiryRank(a, today) - expiryRank(b, today));
  } else if (key === 'price') {
    sorted.sort((a, b) => priceRank(a) - priceRank(b));
  }
  return sorted;
}
