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

**⚠ Owner decision — connectivity awareness (`onlineManager`).** React Query still believes the
device is *always online*. Queries therefore fail rather than pausing, mutations are never queued,
and there is no automatic refetch the instant connectivity returns. Wiring `onlineManager` properly
requires a connectivity source — `@react-native-community/netinfo` or `expo-network` — both of
which are **native modules and therefore force a new EAS build**. Not taken unilaterally so late in
the polish cycle. The error states above mean the app now degrades honestly without it; this would
make it degrade *gracefully*. Recommend taking it with the next EAS build.

- [ ] Decide on `onlineManager` + a connectivity dep (needs a new EAS build).

## Launch checklist (gates G1 — do not tag v1.0.0 until all checked)

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
- [ ] Push cron verified (`cron.job_run_details` shows recent successful runs for all
      three jobs).
- [ ] Store forms filled from the matrices below; screenshots uploaded.
- [ ] Supabase advisors clean except documented acceptances.

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
(none for Tracking, Analytics, or Advertising until E2 analytics ships).

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
