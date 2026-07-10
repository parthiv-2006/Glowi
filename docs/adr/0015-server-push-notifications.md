# ADR 0015: Server-triggered push notifications via pg_cron + pg_net

- Status: Accepted
- Date: 2026-07-10

## Context

Every notification Glowi sends today is a **local** schedule (`expo-notifications`
identifiers `glowi-routine-am/pm`, `glowi-weekly-scan`, `glowi-glow-report`), which means
nothing can reach a user who stopped opening the app — precisely the user a retention
feature needs to reach. ARCHITECTURE.md deferred server push in v1 partly because the
project had no server-side scheduler and adding external cron infrastructure felt heavy.

That premise no longer holds: Supabase ships `pg_cron` (schedules inside Postgres) and
`pg_net` (async HTTP from Postgres), so "server cron" is one migration, not new infra.

## Decision

**A `push_tokens` table, one row per device token** (migration `0017_push_tokens.sql`):
`token text UNIQUE`, `platform ios|android`, standard `crud_own` RLS, `set_updated_at`
trigger. The client registers on sign-in (`registerPushToken` in `lib/notifications.ts`,
called from a `usePushRegistration` hook in the root layout): permission → Expo push token
(`getExpoPushTokenAsync` with the EAS `projectId`) → upsert keyed on the token. Web,
simulators, denied permission, and Expo Go (no remote push since SDK 53) all return
`false` and change nothing.

**A `push-dispatch` edge function, authenticated by shared secret, not JWT.** There is no
user in a cron tick, so `verify_jwt` is off and the function instead requires an
`x-push-secret` header matching its `PUSH_DISPATCH_SECRET` secret. The same value is
stored in **Vault** under `push_dispatch_secret` — inserted operationally, never
committed — and read by the cron jobs at fire time, so no credential ever appears in a
migration file or `cron.job` row. Without the header the function 401s; the anon key alone
cannot trigger a send, closing the notification-spam hole an anon-callable dispatcher
would open.

**Two pg_cron schedules** (migration `0018_push_cron.sql`), both `net.http_post` calls:

- `glowi-push-glow-report`, Mondays 13:00 UTC — "Your Glow Report is ready ✨" to every
  registered device, deep-linking to the `/report` marker the tap listener already
  resolves. **Generation stays lazy**: the push is only the doorbell; the one Claude call
  still happens when the user opens the report, so lapsed users cost zero tokens
  (preserving the ADR-0014 cost model — pre-generating for all users was rejected).
- `glowi-push-scan-nudge`, Wednesdays 17:00 UTC — users whose most recent completed scan
  is 14+ days old. Never-scanned users are excluded (a nudge about a habit they haven't
  started reads as spam). The weekly cadence doubles as dedup — no send-log table.

**Expo's push API is the transport.** Batches of ≤100, no key needed (the token itself is
the credential). `DeviceNotRegistered` tickets delete their token row, so the table
self-prunes as devices churn.

**Local/server handoff.** When registration succeeds the device cancels its local
`glowi-weekly-scan` and `glowi-glow-report` schedules and sets a persisted
`pushRegistered` flag that stops `scan/analyzing.tsx` from rescheduling them — a
push-registered device never gets both the server ping and its local twin. Routine AM/PM
reminders stay local: they are time-of-day preferences, not server events. Devices where
push fails keep the local reminders unchanged, so nothing regresses in Expo Go or on web.

## Rejected alternatives

- **Pre-generating every user's report before pushing.** Instant opens, but pays one
  Claude call per user per week whether they return or not — inverts the lazy-cache cost
  model for marginal UX.
- **External scheduler (GitHub Actions cron, EAS cron, a worker).** New credentials, a new
  deploy surface, and another thing to monitor, when the database already has a scheduler
  co-located with the data it queries.
- **`verify_jwt` on + anon-key cron calls.** The anon key is public by design; anyone
  holding it could fire arbitrary pushes at every user. A dedicated secret in Vault keeps
  dispatch server-only.
- **FCM/APNs directly.** Real key management on two platforms for no gain at this scale;
  Expo's service is the platform-blessed path for an Expo app.

## Verification

Quality gate green (tsc strict, eslint, 150 jest tests). Migrations applied to
`rfuuznnbctfyqttslrbv`; `cron.job` shows both schedules; the deployed function 401s
without the secret, and with it returns `{sent: 0}` (no tokens yet) for both kinds and
400s on an unknown kind. **Deferred device checks (no device in this environment):** a
real token registration from the EAS build, an end-to-end push receipt, and the
local-reminder handoff — the dev/preview APK is the acceptance vehicle, since remote push
does not work in Expo Go.

## Consequences

- Lapsed users can be reached for the first time; the Glow Report gains a true weekly
  delivery moment even when the app is closed.
- The project now runs scheduled jobs. `cron.job_run_details` is the audit trail; a
  failing schedule is invisible to users, so check it when pushes seem silent.
- The shared secret must exist in two places (Vault + function secret). Rotating it means
  updating both; losing the Vault row silently disables dispatch (the cron call 401s).
- Push token rows are user data: RLS-scoped like everything else and cascade-deleted with
  the account.
