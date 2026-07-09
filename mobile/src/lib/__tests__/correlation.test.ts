import { describe, expect, it } from '@jest/globals';

import { buildEvents, correlateScanTrends, MAX_INSIGHTS, MIN_EFFECT_DAYS } from '../correlation';
import type { ReactionLog, Scan, ScanConcern, ShelfItem } from '../types';

function concern(partial: Partial<ScanConcern>): ScanConcern {
  return {
    concern_slug: 'dark-spots',
    display_name: 'Dark spots',
    severity: 50,
    confidence: 0.9,
    areas: [],
    observations: '',
    caution: null,
    ...partial,
  };
}

function scan(partial: Partial<Scan>): Scan {
  return {
    id: 's1',
    user_id: 'u1',
    image_path: null,
    status: 'complete',
    skin_score: 60,
    skin_type_estimate: null,
    summary: null,
    concerns: [],
    area: null,
    notes: null,
    capture_meta: null,
    created_at: '2026-06-01T12:00:00Z',
    ...partial,
  };
}

function item(partial: Partial<ShelfItem>): ShelfItem {
  return {
    id: 'x',
    product_id: null,
    name: 'Niacinamide Serum',
    brand: null,
    category: null,
    key_ingredients: ['niacinamide'],
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
    created_at: '2026-06-10',
    updated_at: '2026-06-10',
    ...partial,
  };
}

function reaction(partial: Partial<ReactionLog>): ReactionLog {
  return {
    id: 'r1',
    shelf_item_id: null,
    product_name: 'Retinol Cream',
    brand: null,
    key_ingredients: ['retinol'],
    reacted_on: '2026-06-10',
    symptoms: ['Redness'],
    severity: 'moderate',
    notes: null,
    created_at: '2026-06-10',
    updated_at: '2026-06-10',
    ...partial,
  };
}

describe('buildEvents', () => {
  it('merges shelf additions and reactions into one labelled stream', () => {
    const events = buildEvents([item({})], [reaction({})]);
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({ kind: 'shelf_add', label: 'Added Niacinamide Serum' });
    expect(events[1]).toMatchObject({ kind: 'reaction', label: 'Reaction to Retinol Cream' });
  });
});

describe('correlateScanTrends', () => {
  const before = scan({
    id: 'before',
    created_at: '2026-06-01T12:00:00Z',
    skin_score: 60,
    concerns: [concern({ severity: 50 })],
  });
  const after = scan({
    id: 'after',
    created_at: '2026-06-20T12:00:00Z',
    skin_score: 68,
    concerns: [concern({ severity: 38 })],
  });

  it('returns nothing with fewer than two completed scans', () => {
    expect(correlateScanTrends([before], [item({})], [])).toEqual([]);
    const pending = scan({ id: 'p', status: 'pending', created_at: '2026-06-20T12:00:00Z' });
    expect(correlateScanTrends([before, pending], [item({})], [])).toEqual([]);
  });

  it('credits a shelf addition flanked by scans with the concern improvement', () => {
    const insights = correlateScanTrends([before, after], [item({ created_at: '2026-06-10' })], []);
    expect(insights).toHaveLength(1);
    expect(insights[0].direction).toBe('improved');
    expect(insights[0].concernDeltas[0]).toMatchObject({ name: 'Dark spots', delta: -12 });
    expect(insights[0].headline).toBe('Dark spots dropped 12 points across the next scan.');
    expect(insights[0].scoreDelta).toBe(8);
  });

  it('flags worsening after a logged reaction', () => {
    const worse = scan({
      id: 'worse',
      created_at: '2026-06-20T12:00:00Z',
      skin_score: 52,
      concerns: [concern({ severity: 63 })],
    });
    const insights = correlateScanTrends(
      [before, worse],
      [],
      [reaction({ reacted_on: '2026-06-10' })],
    );
    expect(insights).toHaveLength(1);
    expect(insights[0].direction).toBe('worsened');
    expect(insights[0].headline).toBe('Dark spots rose 13 points across the next scan.');
  });

  it('needs a scan at least MIN_EFFECT_DAYS after the event', () => {
    const tooSoon = scan({ id: 'soon', created_at: '2026-06-11T12:00:00Z', skin_score: 70 });
    const insights = correlateScanTrends(
      [before, tooSoon],
      [item({ created_at: '2026-06-10' })],
      [],
    );
    expect(MIN_EFFECT_DAYS).toBeGreaterThan(1);
    expect(insights).toEqual([]);
  });

  it('skips events with no baseline scan before them', () => {
    const insights = correlateScanTrends([before, after], [item({ created_at: '2026-05-01' })], []);
    expect(insights).toEqual([]);
  });

  it('falls back to the skin score when no single concern moved enough', () => {
    const flatConcerns = scan({
      id: 'flat',
      created_at: '2026-06-20T12:00:00Z',
      skin_score: 67,
      concerns: [concern({ severity: 48 })],
    });
    const insights = correlateScanTrends(
      [before, flatConcerns],
      [item({ created_at: '2026-06-10' })],
      [],
    );
    expect(insights).toHaveLength(1);
    expect(insights[0].concernDeltas).toEqual([]);
    expect(insights[0].headline).toBe('Skin score climbed 7 points across the next scan.');
  });

  it('drops events where nothing measurable changed', () => {
    const unchanged = scan({
      id: 'same',
      created_at: '2026-06-20T12:00:00Z',
      skin_score: 61,
      concerns: [concern({ severity: 49 })],
    });
    const insights = correlateScanTrends(
      [before, unchanged],
      [item({ created_at: '2026-06-10' })],
      [],
    );
    expect(insights).toEqual([]);
  });

  it('caps output at MAX_INSIGHTS, most recent events first', () => {
    const items = ['2026-06-05', '2026-06-07', '2026-06-09', '2026-06-11', '2026-06-13'].map(
      (date, i) => item({ id: `i${i}`, name: `Product ${i}`, created_at: date }),
    );
    const insights = correlateScanTrends([before, after], items, []);
    expect(insights).toHaveLength(MAX_INSIGHTS);
    expect(insights[0].event.label).toBe('Added Product 4');
    expect(insights[3].event.label).toBe('Added Product 1');
  });
});
