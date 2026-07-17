/**
 * CorrelationChart series builder — turns one CorrelationInsight plus the scan
 * history into a small before/after series windowed around the insight's event,
 * so the Progress tab can draw the movement the headline describes.
 *
 * Lives apart from correlation.ts on purpose: that module is a lockstep mirror
 * of supabase/functions/_shared/correlation.ts and must not grow client-only
 * chart logic. Free of I/O.
 */
import type { CorrelationInsight } from './correlation';
import type { Scan } from './types';

/** Most points kept on/before the event — enough run-in to show the baseline. */
export const MAX_BEFORE = 3;
/** Most points kept after the event — the measured window. */
export const MAX_AFTER = 5;

export interface SeriesPoint {
  /** Scan created_at, ISO. */
  date: string;
  /** Concern severity or skin score, 0–100. */
  value: number;
}

export interface InsightSeries {
  points: SeriesPoint[];
  /** Index into points of the baseline — the last scan on/before the event. */
  eventIndex: number;
  metric: 'concern' | 'score';
  /** Set when metric === 'concern'. */
  concernName?: string;
  /** Signed movement, negative = the concern improved / score fell. */
  delta: number;
}

/**
 * Builds the series for one insight: the top-moved concern's severity per scan
 * when the insight has concern deltas, else the skin score. Returns null when
 * there is nothing chartable (no baseline scan, fewer than two points, or an
 * unparseable event date) — the caller renders nothing and the insight row
 * looks exactly as it did before charts existed.
 */
export function insightSeries(insight: CorrelationInsight, scans: Scan[]): InsightSeries | null {
  const eventTime = Date.parse(insight.event.date);
  if (Number.isNaN(eventTime)) return null;

  // Local copy of the completed-ascending ordering — don't import correlation.ts privates.
  const completed = scans
    .filter((s) => s.status === 'complete')
    .slice()
    .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));

  const top = insight.concernDeltas[0];
  const all: SeriesPoint[] = [];
  for (const scan of completed) {
    if (top) {
      const match = scan.concerns.find((c) => c.concern_slug === top.slug);
      if (!match) continue;
      all.push({ date: scan.created_at, value: match.severity });
    } else {
      if (scan.skin_score == null) continue;
      all.push({ date: scan.created_at, value: scan.skin_score });
    }
  }

  const before = all.filter((p) => Date.parse(p.date) <= eventTime).slice(-MAX_BEFORE);
  const after = all.filter((p) => Date.parse(p.date) > eventTime).slice(0, MAX_AFTER);
  const points = [...before, ...after];
  if (before.length === 0 || points.length < 2) return null;

  const baseline = before[before.length - 1];
  const last = points[points.length - 1];
  return {
    points,
    eventIndex: before.length - 1,
    metric: top ? 'concern' : 'score',
    concernName: top?.name,
    delta: top?.delta ?? insight.scoreDelta ?? last.value - baseline.value,
  };
}

/** Total length of a polyline in px — the dash length for draw-on animation. */
export function polylineLength(pts: { x: number; y: number }[]): number {
  let len = 0;
  for (let i = 1; i < pts.length; i++) {
    len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  }
  return len;
}
