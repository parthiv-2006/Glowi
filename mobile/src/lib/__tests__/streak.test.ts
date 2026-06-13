import { describe, expect, it } from '@jest/globals';

import { checkedInToday, computeStreak, lastNDays } from '../streak';

const iso = (d: Date) => d.toISOString().slice(0, 10);
function daysAgo(n: number, from = new Date('2026-06-12T12:00:00Z')): string {
  const d = new Date(from);
  d.setDate(d.getDate() - n);
  return iso(d);
}

describe('computeStreak', () => {
  const today = new Date('2026-06-12T12:00:00Z');

  it('returns 0 with no check-ins', () => {
    expect(computeStreak([], today)).toBe(0);
  });

  it('counts a single check-in today as 1', () => {
    expect(computeStreak([daysAgo(0)], today)).toBe(1);
  });

  it('counts consecutive days ending today', () => {
    expect(computeStreak([daysAgo(0), daysAgo(1), daysAgo(2)], today)).toBe(3);
  });

  it('keeps the streak alive when only yesterday is checked (today pending)', () => {
    expect(computeStreak([daysAgo(1), daysAgo(2)], today)).toBe(2);
  });

  it('breaks the streak on a gap', () => {
    expect(computeStreak([daysAgo(0), daysAgo(1), daysAgo(3)], today)).toBe(2);
  });

  it('returns 0 when the most recent check-in is older than yesterday', () => {
    expect(computeStreak([daysAgo(2), daysAgo(3)], today)).toBe(0);
  });

  it('ignores duplicate dates', () => {
    expect(computeStreak([daysAgo(0), daysAgo(0), daysAgo(1)], today)).toBe(2);
  });
});

describe('checkedInToday', () => {
  const today = new Date('2026-06-12T12:00:00Z');
  it('is true when today is present', () => {
    expect(checkedInToday([daysAgo(0)], today)).toBe(true);
  });
  it('is false when only past days are present', () => {
    expect(checkedInToday([daysAgo(1)], today)).toBe(false);
  });
});

describe('lastNDays', () => {
  const today = new Date('2026-06-12T12:00:00Z');
  it('returns N dates oldest-first ending today', () => {
    const days = lastNDays(7, today);
    expect(days).toHaveLength(7);
    expect(days[6]).toBe('2026-06-12');
    expect(days[0]).toBe('2026-06-06');
  });
});
