import { describe, expect, it } from '@jest/globals';

import {
  buildEvents,
  correlateScanTrends,
  cycleEvents,
  lifestyleEvents,
  MAX_INSIGHTS,
  MIN_EFFECT_DAYS,
  MIN_STREAK_DAYS,
} from '../correlation';
import type { LifestyleLog, ReactionLog, Scan, ScanConcern, ShelfItem } from '../types';

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

function life(partial: Partial<LifestyleLog>): LifestyleLog {
  return {
    id: 'l',
    log_date: '2026-06-05',
    sleep_quality: null,
    stress_level: null,
    water_level: null,
    diet_dairy: false,
    diet_sugar: false,
    diet_alcohol: false,
    cycle_phase: null,
    created_at: '2026-06-05',
    updated_at: '2026-06-05',
    ...partial,
  };
}

/** Consecutive daily logs from `start`, each patched by `overrides`. */
function streak(start: string, days: number, overrides: Partial<LifestyleLog>): LifestyleLog[] {
  const base = Date.parse(start);
  return Array.from({ length: days }, (_, i) => {
    const date = new Date(base + i * 86_400_000).toISOString().slice(0, 10);
    return life({ id: `l${date}`, log_date: date, ...overrides });
  });
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

describe('lifestyleEvents', () => {
  it('emits an event for a streak at the MIN_STREAK_DAYS boundary, anchored at the start', () => {
    const events = lifestyleEvents(streak('2026-06-05', MIN_STREAK_DAYS, { sleep_quality: 0 }));
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      kind: 'lifestyle',
      date: '2026-06-05',
      label: `Low-sleep stretch (${MIN_STREAK_DAYS} days)`,
      key_ingredients: [],
    });
  });

  it('ignores a run one day short of the threshold', () => {
    expect(
      lifestyleEvents(streak('2026-06-05', MIN_STREAK_DAYS - 1, { sleep_quality: 0 })),
    ).toEqual([]);
  });

  it('breaks a streak across a non-consecutive gap and only counts the qualifying run', () => {
    const events = lifestyleEvents([
      ...streak('2026-06-05', 2, { sleep_quality: 0 }), // 5th–6th: too short
      ...streak('2026-06-08', 3, { sleep_quality: 0 }), // 8th–10th: qualifies
    ]);
    expect(events).toHaveLength(1);
    expect(events[0].label).toBe('Low-sleep stretch (3 days)');
    expect(events[0].date).toBe('2026-06-08');
  });

  it('does not treat unanswered (null) sleep as poor, and a null mid-run breaks it', () => {
    expect(lifestyleEvents(streak('2026-06-05', 4, { sleep_quality: null }))).toEqual([]);
    const broken = [
      life({ log_date: '2026-06-05', sleep_quality: 0 }),
      life({ log_date: '2026-06-06', sleep_quality: null }),
      life({ log_date: '2026-06-07', sleep_quality: 0 }),
      life({ log_date: '2026-06-08', sleep_quality: 0 }),
    ];
    expect(lifestyleEvents(broken)).toEqual([]);
  });

  it('detects high-stress and diet-flag stretches with their own labels', () => {
    expect(lifestyleEvents(streak('2026-06-05', 3, { stress_level: 2 }))[0].label).toBe(
      'High-stress stretch (3 days)',
    );
    expect(lifestyleEvents(streak('2026-06-05', 3, { diet_sugar: true }))[0].label).toBe(
      'Sugar-heavy stretch (3 days)',
    );
    // Moderate stress (1) is not "high" — no event.
    expect(lifestyleEvents(streak('2026-06-05', 3, { stress_level: 1 }))).toEqual([]);
  });
});

describe('cycleEvents', () => {
  it('emits an event for a same-phase run at the threshold, anchored at the start', () => {
    const events = cycleEvents(streak('2026-06-05', MIN_STREAK_DAYS, { cycle_phase: 'luteal' }));
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      kind: 'cycle',
      date: '2026-06-05',
      label: `Luteal phase (${MIN_STREAK_DAYS} days)`,
      key_ingredients: [],
    });
  });

  it('ignores a run one day short of the threshold', () => {
    expect(
      cycleEvents(streak('2026-06-05', MIN_STREAK_DAYS - 1, { cycle_phase: 'luteal' })),
    ).toEqual([]);
  });

  it('a phase change resets the run — two short runs emit nothing', () => {
    const logs = [
      ...streak('2026-06-05', 2, { cycle_phase: 'menstrual' }),
      ...streak('2026-06-07', 2, { cycle_phase: 'follicular' }),
    ];
    expect(cycleEvents(logs)).toEqual([]);
  });

  it('back-to-back qualifying phases each get their own event', () => {
    const logs = [
      ...streak('2026-06-05', 3, { cycle_phase: 'menstrual' }),
      ...streak('2026-06-08', 3, { cycle_phase: 'follicular' }),
    ];
    const events = cycleEvents(logs);
    expect(events).toHaveLength(2);
    expect(events[0].label).toBe('Menstrual phase (3 days)');
    expect(events[1]).toMatchObject({ label: 'Follicular phase (3 days)', date: '2026-06-08' });
  });

  it('a calendar gap breaks a same-phase run', () => {
    const logs = [
      ...streak('2026-06-05', 2, { cycle_phase: 'luteal' }),
      ...streak('2026-06-09', 2, { cycle_phase: 'luteal' }), // gap on the 7th–8th
    ];
    expect(cycleEvents(logs)).toEqual([]);
  });

  it('is silent when cycle tracking is off (all phases null)', () => {
    expect(cycleEvents(streak('2026-06-05', 5, { cycle_phase: null }))).toEqual([]);
    expect(cycleEvents(streak('2026-06-05', 5, { sleep_quality: 0 }))).toEqual([]);
  });
});

describe('correlateScanTrends with lifestyle logs', () => {
  const before = scan({
    id: 'before',
    created_at: '2026-06-01T12:00:00Z',
    skin_score: 70,
    concerns: [concern({ concern_slug: 'acne', display_name: 'Breakouts', severity: 40 })],
  });
  const worse = scan({
    id: 'after',
    created_at: '2026-06-20T12:00:00Z',
    skin_score: 62,
    concerns: [concern({ concern_slug: 'acne', display_name: 'Breakouts', severity: 52 })],
  });

  it('defaults the lifestyle param so existing three-argument calls are unaffected', () => {
    expect(correlateScanTrends([before, worse], [], [])).toEqual([]);
  });

  it('flags a worsening that follows a poor-sleep stretch', () => {
    const insights = correlateScanTrends(
      [before, worse],
      [],
      [],
      streak('2026-06-05', 4, { sleep_quality: 0 }),
    );
    expect(insights).toHaveLength(1);
    expect(insights[0].event).toMatchObject({
      kind: 'lifestyle',
      label: 'Low-sleep stretch (4 days)',
    });
    expect(insights[0].direction).toBe('worsened');
    expect(insights[0].headline).toBe('Breakouts rose 12 points across the next scan.');
  });

  it('drops a lifestyle streak that is too short to be an event', () => {
    const insights = correlateScanTrends(
      [before, worse],
      [],
      [],
      streak('2026-06-05', 2, { sleep_quality: 0 }),
    );
    expect(insights).toEqual([]);
  });
});
