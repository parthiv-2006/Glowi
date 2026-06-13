import { describe, expect, it } from '@jest/globals';

import { generateRoutineSteps } from '../routineGenerator';
import type { Product, ProductForConcern, ScanConcern } from '../types';

function product(over: Partial<Product> & { id: string; category: Product['category'] }): Product {
  return {
    slug: over.id,
    brand: 'Brand',
    name: 'Product',
    description: '',
    key_ingredients: [],
    price_usd: 10,
    image_url: null,
    retailer_links: [],
    skin_types: [],
    am_pm: 'both',
    step_order: 50,
    ...over,
  } as Product;
}

function pfc(
  p: Partial<Product> & { id: string; category: Product['category'] },
  relevance = 3,
): ProductForConcern {
  return { ...product(p), relevance, rationale: null };
}

const concerns: ScanConcern[] = [
  { concern_slug: 'acne', display_name: 'Acne', severity: 60, confidence: 0.9, areas: [], observations: '', caution: null },
  { concern_slug: 'dryness', display_name: 'Dryness', severity: 30, confidence: 0.8, areas: [], observations: '', caution: null },
];

describe('generateRoutineSteps', () => {
  it('routes SPF into AM only', () => {
    const map = {
      acne: [
        pfc({ id: 'spf1', category: 'spf', am_pm: 'am', step_order: 90 }, 5),
        pfc({ id: 'cl1', category: 'cleanser', am_pm: 'both', step_order: 10 }, 4),
      ],
      dryness: [pfc({ id: 'mo1', category: 'moisturizer', am_pm: 'both', step_order: 60 }, 4)],
    };
    const { am, pm } = generateRoutineSteps(concerns, map);
    expect(am.some((s) => s.product.category === 'spf')).toBe(true);
    expect(pm.some((s) => s.product.category === 'spf')).toBe(false);
  });

  it('orders steps by step_order within a period', () => {
    const map = {
      acne: [
        pfc({ id: 'mo', category: 'moisturizer', am_pm: 'am', step_order: 60 }, 4),
        pfc({ id: 'cl', category: 'cleanser', am_pm: 'am', step_order: 10 }, 4),
        pfc({ id: 'se', category: 'serum', am_pm: 'am', step_order: 30 }, 4),
      ],
      dryness: [],
    };
    const { am } = generateRoutineSteps(concerns, map);
    const orders = am.map((s) => s.product.step_order);
    expect(orders).toEqual([...orders].sort((a, b) => a - b));
  });

  it('keeps at most one product per category', () => {
    const map = {
      acne: [
        pfc({ id: 'cl1', category: 'cleanser', step_order: 10 }, 5),
        pfc({ id: 'cl2', category: 'cleanser', step_order: 10 }, 3),
      ],
      dryness: [],
    };
    const { am, pm } = generateRoutineSteps(concerns, map);
    const amCleansers = am.filter((s) => s.product.category === 'cleanser');
    const pmCleansers = pm.filter((s) => s.product.category === 'cleanser');
    expect(amCleansers.length).toBeLessThanOrEqual(1);
    expect(pmCleansers.length).toBeLessThanOrEqual(1);
    // keeps the higher-relevance cleanser
    if (amCleansers.length) expect(amCleansers[0].product.id).toBe('cl1');
  });

  it('assigns reduced frequency to treatments/exfoliants', () => {
    const map = {
      acne: [pfc({ id: 'tr', category: 'treatment', am_pm: 'pm', step_order: 40 }, 5)],
      dryness: [],
    };
    const { pm } = generateRoutineSteps(concerns, map);
    const treatment = pm.find((s) => s.product.category === 'treatment');
    expect(treatment?.frequency).toBe('2-3x-week');
  });

  it('caps each period at 5 steps', () => {
    const many: ProductForConcern[] = (
      ['cleanser', 'toner', 'serum', 'moisturizer', 'spf', 'eye-cream'] as const
    ).map((category, i) => pfc({ id: `p${i}`, category, am_pm: 'am', step_order: i * 10 }, 4));
    const { am } = generateRoutineSteps(concerns, { acne: many, dryness: [] });
    expect(am.length).toBeLessThanOrEqual(5);
  });

  it('returns empty routines when there are no products', () => {
    const { am, pm } = generateRoutineSteps(concerns, { acne: [], dryness: [] });
    expect(am).toEqual([]);
    expect(pm).toEqual([]);
  });
});
