/** Streak math from routine check-in dates. Pure + unit-tested. */

/** Distinct YYYY-MM-DD dates → current consecutive-day streak ending today/yesterday. */
export function computeStreak(dates: string[], today = new Date()): number {
  if (!dates.length) return 0;
  const set = new Set(dates);
  const cursor = new Date(today);
  cursor.setHours(0, 0, 0, 0);

  const iso = (d: Date) => d.toISOString().slice(0, 10);

  // A streak is "alive" if there's a check-in today OR yesterday (today not done yet).
  if (!set.has(iso(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
    if (!set.has(iso(cursor))) return 0;
  }

  let streak = 0;
  while (set.has(iso(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/** Did the user check in today? */
export function checkedInToday(dates: string[], today = new Date()): boolean {
  return dates.includes(today.toISOString().slice(0, 10));
}

/** Last N calendar days as ISO strings, oldest first — for the activity grid. */
export function lastNDays(n: number, today = new Date()): string[] {
  const out: string[] = [];
  const cursor = new Date(today);
  cursor.setHours(0, 0, 0, 0);
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(cursor);
    d.setDate(cursor.getDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}
