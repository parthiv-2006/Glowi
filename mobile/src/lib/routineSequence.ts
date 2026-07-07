/**
 * Pure routine sequencing — wait times between steps and order/pairing
 * warnings, derived from each step's product category and ingredients.
 * Users know their products but not the chemistry; wrong order can neutralize
 * actives or irritate skin.
 *
 * Free of I/O so it is shared by the routine screen and unit tests.
 */
import type { RoutineStep } from './types';

/** A recommended pause after a step, shown between step cards. */
export interface StepWait {
  minutes: number;
  note: string;
}

/** An order or pairing problem in the current step list. */
export interface SequenceWarning {
  /** 'fix' = actively undermines a product; 'caution' = irritation risk. */
  severity: 'fix' | 'caution';
  message: string;
}

function haystack(step: RoutineStep): string {
  return [
    step.product?.name ?? '',
    step.custom_name ?? '',
    ...(step.product?.key_ingredients ?? []),
  ]
    .join(' ')
    .toLowerCase();
}

function isRetinoid(step: RoutineStep): boolean {
  return /retin|adapalene|tretinoin/.test(haystack(step));
}

function isVitaminC(step: RoutineStep): boolean {
  return /vitamin c|ascorb/.test(haystack(step));
}

function isAcidExfoliant(step: RoutineStep): boolean {
  return (
    step.product?.category === 'exfoliant' ||
    /salicylic|glycolic|lactic|\baha\b|\bbha\b/.test(haystack(step))
  );
}

/**
 * Recommended wait after a step before applying the next one. Null means the
 * next step can follow immediately.
 */
export function waitAfter(step: RoutineStep, next: RoutineStep | undefined): StepWait | null {
  if (!next) return null;
  const category = step.product?.category ?? null;

  if (isVitaminC(step)) {
    return { minutes: 10, note: 'Vitamin C needs its low pH — let it fully absorb first' };
  }
  if (isRetinoid(step) || category === 'treatment') {
    return { minutes: 15, note: 'Let the treatment settle so the next layer doesn’t dilute it' };
  }
  if (category === 'exfoliant') {
    return {
      minutes: 15,
      note: 'Give the acid time to work before neutralizing it with the next step',
    };
  }
  if (category === 'serum') {
    return { minutes: 3, note: 'Wait until it no longer feels tacky' };
  }
  if (category === 'moisturizer' && next.product?.category === 'spf') {
    return { minutes: 5, note: 'SPF forms its protective film best on settled moisturizer' };
  }
  return null;
}

/** Order and pairing problems for a period's step list, worst first. */
export function sequenceWarnings(steps: RoutineStep[], period: 'am' | 'pm'): SequenceWarning[] {
  const warnings: SequenceWarning[] = [];
  if (steps.length < 2) {
    // A single step can still be mis-timed (e.g. a retinoid in the morning).
    if (steps.length === 1 && period === 'am' && isRetinoid(steps[0])) {
      warnings.push({
        severity: 'fix',
        message:
          'Retinoids degrade in daylight and raise sun sensitivity — move this to your evening routine.',
      });
    }
    return warnings;
  }

  const cleanserIdx = steps.findIndex((s) => s.product?.category === 'cleanser');
  if (cleanserIdx > 0) {
    warnings.push({
      severity: 'fix',
      message: 'Cleanser should be step 1 — everything applied before it gets washed off.',
    });
  }

  const spfIdx = steps.findIndex((s) => s.product?.category === 'spf');
  if (spfIdx !== -1 && period === 'pm') {
    warnings.push({
      severity: 'caution',
      message: 'SPF has no job at night — save it for the morning routine.',
    });
  } else if (spfIdx !== -1 && spfIdx !== steps.length - 1) {
    warnings.push({
      severity: 'fix',
      message: 'SPF must be the very last step — layers applied over it break its protective film.',
    });
  }

  if (period === 'am' && steps.some(isRetinoid)) {
    warnings.push({
      severity: 'fix',
      message:
        'Retinoids degrade in daylight and raise sun sensitivity — move them to your evening routine.',
    });
  }

  if (steps.some(isRetinoid) && steps.some((s) => isAcidExfoliant(s) && !isRetinoid(s))) {
    warnings.push({
      severity: 'caution',
      message:
        'A retinoid and an exfoliating acid in the same routine raises irritation risk — alternate nights instead.',
    });
  }

  if (steps.some(isRetinoid) && steps.some(isVitaminC)) {
    warnings.push({
      severity: 'caution',
      message:
        'Vitamin C and a retinoid compete for skin pH — use vitamin C in the AM and the retinoid at night.',
    });
  }

  const moisturizerIdx = steps.findIndex((s) => s.product?.category === 'moisturizer');
  const lateSerumIdx = steps.findIndex(
    (s, i) => i > moisturizerIdx && s.product?.category === 'serum',
  );
  if (moisturizerIdx !== -1 && lateSerumIdx !== -1) {
    warnings.push({
      severity: 'fix',
      message: 'A serum applied over moisturizer can’t penetrate — move it before the moisturizer.',
    });
  }

  return warnings.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'fix' ? -1 : 1));
}
