# ADR 0018: Abandoned-guest cleanup with a 90-day retention window

- Status: Accepted
- Date: 2026-07-11

## Context

Guest mode (ADR-0002) creates a **real, permanent auth user** on every "Continue as
guest" tap — pre-confirmed email, random password, private storage prefix. That is what
makes guest data survive app restarts and upgrade cleanly to a full account (B1 of the
production-polish plan). The cost: a guest who signs out, or simply never returns, leaves
an auth user, its RLS-owned rows, and any face photos behind **forever**. Nothing in the
system ever reclaimed them. With signup rate-limited at 10/hour/IP the growth is bounded
but monotonic, and face photos of people who abandoned the product are exactly the data a
privacy-respecting app should not hoard.

## Decision

**A `cleanup-guests` edge function swept monthly by pg_cron** (migration
`0023_guest_cleanup_cron.sql`, 04:00 UTC on the 1st), authenticated exactly like
`push-dispatch`: `verify_jwt` off, `x-push-secret` header checked (timing-safe) against
`PUSH_DISPATCH_SECRET`, with the same Vault entry (`push_dispatch_secret`) supplying the
value at fire time. One cron identity, deliberately — a second secret would double the
rotation surface for no isolation gain, since both functions are service-role anyway.

**Abandoned = `profiles.is_guest` and no activity for 90 days.** `profiles.updated_at`
is the cheap prefilter (indexed PK join, no scans of large tables); users passing it are
then *rescued* if they have scans, chat messages, or lifestyle logs newer than the
cutoff. 90 days is deliberately generous: a seasonal user who checks their skin quarterly
survives; someone who tried the app once at a party does not. Full accounts are never
touched regardless of inactivity.

**Deletion order: storage first, then `auth.admin.deleteUser`.** FK cascades from
`auth.users` clear all 17 user tables (verified against `pg_constraint`, not just the
migration files), but bucket objects have no FK — deleting the auth user first would
orphan the photos permanently (Supabase blocks direct SQL deletes on `storage.objects`).
If storage removal fails, the user is skipped and retried next month.

**Capped at 50 deletions per run** so a large backlog drains gradually instead of
hammering the auth admin API, and **`{"dryRun": true}`** reports the would-be targets
without touching anything — the production rollout ran it first.

## Rejected alternatives

- **Cleaning up on sign-out.** Punishes the legitimate guest flow — sign-out must remain
  reversible via the SecureStore credentials until the retention window truly expires.
- **A shorter window (30 days).** Saves little storage, risks deleting a slow-cadence
  user's scans. Skin progress is inherently a months-scale product.
- **Postgres-only deletion (SQL cron job, no edge function).** Cannot delete storage
  objects (API-only) and cannot call `auth.admin.deleteUser`; an edge function is the
  only place both capabilities meet.
- **A dedicated secret for this function.** More rotation surface, zero added isolation.

## Verification

Dry run against production listed only guests inactive 90+ days (output in the PR). A
seeded guest with a backdated profile and an uploaded storage object was fully removed —
auth user, all rows, storage object — while a freshly created guest in the same run was
untouched. `cron.job` shows `glowi-cleanup-guests`.

## Consequences

- Guest storage and auth growth is now bounded; the privacy story ("we don't keep
  abandoned face photos") is real and documented for the C1 privacy policy.
- A returning guest whose account was reclaimed after 90+ days of absence gets a fresh
  guest account; their old data is gone by design. The upgrade screen's pitch ("create an
  account to keep your progress") is the mitigation.
- The retention window is a product commitment: C1's privacy policy must state it, and
  changing it means updating both the constant and the policy.
