/**
 * faceZones — maps a scan concern's free-text `areas` onto a fixed vocabulary of
 * face regions the {@link FaceZoneMap} can draw. The model emits `areas` with no
 * controlled vocabulary (mock: `nose / inner cheeks / chin / forehead / cheeks`),
 * so this is a best-effort normalizer: anything it can't place stays visible as
 * text upstream. Pure, I/O-free — unit-tested in `lib/__tests__/faceZones.test.ts`.
 */
import type { ScanConcern } from './types';

export type FaceZone =
  | 'forehead'
  | 'temples'
  | 'under_eyes'
  | 'nose'
  | 'left_cheek'
  | 'right_cheek'
  | 'perioral'
  | 'chin'
  | 'jawline';

/** Render / legend order, roughly top → bottom of the face. */
export const FACE_ZONES: readonly FaceZone[] = [
  'forehead',
  'temples',
  'under_eyes',
  'nose',
  'left_cheek',
  'right_cheek',
  'perioral',
  'chin',
  'jawline',
];

export const FACE_ZONE_LABEL: Record<FaceZone, string> = {
  forehead: 'Forehead',
  temples: 'Temples',
  under_eyes: 'Under eyes',
  nose: 'Nose',
  left_cheek: 'Left cheek',
  right_cheek: 'Right cheek',
  perioral: 'Mouth area',
  chin: 'Chin',
  jawline: 'Jawline',
};

/** Lowercase, hyphens → spaces, strip punctuation, collapse whitespace. */
function normalize(area: string): string {
  return area
    .toLowerCase()
    .replace(/-/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Map one free-text area onto zero or more {@link FaceZone}s. First matching
 * group wins (whole-face, then composites); keyword groups union all hits.
 * `[]` means unmappable — the caller keeps the raw text visible.
 *
 * Left/right follow the selfie-mirror convention: "left cheek" is the viewer's
 * left, which is the left side of the silhouette as drawn.
 */
export function normalizeArea(area: string): FaceZone[] {
  const norm = normalize(area);
  if (norm.length === 0) return [];

  // Whole-face → every zone.
  if (norm === 'face') return [...FACE_ZONES];
  if (/\b(whole|full|entire) face\b/.test(norm) || norm.includes('all over')) {
    return [...FACE_ZONES];
  }

  // Composites — resolve to a fixed set, winner-take-all.
  if (/\bt zone\b/.test(norm)) return ['forehead', 'nose', 'chin'];
  if (/\bu zone\b/.test(norm) || norm.includes('lower face')) {
    return ['left_cheek', 'right_cheek', 'chin', 'jawline'];
  }

  // Keyword groups — union every hit.
  const zones = new Set<FaceZone>();
  if (/forehead|brow/.test(norm)) zones.add('forehead');
  if (/temple/.test(norm)) zones.add('temples');
  if (/under eye|eye area|periorbital|dark circles/.test(norm)) zones.add('under_eyes');
  // Perioral phrasings tested before nose so "nasolabial" never leaks to the nose.
  if (/nasolabial|smile line|laugh line/.test(norm)) zones.add('perioral');
  if (/\bnose\b|\bnasal\b/.test(norm)) zones.add('nose');
  if (/cheek/.test(norm)) {
    const left = /\bleft\b/.test(norm);
    const right = /\bright\b/.test(norm);
    if (left && !right) zones.add('left_cheek');
    else if (right && !left) zones.add('right_cheek');
    else {
      zones.add('left_cheek');
      zones.add('right_cheek');
    }
  }
  if (/chin/.test(norm)) zones.add('chin');
  if (/jaw/.test(norm)) zones.add('jawline');
  if (/mouth|perioral|\blips?\b/.test(norm)) zones.add('perioral');

  return FACE_ZONES.filter((z) => zones.has(z));
}

export interface ZoneMap {
  /** Highest severity seen in each mapped zone. */
  zones: Map<FaceZone, number>;
  /** Raw area strings that mapped to nothing, deduped case-insensitively. */
  unmappedAreas: string[];
}

/**
 * Fold a set of concerns into a per-zone severity map (max severity wins when
 * several concerns touch the same zone) plus the leftover unmappable areas.
 */
export function zoneSeverities(concerns: ScanConcern[]): ZoneMap {
  const zones = new Map<FaceZone, number>();
  const unmapped = new Map<string, string>(); // lowercased key → first-seen casing

  for (const concern of concerns) {
    for (const area of concern.areas) {
      const mapped = normalizeArea(area);
      if (mapped.length === 0) {
        const trimmed = area.trim();
        if (trimmed.length === 0) continue;
        const key = trimmed.toLowerCase();
        if (!unmapped.has(key)) unmapped.set(key, trimmed);
        continue;
      }
      for (const zone of mapped) {
        const prev = zones.get(zone);
        if (prev === undefined || concern.severity > prev) zones.set(zone, concern.severity);
      }
    }
  }

  return { zones, unmappedAreas: [...unmapped.values()] };
}
