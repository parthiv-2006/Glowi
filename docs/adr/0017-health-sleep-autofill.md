# ADR 0017: HealthKit / Health Connect sleep auto-fill (suggest-and-confirm)

- Status: Accepted
- Date: 2026-07-10

## Context

The Lifestyle Diary's biggest risk was named in ADR-0013: manual-entry fatigue killing
data quality, and with it correlation quality. Sleep is the field a device can measure —
both platforms expose last night's sleep through a health store. The question was how to
bring it in without violating the diary's core stance that **an unanswered scale is not
data** and a diary row is something the user said, not something a sensor guessed.

## Decision

**Suggest, never write.** When the user opts in (Profile → "Auto-fill sleep from Health",
default off) and today's `sleep_quality` is unanswered, the check-in card fetches last
night's sleep and shows one line — "Health saw 7.8 h of sleep — great. Tap to log it." A
tap runs the exact same upsert a manual answer would; no tap, no row. Provenance stays
clean: everything in `lifestyle_logs` is user-confirmed, so ADR-0013's correlation
semantics are untouched. Silent auto-logging was rejected outright — it fabricates diary
rows the user never reviewed and muddies what a low-sleep streak means.

**Native libraries.** iOS: `@kingstinct/react-native-healthkit` v14 (Nitro-based, hence
the new `react-native-nitro-modules` dep) reading `HKCategoryTypeIdentifierSleepAnalysis`
samples, counting only the asleep states (unspecified/core/deep/REM — in-bed and awake
excluded). Android: `react-native-health-connect` reading `SleepSession` records. Both
read-only; the HealthKit config plugin sets `NSHealthUpdateUsageDescription: false` so
the app never even requests write entitlement. Health Connect requires `minSdkVersion 26`
(via `expo-build-properties`) and `android.permission.health.READ_SLEEP` joins CAMERA in
the manifest.

**Isolation.** `lib/health.ts` is the only file that touches the native modules, imports
them lazily inside try/catch, and returns `null` on every failure — missing module (Expo
Go), web, denied permission, no data. The pure mapping lives in `lib/sleepMapping.ts`:
&lt;6 h → poor, 6–7.5 h → okay, ≥7.5 h → great, and implausible readings (&lt;1 h, &gt;16 h)
map to `null` rather than a guess. Only the mapping is unit-testable in this environment,
so it carries the tests.

## Rejected alternatives

- **Silent auto-log** — see above; also breaks the "logged N of 14 days" honesty in the
  coach's lifestyle block, which counts user engagement, not sensor coverage.
- **Auto-filling stress/water too.** No device measures them comparably; sleep is the
  only field with a trustworthy source.
- **`react-native-health` (older iOS lib).** Predates the new architecture; the
  Kingstinct library is typed, maintained, and ships an Expo config plugin.

## Verification

Quality gate green (tsc strict — both libraries' types resolve, eslint, 155 jest
including the new mapping suite); `expo export --platform web` exits 0, proving the
lazily-imported native modules don't break web bundling. **Deferred device checks (no
device or dev build in this environment):** the OS permission sheets, a real HealthKit /
Health Connect read, and the suggestion→confirm→upsert round-trip. This feature requires
a **new EAS dev/preview build** (native modules aren't in Expo Go or the previous APK);
until then the toggle simply never produces a suggestion, which is the designed
degradation.

## Consequences

- Sleep data quality should rise without weakening what a diary row means; correlation
  streaks stay grounded in confirmed entries.
- Two native dependencies + Nitro join the build; the next EAS build is mandatory before
  the feature is testable, and `minSdkVersion` rises to 26 (Android 8.0+, effectively no
  user impact in 2026).
- The 6 h / 7.5 h thresholds are opinionated constants in `sleepMapping.ts` — tune there,
  with tests, if user feedback disagrees.
