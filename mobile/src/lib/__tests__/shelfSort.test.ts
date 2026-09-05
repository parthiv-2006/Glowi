import { describe, expect, it } from '@jest/globals';

import { SHELF_SORT_OPTIONS, sortShelfItems } from '../shelfSort';
import type { ShelfItem } from '../types';

const TODAY = new Date('2026-07-06T12:00:00');

function item(partial: Partial<ShelfItem>): ShelfItem {
  return {
    id: 'x',
    product_id: null,
    name: 'Test',
    brand: null,
    category: 'serum',
    key_ingredients: [],
    image_path: null,
    size_label: null,
    opened_at: null,
    shelf_life_months: null,
    amount_remaining: 100,
    times_used: 0,
    last_used_at: null,
    status: 'active',
    notes: null,
    price_usd: null,
    created_at: '2026-06-01',
    updated_at: '2026-06-01',
    ...partial,
  };
}

describe('sortShelfItems', () => {
  it('is a no-op for "attention" — the caller owns that order', () => {
    const items = [item({ id: 'b', name: 'B' }), item({ id: 'a', name: 'A' })];
    expect(sortShelfItems(items, 'attention')).toEqual(items);
  });

  it('sorts by name, case-insensitively', () => {
    const items = [
      item({ id: '1', name: 'niacinamide serum' }),
      item({ id: '2', name: 'Aloe Gel' }),
      item({ id: '3', name: 'Barrier Cream' }),
    ];
    expect(sortShelfItems(items, 'name').map((i) => i.id)).toEqual(['2', '3', '1']);
  });

  it('sorts by expiry, soonest first, sealed items last', () => {
    const expiring = item({ id: 'a', opened_at: '2026-06-25', shelf_life_months: 6 }); // far off
    const soon = item({ id: 'b', opened_at: '2026-06-28', shelf_life_months: 1 }); // sooner
    const sealed = item({ id: 'c', opened_at: null });
    const result = sortShelfItems([expiring, sealed, soon], 'expiry', TODAY);
    expect(result.map((i) => i.id)).toEqual(['b', 'a', 'c']);
  });

  it('sorts by price, cheapest first, unpriced items last', () => {
    const pricey = item({ id: 'a', price_usd: 40 });
    const cheap = item({ id: 'b', price_usd: 8 });
    const unpriced = item({ id: 'c', price_usd: null });
    const result = sortShelfItems([pricey, unpriced, cheap], 'price');
    expect(result.map((i) => i.id)).toEqual(['b', 'a', 'c']);
  });

  it('does not mutate the input array', () => {
    const items = [item({ id: 'b', name: 'B' }), item({ id: 'a', name: 'A' })];
    const original = [...items];
    sortShelfItems(items, 'name');
    expect(items).toEqual(original);
  });

  it('exposes every sort key as a labeled option, attention first', () => {
    expect(SHELF_SORT_OPTIONS.map((o) => o.key)).toEqual(['attention', 'name', 'expiry', 'price']);
    expect(SHELF_SORT_OPTIONS.every((o) => o.label.length > 0)).toBe(true);
  });
});
