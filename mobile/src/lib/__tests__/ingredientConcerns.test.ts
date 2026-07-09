import { describe, expect, it } from '@jest/globals';

import { concernsTargetedBy, normalizeIngredient } from '../ingredientConcerns';

describe('normalizeIngredient', () => {
  it('lowercases, trims, and strips concentration/dose noise', () => {
    expect(normalizeIngredient('Niacinamide')).toBe('niacinamide');
    expect(normalizeIngredient('  Vitamin C 20%  ')).toBe('vitamin c');
    expect(normalizeIngredient('Zinc Picolinate 30mg')).toBe('zinc picolinate');
    expect(normalizeIngredient('Hyaluronic Acid x5')).toBe('hyaluronic acid');
    expect(normalizeIngredient('Cholecalciferol 2000 IU')).toBe('cholecalciferol');
  });
});

describe('concernsTargetedBy', () => {
  it('maps known actives to their seeded concern slugs', () => {
    expect(concernsTargetedBy(['niacinamide'])).toEqual(
      expect.arrayContaining(['oiliness', 'enlarged-pores', 'hyperpigmentation']),
    );
    expect(concernsTargetedBy(['retinol'])).toEqual(
      expect.arrayContaining([
        'fine-lines-wrinkles',
        'acne',
        'hyperpigmentation',
        'enlarged-pores',
      ]),
    );
    expect(concernsTargetedBy(['salicylic acid'])).toEqual(
      expect.arrayContaining(['acne', 'blackheads-congestion', 'enlarged-pores', 'oiliness']),
    );
    expect(concernsTargetedBy(['benzoyl peroxide 5.5%'])).toEqual(['acne']);
  });

  it('handles common ingredient-name synonyms', () => {
    expect(concernsTargetedBy(['vitamin c'])).toEqual(concernsTargetedBy(['ascorbic acid']));
    expect(concernsTargetedBy(['bha'])).toEqual(concernsTargetedBy(['salicylic acid']));
  });

  it('does not false-positive on substrings of unrelated ingredients', () => {
    // "alpha arbutin" contains the letters "pha" but must not match the PHA/AHA family.
    expect(concernsTargetedBy(['alpha arbutin'])).toEqual(['hyperpigmentation']);
  });

  it('returns an empty array for unknown ingredients', () => {
    expect(concernsTargetedBy(['unobtanium'])).toEqual([]);
    expect(concernsTargetedBy([])).toEqual([]);
  });

  it('unions concerns across multiple ingredients without duplicates', () => {
    const result = concernsTargetedBy(['niacinamide', 'zinc pca']);
    expect(result.filter((c) => c === 'oiliness')).toHaveLength(1);
    expect(result).toEqual(
      expect.arrayContaining(['oiliness', 'enlarged-pores', 'hyperpigmentation', 'acne']),
    );
  });
});
