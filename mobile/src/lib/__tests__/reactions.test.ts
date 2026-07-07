import { describe, expect, it } from '@jest/globals';

import {
  normalizeIngredient,
  reactionMemoryContent,
  riskyShelfItems,
  sharedRiskIngredients,
} from '../reactions';
import type { ReactionLog, ShelfItem } from '../types';

function reaction(partial: Partial<ReactionLog>): ReactionLog {
  return {
    id: 'r1',
    shelf_item_id: null,
    product_name: 'Test Serum',
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

function item(partial: Partial<ShelfItem>): ShelfItem {
  return {
    id: 'x',
    product_id: null,
    name: 'Test',
    brand: null,
    category: null,
    key_ingredients: [],
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
    created_at: '2026-06-01',
    updated_at: '2026-06-01',
    ...partial,
  };
}

describe('normalizeIngredient', () => {
  it('lowercases, trims, and collapses whitespace', () => {
    expect(normalizeIngredient('  Salicylic   Acid ')).toBe('salicylic acid');
  });
});

describe('sharedRiskIngredients', () => {
  it('matches ingredients case-insensitively, keeping the item casing', () => {
    const shared = sharedRiskIngredients(
      { key_ingredients: ['Retinol', 'salicylic acid'] },
      { key_ingredients: ['Salicylic Acid', 'ceramides'] },
    );
    expect(shared).toEqual(['Salicylic Acid']);
  });
  it('is empty when the reaction has no known ingredients', () => {
    expect(
      sharedRiskIngredients({ key_ingredients: [] }, { key_ingredients: ['retinol'] }),
    ).toEqual([]);
  });
});

describe('riskyShelfItems', () => {
  const retinolReaction = reaction({ shelf_item_id: 'shelf-1', key_ingredients: ['retinol'] });

  it('flags active items sharing an ingredient with a reaction', () => {
    const risky = item({ id: 'shelf-2', key_ingredients: ['Retinol', 'squalane'] });
    const risks = riskyShelfItems([retinolReaction], [risky]);
    expect(risks).toHaveLength(1);
    expect(risks[0].item.id).toBe('shelf-2');
    expect(risks[0].ingredients).toEqual(['Retinol']);
    expect(risks[0].reactions).toEqual([retinolReaction]);
  });

  it('excludes the item the reaction was logged against', () => {
    const source = item({ id: 'shelf-1', key_ingredients: ['retinol'] });
    expect(riskyShelfItems([retinolReaction], [source])).toEqual([]);
  });

  it('ignores non-active items and non-overlapping items', () => {
    const finished = item({ id: 'a', key_ingredients: ['retinol'], status: 'finished' });
    const unrelated = item({ id: 'b', key_ingredients: ['ceramides'] });
    expect(riskyShelfItems([retinolReaction], [finished, unrelated])).toEqual([]);
  });

  it('dedupes ingredients across multiple matching reactions', () => {
    const second = reaction({ id: 'r2', key_ingredients: ['retinol', 'niacinamide'] });
    const risky = item({ id: 'c', key_ingredients: ['retinol', 'niacinamide'] });
    const risks = riskyShelfItems([retinolReaction, second], [risky]);
    expect(risks[0].ingredients).toEqual(['retinol', 'niacinamide']);
    expect(risks[0].reactions).toHaveLength(2);
  });
});

describe('reactionMemoryContent', () => {
  it('names the product, date, symptoms, and ingredients', () => {
    const content = reactionMemoryContent({
      product_name: 'Resurfacing Retinol Serum',
      brand: 'CeraVe',
      reacted_on: '2026-07-01',
      symptoms: ['Redness', 'Burning / stinging'],
      key_ingredients: ['retinol', 'ceramides'],
    });
    expect(content).toContain('CeraVe Resurfacing Retinol Serum');
    expect(content).toContain('2026-07-01');
    expect(content).toContain('redness, burning / stinging');
    expect(content).toContain('retinol, ceramides');
    expect(content).toContain('Never recommend this product again.');
  });

  it('handles missing brand, symptoms, and ingredients', () => {
    const content = reactionMemoryContent({
      product_name: 'Mystery Cream',
      brand: null,
      reacted_on: '2026-07-01',
      symptoms: [],
      key_ingredients: [],
    });
    expect(content).toContain('Mystery Cream');
    expect(content).toContain('a bad reaction');
    expect(content).not.toContain('key ingredients');
  });
});
