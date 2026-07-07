/**
 * Pure Scan-to-Trend Correlation logic — lines routine-change events (shelf
 * additions, logged reactions) up against the scan history and measures what
 * actually moved between the last scan before each event and the latest scan
 * after it. Turns scans from snapshots into a feedback loop: "since you added
 * niacinamide, dark spots dropped 12 points."
 *
 * These are correlations, not causation — the UI must always show
 * CORRELATION_CAVEAT alongside the insights. Free of I/O so it is shared by
 * the Progress tab and unit tests.
 */
import type { ChangeDirection, ReactionLog, Scan, ShelfItem } from './types';

/** A scan this soon after an event can't plausibly reflect it yet. */
export const MIN_EFFECT_DAYS = 3;
/** Concern severity must move at least this much to count (0–100 scale). */
export const MIN_CONCERN_DELTA = 5;
/** Skin score must move at least this much when no concern moved. */
export const MIN_SCORE_DELTA = 3;
/** Most insights shown at once — recency wins. */
export const MAX_INSIGHTS = 4;

export const CORRELATION_CAVEAT =
  'Correlations, not proof — skin responds to many things at once. Keep scanning to sharpen these.';

export type CorrelationEventKind = 'shelf_add' | 'reaction';

/** A routine change worth checking the scan history against. */
export interface CorrelationEvent {
  kind: CorrelationEventKind;
  /** ISO date the change happened. */
  date: string;
  /** e.g. "Added Niacinamide Serum" or "Reaction to Retinol Cream". */
  label: string;
  key_ingredients: string[];
}

/** One concern's severity movement between the flanking scans. */
export interface ConcernDelta {
  name: string;
  from: number;
  to: number;
  /** to − from; negative = the concern improved. */
  delta: number;
}

export interface CorrelationInsight {
  event: CorrelationEvent;
  direction: ChangeDirection;
  /** after − before skin score, when both scans have one. */
  scoreDelta: number | null;
  /** Largest concern movements (|delta| ≥ MIN_CONCERN_DELTA), biggest first. */
  concernDeltas: ConcernDelta[];
  /** Completed scans recorded after the event. */
  scansAfter: number;
  /** The measured effect, e.g. "Dark spots dropped 12 points across the next 2 scans." */
  headline: string;
}

const DAY_MS = 86_400_000;

function completedAscending(scans: Scan[]): Scan[] {
  return scans
    .filter((s) => s.status === 'complete')
    .slice()
    .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
}

/** Shelf additions + logged reactions as a single event stream. */
export function buildEvents(shelfItems: ShelfItem[], reactions: ReactionLog[]): CorrelationEvent[] {
  const events: CorrelationEvent[] = [];
  for (const item of shelfItems) {
    events.push({
      kind: 'shelf_add',
      date: item.created_at,
      label: `Added ${item.name}`,
      key_ingredients: item.key_ingredients,
    });
  }
  for (const r of reactions) {
    events.push({
      kind: 'reaction',
      date: r.reacted_on,
      label: `Reaction to ${r.product_name}`,
      key_ingredients: r.key_ingredients,
    });
  }
  return events;
}

function concernDeltas(before: Scan, after: Scan): ConcernDelta[] {
  const deltas: ConcernDelta[] = [];
  for (const b of before.concerns) {
    const a = after.concerns.find((c) => c.concern_slug === b.concern_slug);
    if (!a) continue;
    const delta = a.severity - b.severity;
    if (Math.abs(delta) < MIN_CONCERN_DELTA) continue;
    deltas.push({ name: b.display_name, from: b.severity, to: a.severity, delta });
  }
  return deltas.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, 2);
}

function scanCountLabel(n: number): string {
  return n === 1 ? 'the next scan' : `the next ${n} scans`;
}

function effectHeadline(
  deltas: ConcernDelta[],
  scoreDelta: number | null,
  scansAfter: number,
): string | null {
  if (deltas.length > 0) {
    const top = deltas[0];
    const verb = top.delta < 0 ? 'dropped' : 'rose';
    return `${top.name} ${verb} ${Math.abs(top.delta)} points across ${scanCountLabel(scansAfter)}.`;
  }
  if (scoreDelta != null && Math.abs(scoreDelta) >= MIN_SCORE_DELTA) {
    const verb = scoreDelta > 0 ? 'climbed' : 'slipped';
    return `Skin score ${verb} ${Math.abs(scoreDelta)} points across ${scanCountLabel(scansAfter)}.`;
  }
  return null;
}

/**
 * Correlates routine-change events with the scan history. An event needs a
 * baseline scan on/before its date and a scan ≥ MIN_EFFECT_DAYS after it; the
 * measured window is baseline → latest scan. Events with nothing measurable
 * are dropped. Most recent events first, capped at MAX_INSIGHTS.
 */
export function correlateScanTrends(
  scans: Scan[],
  shelfItems: ShelfItem[],
  reactions: ReactionLog[],
): CorrelationInsight[] {
  const completed = completedAscending(scans);
  if (completed.length < 2) return [];

  const insights: CorrelationInsight[] = [];
  for (const event of buildEvents(shelfItems, reactions)) {
    const eventTime = Date.parse(event.date);
    if (Number.isNaN(eventTime)) continue;

    const baseline = [...completed].reverse().find((s) => Date.parse(s.created_at) <= eventTime);
    const settled = completed.filter(
      (s) => Date.parse(s.created_at) - eventTime >= MIN_EFFECT_DAYS * DAY_MS,
    );
    if (!baseline || settled.length === 0) continue;

    const endpoint = settled[settled.length - 1];
    const scansAfter = completed.filter((s) => Date.parse(s.created_at) > eventTime).length;

    const deltas = concernDeltas(baseline, endpoint);
    const scoreDelta =
      baseline.skin_score != null && endpoint.skin_score != null
        ? endpoint.skin_score - baseline.skin_score
        : null;

    const headline = effectHeadline(deltas, scoreDelta, scansAfter);
    if (!headline) continue;

    const improved = deltas.length > 0 ? deltas[0].delta < 0 : (scoreDelta ?? 0) > 0;
    insights.push({
      event,
      direction: improved ? 'improved' : 'worsened',
      scoreDelta,
      concernDeltas: deltas,
      scansAfter,
      headline,
    });
  }

  return insights
    .sort((a, b) => Date.parse(b.event.date) - Date.parse(a.event.date))
    .slice(0, MAX_INSIGHTS);
}
