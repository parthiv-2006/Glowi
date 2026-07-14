/**
 * Image sniffing is a security boundary, not a convenience: it is what stops a
 * non-image payload (or an image type the vision API rejects) from being
 * forwarded upstream on the strength of a client-supplied content type. The
 * tests that matter are the negative ones.
 */
import { assertEquals } from '@std/assert';
import { base64Prefix, sniffImageMediaType } from '../images.ts';

const bytes = (...b: number[]) => new Uint8Array(b);

/** "RIFF" + 4 size bytes + "WEBP". */
const webp = bytes(0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50);
const png = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00);
const jpeg = bytes(0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10);
const gif = bytes(0x47, 0x49, 0x46, 0x38, 0x39, 0x61);

Deno.test('sniffImageMediaType: recognises the four accepted formats', () => {
  assertEquals(sniffImageMediaType(jpeg), 'image/jpeg');
  assertEquals(sniffImageMediaType(png), 'image/png');
  assertEquals(sniffImageMediaType(gif), 'image/gif');
  assertEquals(sniffImageMediaType(webp), 'image/webp');
});

Deno.test('sniffImageMediaType: rejects non-images', () => {
  // A PDF, an ELF binary, HTML, and plain text — all things an attacker can
  // upload with an image/jpeg content type on the request.
  assertEquals(sniffImageMediaType(bytes(0x25, 0x50, 0x44, 0x46, 0x2d)), null); // %PDF-
  assertEquals(sniffImageMediaType(bytes(0x7f, 0x45, 0x4c, 0x46)), null); // ELF
  assertEquals(sniffImageMediaType(bytes(0x3c, 0x68, 0x74, 0x6d, 0x6c, 0x3e)), null); // <html>
  assertEquals(sniffImageMediaType(new TextEncoder().encode('not an image at all')), null);
});

Deno.test('sniffImageMediaType: rejects empty and truncated signatures', () => {
  assertEquals(sniffImageMediaType(bytes()), null);
  assertEquals(sniffImageMediaType(bytes(0xff, 0xd8)), null); // JPEG minus a byte
  assertEquals(sniffImageMediaType(png.slice(0, 7)), null); // PNG minus a byte
  assertEquals(sniffImageMediaType(webp.slice(0, 11)), null); // WebP minus a byte
});

Deno.test('sniffImageMediaType: RIFF alone is not WebP', () => {
  // A RIFF container that is a .wav, not an image — the format tag at byte 8 is
  // the whole check, so a prefix-only match must not pass.
  const wav = bytes(0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45);
  assertEquals(sniffImageMediaType(wav), null);
});

Deno.test('base64Prefix: decodes enough leading bytes to sniff', () => {
  const b64 = btoa(String.fromCharCode(...png));
  assertEquals(sniffImageMediaType(base64Prefix(b64)), 'image/png');
});

Deno.test('base64Prefix: malformed base64 decodes to nothing rather than throwing', () => {
  // The caller sniffs the result, so an undecodable payload must land on "not
  // an image" — not blow up the function with an unhandled InvalidCharacterError.
  assertEquals(base64Prefix('!!!not base64!!!').length, 0);
  assertEquals(sniffImageMediaType(base64Prefix('!!!not base64!!!')), null);
});
