# ADR 0012: Guided Scan Capture

- Status: Accepted
- Date: 2026-07-09

## Context

Every trend feature Glowi ships — the before/after slider, concern sparklines, the
`compareScans` AI delta, and WS3's coach correlations — compares one scan photo to
another and reports the difference as signal. That comparison is only honest if the
photos are comparable: same framing, same distance, similar light. Until now the only
capture path was `expo-image-picker` (`scan/index.tsx`): the user shot a free-form photo
or picked one from the library, with no guidance on framing or exposure. A face filling
the frame in soft window light one week and a dim, side-lit half-face the next produces
a "change" that is really just a change in photography, and every downstream feature
inherits that noise.

## Decision

**A static alignment overlay + a post-capture lighting check, inside `expo-camera` —
not real-time ML face tracking.** A new route `scan/camera.tsx` renders a front-camera
`CameraView` letterboxed to the same 4:5 frame as the picker screen, with a fixed SVG
overlay: a face oval (~62% frame width, centred slightly above middle) cut from a
dimming scrim, forehead/chin ticks, and the caption "Fill the oval · hold at arm's
length · eyes level". The geometry is fixed and versioned (`OVERLAY_VERSION`), recorded
on each scan so trends can tell which guidance a photo was framed against.

**Why post-capture, not real-time:** real-time face tracking needs
`react-native-vision-camera` + a face-detector frame processor, which requires a custom
dev/EAS build and doesn't run in Expo Go. A static overlay plus a one-shot quality read
is Expo Go-compatible, adds **zero new native modules** (`expo-camera` is the only new
dep, and `@shopify/react-native-skia` — already a dependency — does the pixel read), and
delivers the bulk of the consistency benefit. The ML upgrade path is recorded as
deferred below rather than built now.

**Lighting check is pure logic behind a thin Skia I/O edge.** `mobile/src/lib/
captureQuality.ts` (`assessCapture(pixels, width, height)`) is I/O-free: it takes a
decoded RGBA buffer and returns `{ meanLuminance, clippedShadows, clippedHighlights,
verdict }` using rec-709 luma and named thresholds (dark < 60 mean, bright > 200 mean,
clip fraction > 0.30, uneven = left/right half-mean gap > 45). The camera screen owns the
Skia decode+downscale (to ≤64px — plenty to judge exposure, far cheaper than the full
frame) and hands the small buffer to the pure module, which keeps the verdict logic
unit-testable with synthetic buffers and identical on every platform. On a non-`good`
verdict a retake sheet offers a plain-language reason + **Retake** (default) / **Use
anyway** — guidance, never a hard block. A failed decode (`null`) also never blocks:
the user proceeds and `capture_meta` records nulls.

**`capture_meta` on the scan row, not a new table.** Migration `0014` adds a nullable
`jsonb capture_meta` to `scans` — `{ guided, overlay_version, mean_luminance, verdict }`,
written by the camera flow and left `null` for library uploads and legacy scans. RLS is
unchanged: it's a column on the already user-owned `scans` table, covered by the existing
`crud_own` policies. This is the hook for future consistency-weighted trends (e.g.
down-weighting a comparison where one photo was `too_dark` or ungudied) without a schema
migration later.

**Library upload stays.** `scan/index.tsx`'s "Take photo" now opens the guided camera;
"Upload" remains the library fallback with a one-line nudge ("Guided photos compare best
week to week."). The old `launchCameraAsync` free-form path was removed, not commented
out. On web, `CameraView` + the Skia read are unavailable, so `scan/camera.web.tsx`
degrades to the library picker (mirroring `ScanTheater.web.tsx` / `AuroraBackground.web.
tsx`), and photos chosen there carry no `capture_meta`.

## Deferred — ML face alignment

Real-time face-box tracking (are the eyes level? is the face centred and at the right
distance *before* the shutter?) via `react-native-vision-camera` + a face-detector plugin
in a custom dev build is the natural next step. It's deferred because it forces users off
Expo Go and adds a native dependency for a marginal gain over the static overlay. When
Glowi ships a permanent dev/EAS build pipeline (WS2), this becomes viable; `capture_meta`
already reserves room to record a richer alignment score alongside the lighting verdict.

## Consequences

**Advantages**

- Week-over-week photos are meaningfully more comparable — the honest foundation every
  trend feature and WS3's coach context depends on.
- No new native module and Expo Go-compatible, so it ships without a custom build and
  works in the existing QA loop.
- The exposure logic is pure and fully unit-tested (synthetic buffers), so its verdicts
  are deterministic and regression-safe independent of any device.
- `capture_meta` is an additive, nullable column — zero risk to existing scans and a
  ready hook for consistency-weighted trends later.

**Tradeoffs**

- The overlay is guidance, not enforcement: a user can still shoot off-centre or "Use
  anyway" past a bad-light warning. Accepted — a hard block would be hostile, and
  `capture_meta` lets downstream features discount low-quality captures instead.
- The lighting read is a coarse global/left-right heuristic, not a true face-region
  exposure model; it catches gross under/over-exposure and side-lighting, not subtle
  unevenness. Adequate for a retake nudge; the thresholds live as named constants in
  `captureQuality.ts` for tuning.
- Native camera behaviour (overlay geometry on real aspect ratios, permission flow,
  Skia read on device) can't be exercised in a web preview — it needs on-device Expo Go
  verification, which is called out explicitly rather than claimed as done here.
