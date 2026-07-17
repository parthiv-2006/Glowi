import { describe, expect, it } from '@jest/globals';

import type { CorrelationInsight } from '../correlation';
import { insightSeries, MAX_AFTER, MAX_BEFORE, polylineLength } from '../correlationSeries';
import type { Scan, ScanConcern } from '../types';

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

function insight(partial: Partial<CorrelationInsight>): CorrelationInsight {
  return {
    event: {
      kind: 'shelf_add',
      date: '2026-06-10',
      label: 'Added Niacinamide Serum',
      key_ingredients: ['niacinamide'],
    },
    direction: 'improved',
    scoreDelta: null,
    concernDeltas: [],
    scansAfter: 1,
    headline: 'Dark spots dropped 12 points across the next scan.',
    ...partial,
  };
}

const darkSpotsDelta = {
  slug: 'dark-spots',
  name: 'Dark spots',
  from: 52,
  to: 40,
  delta: -12,
};

describe('insightSeries', () => {
  it('charts the top concern by slug and skips scans lacking it', () => {
    const scans = [
      scan({ id: 'a', created_at: '2026-06-01', concerns: [concern({ severity: 52 })] }),
      scan({ id: 'b', created_at: '2026-06-05', concerns: [concern({ concern_slug: 'redness' })] }),
      scan({ id: 'c', created_at: '2026-06-15', concerns: [concern({ severity: 40 })] }),
    ];
    const series = insightSeries(insight({ concernDeltas: [darkSpotsDelta] }), scans);
    expect(series).not.toBeNull();
    expect(series!.metric).toBe('concern');
    expect(series!.concernName).toBe('Dark spots');
    expect(series!.points).toEqual([
      { date: '2026-06-01', value: 52 },
      { date: '2026-06-15', value: 40 },
    ]);
    expect(series!.eventIndex).toBe(0);
  });

  it('falls back to skin score and skips null-score scans', () => {
    const scans = [
      scan({ id: 'a', created_at: '2026-06-01', skin_score: 58 }),
      scan({ id: 'b', created_at: '2026-06-05', skin_score: null }),
      scan({ id: 'c', created_at: '2026-06-15', skin_score: 64 }),
    ];
    const series = insightSeries(insight({ scoreDelta: 6 }), scans);
    expect(series).not.toBeNull();
    expect(series!.metric).toBe('score');
    expect(series!.concernName).toBeUndefined();
    expect(series!.points.map((p) => p.value)).toEqual([58, 64]);
  });

  it('windows to the last MAX_BEFORE and first MAX_AFTER points around the event', () => {
    const before = Array.from({ length: 6 }, (_, i) =>
      scan({ id: `b${i}`, created_at: `2026-06-0${i + 1}`, skin_score: 40 + i }),
    );
    const after = Array.from({ length: 8 }, (_, i) =>
      scan({ id: `a${i}`, created_at: `2026-06-${11 + i}`, skin_score: 50 + i }),
    );
    const series = insightSeries(insight({}), [...before, ...after]);
    expect(series!.points).toHaveLength(MAX_BEFORE + MAX_AFTER);
    // Last 3 before-points: scores 43, 44, 45; first 5 after: 50–54.
    expect(series!.points.map((p) => p.value)).toEqual([43, 44, 45, 50, 51, 52, 53, 54]);
    expect(series!.eventIndex).toBe(MAX_BEFORE - 1);
  });

  it('returns null without a baseline point on/before the event', () => {
    const scans = [
      scan({ id: 'a', created_at: '2026-06-11' }),
      scan({ id: 'b', created_at: '2026-06-15' }),
    ];
    expect(insightSeries(insight({}), scans)).toBeNull();
  });

  it('returns null with fewer than two points', () => {
    expect(insightSeries(insight({}), [scan({ created_at: '2026-06-01' })])).toBeNull();
  });

  it('returns null for an unparseable event date', () => {
    const scans = [
      scan({ id: 'a', created_at: '2026-06-01' }),
      scan({ id: 'b', created_at: '2026-06-15' }),
    ];
    expect(
      insightSeries(insight({ event: { ...insight({}).event, date: 'nope' } }), scans),
    ).toBeNull();
  });

  it('excludes non-complete scans', () => {
    const scans = [
      scan({ id: 'a', created_at: '2026-06-01' }),
      scan({ id: 'b', created_at: '2026-06-05', status: 'pending' }),
      scan({ id: 'c', created_at: '2026-06-15' }),
    ];
    const series = insightSeries(insight({}), scans);
    expect(series!.points.map((p) => p.date)).toEqual(['2026-06-01', '2026-06-15']);
  });

  it('prefers the concern delta, then scoreDelta, then last − baseline', () => {
    const scans = [
      scan({
        id: 'a',
        created_at: '2026-06-01',
        skin_score: 58,
        concerns: [concern({ severity: 52 })],
      }),
      scan({
        id: 'b',
        created_at: '2026-06-15',
        skin_score: 64,
        concerns: [concern({ severity: 40 })],
      }),
    ];
    expect(
      insightSeries(insight({ concernDeltas: [darkSpotsDelta], scoreDelta: 6 }), scans)!.delta,
    ).toBe(-12);
    expect(insightSeries(insight({ scoreDelta: 6 }), scans)!.delta).toBe(6);
    expect(insightSeries(insight({}), scans)!.delta).toBe(64 - 58);
  });
});

describe('polylineLength', () => {
  it('sums segment lengths (closed 3-4-5 triangle)', () => {
    expect(
      polylineLength([
        { x: 0, y: 0 },
        { x: 3, y: 0 },
        { x: 3, y: 4 },
        { x: 0, y: 0 },
      ]),
    ).toBe(3 + 4 + 5);
  });

  it('is zero for a single point or empty list', () => {
    expect(polylineLength([{ x: 10, y: 10 }])).toBe(0);
    expect(polylineLength([])).toBe(0);
  });
});
