import { describe, expect, it } from '@jest/globals';

import { readingProgress } from '../readingProgress';

describe('readingProgress', () => {
  it('is 0 at the top of a scrollable article', () => {
    expect(readingProgress(0, 2000, 800)).toBe(0);
  });

  it('is 1 at the bottom of a scrollable article', () => {
    expect(readingProgress(1200, 2000, 800)).toBe(1);
  });

  it('is fractional partway through', () => {
    expect(readingProgress(600, 2000, 800)).toBeCloseTo(0.5);
  });

  it('clamps a negative scroll offset (rubber-band overscroll) to 0', () => {
    expect(readingProgress(-40, 2000, 800)).toBe(0);
  });

  it('clamps an offset past the bottom (rubber-band overscroll) to 1', () => {
    expect(readingProgress(5000, 2000, 800)).toBe(1);
  });

  it('is 1 when the content is shorter than the viewport — nothing to scroll', () => {
    expect(readingProgress(0, 400, 800)).toBe(1);
  });

  it('is 1 when content and viewport heights are equal', () => {
    expect(readingProgress(0, 800, 800)).toBe(1);
  });

  it('never throws on zero heights', () => {
    expect(() => readingProgress(0, 0, 0)).not.toThrow();
  });
});
