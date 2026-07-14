/**
 * The parser reads whatever the model felt like emitting. The rule it enforces
 * is simple and absolute: the raw block never survives into the prose the user
 * reads, and a malformed block costs the recommendation, never the reply.
 */
import { assertEquals } from '@std/assert';
import { parseProductBlock } from '../products.ts';

Deno.test('parseProductBlock: extracts slugs and strips the block from the reply', () => {
  const raw =
    'Try a gentle cleanser first — the CeraVe one is a safe start.\n' +
    '<products>["cerave-hydrating-cleanser","la-roche-posay-toleriane"]</products>';

  const { reply, productRefs } = parseProductBlock(raw);

  assertEquals(productRefs, ['cerave-hydrating-cleanser', 'la-roche-posay-toleriane']);
  assertEquals(reply, 'Try a gentle cleanser first — the CeraVe one is a safe start.');
});

Deno.test('parseProductBlock: no block is the common case', () => {
  const raw = 'Give the retinol six weeks before you judge it.';
  assertEquals(parseProductBlock(raw), { reply: raw, productRefs: [] });
});

Deno.test('parseProductBlock: caps at three slugs', () => {
  const raw = '<products>["a","b","c","d","e"]</products>';
  assertEquals(parseProductBlock(raw).productRefs, ['a', 'b', 'c']);
});

Deno.test('parseProductBlock: drops non-string entries', () => {
  const raw = '<products>["a",null,42,{"slug":"b"},"c"]</products>';
  assertEquals(parseProductBlock(raw).productRefs, ['a', 'c']);
});

Deno.test('parseProductBlock: a malformed block costs the slugs, not the reply', () => {
  // Truncated JSON inside the tags: the user still gets their answer.
  const raw = 'Salicylic acid is the one to reach for.\n<products>["salicylic-2</products>';

  const { reply, productRefs } = parseProductBlock(raw);

  assertEquals(productRefs, []);
  assertEquals(reply, 'Salicylic acid is the one to reach for.');
});

Deno.test('parseProductBlock: an unterminated block is still stripped', () => {
  // A reply cut off at max_tokens ends mid-block. The slugs are lost (they may
  // be half-written), but the user must never see the raw tag.
  const { reply, productRefs } = parseProductBlock('Here you go. <products>["cerave-hyd');
  assertEquals(productRefs, []);
  assertEquals(reply, 'Here you go.');
});

Deno.test('parseProductBlock: a complete array in an unterminated block still parses', () => {
  const { reply, productRefs } = parseProductBlock('Here you go. <products>["a","b"]');
  assertEquals(productRefs, ['a', 'b']);
  assertEquals(reply, 'Here you go.');
});

Deno.test('parseProductBlock: tolerates whitespace and newlines inside the tags', () => {
  const raw = 'Sure.\n<products>\n  ["a", "b"]\n</products>';
  const { reply, productRefs } = parseProductBlock(raw);
  assertEquals(productRefs, ['a', 'b']);
  assertEquals(reply, 'Sure.');
});

Deno.test('parseProductBlock: an empty array yields no refs and a clean reply', () => {
  const { reply, productRefs } = parseProductBlock('Nothing to add.\n<products>[]</products>');
  assertEquals(productRefs, []);
  assertEquals(reply, 'Nothing to add.');
});
