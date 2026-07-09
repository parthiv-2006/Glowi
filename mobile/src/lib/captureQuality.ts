/**
 * Post-capture lighting assessment for guided scans (see scan/camera.tsx).
 *
 * Pure and I/O-free: the camera screen decodes the photo to a small RGBA pixel
 * buffer with Skia and hands it here. Keeping the maths pure means the verdict
 * logic is unit-testable with synthetic buffers and identical on every platform.
 *
 * Why it matters: every trend feature (before/after, sparklines, WS3's coach
 * correlations) is only as honest as the photos. Comparable photos need
 * comparable exposure, so we nudge the user to retake when the light is poor.
 */

import type { CaptureVerdict } from './types';

export type { CaptureVerdict };

export interface CaptureQuality {
  /** Mean rec-709 luma across all pixels, 0–255. */
  meanLuminance: number;
  /** Fraction of pixels crushed to near-black, 0–1. */
  clippedShadows: number;
  /** Fraction of pixels blown out to near-white, 0–1. */
  clippedHighlights: number;
  verdict: CaptureVerdict;
}

// Luma thresholds (0–255) and fractions. Named so the retake bar is tunable.
/** Below this mean, the frame reads as underexposed. */
export const DARK_MEAN = 60;
/** Above this mean, the frame reads as overexposed. */
export const BRIGHT_MEAN = 200;
/** A pixel at/under this luma counts as a crushed shadow. */
export const SHADOW_CLIP_LUMA = 16;
/** A pixel at/over this luma counts as a blown highlight. */
export const HIGHLIGHT_CLIP_LUMA = 240;
/** Clipping past this fraction of the frame fails the exposure check. */
export const CLIP_FRACTION = 0.3;
/** Left/right mean-luma gap past this (0–255) reads as side-lit / uneven. */
export const UNEVEN_DELTA = 45;

/** rec-709 luma for an 8-bit RGB triple. */
function luma(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Assess a decoded RGBA (or RGB) pixel buffer. `width`/`height` describe the
 * downscaled copy the caller decoded — typically ≤64px on the long edge, which
 * is plenty to judge exposure and far cheaper than the full frame.
 */
export function assessCapture(pixels: Uint8Array, width: number, height: number): CaptureQuality {
  const pixelCount = width * height;
  if (pixelCount <= 0 || pixels.length < pixelCount) {
    return { meanLuminance: 0, clippedShadows: 0, clippedHighlights: 0, verdict: 'too_dark' };
  }
  // Infer channel count (4 = RGBA from Skia, 3 = RGB) from the buffer length.
  const channels = Math.max(1, Math.floor(pixels.length / pixelCount));
  const midX = Math.floor(width / 2);

  let total = 0;
  let shadows = 0;
  let highlights = 0;
  let leftTotal = 0;
  let leftCount = 0;
  let rightTotal = 0;
  let rightCount = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels;
      const l = luma(pixels[i], pixels[i + 1] ?? pixels[i], pixels[i + 2] ?? pixels[i]);
      total += l;
      if (l <= SHADOW_CLIP_LUMA) shadows++;
      if (l >= HIGHLIGHT_CLIP_LUMA) highlights++;
      if (x < midX) {
        leftTotal += l;
        leftCount++;
      } else {
        rightTotal += l;
        rightCount++;
      }
    }
  }

  const meanLuminance = total / pixelCount;
  const clippedShadows = shadows / pixelCount;
  const clippedHighlights = highlights / pixelCount;
  const leftMean = leftCount ? leftTotal / leftCount : meanLuminance;
  const rightMean = rightCount ? rightTotal / rightCount : meanLuminance;
  const sideGap = Math.abs(leftMean - rightMean);

  let verdict: CaptureVerdict;
  if (meanLuminance < DARK_MEAN || clippedShadows > CLIP_FRACTION) {
    verdict = 'too_dark';
  } else if (meanLuminance > BRIGHT_MEAN || clippedHighlights > CLIP_FRACTION) {
    verdict = 'too_bright';
  } else if (sideGap > UNEVEN_DELTA) {
    verdict = 'uneven';
  } else {
    verdict = 'good';
  }

  return { meanLuminance, clippedShadows, clippedHighlights, verdict };
}

/** Plain-language reason for the retake sheet — one calm sentence per verdict. */
export function captureQualityMessage(verdict: CaptureVerdict): string {
  switch (verdict) {
    case 'too_dark':
      return 'This photo looks underexposed. Face a window or turn on more light so your skin is clearly lit.';
    case 'too_bright':
      return 'This photo is washed out by strong light. Step out of direct glare or soften the light a little.';
    case 'uneven':
      return 'The light is coming from one side, casting a shadow across your face. Face the light head-on for an even read.';
    case 'good':
      return 'Lighting looks good.';
  }
}
