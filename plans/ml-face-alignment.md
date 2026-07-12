# Scoping: real-time ML face alignment for guided capture (F3)

**Status: scoping only — build is a separate future owner decision.** Deferred in
ADR-0012; this document is the promised sizing so that decision can be made cold.

## What it would replace

Guided capture (`scan/camera.tsx`) today shows a **static** alignment overlay and a
rec-709 luma exposure verdict (`captureQuality.ts`). The user aligns themselves; nothing
tracks the face. The upgrade: a live face-detection box driving the overlay — "move
closer / center your face / hold still" — with capture auto-triggering when aligned,
producing more consistent framing and therefore more comparable scan-to-scan photos
(better `compare-scans` deltas, better trend lines).

## Dependency choice

| Option | Verdict |
|---|---|
| `react-native-vision-camera` + `react-native-vision-camera-face-detector` (MLKit/Vision frame processor) | **Recommended.** Actively maintained, JSI frame processors, MLKit on Android / Apple Vision on iOS, no cloud calls. |
| `expo-face-detector` | Deprecated/removed in recent SDKs — not viable. |
| Custom TFLite/MediaPipe integration | Maximum control, weeks of native work — not justified for a bounding box. |

`react-native-vision-camera` **replaces `expo-camera`** for the guided path — the two
camera stacks shouldn't coexist. That is the riskiest part of the build: the capture
screen, exposure assessment hook-in, and `capture_meta` writing all migrate.

## Expo compatibility

Needs a **dev build / EAS build** (config plugin + native code) — already true for this
app (HealthKit/Health Connect forced dev builds long ago), so no workflow regression.
Not available in Expo Go; `camera.web.tsx` (picker fallback) is untouched.

## Data & schema

No schema change. `scans.capture_meta` (migration 0014) already stores capture context;
add keys like `face_box`, `alignment_score`, `auto_captured` under the existing jsonb —
additive, no migration. `assessCapture` stays as the exposure gate; alignment becomes a
second, parallel signal.

## Fallback behavior

Face detection unavailable (old device, init failure) → static overlay exactly as
today. The feature must be a progressive enhancement with zero new failure modes:
detector errors are swallowed to the static path, never surfaced as capture blockers.

## Estimated size

- Dependency swap + config plugins + EAS builds green on both platforms: **2–3 days**
- Frame-processor alignment logic + overlay animation + auto-capture UX: **2–3 days**
- QA across device tiers (MLKit perf on low-end Android is the wildcard): **2 days**
- Total: **~1.5–2 weeks** including review; app size grows ~3–8 MB (MLKit models).

## Recommendation

Worth building **after** launch metrics show scan repeat-usage (the payoff is trend
quality, which only matters for repeat scanners). Do not bundle into v1.0.
