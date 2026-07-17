import { describe, expect, it } from '@jest/globals';

import { BAR_MAX, barWidth, buildTimeline } from '../routineTimeline';
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

describe('barWidth', () => {
  it('maps minutes to a proportional px width, capped at BAR_MAX', () => {
    expect(barWidth(0)).toBe(24);
    expect(barWidth(3)).toBe(36);
    expect(barWidth(5)).toBe(44);
    expect(barWidth(10)).toBe(64);
    expect(barWidth(15)).toBe(84);
    expect(barWidth(30)).toBe(BAR_MAX);
  });
});

describe('buildTimeline', () => {
  const vitaminC = step({
    id: 'vc',
    product: product({
      id: 'vc',
      name: 'Vitamin C Suspension',
      key_ingredients: ['ascorbic acid'],
    }),
  });
  const moisturizer = step({
    id: 'm',
    product: product({ id: 'm', category: 'moisturizer' }),
  });
  const spf = step({ id: 'spf', product: product({ id: 'spf', category: 'spf' }) });

  it('builds one segment per gap, with minutes/notes carried through', () => {
    const model = buildTimeline([vitaminC, moisturizer, spf]);
    expect(model.segments).toHaveLength(2);
    expect(model.segments[0].minutes).toBe(10);
    expect(model.segments[0].note).toMatch(/vitamin c/i);
    expect(model.segments[1].minutes).toBe(5);
    expect(model.segments[1].note).toMatch(/spf/i);
    expect(model.totalWaitMinutes).toBe(15);
  });

  it('emits a zero-wait segment when no wait is needed between two steps', () => {
    const cleanser = step({ id: 'c', product: product({ id: 'c', category: 'cleanser' }) });
    const model = buildTimeline([cleanser, moisturizer]);
    expect(model.segments).toHaveLength(1);
    expect(model.segments[0].minutes).toBe(0);
    expect(model.segments[0].note).toBeNull();
    expect(model.segments[0].width).toBe(24);
    expect(model.totalWaitMinutes).toBe(0);
  });

  it('has no segments for a single step or an empty list', () => {
    expect(buildTimeline([moisturizer]).segments).toEqual([]);
    expect(buildTimeline([]).segments).toEqual([]);
  });
});
