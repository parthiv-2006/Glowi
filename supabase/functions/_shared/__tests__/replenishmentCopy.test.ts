/**
 * mapCopyLines ties a model's ordered array of lines to the ordered
 * candidate list. It must never let a malformed batch invent copy for a
 * product it wasn't given, and a single bad line must cost only that
 * candidate, never the whole batch.
 */
import { assertEquals } from '@std/assert';
import { mapCopyLines } from '../replenishmentCopy.ts';

const CANDIDATES = [{ productId: 'p1' }, { productId: 'p2' }, { productId: 'p3' }];

Deno.test('mapCopyLines: maps lines onto candidates by position', () => {
  const parsed = { lines: ['Great for oily skin.', 'A gentler nightly swap.', 'Matches your budget.'] };
  assertEquals(mapCopyLines(parsed, CANDIDATES), {
    p1: 'Great for oily skin.',
    p2: 'A gentler nightly swap.',
    p3: 'Matches your budget.',
  });
});

Deno.test('mapCopyLines: wrong array length drops the whole batch', () => {
  const parsed = { lines: ['Only one line.'] };
  assertEquals(mapCopyLines(parsed, CANDIDATES), {});
});

Deno.test('mapCopyLines: not an object with a lines array drops the whole batch', () => {
  assertEquals(mapCopyLines('just a string', CANDIDATES), {});
  assertEquals(mapCopyLines(null, CANDIDATES), {});
  assertEquals(mapCopyLines({ lines: 'not an array' }, CANDIDATES), {});
});

Deno.test('mapCopyLines: a non-string entry drops only that candidate', () => {
  const parsed = { lines: ['Great pick for you.', 42, 'Also a solid choice.'] };
  assertEquals(mapCopyLines(parsed, CANDIDATES), {
    p1: 'Great pick for you.',
    p3: 'Also a solid choice.',
  });
});

Deno.test('mapCopyLines: a too-short line drops only that candidate', () => {
  const parsed = { lines: ['Great pick for you.', 'ok', 'Also a solid choice.'] };
  assertEquals(mapCopyLines(parsed, CANDIDATES), {
    p1: 'Great pick for you.',
    p3: 'Also a solid choice.',
  });
});

Deno.test('mapCopyLines: caps an overlong line rather than dropping it', () => {
  const long = 'x'.repeat(500);
  const parsed = { lines: [long] };
  const result = mapCopyLines(parsed, [{ productId: 'p1' }]);
  assertEquals(result.p1.length, 160);
});

Deno.test('mapCopyLines: empty candidate list yields an empty map', () => {
  assertEquals(mapCopyLines({ lines: [] }, []), {});
});
