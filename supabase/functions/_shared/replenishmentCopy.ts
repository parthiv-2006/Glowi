/**
 * Validation for AI-generated replenishment "why this over that" copy (F1) —
 * one short coach-voiced line per suggested replacement, generated once per
 * (shelf item, product) pair and cached in replenishment_copy.
 *
 * Lives here rather than inline in the edge function so the one piece of
 * this feature that parses model output can be tested directly — same
 * pattern as products.ts.
 */

/** Longest a single line may be — a coach aside, not a paragraph. */
export const MAX_COPY_CHARS = 160;

export interface CopyCandidate {
  productId: string;
}

/**
 * Maps a model's ordered array of lines onto the ordered candidate list —
 * ordinal position, not a model-authored key, ties a line to a product,
 * since a uuid is easy for the model to mangle but position never is.
 * Anything malformed (wrong shape, wrong length, an empty/too-short line)
 * drops that one candidate rather than failing the whole batch; the caller
 * already has a deterministic rationale to fall back to per-candidate.
 */
export function mapCopyLines(
  parsed: unknown,
  candidates: CopyCandidate[],
): Record<string, string> {
  const lines = (parsed as { lines?: unknown })?.lines;
  if (!Array.isArray(lines) || lines.length !== candidates.length) return {};

  const result: Record<string, string> = {};
  candidates.forEach((candidate, i) => {
    const line = lines[i];
    if (typeof line !== 'string') return;
    const trimmed = line.trim().slice(0, MAX_COPY_CHARS);
    if (trimmed.length < 8) return; // too short to be a real line — drop it
    result[candidate.productId] = trimmed;
  });
  return result;
}
