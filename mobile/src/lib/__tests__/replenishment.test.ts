import { describe, expect, it } from '@jest/globals';

import { MAX_SUGGESTIONS, replenishmentTriggers, suggestReplacements } from '../replenishment';
import type { Product, ReactionLog, Scan, ShelfItem } from '../types';

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

function product(partial: Partial<Product>): Product {
  return {
    id: 'p1',
    slug: 'test-product',
    brand: 'TestBrand',
    name: 'Test Product',
    category: 'serum',
    description: '',
    key_ingredients: [],
    price_usd: 20,
    image_url: null,
    retailer_links: [],
    skin_types: [],
    am_pm: 'both',
    step_order: 1,
    ...partial,
  };
}

function scan(concerns: Scan['concerns']): Scan {
  return {
    id: 's1',
    user_id: 'u1',
    image_path: null,
    status: 'complete',
    skin_score: 70,
    skin_type_estimate: null,
    summary: null,
    concerns,
    area: null,
    notes: null,
    capture_meta: null,
    created_at: '2026-07-01',
  };
}

function reaction(partial: Partial<ReactionLog>): ReactionLog {
  return {
    id: 'r1',
    shelf_item_id: null,
    product_name: 'Reacted Product',
    brand: null,
    key_ingredients: [],
    reacted_on: '2026-07-01',
    symptoms: ['Redness'],
    severity: 'moderate',
    notes: null,
    created_at: '2026-07-01',
    updated_at: '2026-07-01',
    ...partial,
  };
}

describe('replenishmentTriggers', () => {
  it('flags an expired item', () => {
    const expired = item({ id: 'a', opened_at: '2025-01-01', shelf_life_months: 6 });
    expect(replenishmentTriggers([expired], TODAY)).toEqual([{ item: expired, reason: 'expired' }]);
  });

  it('flags an item expiring soon', () => {
    const expiring = item({ id: 'b', opened_at: '2026-01-10', shelf_life_months: 6 });
    expect(replenishmentTriggers([expiring], TODAY)).toEqual([
      { item: expiring, reason: 'expiring' },
    ]);
  });

  it('flags a low-stock item', () => {
    const low = item({ id: 'c', amount_remaining: 15 });
    expect(replenishmentTriggers([low], TODAY)).toEqual([{ item: low, reason: 'low_stock' }]);
  });

  it('flags an out-of-stock item', () => {
    const out = item({ id: 'd', amount_remaining: 0 });
    expect(replenishmentTriggers([out], TODAY)).toEqual([{ item: out, reason: 'out' }]);
  });

  it('produces no trigger for a fresh, well-stocked item', () => {
    const fine = item({ id: 'e', opened_at: '2026-07-01', shelf_life_months: 12 });
    expect(replenishmentTriggers([fine], TODAY)).toEqual([]);
  });

  it('prioritizes expired over a simultaneous low-stock condition', () => {
    const both = item({
      id: 'f',
      opened_at: '2025-01-01',
      shelf_life_months: 6,
      amount_remaining: 10,
    });
    expect(replenishmentTriggers([both], TODAY)).toEqual([{ item: both, reason: 'expired' }]);
  });

  it('prioritizes out over expiring when both apply', () => {
    const both = item({
      id: 'g',
      opened_at: '2026-01-10',
      shelf_life_months: 6,
      amount_remaining: 0,
    });
    expect(replenishmentTriggers([both], TODAY)).toEqual([{ item: both, reason: 'out' }]);
  });
});

describe('suggestReplacements', () => {
  const trigger = (i: Partial<ShelfItem> = {}) => ({
    item: item({ id: 'triggered', category: 'serum', price_usd: 20, ...i }),
    reason: 'expiring' as const,
  });

  it('returns empty for an empty catalog', () => {
    expect(suggestReplacements(trigger(), [], null, [], [], null)).toEqual([]);
  });

  it('returns empty when the triggered item has no category', () => {
    const t = { item: item({ id: 'x', category: null }), reason: 'out' as const };
    expect(suggestReplacements(t, [product({ id: 'p1' })], null, [], [], null)).toEqual([]);
  });

  it('only candidates from the same category', () => {
    const serum = product({ id: 'p1', category: 'serum' });
    const cleanser = product({ id: 'p2', category: 'cleanser' });
    const result = suggestReplacements(trigger(), [serum, cleanser], null, [], [], null);
    expect(result.map((r) => r.product.id)).toEqual(['p1']);
  });

  it('excludes products already owned on the active shelf, and the triggered item’s own match', () => {
    const owned = product({ id: 'p1', category: 'serum' });
    const triggeredMatch = product({ id: 'p2', category: 'serum' });
    const available = product({ id: 'p3', category: 'serum' });
    const shelf = [
      item({ id: 'owned-1', product_id: 'p1', status: 'active', category: 'serum' }),
      item({ id: 'not-owned', product_id: 'p9', status: 'finished', category: 'serum' }),
    ];
    const result = suggestReplacements(
      trigger({ product_id: 'p2' }),
      [owned, triggeredMatch, available],
      null,
      [],
      shelf,
      null,
    );
    expect(result.map((r) => r.product.id)).toEqual(['p3']);
  });

  it('hard-disqualifies a candidate sharing an ingredient with a logged reaction', () => {
    const risky = product({ id: 'p1', key_ingredients: ['Retinol'] });
    const safe = product({ id: 'p2', key_ingredients: ['Niacinamide'] });
    const reactions = [reaction({ key_ingredients: ['retinol'] })];
    const result = suggestReplacements(trigger(), [risky, safe], null, reactions, [], null);
    expect(result.map((r) => r.product.id)).toEqual(['p2']);
  });

  it('scores +2 per distinct latest-scan concern the candidate targets', () => {
    const s = scan([
      {
        concern_slug: 'acne',
        display_name: 'Acne',
        severity: 60,
        confidence: 80,
        areas: [],
        observations: '',
        caution: null,
      },
      {
        concern_slug: 'hyperpigmentation',
        display_name: 'Hyperpigmentation',
        severity: 40,
        confidence: 70,
        areas: [],
        observations: '',
        caution: null,
      },
    ]);
    // azelaic acid targets hyperpigmentation, acne, redness — matches both scan concerns.
    // salicylic acid targets acne, blackheads, pores, oiliness — matches only one.
    // price_usd is set above the trigger's so no price point sneaks into the score.
    const doubleMatch = product({ id: 'p1', key_ingredients: ['azelaic acid'], price_usd: 25 });
    const singleMatch = product({ id: 'p2', key_ingredients: ['salicylic acid'], price_usd: 25 });
    const noMatch = product({ id: 'p3', key_ingredients: ['glycerin'], price_usd: 25 });
    const result = suggestReplacements(
      trigger(),
      [doubleMatch, singleMatch, noMatch],
      s,
      [],
      [],
      null,
    );
    expect(result.map((r) => r.product.id)).toEqual(['p1', 'p2', 'p3']);
    expect(result[0].score).toBe(4);
    expect(result[0].why).toContain('acne');
    expect(result[0].why).toContain('hyperpigmentation');
  });

  it('scores +1 for a matching skin type and +1 for price at or below the triggered item', () => {
    const matches = product({ id: 'p1', skin_types: ['oily'], price_usd: 15 });
    const noMatch = product({ id: 'p2', skin_types: ['dry'], price_usd: 25 });
    const result = suggestReplacements(
      trigger({ price_usd: 20 }),
      [matches, noMatch],
      null,
      [],
      [],
      'oily',
    );
    expect(result[0].product.id).toBe('p1');
    expect(result[0].score).toBe(2);
    expect(result[0].why).toContain('matches your skin type');
    expect(result[0].why).toContain('similar price');
    expect(result[1].score).toBe(0);
  });

  it('skips the price comparison when either price is null', () => {
    const unpriced = product({ id: 'p1', price_usd: null });
    const result = suggestReplacements(
      trigger({ price_usd: null }),
      [unpriced],
      null,
      [],
      [],
      null,
    );
    expect(result[0].score).toBe(0);
  });

  it('breaks ties by lower price', () => {
    const cheaper = product({ id: 'p1', price_usd: 10 });
    const pricier = product({ id: 'p2', price_usd: 30 });
    const result = suggestReplacements(
      trigger({ price_usd: null }),
      [pricier, cheaper],
      null,
      [],
      [],
      null,
    );
    expect(result.map((r) => r.product.id)).toEqual(['p1', 'p2']);
  });

  it('caps suggestions at MAX_SUGGESTIONS', () => {
    const catalog = Array.from({ length: 5 }, (_, i) => product({ id: `p${i}`, price_usd: i }));
    const result = suggestReplacements(trigger({ price_usd: null }), catalog, null, [], [], null);
    expect(result).toHaveLength(MAX_SUGGESTIONS);
    expect(MAX_SUGGESTIONS).toBe(3);
  });

  it('never throws with no scan, no reactions, no shelf, and no skin type', () => {
    expect(() =>
      suggestReplacements(trigger(), [product({ id: 'p1' })], null, [], [], null),
    ).not.toThrow();
  });
});
