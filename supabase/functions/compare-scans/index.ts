/**
 * compare-scans — Claude vision diff between two completed scan photos.
 *
 * Input:  { scanIdBefore, scanIdAfter }
 * Effect: checks cache → downloads both images → calls Claude with a
 *         two-image honest-diff prompt → validates → persists to
 *         scan_comparisons (idempotent per pair).
 * Output: { delta: AIDelta }
 */
import { serve, json, HttpError } from '../_shared/http.ts';
import { serviceClient, requireUser } from '../_shared/supabase.ts';
import { callClaude, extractJson, MODELS } from '../_shared/anthropic.ts';
import { sniffImageMediaType } from '../_shared/images.ts';
import { enforceRateLimit } from '../_shared/ratelimit.ts';

const RATE_LIMIT = { max: 10, windowSeconds: 86_400 };

interface CompareBody {
  scanIdBefore?: string;
  scanIdAfter?: string;
}

interface ConcernChange {
  slug: string | null;
  display_name: string;
  direction: 'improved' | 'worsened' | 'unchanged';
  magnitude: number;
  observation: string;
}

interface AIDelta {
  headline: string;
  overall_narrative: string;
  changes: ConcernChange[];
  caveat: string | null;
}

const VALID_DIRECTIONS = new Set(['improved', 'worsened', 'unchanged']);
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(n)));

async function imageToBase64(
  svc: ReturnType<typeof serviceClient>,
  imagePath: string,
): Promise<{ base64: string; mediaType: string }> {
  const { data: blob, error } = await svc.storage.from('scan-images').download(imagePath);
  if (error || !blob) throw new HttpError(500, `Could not download image: ${imagePath}`);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const mediaType = sniffImageMediaType(bytes);
  if (!mediaType) throw new HttpError(400, 'Scan image is not a supported format');
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return { base64: btoa(binary), mediaType };
}

serve(async (req) => {
  const { user } = await requireUser(req);
  const { scanIdBefore, scanIdAfter } =
    ((await req.json().catch(() => ({}))) as CompareBody) ?? {};

  if (!scanIdBefore || !scanIdAfter) {
    throw new HttpError(400, 'scanIdBefore and scanIdAfter are required');
  }
  if (scanIdBefore === scanIdAfter) {
    throw new HttpError(400, 'scanIdBefore and scanIdAfter must be different scans');
  }

  const svc = serviceClient();

  // Cache hit — return immediately without calling Claude.
  const { data: cached } = await svc
    .from('scan_comparisons')
    .select('ai_delta')
    .eq('user_id', user.id)
    .eq('scan_id_before', scanIdBefore)
    .eq('scan_id_after', scanIdAfter)
    .maybeSingle();
  if (cached) return json({ delta: cached.ai_delta });

  // After the cache check: revisiting a stored comparison stays free.
  await enforceRateLimit(svc, `compare-scans:${user.id}`, RATE_LIMIT.max, RATE_LIMIT.windowSeconds);

  // Verify both scans belong to this user and are complete with images.
  const { data: scans, error: scansErr } = await svc
    .from('scans')
    .select('id, user_id, image_path, status')
    .in('id', [scanIdBefore, scanIdAfter]);
  if (scansErr) throw new HttpError(500, scansErr.message);
  if (!scans || scans.length !== 2) throw new HttpError(404, 'One or both scans not found');

  for (const scan of scans) {
    if (scan.user_id !== user.id) throw new HttpError(403, 'Forbidden');
    if (scan.status !== 'complete') throw new HttpError(400, `Scan ${scan.id} is not complete`);
    if (!scan.image_path) throw new HttpError(400, `Scan ${scan.id} has no image`);
  }

  const scanBefore = scans.find((s) => s.id === scanIdBefore)!;
  const scanAfter = scans.find((s) => s.id === scanIdAfter)!;

  // Download and base64-encode both images in parallel.
  const [imgBefore, imgAfter] = await Promise.all([
    imageToBase64(svc, scanBefore.image_path),
    imageToBase64(svc, scanAfter.image_path),
  ]);

  // Fetch concern taxonomy for the allowed slug list.
  const { data: taxonomy } = await svc.from('concerns').select('slug, name');
  const slugList = (taxonomy ?? []).map((c) => `${c.slug} (${c.name})`).join(', ');
  const validSlugs = new Set((taxonomy ?? []).map((c) => c.slug));

  const system = `You are Glowi's skin-change analysis engine. You are shown two photos of the same person's skin taken at different times — BEFORE (first image) and AFTER (second image).

Return STRICT JSON only — no prose, no markdown fences.

Rules:
- Be rigorously honest. If you cannot see a meaningful difference, say so.
- Do not assume improvement. Changes can be positive, negative, or neutral.
- Only report changes you can visually substantiate. Confidence beats completeness.
- Lighting, angle, and camera differences can mimic skin changes. Flag uncertainty when present.

Return this exact shape:
{
  "headline": "<1 sentence: the single most meaningful change, or 'No significant change detected'>",
  "overall_narrative": "<2-3 sentences summarising visible changes honestly>",
  "changes": [
    {
      "slug": "<concern slug from the allowed list, or null if general>",
      "display_name": "<human-readable concern name>",
      "direction": <"improved" | "worsened" | "unchanged">,
      "magnitude": <0-100, where 0 = imperceptible, 100 = dramatic>,
      "observation": "<1 sentence: what you actually see that supports this>"
    }
  ],
  "caveat": <null, or a sentence noting significant photo-quality differences that limit confidence>
}

Report 1-5 changes, most significant first.
Allowed concern slugs: ${slugList}`;

  let raw: string;
  try {
    raw = await callClaude({
      model: MODELS.primary,
      system,
      maxTokens: 1200,
      temperature: 0.2,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: imgBefore.mediaType, data: imgBefore.base64 },
            },
            {
              type: 'image',
              source: { type: 'base64', media_type: imgAfter.mediaType, data: imgAfter.base64 },
            },
            { type: 'text', text: 'Compare the BEFORE (first image) to the AFTER (second image) and return the JSON delta.' },
          ],
        },
      ],
    });
  } catch (err) {
    console.error('compare-scans Claude call failed:', err);
    throw new HttpError(502, 'AI comparison failed — please try again');
  }

  const result = extractJson<AIDelta>(raw);

  // Validate and sanitize — never trust model output into the DB unchecked.
  const changes: ConcernChange[] = (Array.isArray(result.changes) ? result.changes : [])
    .slice(0, 5)
    .filter((c) => c && VALID_DIRECTIONS.has(c.direction))
    .map((c) => ({
      slug: c.slug && validSlugs.has(String(c.slug)) ? String(c.slug) : null,
      display_name: String(c.display_name ?? '').slice(0, 120) || 'Skin change',
      direction: c.direction as ConcernChange['direction'],
      magnitude: clamp(Number(c.magnitude) || 0, 0, 100),
      observation: String(c.observation ?? '').slice(0, 400),
    }));

  const delta: AIDelta = {
    headline: String(result.headline ?? 'No significant change detected').slice(0, 200),
    overall_narrative: String(result.overall_narrative ?? '').slice(0, 600),
    changes,
    caveat: result.caveat ? String(result.caveat).slice(0, 300) : null,
  };

  const { error: insertErr } = await svc.from('scan_comparisons').insert({
    user_id: user.id,
    scan_id_before: scanIdBefore,
    scan_id_after: scanIdAfter,
    ai_delta: delta,
  });
  if (insertErr) console.error('scan_comparisons insert failed:', insertErr.message);

  return json({ delta });
});
