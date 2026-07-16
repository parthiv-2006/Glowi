# Release runbook — Glowi v1.0

Owner-facing: everything needed to build, submit, and launch. Store-form matrices and
review notes live here too (C2). Updated 2026-07-11.

## Build & version configuration (D6)

- `app.json`: `version: 1.0.0`, `ITSAppUsesNonExemptEncryption: false` (standard HTTPS
  only — skips the export-compliance questionnaire). Permissions are exactly what's
  used: camera (guided scan), photo library (scan/shelf picker), `READ_SLEEP` (opt-in
  Health auto-fill), notifications.
- `eas.json` production profile pins the public env (`EXPO_PUBLIC_AI_MODE=live`,
  Supabase URL + anon key — both public-by-design, RLS is the boundary) so a production
  build can never accidentally ship in mock mode or against a dev project.
- `appVersionSource: remote` + `autoIncrement: true`: EAS owns `buildNumber` /
  `versionCode` and bumps them per production build; `version` in app.json is the
  user-facing marketing version and is bumped manually.
- Build commands (run from `mobile/`):
  - `eas build -p android --profile production` → `.aab` for Play
  - `eas build -p ios --profile production` → App Store (needs Apple Developer account)
  - `eas submit -p <platform> --latest` once `submit.production` has store credentials.

## Tablet decision (D7)

`supportsTablet: false` stays for v1. No iPad-specific layouts exist; `useResponsive()`
exists to serve large phones, not tablets, and shipping iPad would double the review/QA
matrix for a v1 with no tablet design. Revisit post-launch if analytics show demand.

## Web launch hardening (C4)

Verified 2026-07-12 by building the static export (`npx expo export -p web` — 28 routes) and
driving it route-by-route in a headless browser (public routes unauthenticated; authed routes
via a guest session). **Result: every route renders or degrades deliberately, with zero console
errors** (one benign, expected `expo-notifications` "push token changes not supported on web"
warning appears everywhere — no action).

- **Secret scan of the built bundle:** clean — only the public anon key is present; no
  service-role key, no Anthropic key, no `ANTHROPIC*` reference.
- **Public routes (no session):** welcome, sign-in, sign-up, forgot-password, reset-password,
  legal/privacy, legal/terms — all render.
- **Authed routes (guest session):** Home (Skin Weather forecast), progress, chat, learn,
  profile, shelf, report — all render.
- **Deliberate web degradations (confirmed intentional, no dead UI):** guided scan →
  library picker (`camera.web.tsx`); local reminders + push registration no-op
  (`notifications.ts` early-returns on web); Health sleep auto-fill absent (native-only,
  `health.ts` returns null); the derm-PDF and "Export my data" rows are hidden on web
  (`Platform.OS !== 'web'` — native share/print unavailable). **Delete account remains
  available on web**, so the P0 compliance action works in the browser.
- **Two bugs found and fixed during the drive** (both re-verified on the rebuilt export):
  1. The auth gate (`_layout.tsx`) only exempted the `(auth)` group, so `/legal/*` and the
     `/reset-password` landing **bounced to /welcome when logged out** — breaking the hosted
     store-form URLs and the welcome-screen Terms/Privacy links. Now exempts `legal` +
     `reset-password` from both the sign-in and onboarding bounces.
  2. `useSkinForecast` fired an unauthenticated `skin-forecast` call (401) during the cold-load
     redirect race; now gated on session (`enabled: !!userId`).

**Owner-gated (stubbed — see checklist):** production web host + domain and deploy, and
`GLOWI_ALLOWED_ORIGINS` set to that origin (closes A4). Until set, the CORS wildcard fallback is
a dev convenience only. Test guest accounts created during this QA are anonymous/inactive and are
reaped by the A6 cleanup job at 90 days.

## Notifications & reminders (D4)

Code audit of the notification pipeline, 2026-07-13. Five defects found and fixed; the
remaining verification needs a physical device and is owner-gated below.

**Fixed in code:**

1. **Android push registration could never succeed on Android 13+.** `getExpoPushTokenAsync`
   requires a notification channel to exist first, and no channel was ever created. Every
   Android push registration failed silently (the function swallows errors and returns
   `false`), so those devices fell back to local reminders forever and the server never had a
   token to push to. `ensureAndroidChannel()` now runs before token acquisition and before any
   scheduling — which also means notifications file under a named "Reminders & reports" channel
   in system settings instead of an unnamed fallback.
2. **A notification tap that cold-started the app was dropped.** Deep links were handled only
   by `addNotificationResponseReceivedListener`, which is registered during React mount — after
   the OS has already delivered the response that launched the process. Tapping the Glow Report
   push from a killed app landed the user on Home with no explanation. `_layout.tsx` now also
   reads `getLastNotificationResponseAsync()` on mount and dedupes by notification id.
3. **The permission prompt fired at boot.** `registerPushToken` requested permission as soon as
   a session existed — i.e. immediately after sign-up, before the user had seen a single scan.
   That is both bad manners and the surest route to a permanent denial (iOS only ever shows the
   dialog once). Registration is now silent and only picks up a token if permission is *already*
   granted; the ask happens contextually (after the first scan, or the Profile reminders
   toggle), and `syncPushRegistration()` completes the local→server handoff on the spot rather
   than waiting for the next cold start.
4. **Routine and weekly-scan reminders had no deep link.** Only the Glow Report reminder carried
   a `data.url`; the others just opened the app wherever it happened to be. AM/PM reminders now
   route to `/routine` and the weekly scan nudge to `/scan`.
5. **A denied permission was a dead end.** Nothing checked `canAskAgain`, so once a user had
   declined, the Profile reminders toggle silently snapped back forever with no explanation and
   no route to system settings.

**Owner device QA (cannot be verified from a build machine — needs a real device):**

- [ ] Permission prompt appears **after the first scan**, not at sign-up.
- [ ] Decline the prompt → app stays fully functional; Profile → Reminders explains and offers
      a jump to system settings rather than snapping back silently.
- [ ] AM/PM routine reminders fire at the set times and open `/routine`.
- [ ] Weekly scan nudge fires and opens `/scan`.
- [ ] **Cold start:** kill the app, send/await a Glow Report push, tap it → lands on the correct
      week's report (this is the path that was broken).
- [ ] Once push registers, the local weekly reminders stop — no double-notification in the week
      after registration.
- [ ] Android 13+: push token registers (check a `push_tokens` row appears) and notifications
      show under a "Reminders & reports" channel in system settings.

## Offline & error states (D2)

Route-by-route audit, 2026-07-13.

**The systemic defect.** Every query-driven route handled `isLoading` (skeleton) and rendered an
`EmptyState` when the data array came back empty — and *nothing* handled query failure. A failed
fetch produces no data, so every screen fell straight through to its empty state: a user with a
full shelf and twenty scans, on a dropped connection, was told "Your shelf is empty" and "No scans
yet". A network failure was indistinguishable from having no data — and the empty states invite
the user to *act* ("Take your first scan"), so the app was actively encouraging people to
re-do work they had already done.

Fixed with a new `ErrorState` primitive (`components/ui/ErrorState.tsx`) — mascot, plain-language
title, retry button — wired into every route's render precedence, which is now
**loading → error → empty → data**. It deliberately does not print the underlying exception:
a Postgres or fetch message means nothing to the person reading it, and the retry is the useful
part. Routes covered: Home, Progress, Coach list, Learn, results, concern detail, forecast, report
list + detail, article, shelf (index/detail/budget/replenish/conflicts), routine, reactions, memory.

**Three flows called out in the plan, each verified by reading the code:**

1. **Mid-scan network drop — was broken.** `createScan` inserts a `pending` row *before* the
   upload and the AI call. Nothing cleaned it up when either threw, so a dropped connection left
   an orphaned pending scan in the user's history permanently. Now removed on failure, and the
   raw exception text is no longer shown to the user.
2. **Chat send failure — was broken, worse than the plan suspected.** The concern was a duplicate
   message on retry; the actual bug was *silent loss*. The draft was cleared on send, and the
   `finally` block invalidated the message list — which refetched from a server that had persisted
   nothing, wiping the optimistic bubble. The user's message vanished with no error anywhere. The
   text is now returned to the input and the failure is stated.
3. **Check-in tap failure — was already correct.** `useUpsertLifestyleLog` snapshots the cache in
   `onMutate`, restores it in `onError`, invalidates in `onSettled`. The rollback works. (It
   reverts silently, with no message — acceptable for a one-tap control, noted not fixed.)

**Foreground refresh.** React Query detects focus via a browser `visibilitychange` listener, which
does not exist in React Native — so its focus tracking was inert and `refetchOnWindowFocus: false`
was a setting that did nothing either way. `lib/query.ts` now feeds `focusManager` from `AppState`,
so stale data refreshes when the user returns to the app: the ordinary way a phone recovers from a
spell of no signal. Bounded by the existing 60s `staleTime`.

**Connectivity awareness (`onlineManager`) — resolved 2026-07-13 (owner: take it with `expo-network`).**
`onlineManager` is now fed from `expo-network` (`lib/query.ts`), so React Query knows when the
device drops off the network and, more importantly, when it comes back: `refetchOnReconnect`
heals a stale screen the instant signal returns, instead of waiting for the user to find the
retry button.

We deliberately **decline React Query's query-pausing** (`networkMode: 'always'` rather than the
default `'online'`). Pausing sounds like the offline-friendly choice and is a trap here: a paused
query reports neither `isLoading` nor `isError`, so every route's `loading → error → empty → data`
chain would fall through to the *empty* state and tell an offline user with a full shelf that
their shelf is empty — exactly the lie D2 removed. Pausing only pays off with an offline-aware UI
on ~15 routes plus a persisted mutation queue (an unpersisted paused mutation dies with the
process anyway); neither exists. Letting fetches fire and fail lands the user on the designed
`ErrorState` ("check your connection, try again"), which is the honest thing to show. Revisit if
we ever add mutation persistence.

⚠ `expo-network` is a **native module**: the next EAS build is mandatory before this reaches a
device. It ships alongside Sentry (E1), which needs a new build for the same reason.

## Crash reporting (E1 — Sentry)

Wired and inert until the owner supplies a DSN. `@sentry/react-native` initializes in
`_layout.tsx` via `lib/sentry.ts`; the root is wrapped in `Sentry.ErrorBoundary` with the
designed `CrashFallback` screen, so a render crash shows Glowi and a Restart button instead of
React Native's blank white screen. **The fallback works with or without a DSN** — reporting is
the optional half, not the recovery.

**Privacy posture (do not relax without re-reading `docs/legal/privacy-policy.md`).** Glowi
handles face photos, sleep and cycle data, so Sentry's defaults are wrong for us by
construction and are all off: `attachScreenshot: false` (a crash on the results screen would
otherwise ship a photo of the user's face to a third party), `attachViewHierarchy: false`,
`sendDefaultPii: false`, no session replay. Console and XHR breadcrumbs are dropped in
`beforeBreadcrumb` — they would carry chat text and scan payloads. The user is attached as an
opaque `id` only, never an email.

**Owner setup, in order:**

1. Create the Sentry project (platform: React Native) → copy the DSN.
2. Set `EXPO_PUBLIC_SENTRY_DSN` on the EAS **production** profile (it is a publishable value —
   a DSN only permits writing events).
3. For readable stack traces, add `SENTRY_ORG`, `SENTRY_PROJECT` and `SENTRY_AUTH_TOKEN` as EAS
   **secrets** (build-time only — never `EXPO_PUBLIC_*`, they must not reach the bundle). The
   `@sentry/react-native/expo` config plugin and `metro.config.js` upload source maps on build;
   without the token the build still succeeds and just warns.
4. Verify: production-profile build → force a crash → the event appears in Sentry with a
   readable stack, no screenshot attached, and no email on the user.

Edge functions deliberately have **no** Sentry — Supabase function logs plus the weekly log
review below are proportionate at this scale.

- [ ] Sentry project created, DSN + source-map secrets set on the EAS production profile.
- [ ] Forced test crash appears in Sentry with a readable stack and no PII.

## Product analytics (E2 — seam only, no provider)

Owner decision (2026-07-13): **instrument now, choose a vendor later.** `lib/analytics.ts`
carries seven events — `session_start`, `scan_completed`, `chat_message_sent`,
`checkin_logged`, `report_opened`, `replenishment_viewed`, `upgrade_completed` — and no sink.
Nothing is sent anywhere today: no dependency, no network call, no bundle weight. The
expensive half (instrumenting seven flows across a shipped app) is done; the cheap half
(installing a provider) is one `AnalyticsSink` implementation away.

**No store-form or policy change is needed while the sink is unset** — the app collects
nothing. The Apple/Play matrices below stay as they are.

**If a provider is later installed** (PostHog remains the recommendation), all three of these
must happen together, or we would be collecting data we never disclosed:

- [ ] Implement `AnalyticsSink` and call `setAnalyticsSink` once at startup.
- [ ] Update the privacy policy (`lib/legal.ts`) to name the vendor and bump `LEGAL_UPDATED`.
- [ ] Add _Diagnostics → Product Interaction_ to the Apple privacy labels and the Play Data
      Safety form.

Events carry **no properties, by type** — an `AnalyticsEvent` is a bare string from a closed
union, so there is no parameter through which a scan score, chat message or sleep value could
reach a vendor, by accident or by a later edit. A future dimension is a *new event name*, never
a payload. The Profile → "Share usage analytics" opt-out is enforced at one choke point in
`track()`, so it silences every event, including ones added after this was written.

## Tests (E4) and E2E (E5)

**Every push runs** (`.github/workflows/ci.yml`): mobile typecheck · lint · `format:check` ·
205 Jest tests; edge functions `deno check` · 37 `deno test`s. Don't push red.

The Jest suite now includes component tests (React Native Testing Library) for the four
flows whose failures would be silent: sign-up validation, the check-in card's optimistic
upsert **and its rollback**, chat send **restoring the draft when it fails**, and the
replenish route's `loading → error → empty → data` precedence. They mock Supabase at the
client boundary (`src/test/supabaseMock.ts`) so React Query, the mutation lifecycle and
`api.ts` all execute for real — mocking `hooks.ts` instead would stub out the exact code
those bugs lived in.

**E2E (Maestro) is manual-dispatch only** — `.github/workflows/e2e.yml`, or
`maestro test .maestro/` locally against a mock-mode dev build. Four flows:
guest→scan, **guest→upgrade→data survives** (the B1 regression test), check-in
persistence, chat send.

- [ ] ⚠️ **Run the Maestro suite green at least once.** The flows are written but have
      **never been executed** — they need the pending EAS build (see below). Expect to fix
      selectors on the first run; that is the flows doing their job. E5 is not done until
      this box is ticked.
- [ ] Run it again before each release build, and after anything touching auth, scan or chat.

## Performance (E6)

See [PERFORMANCE.md](PERFORMANCE.md). Baseline: **8.6 MB** Android JS bundle. One unused font
face was removed from the cold-start critical path. The on-device half (frame cost, real
cold-start numbers, scroll jank on a mid-tier Android) is **deferred to the next build**, and
one real problem is knowingly open: **every list route fetches the user's entire history and
mounts all of it** — invisible today, a support ticket in two years. It needs a pagination
decision, not a mechanical edit.

- [ ] Profile on a mid-tier Android once a build exists; then plan the list-virtualization fix.

## Release-candidate gate (G1) — ran 2026-07-16, all engineering checks green

The final pre-launch review (`polish_product.md` task G1) ran against `main` with a
clean tree. **`v1.0.0` tags this engineering-complete release candidate**; the launch
checklist below gates *store submission and public launch*, not the tag — its open
items all need owner credentials or a physical device.

- **Supabase advisors** — clean except the two documented acceptances:
  `rate_limit_events` RLS-enabled-no-policy (INFO; deliberate — the table is written
  only by the SECURITY DEFINER `check_rate_limit` RPC and read by nobody else), and
  the HIBP leaked-password WARN (owner-gated toggle, below). Performance advisor
  shows only INFO `unused_index` rows — the A3/0026 covering indexes, unused because
  production traffic is near zero.
- **Quality gate** — typecheck, lint, `format:check`, 205 Jest tests (24 suites),
  `deno check` over all 14 functions + 12 shared modules, 37 Deno tests: all green.
- **Security review of the release diff** (`47be17f..HEAD`, the ~60 polish commits) —
  no findings. Verified: `auth-signup` upgrade mode derives its target from the
  caller's JWT only and refuses non-guests; `delete-account` fails closed on partial
  storage deletion; `cleanup-guests` authenticates timing-safely and skips (never
  orphans) on storage failure; `email_taken` is service-role-only (no enumeration
  oracle); all 10 AI functions rate-limit after their cache checks; prompt fencing
  (`<user_context>`/`<week_facts>`, ADR-0020) present in all five prompt-assembling
  functions; auth-gate exemptions expose only static legal pages and the recovery
  landing; no secrets in the diff.
- **Live production checks** — `glowi-push-glow-report` and `glowi-push-scan-nudge`
  crons both succeeded on their latest runs; `glowi-cleanup-guests` (monthly, first
  run Aug 1) verified end-to-end via a dry-run through the real cron path
  (`net.http_post` + Vault secret → 200, `{"dryRun":true,"count":0}`); the rate
  limiter is writing live events (`skin-forecast`, `signup` buckets).

## Launch checklist (gates store submission — owner items)

- [ ] **New EAS build cut** — `expo-network` (connectivity) and `@sentry/react-native` (crash
      reporting) are native modules; neither reaches a device on the existing build. **The
      Maestro suite and the on-device perf pass both block on this.**
- [ ] **HIBP leaked-password protection ON** (Auth → Sign In / Providers → password) —
      owner-deferred 2026-07-11; security advisor WARN until done.
- [ ] **`glowi://reset-password` in Auth → URL Configuration → Redirect URLs** — the
      reset deep link falls back to the Site URL without it.
- [ ] **Custom SMTP (Resend)** once a domain exists — see ARCHITECTURE → Auth
      operations. Until then auth email rides the built-in sender (few emails/hour).
- [ ] **`GLOWI_ALLOWED_ORIGINS` set to the production web origin** (closes A4; the
      wildcard fallback is a dev convenience only).
- [ ] **Password-reset loop verified on a physical device** (request → email → tap →
      new password works).
- [ ] Legal copy (privacy/terms) owner-approved and `LEGAL_UPDATED` bumped.
- [ ] Medical-disclaimer copy (results notice + chat line) owner-approved.
- [ ] Production builds smoke-tested on device (Android APK/AAB installed; iOS via
      TestFlight).
- [x] Push cron verified 2026-07-16 (`cron.job_run_details`: both push jobs succeeded
      on their latest runs; `cleanup-guests` hasn't had its first monthly firing yet —
      Aug 1 — but its full cron path returned 200 on a dry-run invocation).
- [ ] Store forms filled from the matrices below; screenshots uploaded.
- [x] Supabase advisors clean except documented acceptances (verified 2026-07-16 — see
      the G1 gate record above).

## Store submission (C2)

Matrices below are derived from the Privacy Policy data inventory (`mobile/src/lib/legal.ts`)
and the actual manifest permissions (`app.json`: iOS camera + photo-library + HealthKit sleep;
Android `CAMERA` + `health.READ_SLEEP`). **Nothing is used for tracking or advertising; no data
is sold; Anthropic is a subprocessor (processing, not "sharing").** Answer the store forms
exactly as tabulated; if you change what the app collects, update `legal.ts` **and** these tables
together.

### Apple — App Privacy (App Store Connect → App Privacy)

Top-level: **"Data Not Used to Track You"** (no ATT prompt needed). Every type below is
**linked to the user's identity** (account-scoped) and used only for **App Functionality**
(none for Tracking, Analytics, or Advertising — E2 shipped the analytics *seam* with no provider
installed, so nothing is collected; see the E2 section for what to change if one is added).

| Apple data type                   | Specific data                                                                                        | Collected                      | Purpose           | Notes                                                      |
| --------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------ | ----------------- | ---------------------------------------------------------- |
| Contact Info → Email Address      | Account email                                                                                        | Yes (email accounts only)      | App Functionality | Guests have no email                                       |
| Health & Fitness → Health         | Sleep hours (opt-in), cycle phase (opt-in, sensitive), lifestyle logs, skin analysis scores/concerns | Yes                            | App Functionality | Health read-only from HealthKit; user confirms before save |
| User Content → Photos or Videos   | Skin scan + product photos                                                                           | Yes                            | App Functionality | Private per-user bucket; sent to Anthropic for analysis    |
| User Content → Other User Content | Chat messages, AI memories, reactions/symptoms, shelf products, routines                             | Yes                            | App Functionality | User can view/delete memories in-app                       |
| Location → Coarse Location        | City-level label + coordinates for Skin Weather                                                      | Yes (opt-in)                   | App Functionality | No precise/background location                             |
| Identifiers → Device ID           | Expo push token                                                                                      | Yes (if notifications allowed) | App Functionality | Delivering scheduled nudges                                |

IP address is processed **transiently for signup rate-limiting and deleted within 1 day**; it is
not linked to a stored profile — declared under abuse-prevention in the policy, not a persistent
collection. Crash reporting (E1/Sentry) is **not yet enabled**; when it ships, add
_Diagnostics → Crash Data_ (no email, no photos) and re-review this table.

`ITSAppUsesNonExemptEncryption: false` is set in `app.json` (standard HTTPS only) — the
export-compliance questionnaire is auto-answered.

### Google Play — Data Safety form

**Data shared with third parties: None** (Anthropic acts as a service provider on Glowi's
behalf → Play's processor exemption; still disclosed in the Privacy Policy). **Security:**
encrypted in transit = **Yes**; users can request deletion = **Yes** (Profile → Delete account,
in-app). Data collection is **required** only for core content (photos); opt-in categories are
**optional**.

| Play category       | Data type                                            | Collected            | Optional?                  | Purpose                                  |
| ------------------- | ---------------------------------------------------- | -------------------- | -------------------------- | ---------------------------------------- |
| Personal info       | Email address                                        | Yes (email accounts) | Optional (guest avoids it) | Account management, App functionality    |
| Photos and videos   | Photos                                               | Yes                  | Required for scans         | App functionality                        |
| Health and fitness  | Health info (sleep, cycle, lifestyle, skin analysis) | Yes                  | Optional                   | App functionality                        |
| Messages            | Other in-app messages (coach chat)                   | Yes                  | Optional                   | App functionality                        |
| Location            | Approximate location                                 | Yes                  | Optional                   | App functionality                        |
| Device or other IDs | Push token; IP (transient, rate-limit)               | Yes                  | Optional                   | App functionality; Fraud prevention (IP) |

**Health Connect declaration (required for `READ_SLEEP`):** in Play Console → App content →
Health apps declaration, declare sleep read access, its in-app purpose (pre-fill the daily
check-in), and provide the hosted **Privacy Policy URL** (the web export's `/legal/privacy`).
Without this declaration the `health.READ_SLEEP` permission is rejected at review.

### App Review notes (paste into both consoles' review-notes field)

- **What it is:** AI-assisted skincare _coaching for cosmetic and wellness purposes only_. It
  describes the visible appearance of skin and suggests routines/products. **It does not
  diagnose, treat, or cure** — the in-app medical disclaimer (D5) states this on first scan
  results and in chat. This is important for both stores' health-app policies.
- **Reviewer account:** seed a demo account and paste credentials here. Guest mode ("Continue as
  guest") also gives full access with no email if the reviewer prefers.
- **Reviewing a scan without a real face:** the scan flow accepts a **library photo** (tap
  "Upload photo" instead of the camera); any clear photo of skin returns a result. On web the
  camera route degrades to a picker automatically.
- **AI backend:** photos and chat are processed by Anthropic (subprocessor); not used for
  training; API keys are server-side only.

### Screenshots & store assets checklist (owner)

- [ ] iPhone 6.9" (required) and 6.5" screenshot sets — Home (Skin Weather + check-in),
      scan results, chat coach, progress/before-after, shelf. Capture in **mock mode** for clean
      deterministic content (`EXPO_PUBLIC_AI_MODE=mock`).
- [ ] Android phone screenshots (same five screens).
- [ ] Feature graphic (Play, 1024×500), app icon already generated (`npm run assets`).
- [ ] Short + full store descriptions (draft in a follow-up; lead with "AI skincare coach,
      cosmetic guidance not medical").
- [ ] `eas.json` `submit.production` filled with App Store Connect app ID + Play service-account
      JSON (owner credentials) — then `eas submit -p <platform> --latest`.
