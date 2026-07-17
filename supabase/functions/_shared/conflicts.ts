/**
 * Validation for AI-generated ingredient-conflict reports — the one piece of
 * check-conflicts that parses model output, extracted so it can be tested
 * directly (same pattern as products.ts and replenishmentCopy.ts).
 *
 * Every other function validates model output field-by-field before it is
 * persisted; this closes the gap for conflict reports. A malformed entry
 * drops that one conflict, never the whole report.
 */

export type ConflictSeverity = 'avoid' | 'caution' | 'time_of_day';

export interface IngredientConflict {
  severity: ConflictSeverity;
  ingredients: string[];
  products: string[];
  reason: string;
  citation: string;
  recommendation: string;
}

const VALID_SEVERITIES = new Set<ConflictSeverity>(['avoid', 'caution', 'time_of_day']);

/** Report size and per-field caps — a report is a shortlist, not a dump. */
const MAX_CONFLICTS = 10;
const MAX_LIST_ITEMS = 6;
const MAX_NAME_CHARS = 80;
const MAX_TEXT_CHARS = 400;

function cleanStrings(value: unknown): string[] {
  return (Array.isArray(value) ? value : [])
    .filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
    .map((s) => s.trim().slice(0, MAX_NAME_CHARS))
    .slice(0, MAX_LIST_ITEMS);
}

/**
 * Returns only the well-formed conflicts from parsed model output, with every
 * field type-checked and length-capped. An entry without a valid severity, at
 * least one ingredient, and a non-empty reason is dropped.
 */
export function sanitizeConflicts(parsed: unknown): IngredientConflict[] {
  const conflicts = (parsed as { conflicts?: unknown })?.conflicts;
  if (!Array.isArray(conflicts)) return [];

  const result: IngredientConflict[] = [];
  for (const entry of conflicts.slice(0, MAX_CONFLICTS)) {
    if (!entry || typeof entry !== 'object') continue;
    const c = entry as Record<string, unknown>;
    if (typeof c.severity !== 'string' || !VALID_SEVERITIES.has(c.severity as ConflictSeverity)) {
      continue;
    }
    const ingredients = cleanStrings(c.ingredients);
    const reason = typeof c.reason === 'string' ? c.reason.trim().slice(0, MAX_TEXT_CHARS) : '';
    if (!ingredients.length || !reason) continue;
    result.push({
      severity: c.severity as ConflictSeverity,
      ingredients,
      products: cleanStrings(c.products),
      reason,
      citation:
        typeof c.citation === 'string'
          ? c.citation.trim().slice(0, MAX_NAME_CHARS * 2)
          : 'established dermatology guidance',
      recommendation:
        typeof c.recommendation === 'string' ? c.recommendation.trim().slice(0, MAX_TEXT_CHARS) : '',
    });
  }
  return result;
}
