import { describe, expect, it } from '@jest/globals';

import { mostRecentCompletedWeekStart, weekEndOf } from '../glowReport';

// Dates are built with the local Date constructor at noon so the local calendar
// day is unambiguous in any timezone — the helper reads local Y/M/D by design
// (a user's "this week" is their local week), so UTC-instant inputs would be
// timezone-fragile. Month is 0-indexed: 6 = July.
describe('mostRecentCompletedWeekStart', () => {
  it('returns the previous Monday from a mid-week day', () => {
    // Wed 2026-07-08 → current week Mon 07-06 → most recent completed Mon 06-29.
    expect(mostRecentCompletedWeekStart(new Date(2026, 6, 8, 12))).toBe('2026-06-29');
  });

  it('treats Sunday as still in the current (incomplete) week', () => {
    // Sun 2026-07-12 is the last day of the 07-06 week → completed week is 06-29.
    expect(mostRecentCompletedWeekStart(new Date(2026, 6, 12, 12))).toBe('2026-06-29');
  });

  it('rolls forward once a new week starts on Monday', () => {
    // Mon 2026-07-13 → current week Mon 07-13 → most recent completed Mon 07-06.
    expect(mostRecentCompletedWeekStart(new Date(2026, 6, 13, 12))).toBe('2026-07-06');
  });

  it('always returns a Monday whose week ended before the given day', () => {
    for (let i = 0; i < 40; i++) {
      const d = new Date(2026, 0, 1, 12);
      d.setDate(d.getDate() + i);
      const start = mostRecentCompletedWeekStart(d);
      expect(new Date(`${start}T00:00:00Z`).getUTCDay()).toBe(1);
      // The completed week's Sunday must fall before the given local day.
      const localDay = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
        d.getDate(),
      ).padStart(2, '0')}`;
      expect(weekEndOf(start) < localDay).toBe(true);
    }
  });
});

describe('weekEndOf', () => {
  it('returns the Sunday six days after the Monday start', () => {
    expect(weekEndOf('2026-07-06')).toBe('2026-07-12');
  });
});
