/**
 * Pure Shelf logic — period-after-opening (PAO) expiry, stock level, and the
 * default shelf lives that make those computable even when the user doesn't
 * know a product's exact PAO.
 *
 * Free of I/O so it is shared by the inventory UI, the Skin Weather
 * integration, and unit tests. See docs/adr/0006-the-shelf-inventory.md.
 */
import type { ProductCategory, ShelfItem } from './types';

/** Typical months a product stays good after opening, by category. */
export const DEFAULT_PAO_MONTHS: Record<ProductCategory, number> = {
  cleanser: 12,
  exfoliant: 12,
  toner: 12,
  // Antioxidant serums (vitamin C) oxidize fast — the short default is deliberate.
  serum: 6,
  moisturizer: 12,
  spf: 12,
  treatment: 6,
  mask: 12,
  'eye-cream': 9,
  supplement: 12,
};

const FALLBACK_PAO_MONTHS = 12;
/** Warn this many days before a product passes its PAO. */
export const EXPIRY_WARNING_DAYS = 14;
/** At or below this percentage, a product counts as running low. */
export const LOW_STOCK_PCT = 20;

const DAY_MS = 86_400_000;

/** Effective shelf life for an item — its own value, else the category default. */
export function effectiveShelfLifeMonths(
  item: Pick<ShelfItem, 'shelf_life_months' | 'category'>,
): number {
  if (item.shelf_life_months && item.shelf_life_months > 0) return item.shelf_life_months;
  if (item.category) return DEFAULT_PAO_MONTHS[item.category];
  return FALLBACK_PAO_MONTHS;
}

export type ExpiryKind = 'sealed' | 'fresh' | 'expiring' | 'expired';

export interface ExpiryStatus {
  kind: ExpiryKind;
  /** Days until (positive) or since (negative) the PAO date; null when sealed. */
  daysLeft: number | null;
  /** ISO date the product is considered past-PAO; null when sealed. */
  expiresOn: string | null;
}

/**
 * PAO expiry for an item. Unopened products have no clock yet ("sealed"); once
 * opened, the clock runs from `opened_at` for the effective shelf life.
 */
export function expiryStatus(
  item: Pick<ShelfItem, 'opened_at' | 'shelf_life_months' | 'category'>,
  today: Date = new Date(),
): ExpiryStatus {
  if (!item.opened_at) return { kind: 'sealed', daysLeft: null, expiresOn: null };

  const opened = new Date(`${item.opened_at}T00:00:00`);
  const expires = new Date(opened);
  expires.setMonth(expires.getMonth() + effectiveShelfLifeMonths(item));

  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const daysLeft = Math.round((expires.getTime() - startOfToday.getTime()) / DAY_MS);
  const expiresOn = expires.toISOString().slice(0, 10);

  if (daysLeft < 0) return { kind: 'expired', daysLeft, expiresOn };
  if (daysLeft <= EXPIRY_WARNING_DAYS) return { kind: 'expiring', daysLeft, expiresOn };
  return { kind: 'fresh', daysLeft, expiresOn };
}

export type StockKind = 'ok' | 'low' | 'out';

export function stockStatus(amountRemaining: number): StockKind {
  if (amountRemaining <= 0) return 'out';
  if (amountRemaining <= LOW_STOCK_PCT) return 'low';
  return 'ok';
}

export interface ShelfSummary {
  total: number;
  expiring: number;
  expired: number;
  low: number;
}

/** Counts that drive the Shelf header and the Home nudge. */
export function summarizeShelf(items: ShelfItem[], today: Date = new Date()): ShelfSummary {
  let expiring = 0;
  let expired = 0;
  let low = 0;
  for (const item of items) {
    const e = expiryStatus(item, today);
    if (e.kind === 'expiring') expiring++;
    if (e.kind === 'expired') expired++;
    const s = stockStatus(item.amount_remaining);
    if (s === 'low' || s === 'out') low++;
  }
  return { total: items.length, expiring, expired, low };
}

/** Human label for an expiry status, e.g. "Expires in 9 days". */
export function expiryLabel(status: ExpiryStatus): string {
  switch (status.kind) {
    case 'sealed':
      return 'Unopened';
    case 'expired':
      return status.daysLeft === -1
        ? 'Expired yesterday'
        : `Expired ${Math.abs(status.daysLeft ?? 0)} days ago`;
    case 'expiring':
      if (status.daysLeft === 0) return 'Expires today';
      return status.daysLeft === 1 ? 'Expires tomorrow' : `Expires in ${status.daysLeft} days`;
    case 'fresh':
      return 'Fresh';
  }
}
