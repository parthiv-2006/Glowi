/**
 * Pure routine generation — no React, no side effects.
 * Takes the scan concerns and a pre-fetched products-by-concern map and
 * returns an ordered AM and PM step list ready to be persisted.
 */
import type { Product, ProductForConcern, ScanConcern, RoutineStep } from './types';

export interface GeneratedStep {
  product: Product;
  instruction: string;
  frequency: RoutineStep['frequency'];
}

// ─── Category routing ────────────────────────────────────────────────────────

/** Categories that default to AM when a product is marked 'both'. */
const AM_PREFERRED_CATEGORIES = new Set([
  'cleanser',
  'toner',
  'serum',
  'moisturizer',
  'spf',
  'eye-cream',
]);

/** Categories that default to PM when a product is marked 'both'. */
const PM_PREFERRED_CATEGORIES = new Set(['treatment', 'exfoliant', 'mask']);

/** Categories that use a reduced application frequency. */
const REDUCED_FREQUENCY_CATEGORIES = new Set(['exfoliant', 'treatment', 'mask']);

// ─── Instruction library ─────────────────────────────────────────────────────

function instructionFor(product: Product): string {
  switch (product.category) {
    case 'cleanser':
      return 'Massage onto damp skin with gentle circular motions, then rinse with lukewarm water.';
    case 'exfoliant':
      return 'Apply at night only; start 2–3x per week and build up as tolerated. Avoid the eye area.';
    case 'toner':
      return 'Sweep over cleansed skin with a cotton pad or press in with fingertips.';
    case 'serum': {
      // Distinguish vitamin-C / brightening serums (AM) vs treatment serums
      const name = product.name.toLowerCase();
      const brand = product.brand.toLowerCase();
      if (
        name.includes('vitamin c') ||
        name.includes('vit c') ||
        name.includes('ascorbic') ||
        brand.includes('vitamin c') ||
        name.includes('brightening')
      ) {
        return 'Pat a few drops onto clean skin each morning; let absorb before moisturiser.';
      }
      return 'Pat a few drops onto clean skin; let fully absorb before the next step.';
    }
    case 'moisturizer':
      return 'Smooth evenly over face and neck; press gently into skin rather than rubbing.';
    case 'spf':
      return 'Apply generously as the very last AM step. Reapply every 2 hours when outdoors.';
    case 'treatment':
      return 'Apply a thin layer at night; start 2–3x per week and increase frequency gradually.';
    case 'mask':
      return 'Apply an even layer to clean, dry skin; leave for the directed time, then rinse.';
    case 'eye-cream':
      return 'Tap a pea-sized amount around the orbital bone using your ring finger.';
    case 'supplement':
      return 'Take with food as directed on the packaging.';
    default:
      return 'Apply as directed.';
  }
}

function frequencyFor(product: Product): RoutineStep['frequency'] {
  return REDUCED_FREQUENCY_CATEGORIES.has(product.category) ? '2-3x-week' : 'daily';
}

// ─── Period assignment ────────────────────────────────────────────────────────

function periodFor(product: Product): 'am' | 'pm' | 'both' {
  return product.am_pm;
}

function assignToPeriod(product: Product): ('am' | 'pm')[] {
  const p = periodFor(product);
  if (p === 'am') return ['am'];
  if (p === 'pm') return ['pm'];
  // 'both' — route by category preference
  if (AM_PREFERRED_CATEGORIES.has(product.category)) return ['am'];
  if (PM_PREFERRED_CATEGORIES.has(product.category)) return ['pm'];
  // Fallback: appears in both (e.g. eye cream on dry skin goes both)
  return ['am', 'pm'];
}

// ─── One product per category enforcement ────────────────────────────────────

/** A routine should have at most one product per category. Keep highest relevance. */
function dedupeByCategory(candidates: ProductForConcern[]): ProductForConcern[] {
  const best = new Map<string, ProductForConcern>();
  for (const p of candidates) {
    const existing = best.get(p.category);
    if (!existing || p.relevance > existing.relevance) {
      best.set(p.category, p);
    }
  }
  return Array.from(best.values());
}

// ─── SPF guard ────────────────────────────────────────────────────────────────

/** Ensure SPF only appears in the AM routine. */
function filterForPeriod(steps: GeneratedStep[], period: 'am' | 'pm'): GeneratedStep[] {
  if (period === 'am') return steps;
  return steps.filter((s) => s.product.category !== 'spf');
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function generateRoutineSteps(
  concerns: ScanConcern[],
  productsByConcern: Record<string, ProductForConcern[]>,
): { am: GeneratedStep[]; pm: GeneratedStep[] } {
  // 1. Collect candidates: concerns sorted by severity desc; take top 3 products each
  const sorted = [...concerns].sort((a, b) => b.severity - a.severity);

  const seenIds = new Map<string, ProductForConcern>();
  for (const concern of sorted) {
    const products = productsByConcern[concern.concern_slug] ?? [];
    for (const p of products.slice(0, 3)) {
      const existing = seenIds.get(p.id);
      if (!existing || p.relevance > existing.relevance) {
        seenIds.set(p.id, p);
      }
    }
  }

  // 2. All unique candidates sorted by relevance desc
  const allCandidates = Array.from(seenIds.values()).sort((a, b) => b.relevance - a.relevance);

  // 3. One product per category
  const dedupedCandidates = dedupeByCategory(allCandidates);

  // 4. Split into AM / PM buckets
  const amPool: ProductForConcern[] = [];
  const pmPool: ProductForConcern[] = [];

  for (const p of dedupedCandidates) {
    const periods = assignToPeriod(p);
    if (periods.includes('am')) amPool.push(p);
    if (periods.includes('pm')) pmPool.push(p);
  }

  // 5. Ensure essentials: cleanser + moisturizer in each period if not present
  //    We pull from all candidates (ignoring period filter) only when truly absent
  function ensureCategory(pool: ProductForConcern[], category: string): ProductForConcern[] {
    if (pool.some((p) => p.category === category)) return pool;
    // Try to find any candidate with this category not already in the pool
    const fallback = allCandidates.find(
      (p) => p.category === category && !pool.some((x) => x.id === p.id),
    );
    return fallback ? [...pool, fallback] : pool;
  }

  let amPool2 = ensureCategory(amPool, 'cleanser');
  amPool2 = ensureCategory(amPool2, 'moisturizer');

  let pmPool2 = ensureCategory(pmPool, 'cleanser');
  pmPool2 = ensureCategory(pmPool2, 'moisturizer');

  // 6. AM must include SPF if any candidate is spf
  const spfCandidate = allCandidates.find((p) => p.category === 'spf');
  if (spfCandidate && !amPool2.some((p) => p.category === 'spf')) {
    amPool2 = [...amPool2, spfCandidate];
  }

  // 7. Cap each period at 5 steps; after dedup-by-category within the pool
  const amFinal = dedupeByCategory(amPool2)
    .sort((a, b) => a.step_order - b.step_order)
    .slice(0, 5);
  const pmFinal = dedupeByCategory(pmPool2)
    .sort((a, b) => a.step_order - b.step_order)
    .slice(0, 5);

  function toStep(p: ProductForConcern): GeneratedStep {
    return {
      product: p,
      instruction: instructionFor(p),
      frequency: frequencyFor(p),
    };
  }

  const amSteps = filterForPeriod(amFinal.map(toStep), 'am');
  const pmSteps = filterForPeriod(pmFinal.map(toStep), 'pm');

  return { am: amSteps, pm: pmSteps };
}
