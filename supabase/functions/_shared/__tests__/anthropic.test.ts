/**
 * `extractJson` is the seam where unpredictable model output becomes typed data.
 * Every AI function depends on it, and the failure it must never have is a
 * *silent* one — returning half an object, or a fragment of the prose around it.
 * Throwing is fine (callers reject the response); lying is not.
 */
import { assertEquals, assertThrows } from '@std/assert';
import { extractJson } from '../anthropic.ts';

Deno.test('extractJson: bare object', () => {
  assertEquals(extractJson('{"score":72}'), { score: 72 });
});

Deno.test('extractJson: markdown-fenced object', () => {
  const raw = '```json\n{"score":72,"concerns":["acne"]}\n```';
  assertEquals(extractJson(raw), { score: 72, concerns: ['acne'] });
});

Deno.test('extractJson: prose on both sides', () => {
  const raw = 'Here is the analysis you asked for:\n{"score":41}\nHope that helps!';
  assertEquals(extractJson(raw), { score: 41 });
});

Deno.test('extractJson: top-level array', () => {
  assertEquals(extractJson('[{"slug":"a"},{"slug":"b"}]'), [{ slug: 'a' }, { slug: 'b' }]);
});

Deno.test('extractJson: nested braces close at the right depth', () => {
  const raw = 'text {"a":{"b":{"c":1}},"d":2} trailing {"decoy":true}';
  assertEquals(extractJson(raw), { a: { b: { c: 1 } }, d: 2 });
});

Deno.test('extractJson: braces inside strings do not shift the depth count', () => {
  // The naive "find the last }" implementation gets this wrong, and a model
  // writing about skin "{like this}" is not a hypothetical.
  const raw = '{"note":"use it like { this } and not }{ that","ok":true}';
  assertEquals(extractJson(raw), { note: 'use it like { this } and not }{ that', ok: true });
});

Deno.test('extractJson: escaped quotes inside strings', () => {
  const raw = String.raw`{"note":"she said \"glowy\" not { oily }","ok":true}`;
  assertEquals(extractJson(raw), { note: 'she said "glowy" not { oily }', ok: true });
});

Deno.test('extractJson: an escaped backslash does not escape the closing quote', () => {
  const raw = String.raw`{"path":"C:\\","ok":true}`;
  assertEquals(extractJson(raw), { path: 'C:\\', ok: true });
});

Deno.test('extractJson: no JSON at all throws', () => {
  assertThrows(() => extractJson('I am afraid I cannot help with that.'));
});

Deno.test('extractJson: unbalanced (truncated) output throws rather than half-parsing', () => {
  // What a max_tokens cut-off actually looks like.
  assertThrows(() => extractJson('{"score":72,"concerns":["acne","redness"'));
});

Deno.test('extractJson: syntactically invalid JSON throws', () => {
  assertThrows(() => extractJson("{'score': 72}"));
});
