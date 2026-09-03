import { describe, expect, it } from '@jest/globals';

import { dupeWhy, findDupes, MAX_DUPES, type DupeSource } from '../dupes';
import type { Product, ReactionLog } from '../types';

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

function source(partial: Partial<DupeSource> = {}): DupeSource {
  return {
    category: 'serum',
    key_ingredients: ['Niacinamide'],
    price_usd: 30,
    ...partial,
  };
}

describe('findDupes', () => {
  it('returns empty for an empty catalog', () => {
    expect(findDupes(source(), [], [])).toEqual([]);
  });

  it('returns empty when the source has no category', () => {
    expect(findDupes(source({ category: null }), [product({ id: 'c1' })], [])).toEqual([]);
  });

  it('returns empty when the source has no price', () => {
    expect(findDupes(source({ price_usd: null }), [product({ id: 'c1' })], [])).toEqual([]);
  });

  it('returns empty when the source has no key ingredients', () => {
    expect(findDupes(source({ key_ingredients: [] }), [product({ id: 'c1' })], [])).toEqual([]);
  });

  it('only candidates from the same category', () => {
    const serum = product({ id: 'c1', category: 'serum', key_ingredients: ['niacinamide'] });
    const cleanser = product({ id: 'c2', category: 'cleanser', key_ingredients: ['niacinamide'] });
    const result = findDupes(source(), [serum, cleanser], []);
    expect(result.map((r) => r.product.id)).toEqual(['c1']);
  });

  it('excludes candidates that cost the same or more', () => {
    const pricier = product({ id: 'c1', price_usd: 30, key_ingredients: ['niacinamide'] });
    const equal = product({ id: 'c2', price_usd: 20, key_ingredients: ['niacinamide'] });
    const cheaper = product({ id: 'c3', price_usd: 19.99, key_ingredients: ['niacinamide'] });
    const result = findDupes(source({ price_usd: 20 }), [pricier, equal, cheaper], []);
    expect(result.map((r) => r.product.id)).toEqual(['c3']);
  });

  it('requires at least one shared key ingredient — same category alone is not a dupe', () => {
    const unrelated = product({ id: 'c1', price_usd: 10, key_ingredients: ['glycerin'] });
    expect(findDupes(source(), [unrelated], [])).toEqual([]);
  });

  it('excludes a given product id (the source itself, when it is a catalog product)', () => {
    const self = product({ id: 'self', price_usd: 10, key_ingredients: ['niacinamide'] });
    const other = product({ id: 'other', price_usd: 10, key_ingredients: ['niacinamide'] });
    const result = findDupes(source(), [self, other], [], 'self');
    expect(result.map((r) => r.product.id)).toEqual(['other']);
  });

  it('hard-disqualifies a candidate sharing an ingredient with a logged reaction', () => {
    const risky = product({ id: 'c1', price_usd: 10, key_ingredients: ['Niacinamide', 'Retinol'] });
    const safe = product({ id: 'c2', price_usd: 10, key_ingredients: ['Niacinamide'] });
    const reactions = [reaction({ key_ingredients: ['retinol'] })];
    const result = findDupes(source(), [risky, safe], reactions);
    expect(result.map((r) => r.product.id)).toEqual(['c2']);
  });

  it('ranks by shared-ingredient count first, then by savings', () => {
    const oneShared = product({
      id: 'c1',
      price_usd: 5,
      key_ingredients: ['niacinamide'],
    });
    const twoShared = product({
      id: 'c2',
      price_usd: 15,
      key_ingredients: ['niacinamide', 'zinc pca'],
    });
    const result = findDupes(
      source({ key_ingredients: ['Niacinamide', 'Zinc PCA'] }),
      [oneShared, twoShared],
      [],
    );
    // twoShared has the higher overlap even though it saves less.
    expect(result.map((r) => r.product.id)).toEqual(['c2', 'c1']);
    expect(result[0].score).toBe(2);
    expect(result[0].savingsUsd).toBeCloseTo(15);
    expect(result[1].savingsUsd).toBeCloseTo(25);
  });

  it('breaks a tied overlap score by larger savings', () => {
    const smallSavings = product({ id: 'c1', price_usd: 25, key_ingredients: ['niacinamide'] });
    const bigSavings = product({ id: 'c2', price_usd: 5, key_ingredients: ['niacinamide'] });
    const result = findDupes(source(), [smallSavings, bigSavings], []);
    expect(result.map((r) => r.product.id)).toEqual(['c2', 'c1']);
  });

  it('caps results at MAX_DUPES', () => {
    const catalog = Array.from({ length: 6 }, (_, i) =>
      product({ id: `c${i}`, price_usd: i, key_ingredients: ['niacinamide'] }),
    );
    const result = findDupes(source(), catalog, []);
    expect(result).toHaveLength(MAX_DUPES);
    expect(MAX_DUPES).toBe(3);
  });

  it('never throws with no reactions and no exclusion id', () => {
    expect(() =>
      findDupes(source(), [product({ id: 'c1', key_ingredients: ['niacinamide'] })], []),
    ).not.toThrow();
  });
});

describe('dupeWhy', () => {
  it('names the shared ingredients and the savings', () => {
    expect(dupeWhy({ savingsUsd: 8, sharedIngredients: ['Niacinamide'] })).toBe(
      'Shares niacinamide · saves $8.00',
    );
  });

  it('lists multiple shared ingredients', () => {
    expect(dupeWhy({ savingsUsd: 12.5, sharedIngredients: ['Niacinamide', 'Zinc PCA'] })).toBe(
      'Shares niacinamide, zinc pca · saves $12.50',
    );
  });

  it('still states the savings when nothing is shared (defensive — should not happen via findDupes)', () => {
    expect(dupeWhy({ savingsUsd: 3, sharedIngredients: [] })).toBe('saves $3.00');
  });
});
