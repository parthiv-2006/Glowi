import { describe, expect, it } from '@jest/globals';

import { matchesShelfSearch } from '../shelfSearch';
import type { ShelfItem } from '../types';

function item(partial: Partial<ShelfItem> = {}): Pick<ShelfItem, 'name' | 'brand' | 'notes'> {
  return {
    name: 'Vitamin C Serum',
    brand: 'Acme',
    notes: null,
    ...partial,
  };
}

describe('matchesShelfSearch', () => {
  it('matches everything on an empty query', () => {
    expect(matchesShelfSearch(item(), '')).toBe(true);
    expect(matchesShelfSearch(item(), '   ')).toBe(true);
  });

  it('matches by name, case-insensitively', () => {
    expect(matchesShelfSearch(item({ name: 'Niacinamide Serum' }), 'niacinamide')).toBe(true);
    expect(matchesShelfSearch(item({ name: 'Niacinamide Serum' }), 'NIACINAMIDE')).toBe(true);
  });

  it('matches by brand', () => {
    expect(matchesShelfSearch(item({ brand: 'The Ordinary' }), 'ordinary')).toBe(true);
  });

  it('matches by notes', () => {
    expect(matchesShelfSearch(item({ notes: 'Gift from mom, patch test first' }), 'gift')).toBe(
      true,
    );
  });

  it('is a substring match, not a whole-word match', () => {
    expect(matchesShelfSearch(item({ name: 'Retinol Cream' }), 'retino')).toBe(true);
  });

  it('returns false when nothing matches', () => {
    expect(matchesShelfSearch(item(), 'sunscreen')).toBe(false);
  });

  it('handles a null brand and null notes without throwing', () => {
    expect(() => matchesShelfSearch(item({ brand: null, notes: null }), 'x')).not.toThrow();
    expect(matchesShelfSearch(item({ brand: null, notes: null }), 'acme')).toBe(false);
  });
});
