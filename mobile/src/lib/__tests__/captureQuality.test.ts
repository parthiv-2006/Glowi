import { describe, expect, it } from '@jest/globals';

import { assessCapture, captureQualityMessage, type CaptureVerdict } from '../captureQuality';

/** RGBA buffer where every pixel is (v,v,v,255). */
function solid(width: number, height: number, v: number, channels = 4): Uint8Array {
  const buf = new Uint8Array(width * height * channels);
  for (let i = 0; i < width * height; i++) {
    const o = i * channels;
    buf[o] = v;
    buf[o + 1] = v;
    buf[o + 2] = v;
    if (channels === 4) buf[o + 3] = 255;
  }
  return buf;
}

/** RGBA buffer split left/right at mid-x, each half a solid grey. */
function leftRight(width: number, height: number, left: number, right: number): Uint8Array {
  const buf = new Uint8Array(width * height * 4);
  const midX = Math.floor(width / 2);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4;
      const v = x < midX ? left : right;
      buf[o] = v;
      buf[o + 1] = v;
      buf[o + 2] = v;
      buf[o + 3] = 255;
    }
  }
  return buf;
}

/** RGBA buffer where the first `fraction` of pixels are `a`, the rest `b`. */
function mix(width: number, height: number, fraction: number, a: number, b: number): Uint8Array {
  const buf = new Uint8Array(width * height * 4);
  const cut = Math.floor(width * height * fraction);
  for (let i = 0; i < width * height; i++) {
    const o = i * 4;
    const v = i < cut ? a : b;
    buf[o] = v;
    buf[o + 1] = v;
    buf[o + 2] = v;
    buf[o + 3] = 255;
  }
  return buf;
}

describe('assessCapture', () => {
  it('passes an evenly, moderately-lit frame', () => {
    const q = assessCapture(solid(64, 64, 128), 64, 64);
    expect(q.verdict).toBe('good');
    expect(Math.round(q.meanLuminance)).toBe(128);
    expect(q.clippedShadows).toBe(0);
    expect(q.clippedHighlights).toBe(0);
  });

  it('flags an underexposed frame as too_dark', () => {
    expect(assessCapture(solid(64, 64, 25), 64, 64).verdict).toBe('too_dark');
  });

  it('flags an overexposed frame as too_bright', () => {
    expect(assessCapture(solid(64, 64, 230), 64, 64).verdict).toBe('too_bright');
  });

  it('flags heavy shadow clipping even when the mean is in range', () => {
    // 40% crushed to black, 60% at 200 → mean ~120 (in range) but shadows > 30%.
    const q = assessCapture(mix(64, 64, 0.4, 0, 200), 64, 64);
    expect(q.clippedShadows).toBeGreaterThan(0.3);
    expect(q.verdict).toBe('too_dark');
  });

  it('flags heavy highlight clipping even when the mean is in range', () => {
    // 40% blown to white, 60% at 100 → mean ~162 (in range) but highlights > 30%.
    const q = assessCapture(mix(64, 64, 0.4, 255, 100), 64, 64);
    expect(q.clippedHighlights).toBeGreaterThan(0.3);
    expect(q.verdict).toBe('too_bright');
  });

  it('flags side-lighting as uneven', () => {
    // left 90 / right 165 → mean ~127 (in range), gap 75 > 45.
    const q = assessCapture(leftRight(64, 64, 90, 165), 64, 64);
    expect(q.verdict).toBe('uneven');
  });

  it('does not call a gently graded frame uneven', () => {
    // left 120 / right 150 → gap 30 < 45.
    expect(assessCapture(leftRight(64, 64, 120, 150), 64, 64).verdict).toBe('good');
  });

  it('handles a 3-channel RGB buffer', () => {
    expect(assessCapture(solid(32, 32, 128, 3), 32, 32).verdict).toBe('good');
  });

  it('degrades safely on an empty/invalid buffer', () => {
    const q = assessCapture(new Uint8Array(0), 0, 0);
    expect(q.verdict).toBe('too_dark');
    expect(q.meanLuminance).toBe(0);
  });
});

describe('captureQualityMessage', () => {
  it('returns a distinct, non-empty sentence for every verdict', () => {
    const verdicts: CaptureVerdict[] = ['good', 'too_dark', 'too_bright', 'uneven'];
    const messages = verdicts.map(captureQualityMessage);
    for (const m of messages) expect(m.length).toBeGreaterThan(0);
    expect(new Set(messages).size).toBe(verdicts.length);
  });
});
