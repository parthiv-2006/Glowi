/**
 * Pure mapping from device-measured sleep duration to the diary's 0–2
 * sleep_quality scale (ADR-0017). The health integration suggests, the user
 * confirms — this module only turns hours into a level and a label; it never
 * writes anything. I/O-free and unit-tested.
 */
import type { LifestyleLevel } from './types';

/** Under this many hours asleep reads as a poor night (level 0). */
export const SLEEP_POOR_MAX_HOURS = 6;
/** At or above this many hours asleep reads as a great night (level 2). */
export const SLEEP_GOOD_MIN_HOURS = 7.5;
/** Durations outside this window are sensor noise, not a night's sleep. */
export const SLEEP_PLAUSIBLE_HOURS: readonly [number, number] = [1, 16];

/**
 * Duration → diary level, or null when the measurement isn't a plausible
 * night (never guess from noise — an unanswered scale stays unanswered).
 */
export function sleepQualityFromHours(hours: number): LifestyleLevel | null {
  if (!Number.isFinite(hours)) return null;
  if (hours < SLEEP_PLAUSIBLE_HOURS[0] || hours > SLEEP_PLAUSIBLE_HOURS[1]) return null;
  if (hours < SLEEP_POOR_MAX_HOURS) return 0;
  if (hours < SLEEP_GOOD_MIN_HOURS) return 1;
  return 2;
}

/** "7.8 h" — one decimal, for the suggestion line. */
export function formatSleepHours(hours: number): string {
  return `${(Math.round(hours * 10) / 10).toString()} h`;
}
