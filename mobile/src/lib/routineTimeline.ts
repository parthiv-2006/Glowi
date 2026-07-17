/**
 * Pure routine-timeline model — turns the same wait-time data already shown as
 * WaitConnector pills into a proportional bar per gap, for the RoutineTimeline
 * strip. Free of I/O so it is shared by the routine screen and unit tests.
 */
import { waitAfter } from './routineSequence';
import type { RoutineStep } from './types';

export const BAR_BASE = 24;
export const BAR_PER_MINUTE = 4;
export const BAR_MAX = 96;

/** Minutes of wait → bar width in px, floor 24 (no wait) capped at 96. */
export function barWidth(minutes: number): number {
  return Math.min(BAR_BASE + minutes * BAR_PER_MINUTE, BAR_MAX);
}

/** One gap between consecutive steps. `minutes` is 0 when no wait is needed. */
export interface TimelineSegment {
  minutes: number;
  note: string | null;
  width: number;
}

export interface TimelineModel {
  segments: TimelineSegment[];
  totalWaitMinutes: number;
}

/** One segment per adjacent step pair, via {@link waitAfter}. Empty when steps.length < 2. */
export function buildTimeline(steps: RoutineStep[]): TimelineModel {
  const segments: TimelineSegment[] = [];
  let totalWaitMinutes = 0;

  for (let i = 0; i < steps.length - 1; i++) {
    const wait = waitAfter(steps[i], steps[i + 1]);
    const minutes = wait?.minutes ?? 0;
    segments.push({ minutes, note: wait?.note ?? null, width: barWidth(minutes) });
    totalWaitMinutes += minutes;
  }

  return { segments, totalWaitMinutes };
}
