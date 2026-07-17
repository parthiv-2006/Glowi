import { describe, expect, it } from '@jest/globals';

import { buildConflictGraph, truncateLabel } from '../conflictGraph';
import type { ConflictReport, IngredientConflict } from '../types';

function report(conflicts: Partial<IngredientConflict>[]): ConflictReport {
  return {
    checkedAt: '2026-01-01T00:00:00.000Z',
    conflicts: conflicts.map((c) => ({
      severity: 'caution',
      ingredients: [],
      products: [],
      reason: '',
      citation: '',
      recommendation: '',
      ...c,
    })),
  };
}

describe('buildConflictGraph', () => {
  it('dedups the same product across casing and whitespace into one node', () => {
    const model = buildConflictGraph(
      report([
        { severity: 'caution', products: ['Retinol Serum'] },
        { severity: 'avoid', products: ['  retinol   serum  '] },
      ]),
    );
    expect(model.nodes).toHaveLength(1);
    expect(model.nodes[0].label).toBe('Retinol Serum'); // first-seen casing
    expect(model.nodes[0].conflictIndices).toEqual([0, 1]);
    expect(model.nodes[0].selfSeverities).toEqual(['caution', 'avoid']);
    expect(model.edges).toHaveLength(0);
  });

  it('turns a three-product conflict into three pairwise edges', () => {
    const model = buildConflictGraph(report([{ products: ['A', 'B', 'C'] }]));
    expect(model.nodes.map((node) => node.id)).toEqual(['a', 'b', 'c']);
    expect(model.edges.map((edge) => [edge.from, edge.to])).toEqual([
      ['a', 'b'],
      ['a', 'c'],
      ['b', 'c'],
    ]);
  });

  it('records a single-product conflict as a self-severity with no edge', () => {
    const model = buildConflictGraph(report([{ severity: 'time_of_day', products: ['Differin'] }]));
    expect(model.edges).toHaveLength(0);
    expect(model.nodes[0].selfSeverities).toEqual(['time_of_day']);
    expect(model.nodes[0].conflictIndices).toEqual([0]);
  });

  it('excludes a zero-product conflict from the graph but keeps its index', () => {
    const model = buildConflictGraph(report([{ products: [] }, { products: ['A', 'B'] }]));
    expect(model.excludedConflictIndices).toEqual([0]);
    expect(model.nodes.map((node) => node.id)).toEqual(['a', 'b']);
    expect(model.edges).toHaveLength(1);
    expect(model.edges[0].conflictIndex).toBe(1);
  });

  it('is deterministic: alphabetical nodes, first node at top, deep-equal on repeat', () => {
    const source = report([{ products: ['B', 'A'] }, { severity: 'avoid', products: ['C', 'A'] }]);
    const first = buildConflictGraph(source);
    const second = buildConflictGraph(source);
    expect(first).toEqual(second);
    expect(first.nodes.map((node) => node.id)).toEqual(['a', 'b', 'c']);
    expect(first.nodes[0].x).toBeCloseTo(0.5);
    expect(first.nodes[0].y).toBeCloseTo(0.1); // −90° → top of the circle
  });

  it('numbers duplicate same-pair edges with an ascending parallelIndex', () => {
    const model = buildConflictGraph(
      report([
        { severity: 'caution', products: ['A', 'B'] },
        { severity: 'avoid', products: ['B', 'A'] },
      ]),
    );
    const pair = model.edges.filter((edge) => edge.from === 'a' && edge.to === 'b');
    expect(pair).toHaveLength(2);
    expect([...pair.map((edge) => edge.parallelIndex)].sort()).toEqual([0, 1]);
    // Draw order puts avoid on top (last).
    expect(model.edges[model.edges.length - 1].severity).toBe('avoid');
  });
});

describe('truncateLabel', () => {
  it('leaves names within the limit untouched', () => {
    expect(truncateLabel('Retinol')).toBe('Retinol');
    expect(truncateLabel('123456789012')).toBe('123456789012'); // exactly max
  });

  it('ellipsizes names that overflow the limit', () => {
    expect(truncateLabel("Paula's Choice BHA")).toBe("Paula's Cho…");
    expect(truncateLabel('1234567890123')).toBe('12345678901…');
  });
});
