/**
 * Pure "what helped" summary — filters the existing scan-to-trend
 * correlation insights (lib/correlation.ts) down to the ones that
 * specifically improved one concern, for display on that concern's detail
 * screen. Reuses the already-computed insight list; no new correlation math.
 * Free of I/O so it is shared by the concern detail screen and unit tests.
 */
import type { CorrelationInsight } from './correlation';

export interface ConcernHelp {
  /** e.g. "Added Niacinamide Serum" or "Reaction to Retinol Cream". */
  label: string;
  /** to − from for this concern specifically; always negative (improved). */
  delta: number;
  /** ISO date of the event. */
  date: string;
}

/** Max entries shown — biggest improvement first. */
export const MAX_CONCERN_HELPS = 3;

/**
 * Past events that measurably improved `slug`'s severity, biggest
 * improvement first. An insight only counts when its own concernDeltas
 * include an improving entry for this exact concern — a shelf add that
 * helped a different concern in the same insight is not "what helped" this
 * one.
 */
export function whatHelpedConcern(slug: string, insights: CorrelationInsight[]): ConcernHelp[] {
  const helps: ConcernHelp[] = [];
  for (const insight of insights) {
    const match = insight.concernDeltas.find((d) => d.slug === slug && d.delta < 0);
    if (!match) continue;
    helps.push({ label: insight.event.label, delta: match.delta, date: insight.event.date });
  }
  return helps.sort((a, b) => a.delta - b.delta).slice(0, MAX_CONCERN_HELPS);
}
