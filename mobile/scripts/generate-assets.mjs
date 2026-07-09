// Renders every Glowi app-icon / splash / favicon PNG from the two brand marks
// in assets/brand/ (see glowi-mark.svg). Run with `npm run assets`.
//
// Design notes:
//  - Geometry lives ONLY in the SVGs, which are exact transcriptions of
//    GlowiAvatar.tsx. This script never redraws the sphere — it scales the mark
//    and composites it onto the right field, so the icon can never drift from
//    the in-app mascot.
//  - The solid #15110E field is applied here (not baked into the mark) so the
//    same transparent mark feeds the opaque icon AND the transparent Android
//    foreground + splash layers.
//  - Idempotent: fixed geometry + sharp strips metadata by default, so two runs
//    produce byte-identical PNGs.
//
// deno-lint-ignore-file — this is a Node build script, not app/edge code.
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BRAND = join(__dirname, '..', 'assets', 'brand');
const IMAGES = join(__dirname, '..', 'assets', 'images');

/** bgDarkDeep — the warm-editorial deep field the whole app icon sits on. */
const FIELD = { r: 0x15, g: 0x11, b: 0x0e, alpha: 1 };
const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };

// Sphere diameter as a fraction of each source SVG's viewBox width:
//   glowi-mark.svg      → r46 in a 155 box (halo padding)  = 92/155
//   glowi-mark-mono.svg → r46 in a 100 box (no halo)       = 92/100
const MARK = join(BRAND, 'glowi-mark.svg');
const MONO = join(BRAND, 'glowi-mark-mono.svg');
const MARK_SPHERE_FRAC = 92 / 155;
const MONO_SPHERE_FRAC = 92 / 100;

/**
 * Scale a mark so its sphere occupies `sphereFraction` of a `size`×`size`
 * canvas, then composite it centered onto `field`. Overflow (the soft halo) is
 * clipped to the canvas — intentional bleed for the opaque icon.
 */
async function compose({ source, intrinsicFrac, size, sphereFraction, field, dest }) {
  const markPx = Math.round((sphereFraction * size) / intrinsicFrac);
  let markImg = sharp(source).resize(markPx, markPx, { fit: 'contain', background: TRANSPARENT });
  // When the mark is larger than the canvas (opaque icon: the soft halo bleeds
  // past the edges) sharp can't composite it — center-crop to the canvas first.
  if (markPx > size) {
    const off = Math.round((markPx - size) / 2);
    markImg = markImg.extract({ left: off, top: off, width: size, height: size });
  }
  const mark = await markImg.png().toBuffer();
  const buf = await sharp({
    create: { width: size, height: size, channels: 4, background: field },
  })
    .composite([{ input: mark, gravity: 'center' }])
    .png({ compressionLevel: 9 })
    .toBuffer();
  await sharp(buf).toFile(dest);
  return dest;
}

async function solid({ size, field, dest }) {
  await sharp({ create: { width: size, height: size, channels: 4, background: field } })
    .png({ compressionLevel: 9 })
    .toFile(dest);
  return dest;
}

const jobs = [
  // iOS / legacy launcher icon — sphere on the deep field.
  {
    label: 'icon.png',
    run: () =>
      compose({
        source: MARK,
        intrinsicFrac: MARK_SPHERE_FRAC,
        size: 1024,
        sphereFraction: 0.7,
        field: FIELD,
        dest: join(IMAGES, 'icon.png'),
      }),
  },
  // Android adaptive foreground — sphere in the central safe zone, transparent.
  {
    label: 'android-icon-foreground.png',
    run: () =>
      compose({
        source: MARK,
        intrinsicFrac: MARK_SPHERE_FRAC,
        size: 1024,
        sphereFraction: 0.55,
        field: TRANSPARENT,
        dest: join(IMAGES, 'android-icon-foreground.png'),
      }),
  },
  // Android adaptive background — solid field.
  {
    label: 'android-icon-background.png',
    run: () =>
      solid({ size: 1024, field: FIELD, dest: join(IMAGES, 'android-icon-background.png') }),
  },
  // Android adaptive monochrome — white silhouette in the safe zone.
  {
    label: 'android-icon-monochrome.png',
    run: () =>
      compose({
        source: MONO,
        intrinsicFrac: MONO_SPHERE_FRAC,
        size: 1024,
        sphereFraction: 0.55,
        field: TRANSPARENT,
        dest: join(IMAGES, 'android-icon-monochrome.png'),
      }),
  },
  // Splash mark — sphere + halo on transparent (splash plugin paints the field).
  {
    label: 'splash-icon.png',
    run: () =>
      compose({
        source: MARK,
        intrinsicFrac: MARK_SPHERE_FRAC,
        size: 512,
        sphereFraction: 0.6,
        field: TRANSPARENT,
        dest: join(IMAGES, 'splash-icon.png'),
      }),
  },
  // Web favicon.
  {
    label: 'favicon.png',
    run: () =>
      compose({
        source: MARK,
        intrinsicFrac: MARK_SPHERE_FRAC,
        size: 48,
        sphereFraction: 0.7,
        field: FIELD,
        dest: join(IMAGES, 'favicon.png'),
      }),
  },
];

for (const job of jobs) {
  await job.run();
  // eslint-disable-next-line no-console
  console.log(`✓ ${job.label}`);
}
