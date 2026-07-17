/**
 * sanitizeConflicts is the boundary between Claude's conflict report and the
 * database. It must drop malformed entries one at a time, cap every field,
 * and never let a non-report shape through as a report.
 */
import { assertEquals } from '@std/assert';
import { sanitizeConflicts } from '../conflicts.ts';

const GOOD = {
  severity: 'avoid',
  ingredients: ['retinol', 'benzoyl peroxide'],
  products: ['Brand A Serum', 'Brand B Treatment'],
  reason: 'Benzoyl peroxide oxidizes retinol, degrading both actives.',
  citation: 'established dermatology guidance',
  recommendation: 'Use benzoyl peroxide in the AM and retinol in the PM.',
};

Deno.test('sanitizeConflicts: passes a well-formed conflict through intact', () => {
  const [c] = sanitizeConflicts({ conflicts: [GOOD] });
  assertEquals(c, GOOD);
});

Deno.test('sanitizeConflicts: non-report shapes yield an empty report', () => {
  assertEquals(sanitizeConflicts(null), []);
  assertEquals(sanitizeConflicts('prose'), []);
  assertEquals(sanitizeConflicts({ conflicts: 'not an array' }), []);
  assertEquals(sanitizeConflicts({}), []);
});

Deno.test('sanitizeConflicts: an invalid severity drops only that entry', () => {
  const bad = { ...GOOD, severity: 'catastrophic' };
  assertEquals(sanitizeConflicts({ conflicts: [bad, GOOD] }), [GOOD]);
});

Deno.test('sanitizeConflicts: missing ingredients or reason drops the entry', () => {
  assertEquals(sanitizeConflicts({ conflicts: [{ ...GOOD, ingredients: [] }] }), []);
  assertEquals(sanitizeConflicts({ conflicts: [{ ...GOOD, reason: '   ' }] }), []);
  assertEquals(sanitizeConflicts({ conflicts: [{ ...GOOD, ingredients: [42, null] }] }), []);
});

Deno.test('sanitizeConflicts: non-string optional fields get safe defaults', () => {
  const [c] = sanitizeConflicts({
    conflicts: [{ ...GOOD, products: 'not an array', citation: 7, recommendation: null }],
  });
  assertEquals(c.products, []);
  assertEquals(c.citation, 'established dermatology guidance');
  assertEquals(c.recommendation, '');
});

Deno.test('sanitizeConflicts: caps entry count, list lengths, and field lengths', () => {
  const long = 'x'.repeat(1000);
  const many = Array.from({ length: 20 }, () => ({
    ...GOOD,
    ingredients: Array.from({ length: 12 }, () => long),
    reason: long,
  }));
  const result = sanitizeConflicts({ conflicts: many });
  assertEquals(result.length, 10);
  assertEquals(result[0].ingredients.length, 6);
  assertEquals(result[0].ingredients[0].length, 80);
  assertEquals(result[0].reason.length, 400);
});
