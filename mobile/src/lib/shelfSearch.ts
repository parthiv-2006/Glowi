/**
 * Pure Shelf search matching — case-insensitive substring match across the
 * fields a user would actually remember a product by: name, brand, and any
 * note they left on it. Free of I/O so it is shared by the Shelf screen and
 * unit tests.
 */
import type { ShelfItem } from './types';

/** True when `item` matches the (already-trimmed) search query. Empty query matches everything. */
export function matchesShelfSearch(
  item: Pick<ShelfItem, 'name' | 'brand' | 'notes'>,
  query: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystacks = [item.name, item.brand, item.notes];
  return haystacks.some((h) => !!h && h.toLowerCase().includes(q));
}
