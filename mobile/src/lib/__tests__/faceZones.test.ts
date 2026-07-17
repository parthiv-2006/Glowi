import { describe, expect, it } from '@jest/globals';

import { FACE_ZONES, normalizeArea, zoneSeverities } from '../faceZones';
import type { ScanConcern } from '../types';

function concern(
  partial: Partial<ScanConcern> & { areas: string[]; severity: number },
): ScanConcern {
  return {
    concern_slug: 'test',
    display_name: 'Test concern',
    confidence: 0.9,
    observations: '',
    caution: null,
    ...partial,
  };
}

describe('normalizeArea', () => {
  // The five strings the mock provider actually emits.
  it('maps the mock vocabulary', () => {
    expect(normalizeArea('nose')).toEqual(['nose']);
    expect(normalizeArea('inner cheeks')).toEqual(['left_cheek', 'right_cheek']);
    expect(normalizeArea('chin')).toEqual(['chin']);
    expect(normalizeArea('forehead')).toEqual(['forehead']);
    expect(normalizeArea('cheeks')).toEqual(['left_cheek', 'right_cheek']);
  });

  it('resolves left/right cheek qualifiers to a single side', () => {
    expect(normalizeArea('left cheek')).toEqual(['left_cheek']);
    expect(normalizeArea('Right Cheek')).toEqual(['right_cheek']);
  });

  it('expands composites', () => {
    expect(normalizeArea('T-zone')).toEqual(['forehead', 'nose', 'chin']);
    expect(normalizeArea('full face')).toEqual([...FACE_ZONES]);
  });

  it('maps single live-plausible phrasings', () => {
    expect(normalizeArea('jawline')).toEqual(['jawline']);
    expect(normalizeArea('under-eye area')).toEqual(['under_eyes']);
  });

  it('routes nasolabial phrasing to the mouth area, never the nose', () => {
    expect(normalizeArea('nasolabial folds')).toEqual(['perioral']);
  });

  it('returns [] for unmappable text', () => {
    expect(normalizeArea('neck')).toEqual([]);
    expect(normalizeArea('')).toEqual([]);
  });
});

describe('zoneSeverities', () => {
  it('keeps the highest severity per zone across concerns', () => {
    const { zones } = zoneSeverities([
      concern({ areas: ['chin'], severity: 30 }),
      concern({ areas: ['chin', 'forehead'], severity: 70 }),
    ]);
    expect(zones.get('chin')).toBe(70);
    expect(zones.get('forehead')).toBe(70);
  });

  it('collects unmapped areas, deduped case-insensitively with first-seen casing', () => {
    const { zones, unmappedAreas } = zoneSeverities([
      concern({ areas: ['Neck', 'nose'], severity: 40 }),
      concern({ areas: ['neck', ''], severity: 55 }),
    ]);
    expect(zones.get('nose')).toBe(40);
    expect(unmappedAreas).toEqual(['Neck']);
  });
});
