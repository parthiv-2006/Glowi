/**
 * check-conflicts — ingredient interaction analysis across the user's shelf.
 *
 * Input:  {} (reads the authenticated user's active shelf items from the DB)
 * Cache:  Returns the stored report unchanged when max(shelf_items.updated_at)
 *         hasn't advanced past the most recent report's created_at, avoiding
 *         redundant Claude calls.
 * Output: ConflictReport — { conflicts: IngredientConflict[], checkedAt: string }
 */
import { serve, json, HttpError } from '../_shared/http.ts';
import { serviceClient, requireUser } from '../_shared/supabase.ts';
import { callClaude, extractJson, MODELS } from '../_shared/anthropic.ts';

const SYSTEM_PROMPT = `You are a dermatology-trained ingredient safety analyst.

Return ONLY a valid JSON object — no markdown fences, no prose outside the object:
{ "conflicts": Array<{ "severity": "avoid"|"caution"|"time_of_day", "ingredients": string[], "products": string[], "reason": string, "citation": string, "recommendation": string }> }

Severity definitions:
- "avoid" = these ingredients should never be applied together (antagonism or safety risk).
- "caution" = can coexist but layering them directly raises irritation or reduces efficacy.
- "time_of_day" = one ingredient is restricted to AM or PM due to photosensitivity or degradation.

Rules:
- Only flag real, peer-reviewed interactions — no speculative or cosmetic-brand claims.
- Each conflict must name the specific ingredients AND the shelf products that contain them.
- Citation format: "Author et al., Journal, Year" or "established dermatology guidance".
- If no conflicts exist, return { "conflicts": [] }.`;

serve(async (req) => {
  const { user } = await requireUser(req);
  const svc = serviceClient();

  // 1. Load active shelf items that have at least one ingredient recorded.
  const { data: items, error: shelfErr } = await svc
    .from('shelf_items')
    .select('name, brand, key_ingredients, updated_at')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .neq('key_ingredients', '{}');

  if (shelfErr) throw new HttpError(500, shelfErr.message);

  if (!items?.length) {
    return json({ conflicts: [], checkedAt: new Date().toISOString() });
  }

  // 2. Check the cache: skip Claude if the shelf hasn't changed since the last report.
  const latestShelfChange = items.reduce(
    (max, item) => (item.updated_at > max ? item.updated_at : max),
    '',
  );

  const { data: cached } = await svc
    .from('conflict_reports')
    .select('report, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (cached && cached.created_at >= latestShelfChange) {
    return json(cached.report);
  }

  // 3. Build the shelf context block for Claude.
  const shelfBlock = items
    .map((item) => {
      const label = [item.brand, item.name].filter(Boolean).join(' ');
      return `${label}: ${(item.key_ingredients as string[]).join(', ')}`;
    })
    .join('\n');

  // 4. Call Claude with temperature 0 — we want deterministic, factual output.
  const raw = await callClaude({
    model: MODELS.primary,
    system: SYSTEM_PROMPT,
    maxTokens: 1024,
    temperature: 0,
    messages: [{ role: 'user', content: `Shelf:\n${shelfBlock}` }],
  });

  // 5. Parse — fall back to empty conflicts rather than crashing on malformed output.
  let conflicts: unknown[] = [];
  try {
    const parsed = extractJson<{ conflicts?: unknown[] }>(raw);
    if (Array.isArray(parsed.conflicts)) conflicts = parsed.conflicts;
  } catch {
    console.error('check-conflicts: failed to parse Claude response', raw.slice(0, 200));
  }

  const report = { conflicts, checkedAt: new Date().toISOString() };

  // 6. Persist the new report (best-effort; don't fail the response on insert error).
  await svc.from('conflict_reports').insert({ user_id: user.id, report });

  return json(report);
});
