/**
 * Check-in streak milestones — the thresholds worth celebrating and the pure
 * math for "which did I reach", "which is next", and "did I cross one this
 * week" (the Glow Report's wins hook).
 *
 * ⚠ Lockstep: mirror of mobile/src/lib/milestones.ts —
 * change both or neither.
 */

/** Celebrated streak lengths, ascending. */
export const MILESTONE_DAYS = [3, 7, 14, 30, 60, 100] as const;

/** Highest milestone the streak has reached, or null before the first. */
export function achievedMilestone(streakDays: number): number | null {
  let achieved: number | null = null;
  for (const m of MILESTONE_DAYS) {
    if (streakDays >= m) achieved = m;
  }
  return achieved;
}

/** The next milestone ahead of the streak, or null past the last one. */
export function nextMilestone(streakDays: number): number | null {
  return MILESTONE_DAYS.find((m) => streakDays < m) ?? null;
}

/**
 * The milestone crossed during the most recent 7 days of a streak, or null.
 * A streak of length N crossed milestone M "this week" when it now stands at
 * or past M but was still short of M seven days earlier — so a long-standing
 * milestone is never re-celebrated week after week.
 */
export function milestoneCrossedInWeek(streakDays: number): number | null {
  const achieved = achievedMilestone(streakDays);
  return achieved != null && streakDays - 7 < achieved ? achieved : null;
}
