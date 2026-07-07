import { describe, expect, it } from '@jest/globals';

import { costPerUse, formatUsd, quarterSpend, shelfValue, valueLeaderboard } from '../budget';
import type { ShelfItem } from '../types';

const TODAY = new Date('2026-07-06T12:00:00');

function item(partial: Partial<ShelfItem>): ShelfItem {
  return {
    id: 'x',
    product_id: null,
    name: 'Test',
    brand: null,
    category: null,
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

describe('costPerUse', () => {
  it('divides price by uses', () => {
    expect(costPerUse(item({ price_usd: 30, times_used: 10 }))).toBe(3);
  });
  it('is null when unpriced or unused', () => {
    expect(costPerUse(item({ price_usd: null, times_used: 10 }))).toBeNull();
    expect(costPerUse(item({ price_usd: 30, times_used: 0 }))).toBeNull();
  });
});

describe('shelfValue', () => {
  it('sums priced items and skips unpriced ones', () => {
    expect(
      shelfValue([item({ price_usd: 12.5 }), item({ price_usd: null }), item({ price_usd: 7.5 })]),
    ).toBe(20);
  });
  it('is zero for an empty shelf', () => {
    expect(shelfValue([])).toBe(0);
  });
});

describe('quarterSpend', () => {
  it('counts priced items added within the last 90 days', () => {
    const recent = item({ price_usd: 20, created_at: '2026-06-01' });
    const old = item({ price_usd: 50, created_at: '2026-01-01' });
    const unpriced = item({ price_usd: null, created_at: '2026-06-20' });
    expect(quarterSpend([recent, old, unpriced], TODAY)).toBe(20);
  });
});

describe('valueLeaderboard', () => {
  it('ranks priced, used items by cost-per-use ascending', () => {
    const workhorse = item({ id: 'a', price_usd: 15, times_used: 30 }); // $0.50
    const splurge = item({ id: 'b', price_usd: 80, times_used: 4 }); // $20
    const unused = item({ id: 'c', price_usd: 40, times_used: 0 });
    const board = valueLeaderboard([splurge, unused, workhorse]);
    expect(board.map((e) => e.item.id)).toEqual(['a', 'b']);
    expect(board[0].costPerUse).toBe(0.5);
  });
});

describe('formatUsd', () => {
  it('always shows cents', () => {
    expect(formatUsd(3)).toBe('$3.00');
    expect(formatUsd(0.846)).toBe('$0.85');
  });
});
