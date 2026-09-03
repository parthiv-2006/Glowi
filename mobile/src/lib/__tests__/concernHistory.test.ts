import { describe, expect, it } from '@jest/globals';

import { MAX_CONCERN_HELPS, whatHelpedConcern } from '../concernHistory';
import type { CorrelationInsight } from '../correlation';

function insight(partial: Partial<CorrelationInsight> = {}): CorrelationInsight {
  return {
    event: {
      kind: 'shelf_add',
      date: '2026-06-15',
      label: 'Added Niacinamide Serum',
      key_ingredients: [],
    },
    direction: 'improved',
    scoreDelta: null,
    concernDeltas: [],
    scansAfter: 2,
    headline: 'Acne dropped 10 points across the next 2 scans.',
    ...partial,
  };
}

describe('whatHelpedConcern', () => {
  it('returns empty when no insight touches this concern', () => {
    const insights = [
      insight({ concernDeltas: [{ slug: 'acne', name: 'Acne', from: 60, to: 50, delta: -10 }] }),
    ];
    expect(whatHelpedConcern('hyperpigmentation', insights)).toEqual([]);
  });

  it('includes an insight whose concernDeltas improved this concern', () => {
    const insights = [
      insight({
        event: {
          kind: 'shelf_add',
          date: '2026-06-15',
          label: 'Added Niacinamide Serum',
          key_ingredients: [],
        },
        concernDeltas: [{ slug: 'acne', name: 'Acne', from: 60, to: 50, delta: -10 }],
      }),
    ];
    const result = whatHelpedConcern('acne', insights);
    expect(result).toEqual([{ label: 'Added Niacinamide Serum', delta: -10, date: '2026-06-15' }]);
  });

  it('excludes a matching concern that worsened rather than improved', () => {
    const insights = [
      insight({ concernDeltas: [{ slug: 'acne', name: 'Acne', from: 40, to: 55, delta: 15 }] }),
    ];
    expect(whatHelpedConcern('acne', insights)).toEqual([]);
  });

  it('only counts the delta for the matching concern, not a different one in the same insight', () => {
    const insights = [
      insight({
        concernDeltas: [
          { slug: 'hyperpigmentation', name: 'Hyperpigmentation', from: 50, to: 60, delta: 10 },
          { slug: 'acne', name: 'Acne', from: 60, to: 45, delta: -15 },
        ],
      }),
    ];
    const result = whatHelpedConcern('hyperpigmentation', insights);
    expect(result).toEqual([]);
  });

  it('ranks biggest improvement first', () => {
    const insights = [
      insight({
        event: { kind: 'shelf_add', date: '2026-06-01', label: 'Added A', key_ingredients: [] },
        concernDeltas: [{ slug: 'acne', name: 'Acne', from: 60, to: 55, delta: -5 }],
      }),
      insight({
        event: { kind: 'shelf_add', date: '2026-06-10', label: 'Added B', key_ingredients: [] },
        concernDeltas: [{ slug: 'acne', name: 'Acne', from: 60, to: 40, delta: -20 }],
      }),
    ];
    const result = whatHelpedConcern('acne', insights);
    expect(result.map((h) => h.label)).toEqual(['Added B', 'Added A']);
  });

  it('caps results at MAX_CONCERN_HELPS', () => {
    const insights = Array.from({ length: 5 }, (_, i) =>
      insight({
        event: {
          kind: 'shelf_add',
          date: `2026-06-0${i + 1}`,
          label: `Added ${i}`,
          key_ingredients: [],
        },
        concernDeltas: [{ slug: 'acne', name: 'Acne', from: 60, to: 55 - i, delta: -(5 + i) }],
      }),
    );
    const result = whatHelpedConcern('acne', insights);
    expect(result).toHaveLength(MAX_CONCERN_HELPS);
    expect(MAX_CONCERN_HELPS).toBe(3);
  });

  it('never throws on an empty insight list', () => {
    expect(() => whatHelpedConcern('acne', [])).not.toThrow();
  });
});
