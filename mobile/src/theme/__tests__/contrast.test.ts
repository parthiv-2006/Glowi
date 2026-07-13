import { describe, expect, it, jest } from '@jest/globals';

import { palette } from '../index';

// `theme/index.ts` pulls Reanimated in for `motion.easing`, which can't initialize its
// worklets runtime under jest. The palette itself is plain data — stub the one symbol.
// (babel-plugin-jest-hoist lifts this above the import above.)
jest.mock('react-native-reanimated', () => ({
  Easing: { bezier: () => null },
}));

/**
 * The palette's contrast contract (WCAG 2.1 AA).
 *
 * Every token the app renders *as text* must clear 4.5:1 against every surface it
 * actually lands on. Tokens used only as fills/glows (clayBright, blush, line) are
 * exempt from the text bar but must still clear 3:1 where they carry meaning.
 *
 * This test exists because the "Warm Editorial" palette is cream-on-cream: it is very
 * easy to pick a warm mid-tone that looks right and is unreadable. If you are changing
 * a color and this test fails, the color is the bug — not the test.
 */

const srgbToLinear = (channel: number): number => {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

/** Relative luminance per WCAG 2.1, from a #RRGGBB string. */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}

/** WCAG contrast ratio between two opaque colors — 1:1 (identical) to 21:1 (black/white). */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Hue angle in degrees (0–360) from a #RRGGBB string. */
function hueOf(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const delta = max - Math.min(r, g, b);
  if (delta === 0) return 0;
  const sector =
    max === r ? ((g - b) / delta) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
  return (sector * 60 + 360) % 360;
}

/** Shortest angular distance between two hues, in degrees (0–180). */
function hueGap(a: number, b: number): number {
  const raw = Math.abs(a - b) % 360;
  return raw > 180 ? 360 - raw : raw;
}

const AA_TEXT = 4.5;
const AA_LARGE_AND_GRAPHICS = 3;

/** The surfaces text can land on in the light theme. `well` is the darkest, so it governs. */
const LIGHT_SURFACES = {
  bg: palette.bg,
  card: palette.card,
  well: palette.well,
};

describe('palette contrast (WCAG AA)', () => {
  describe('ink ramp is legible on every light surface', () => {
    const inkTokens = { ink: palette.ink, inkSoft: palette.inkSoft, inkFaint: palette.inkFaint };

    for (const [inkName, ink] of Object.entries(inkTokens)) {
      for (const [surfaceName, surface] of Object.entries(LIGHT_SURFACES)) {
        it(`${inkName} on ${surfaceName}`, () => {
          expect(contrastRatio(ink, surface)).toBeGreaterThanOrEqual(AA_TEXT);
        });
      }
    }

    it('preserves the three-step hierarchy (ink darker than inkSoft darker than inkFaint)', () => {
      expect(luminance(palette.ink)).toBeLessThan(luminance(palette.inkSoft));
      expect(luminance(palette.inkSoft)).toBeLessThan(luminance(palette.inkFaint));
    });
  });

  describe('semantic + accent colors are legible as text on paper', () => {
    const semantic = {
      clay: palette.clay,
      sage: palette.sage,
      ochre: palette.ochre,
      rose: palette.rose,
    };

    for (const [name, color] of Object.entries(semantic)) {
      it(`${name} on bg and card`, () => {
        expect(contrastRatio(color, palette.bg)).toBeGreaterThanOrEqual(AA_TEXT);
        expect(contrastRatio(color, palette.card)).toBeGreaterThanOrEqual(AA_TEXT);
      });
    }

    it('severity tones stay separable by hue, not by lightness', () => {
      // Consequence of the line above: pinning sage/ochre/rose to the same 4.5:1 target
      // against the same paper gives them near-identical luminance, so they differ *only*
      // in hue. That is fine for sighted users and invisible under monochromacy — which is
      // why severity is always rendered with `severityLabel` text beside the color, never
      // as color alone. Guard the hue separation that does the work.
      const hues = [palette.sage, palette.ochre, palette.rose].map(hueOf);
      const [sage, ochre, rose] = hues;
      expect(hueGap(sage, ochre)).toBeGreaterThan(25);
      expect(hueGap(ochre, rose)).toBeGreaterThan(25);
      expect(hueGap(sage, rose)).toBeGreaterThan(25);
    });
  });

  describe('the primary CTA carries white text', () => {
    // GlowButton's primary fill is a clay → clayDeep gradient; the label is white and can
    // sit anywhere along it, so BOTH stops must clear AA.
    it('white on the clay gradient start', () => {
      expect(contrastRatio('#FFFFFF', palette.clay)).toBeGreaterThanOrEqual(AA_TEXT);
    });
    it('white on the clay gradient end', () => {
      expect(contrastRatio('#FFFFFF', palette.clayDeep)).toBeGreaterThanOrEqual(AA_TEXT);
    });
  });

  describe('dark theme (scan screens)', () => {
    const darkInk = {
      inkDark: palette.inkDark,
      inkSoftDark: palette.inkSoftDark,
      inkFaintDark: palette.inkFaintDark,
      clayDark: palette.clayDark,
    };

    for (const [name, color] of Object.entries(darkInk)) {
      it(`${name} on bgDark`, () => {
        expect(contrastRatio(color, palette.bgDark)).toBeGreaterThanOrEqual(AA_TEXT);
      });
    }
  });

  describe('glow/fill tokens are documented as non-text', () => {
    // These are deliberately too light to read on paper. The test pins that fact so nobody
    // "fixes" a screen by using clayBright as a text color — use `clay` instead.
    it('clayBright is not legible as text on paper', () => {
      expect(contrastRatio(palette.clayBright, palette.bg)).toBeLessThan(AA_LARGE_AND_GRAPHICS);
    });
    it('but clayBright IS legible on the dark tab bar, where it marks the active tab', () => {
      // The tab bar is rgba(43,37,33,0.94) over bg — effectively #37312D.
      expect(contrastRatio(palette.clayBright, '#37312D')).toBeGreaterThanOrEqual(AA_TEXT);
    });
  });
});
