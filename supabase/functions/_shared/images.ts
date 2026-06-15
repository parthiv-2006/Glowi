/** Image type sniffing — validate bytes are a real image at the boundary. */

// The four formats the Anthropic vision API accepts.
export type ImageMediaType = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';

/**
 * Returns the image media type from a byte signature (magic numbers), or null
 * if the bytes are not a supported image. Checking the actual bytes — not a
 * client-supplied content type or file extension — stops non-image payloads
 * from reaching the vision API and pins the media_type we forward upstream.
 */
export function sniffImageMediaType(bytes: Uint8Array): ImageMediaType | null {
  // JPEG: FF D8 FF
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'image/png';
  }
  // GIF: "GIF8"
  if (
    bytes.length >= 4 &&
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38
  ) {
    return 'image/gif';
  }
  // WebP: "RIFF" <4 bytes size> "WEBP"
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'image/webp';
  }
  return null;
}

/** Decodes the leading bytes of a base64 string for signature sniffing. */
export function base64Prefix(b64: string, byteCount = 16): Uint8Array {
  // Each base64 char encodes 6 bits; decode only the prefix we need to sniff.
  const chars = b64.slice(0, Math.ceil((byteCount * 4) / 3));
  try {
    const bin = atob(chars);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return new Uint8Array(0);
  }
}
