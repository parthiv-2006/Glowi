import { describe, expect, it } from '@jest/globals';

import {
  formatSleepHours,
  SLEEP_GOOD_MIN_HOURS,
  SLEEP_POOR_MAX_HOURS,
  sleepQualityFromHours,
} from '../sleepMapping';

describe('sleepQualityFromHours', () => {
  it('maps a short night to poor (0)', () => {
    expect(sleepQualityFromHours(4.5)).toBe(0);
    expect(sleepQualityFromHours(SLEEP_POOR_MAX_HOURS - 0.1)).toBe(0);
  });

  it('maps a middling night to okay (1)', () => {
    expect(sleepQualityFromHours(SLEEP_POOR_MAX_HOURS)).toBe(1);
    expect(sleepQualityFromHours(7)).toBe(1);
    expect(sleepQualityFromHours(SLEEP_GOOD_MIN_HOURS - 0.1)).toBe(1);
  });

  it('maps a full night to great (2)', () => {
    expect(sleepQualityFromHours(SLEEP_GOOD_MIN_HOURS)).toBe(2);
    expect(sleepQualityFromHours(9)).toBe(2);
  });

  it('rejects implausible measurements instead of guessing', () => {
    expect(sleepQualityFromHours(0.4)).toBeNull();
    expect(sleepQualityFromHours(20)).toBeNull();
    expect(sleepQualityFromHours(Number.NaN)).toBeNull();
    expect(sleepQualityFromHours(Number.POSITIVE_INFINITY)).toBeNull();
  });
});

describe('formatSleepHours', () => {
  it('renders one decimal with the unit', () => {
    expect(formatSleepHours(7.84)).toBe('7.8 h');
    expect(formatSleepHours(8)).toBe('8 h');
  });
});
