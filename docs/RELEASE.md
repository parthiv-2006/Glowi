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

## Store submission

Filled by task C2 — data-safety matrices, review notes, and screenshots checklist.
