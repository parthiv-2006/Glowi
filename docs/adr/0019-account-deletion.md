# ADR 0019: In-app account deletion

- Status: Accepted
- Date: 2026-07-11

## Context

Nothing in Glowi could erase an account — only `signOut` existed. Apple App Store
Guideline 5.1.1(v) makes in-app account deletion a hard submission requirement for apps
with account creation, and GDPR/CCPA grant an erasure right. Glowi additionally holds
face photos and health-adjacent logs, so a credible erasure story is not optional.

## Decision

**A `delete-account` edge function authenticated by the caller's own JWT** (`verify_jwt`
on — this is a user action, not a cron job; contrast `cleanup-guests`, ADR-0018).
Erasure order mirrors the cleanup job for the same reasons: drain the user's
`scan-images/{id}/` prefix via the Storage API in pages first (bucket objects have no FK
and direct SQL deletes on storage tables are blocked), then `auth.admin.deleteUser` —
FK cascades from `auth.users` clear all 17 user tables, including `push_tokens`, so no
per-table deletes are needed. Any storage failure aborts with a retryable 500 before the
auth user is touched, so a half-completed deletion can always be re-run.

**Client side** (`deleteAccount` in `stores/auth.ts`): invoke the function, then the same
housekeeping as sign-out plus reminder hygiene — clear the SecureStore guest credentials,
cancel the four owned local notification identifiers (never `cancelAll`), local-scope
`signOut` (the server user no longer exists), and the Profile screen clears the React
Query cache so no stale data flashes for the next session. The auth gate lands on the
welcome screen.

**UI**: a destructive "Delete account" row in Profile behind a native confirm dialog
stating exactly what is lost ("scans, photos, chat history, and everything Glowi has
learned — cannot be undone"). Works identically for guests, which is their only erasure
path.

## Rejected alternatives

- **Client-side deletes table-by-table.** RLS lets a user delete their own rows, but not
  their auth user, and PostgREST can't touch storage reliably from a flaky mobile
  connection mid-way; a single server-side function is atomic-enough and retryable.
- **Soft delete / deactivation.** Doesn't satisfy Apple or GDPR erasure, and keeps face
  photos around — the exact liability deletion exists to remove.
- **Reusing `cleanup-guests` with a target parameter.** Mixing a cron-secret-authenticated
  mass job with a user-JWT single-account action doubles the blast radius of a bug in
  either; two small functions with different auth models are safer than one flexible one.

## Verification

A seeded account (scan row, chat session + message, shelf item, lifestyle log, uploaded
photo) deleted via the function with its own JWT: auth user gone, zero rows across user
tables, zero storage objects, push-token rows gone (service-role queries); the JWT is
rejected afterwards. Unauthenticated calls 401.

## Consequences

- Apple/GDPR deletion requirements are met and can be cited in the C1 privacy policy and
  C2 store review notes.
- Deletion is immediate and unrecoverable — no grace period. If support-driven recovery
  is ever wanted, it must become a soft-delete + delayed purge design (a deliberate
  future decision, not a tweak).
- The function shares the storage-first ordering invariant with `cleanup-guests`; any
  future bucket (e.g. avatars) must be added to **both** paths.
