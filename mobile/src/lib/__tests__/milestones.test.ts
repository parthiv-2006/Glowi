import { describe, expect, it } from '@jest/globals';

import {
  MILESTONE_DAYS,
  achievedMilestone,
  milestoneCrossedInWeek,
  nextMilestone,
} from '../milestones';

describe('achievedMilestone', () => {
  it('is null before the first milestone', () => {
    expect(achievedMilestone(0)).toBeNull();
    expect(achievedMilestone(2)).toBeNull();
  });

  it('returns the threshold exactly at a milestone', () => {
    expect(achievedMilestone(3)).toBe(3);
    expect(achievedMilestone(7)).toBe(7);
  });

  it('returns the highest milestone reached, not the next', () => {
    expect(achievedMilestone(13)).toBe(7);
    expect(achievedMilestone(45)).toBe(30);
  });

  it('caps at the last milestone', () => {
    expect(achievedMilestone(365)).toBe(100);
  });
});

describe('nextMilestone', () => {
  it('is the first milestone for a fresh streak', () => {
    expect(nextMilestone(0)).toBe(3);
  });

  it('advances past a just-reached milestone', () => {
    expect(nextMilestone(3)).toBe(7);
    expect(nextMilestone(14)).toBe(30);
  });

  it('is null past the last milestone', () => {
    expect(nextMilestone(100)).toBeNull();
    expect(nextMilestone(365)).toBeNull();
  });
});

describe('milestoneCrossedInWeek', () => {
  it('is null when no milestone is reached', () => {
    expect(milestoneCrossedInWeek(2)).toBeNull();
  });

  it('fires when the milestone falls inside the last 7 days', () => {
    // Streak of 8: seven days ago it stood at 1, so 3 AND 7 were both crossed —
    // the highest one is celebrated.
    expect(milestoneCrossedInWeek(8)).toBe(7);
    expect(milestoneCrossedInWeek(3)).toBe(3);
    expect(milestoneCrossedInWeek(30)).toBe(30);
  });

  it('does not re-celebrate a long-standing milestone', () => {
    // Streak of 21: seven days ago it was 14 — the 14-day milestone is old news.
    expect(milestoneCrossedInWeek(21)).toBeNull();
    expect(milestoneCrossedInWeek(50)).toBeNull();
  });

  it('fires again at the boundary of a new milestone', () => {
    expect(milestoneCrossedInWeek(36)).toBe(30); // 29 → 36 crossed 30
  });

  it('milestones are ascending and unique', () => {
    const sorted = [...MILESTONE_DAYS].sort((a, b) => a - b);
    expect([...MILESTONE_DAYS]).toEqual(sorted);
    expect(new Set(MILESTONE_DAYS).size).toBe(MILESTONE_DAYS.length);
  });
});
