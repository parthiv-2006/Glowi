/**
 * identify-product — reads a skincare product photo for The Shelf.
 *
 * Input:  { imageBase64 }  (base64 product photo, no data: prefix)
 * Effect: none — pure read. Runs Claude vision on the label, matches the result
 *         against the catalog, and validates the structured output. The client
 *         lets the user confirm before anything is persisted.
 * Output: ProductIdentification.
 */
import { serve, json, HttpError } from '../_shared/http.ts';
import { serviceClient, requireUser } from '../_shared/supabase.ts';
import { callClaude, extractJson, MODELS } from '../_shared/anthropic.ts';
import { base64Prefix, sniffImageMediaType } from '../_shared/images.ts';
import { enforceRateLimit } from '../_shared/ratelimit.ts';

const RATE_LIMIT = { max: 20, windowSeconds: 86_400 };

interface IdentifyBody {
  imageBase64?: string;
}

interface ModelResult {
  not_product?: boolean;
  reject_reason?: string;
  name: string;
  brand: string | null;
  category: string | null;
  key_ingredients: string[];
  shelf_life_months: number | null;
  matched_slug: string | null;
  confidence: number;
}

const CATEGORIES = new Set([
  'cleanser',
  'exfoliant',
  'toner',
  'serum',
  'moisturizer',
  'spf',
  'treatment',
  'mask',
  'eye-cream',
  'supplement',
]);

const clampMonths = (n: unknown): number | null => {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v) || v <= 0) return null;
  return Math.min(60, Math.max(1, v));
};

serve(async (req) => {
  const { user } = await requireUser(req);
  const { imageBase64 } = ((await req.json().catch(() => ({}))) as IdentifyBody) ?? {};
  if (!imageBase64 || typeof imageBase64 !== 'string') {
    throw new HttpError(400, 'imageBase64 is required');
  }
  // Guard against oversized payloads (~8MB of base64).
  if (imageBase64.length > 8_000_000) throw new HttpError(413, 'Image too large');
  // Validate the bytes are a real, supported image before forwarding upstream.
  const mediaType = sniffImageMediaType(base64Prefix(imageBase64));
  if (!mediaType) throw new HttpError(400, 'Image must be a JPEG, PNG, WebP, or GIF photo');

  const svc = serviceClient();
  await enforceRateLimit(svc, `identify-product:${user.id}`, RATE_LIMIT.max, RATE_LIMIT.windowSeconds);
  const { data: products } = await svc.from('products').select('slug, brand, name, category');
  const catalog = (products ?? [])
    .map((p) => `${p.slug} | ${p.brand} ${p.name} | ${p.category}`)
    .join('\n');
  const validSlugs = new Set((products ?? []).map((p) => p.slug));

  const system = `You are Glowi's product-recognition engine. You read a photo of a skincare product and return STRICT JSON only — no prose, no markdown fences.

- If the image is not a skincare/cosmetic product, return {"not_product": true, "reject_reason": "<friendly one sentence>"}.
- Otherwise return exactly:
{
  "name": "<product name without the brand, e.g. 'Moisturizing Cream'>",
  "brand": "<brand, or null>",
  "category": <one of: cleanser, exfoliant, toner, serum, moisturizer, spf, treatment, mask, eye-cream, supplement — or null if unclear>,
  "key_ingredients": ["<active ingredient>", ...],
  "shelf_life_months": <typical months-after-opening for this product type, or null>,
  "matched_slug": "<a slug from the catalog below if this is clearly that product, else null>",
  "confidence": <0.0-1.0>
}

Read only what you can see on the label. Don't invent ingredients you can't read. Typical periods-after-opening: vitamin C serums ~3-6, other serums ~6-12, sunscreen 12, moisturizer/cleanser 12.

CATALOG (slug | brand name | category) — match only if confident:
${catalog}`;

  let result: ModelResult;
  try {
    const raw = await callClaude({
      model: MODELS.primary,
      system,
      maxTokens: 600,
      temperature: 0.2,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
            { type: 'text', text: 'Identify this skincare product.' },
          ],
        },
      ],
    });
    result = extractJson<ModelResult>(raw);
  } catch (err) {
    console.error('Product identification failed:', err);
    throw new HttpError(502, 'Could not read that product — try a clearer photo of the label.');
  }

  if (result.not_product) {
    return json({
      not_product: true,
      reject_reason:
        typeof result.reject_reason === 'string'
          ? result.reject_reason.slice(0, 200)
          : "That doesn't look like a skincare product — try a clear photo of the label.",
      name: '',
      brand: null,
      category: null,
      key_ingredients: [],
      shelf_life_months: null,
      matched_slug: null,
      confidence: 0,
    });
  }

  // Boundary validation — never trust model output unchecked.
  const category =
    typeof result.category === 'string' && CATEGORIES.has(result.category) ? result.category : null;
  const matched_slug =
    typeof result.matched_slug === 'string' && validSlugs.has(result.matched_slug)
      ? result.matched_slug
      : null;
  const key_ingredients = (Array.isArray(result.key_ingredients) ? result.key_ingredients : [])
    .filter((i) => typeof i === 'string' && i.trim())
    .map((i) => i.trim().slice(0, 40))
    .slice(0, 8);

  return json({
    not_product: false,
    reject_reason: null,
    name: String(result.name ?? '').slice(0, 120) || 'Unknown product',
    brand: result.brand ? String(result.brand).slice(0, 80) : null,
    category,
    key_ingredients,
    shelf_life_months: clampMonths(result.shelf_life_months),
    matched_slug,
    confidence: Math.min(1, Math.max(0, Number(result.confidence) || 0)),
  });
});
