/**
 * Pure week math for the Weekly Glow Report. The report always covers the most
 * recent *completed* ISO week (Monday–Sunday); generation is triggered lazily on
 * app open, so both the Progress entry and the weekly notification derive the
 * same `week_start` from these helpers. I/O-free and unit-tested.
 */

const DAY_MS = 86_400_000;

/** ISO `yyyy-mm-dd` of a Date's calendar day, pinned to UTC midnight. */
function isoDay(d: Date): string {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())).toISOString().slice(0, 10);
}

/**
 * Monday (ISO) of the most recent completed week — i.e. last week's Monday. On
 * any day of the current in-progress week this returns the Monday before it, so
 * the report never covers a week that hasn't finished.
 */
export function mostRecentCompletedWeekStart(today: Date = new Date()): string {
  const todayIso = isoDay(today);
  const t = Date.parse(`${todayIso}T00:00:00Z`);
  const dow = new Date(t).getUTCDay(); // 0 Sun … 6 Sat
  const isoDow = dow === 0 ? 7 : dow; // 1 Mon … 7 Sun
  const currentMonday = t - (isoDow - 1) * DAY_MS;
  const prevMonday = currentMonday - 7 * DAY_MS;
  return new Date(prevMonday).toISOString().slice(0, 10);
}

/** ISO `yyyy-mm-dd` of the Sunday that closes the week starting on `weekStart`. */
export function weekEndOf(weekStart: string): string {
  return new Date(Date.parse(`${weekStart}T00:00:00Z`) + 6 * DAY_MS).toISOString().slice(0, 10);
}
