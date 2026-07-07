import { describe, expect, it } from '@jest/globals';

import { sequenceWarnings, waitAfter } from '../routineSequence';
import type { Product, RoutineStep } from '../types';

function product(partial: Partial<Product>): Product {
  return {
    id: 'p1',
    slug: 'test',
    brand: 'Test',
    name: 'Product',
    category: 'serum',
    description: '',
    key_ingredients: [],
    price_usd: null,
    image_url: null,
    retailer_links: [],
    skin_types: [],
    am_pm: 'both',
    step_order: 0,
    ...partial,
  };
}

function step(partial: Partial<RoutineStep> & { product?: Product | null }): RoutineStep {
  return {
    id: 's1',
    routine_id: 'r1',
    position: 0,
    product_id: 'p1',
    custom_name: null,
    instruction: '',
    frequency: 'daily',
    product: null,
    ...partial,
  };
}

const cleanser = step({ id: 'c', product: product({ id: 'c', category: 'cleanser' }) });
const moisturizer = step({ id: 'm', product: product({ id: 'm', category: 'moisturizer' }) });
const spf = step({ id: 'spf', product: product({ id: 'spf', category: 'spf' }) });
const vitaminC = step({
  id: 'vc',
  product: product({ id: 'vc', name: 'Vitamin C Suspension', key_ingredients: ['ascorbic acid'] }),
});
const retinoid = step({
  id: 'ret',
  product: product({
    id: 'ret',
    name: 'Resurfacing Retinol Serum',
    category: 'treatment',
    key_ingredients: ['encapsulated retinol'],
  }),
});
const bha = step({
  id: 'bha',
  product: product({
    id: 'bha',
    name: '2% BHA Liquid Exfoliant',
    category: 'exfoliant',
    key_ingredients: ['salicylic acid'],
  }),
});

describe('waitAfter', () => {
  it('is null after the final step', () => {
    expect(waitAfter(moisturizer, undefined)).toBeNull();
  });
  it('recommends 10 minutes after vitamin C', () => {
    expect(waitAfter(vitaminC, moisturizer)?.minutes).toBe(10);
  });
  it('recommends 15 minutes after a treatment or exfoliant', () => {
    expect(waitAfter(retinoid, moisturizer)?.minutes).toBe(15);
    expect(waitAfter(bha, moisturizer)?.minutes).toBe(15);
  });
  it('recommends a short absorb wait after a plain serum', () => {
    const serum = step({ product: product({ category: 'serum' }) });
    expect(waitAfter(serum, moisturizer)?.minutes).toBe(3);
  });
  it('recommends settling moisturizer before SPF, but not before other steps', () => {
    expect(waitAfter(moisturizer, spf)?.minutes).toBe(5);
    expect(waitAfter(moisturizer, step({ product: product({ category: 'mask' }) }))).toBeNull();
  });
  it('needs no wait after cleansing', () => {
    expect(waitAfter(cleanser, vitaminC)).toBeNull();
  });
});

describe('sequenceWarnings', () => {
  it('is empty for a well-ordered AM routine', () => {
    expect(sequenceWarnings([cleanser, vitaminC, moisturizer, spf], 'am')).toEqual([]);
  });

  it('flags a cleanser that is not step 1', () => {
    const w = sequenceWarnings([vitaminC, cleanser, moisturizer], 'am');
    expect(w.some((x) => x.message.includes('Cleanser should be step 1'))).toBe(true);
  });

  it('flags SPF that is not the last step', () => {
    const w = sequenceWarnings([cleanser, spf, moisturizer], 'am');
    expect(w.some((x) => x.message.includes('SPF must be the very last step'))).toBe(true);
  });

  it('flags SPF at night', () => {
    const w = sequenceWarnings([cleanser, moisturizer, spf], 'pm');
    expect(w.some((x) => x.message.includes('no job at night'))).toBe(true);
  });

  it('flags a retinoid in the morning, even as the only step', () => {
    expect(sequenceWarnings([retinoid], 'am')).toHaveLength(1);
    const w = sequenceWarnings([cleanser, retinoid, moisturizer], 'am');
    expect(w.some((x) => x.message.includes('Retinoids degrade in daylight'))).toBe(true);
  });

  it('cautions on retinoid + exfoliating acid in the same routine', () => {
    const w = sequenceWarnings([cleanser, bha, retinoid, moisturizer], 'pm');
    expect(w.some((x) => x.message.includes('alternate nights'))).toBe(true);
  });

  it('cautions on retinoid + vitamin C in the same routine', () => {
    const w = sequenceWarnings([cleanser, vitaminC, retinoid, moisturizer], 'pm');
    expect(w.some((x) => x.message.includes('compete for skin pH'))).toBe(true);
  });

  it('flags a serum applied after moisturizer', () => {
    const serum = step({ id: 'se', product: product({ id: 'se', category: 'serum' }) });
    const w = sequenceWarnings([cleanser, moisturizer, serum], 'pm');
    expect(w.some((x) => x.message.includes('can’t penetrate'))).toBe(true);
  });

  it('sorts fix-severity warnings before cautions', () => {
    const w = sequenceWarnings([cleanser, bha, retinoid, spf, moisturizer], 'pm');
    expect(w.length).toBeGreaterThan(1);
    const firstCaution = w.findIndex((x) => x.severity === 'caution');
    const lastFix = w.map((x) => x.severity).lastIndexOf('fix');
    expect(firstCaution === -1 || lastFix < firstCaution).toBe(true);
  });
});
