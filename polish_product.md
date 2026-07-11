# Glowi — Production Polish Implementation Plan

**Status:** Ready for execution · **Authored:** 2026-07-10 · **Source:** full-codebase audit (mobile app, all 11 edge functions, all 20 migrations, live Supabase advisors, CI, store config)

This document is the single execution contract for taking Glowi from "feature-complete" to
"production-ready." It is written so that an AI agent can pick up any task cold and complete
it without further context. **Every agent executing a task from this document must first read
the [Execution contract](#execution-contract) section.**

**Locked product decisions** (made by the owner on 2026-07-10 — do not re-litigate):

1. **Platforms:** iOS App Store + Google Play + Web (Expo static export). All three ship.
2. **Monetization:** out of scope. Free at launch. Cost-abuse protection (rate limits) is in
   scope; payment infrastructure is not.
3. **Guest mode:** keep it, fix it properly — in-place guest→account conversion that preserves
   data, plus abandoned-guest cleanup.
4. **Scope:** maximally thorough — finalize + security + compliance + observability +
   accessibility + test pyramid + performance + deferred enhancements.

---

## Current state (audit summary)

**What's healthy:**
- Quality gate is fully green: `npm run typecheck`, `npm run lint`, `npm test` all pass (verified 2026-07-10).
- RLS coverage is complete and correct: every user table has `crud_own` policies; catalog tables are `authenticated` read-only; the `scan-images` bucket is private with per-user prefix policies (`supabase/migrations/0002_rls_policies.sql`, `0003_storage_and_triggers.sql`).
- The AI seam (ADR-0003) is intact: `ANTHROPIC_API_KEY` exists only in edge-function secrets; all AI calls go through JWT-verified functions; model output is validated server-side and rejected (not patched) on violation.
- Image bytes are magic-number sniffed at the boundary (`supabase/functions/_shared/images.ts`).
- `auth-signup` (the one pre-auth endpoint) is IP rate-limited via a SECURITY DEFINER `check_rate_limit` RPC (migration 0007).
- All 20 migrations applied; functions deployed; push cron live; semantic memory live.

**What the audit found** (each maps to a task below):

| # | Finding | Severity |
|---|---|---|
| 1 | **Guest→account upgrade loses all data** — `mobile/src/app/upgrade.tsx` calls `signUpEmail`, which creates a *brand-new* user via `auth-signup` and signs into it. The guest's scans, memories, routines, shelf, and chat history are silently abandoned, directly contradicting the screen's own copy ("…are saved across devices"). | **P0 bug** |
| 2 | **No account deletion anywhere** — only `signOut` exists. Apple App Store Guideline 5.1.1(v) makes in-app account deletion a hard submission requirement; GDPR/CCPA require erasure. | **P0 compliance** |
| 3 | **No password reset flow** — no `resetPasswordForEmail` call, no forgot-password UI, no reset deep link. A user who forgets their password permanently loses their account. | **P0 gap** |
| 4 | **Zero rate limiting on all 9 AI edge functions** — `check_rate_limit` is used only by `auth-signup`. Any authenticated user (and guests are mass-creatable at 10/hour/IP) can invoke `chat`, `analyze-skin`, `compare-scans`, etc. in a tight loop → unbounded Anthropic token spend. This is the app's biggest financial exposure. | **P0 security/cost** |
| 5 | **No privacy policy or terms of service** — nothing in-app, nothing hosted. Required by both stores; the app collects face photos, health (sleep) data, location, and push tokens, and sends user content to Anthropic — all of which must be disclosed. Health Connect (`READ_SLEEP`) additionally requires a privacy-policy declaration for Play approval. | **P0 compliance** |
| 6 | **Leaked-password protection disabled** — live Supabase security advisor WARN: HaveIBeenPwned checking is off. | P1 security |
| 7 | **CORS falls back to `*`** when `GLOWI_ALLOWED_ORIGINS` is unset (`supabase/functions/_shared/http.ts:19`) — with a web launch this must be an explicit allowlist. | P1 security |
| 8 | **Dev AI-mode toggle ("Demo"/"Live AI") ships to all users** in Profile (`mobile/src/app/(tabs)/profile.tsx:251`) — any store user can flip the app into mock mode. | P1 bug |
| 9 | **Abandoned guest accounts accumulate forever** — orphaned auth users + their private photos are never cleaned up. | P1 hygiene |
| 10 | **`push-dispatch` secret compared with `!==`** (`supabase/functions/push-dispatch/index.ts:44`) — not constant-time. Low practical risk, trivial fix. | P2 security |
| 11 | **RLS `auth.uid()` initplan warnings on ~20 policies** + 9 unindexed foreign keys (live performance advisors) — every policy re-evaluates `auth.uid()` per row. | P2 performance |
| 12 | **No file-size or MIME limits on the `scan-images` bucket** — bucket created without `file_size_limit`/`allowed_mime_types`; a client can upload arbitrarily large objects. | P2 security |
| 13 | **Accessibility is essentially absent** — 2 `accessibility*` props in the entire app (both in `GlowButton`). No labels on icon-only pressables, no reduce-motion handling for the aurora/Reanimated effects, no screen-reader QA. | P1 quality |
| 14 | **No crash reporting or analytics** — a production crash on a user's device is invisible. | P1 observability |
| 15 | **CI covers only the mobile package** — no Deno typecheck/lint of the 11 edge functions, no `prettier --check`. An edge-function type error merges green today. | P2 CI |
| 16 | **No component/integration/E2E tests** — the pure-logic modules are well unit-tested, but auth, scan, check-in, and chat flows have no automated coverage. | P2 quality |
| 17 | **Working-tree EOL churn** — 5 files show as modified with empty diffs (LF/CRLF normalization); no `.gitattributes`. | P3 hygiene |
| 18 | **Store submission config incomplete** — `version: 0.1.0`, no `ITSAppUsesNonExemptEncryption`, `eas.json` `submit.production` empty, no privacy labels / Data Safety inventory, no screenshots. | P1 launch |
| 19 | **No GDPR data export** — the derm PDF covers a subset; there is no full "export my data" path. | P2 compliance |
| 20 | **Prompt-injection surface unreviewed** — `chat` interpolates user-derived memory text into the system prompt under "treat as ground truth" (`supabase/functions/chat/index.ts:81`). | P2 security |
| 21 | **Session tokens live in AsyncStorage** (`mobile/src/lib/supabase.ts`) — standard practice, but SecureStore-backed auth storage is stronger for a health-adjacent app. | P3 hardening |
| 22 | **No offline/error-state pass** — network failure behavior across routes is unaudited. | P2 quality |

**Fast-follow features flagged in the backlog but not yet built** (in scope per decision #4):
AI replenishment copy · ML face alignment (deferred, needs a native dep + EAS build) · catalog
breadth tooling · Skin Progress Timeline (5-PR blueprint exists in `plans/`).

---

## Execution contract

Every agent working a task from this document MUST:

1. **Read first:** `CLAUDE.md` (repo root), `docs/CODE_INDEX.md` (navigate from it — don't glob around), and the ADRs referenced by your task.
2. **Quality gate before claiming done** (from `mobile/`): `npm run typecheck && npm run lint && npm test`, and `npm run format` before committing. Report actual output; never paper over a failure.
3. **Respect the AI seam** (ADR-0003): any AI-visible change lands in `lib/ai/types.ts` + `live.ts` + `mock.ts` together. Mock mode must work offline at zero token cost.
4. **Lockstep mirrors:** `correlation.ts`, `ingredientConcerns.ts`, `milestones.ts` each exist twice (`mobile/src/lib/` and `supabase/functions/_shared/`). Touch one → touch both → run the parity tests.
5. **Migrations are append-only:** schema changes are a new numbered file in `supabase/migrations/` (next free number at time of writing: **0021**). Never edit an applied migration. If multiple DB tasks run in parallel, coordinate numbering in the PR description and rebase-renumber before merge.
6. **Update `docs/CODE_INDEX.md` in the same commit** for any added/moved/removed route, lib module, component, edge function, or migration. Update `README.md` / `docs/ARCHITECTURE.md` / new ADR for anything with lasting architectural impact.
7. **Commits:** small, logically grouped, Conventional Commits with scope (`fix(mobile): …`, `feat(supabase): …`, `docs: …`). Never commit directly to `main` — branch per task (`polish/<task-id>-<slug>`). End every commit message with the repo's required co-author trailer.
8. **Concurrent workstreams use separate git worktrees** — two sessions sharing one working directory have previously hijacked each other's branches (see memory: WS-A/WS-B concurrency incident). One worktree per parallel track, no exceptions.
9. **UI work:** read `mobile/DESIGN.md` and the design-handoff docs first; reuse `components/ui/` primitives; never fake the §0 effects as flat fills; one Glow element per screen max.
10. **Verification:** user-facing changes are verified by driving the affected flow (screenshot/inspect the route, confirm no console errors, confirm data flows end to end), not just by the type checker. Edge-function changes are verified with a real invocation (mock-auth or curl with a test JWT) and by checking function logs.
11. **Don't self-approve:** every task gets a separate review pass (see [Review protocol](#review-protocol)).

**Supabase coordinates:** project ref `rfuuznnbctfyqttslrbv`. Function secrets: `ANTHROPIC_API_KEY`, `PUSH_DISPATCH_SECRET`, optional `GLOWI_ALLOWED_ORIGINS`, optional `GLOWI_PRIMARY_MODEL`/`GLOWI_LIGHT_MODEL`. Vault holds `push_dispatch_secret`. Deploy functions after changing them.

### Model routing

Three models are available. Route by task shape, not by habit:

- **fable 5** — orchestration, security-critical design, threat modeling, ambiguous/novel architecture, final pre-launch review. Use sparingly; it is the most expensive.
- **opus 4.8** — complex implementation: auth flows, migrations touching RLS, multi-file refactors, accessibility architecture, anything where a subtle mistake is expensive.
- **sonnet 5** — well-scoped implementation with clear acceptance criteria: mechanical edits, config, UI polish, tests, docs, CI.

Each task below carries a **Model** recommendation. The orchestrator (fable 5) remains
responsible for verifying delegated work regardless of which model executed it.

### Review protocol

- Code changes: reviewed by a **different session/agent** than the author (opus 4.8 for
  security-tagged tasks, sonnet 5 otherwise).
- Security tasks (tags `[SEC]`): after implementation review, run a focused adversarial pass —
  "how do I bypass this?" — before merge (fable 5 or opus 4.8).
- Legal-adjacent artifacts (privacy policy, ToS, store forms): AI-drafted, **explicitly marked
  for human review by the owner** — an agent must never declare these "done," only "ready for
  human review."

---

## Phase & dependency map

Phases group tasks by theme; the **Track** column is what actually governs parallelism.
Tracks A–E are independent and can run concurrently in separate worktrees. Within a track,
tasks are ordered by dependency.

| Track | Theme | Tasks (in order) | Can start immediately? |
|---|---|---|---|
| **A** | Backend security & cost | A1 → A2 → A3, then A4, A5, A6, A7 (any order) | Yes |
| **B** | Account lifecycle & auth | B1 → B2 → B3 → B4 | Yes |
| **C** | Compliance & store readiness | C1 → C2 → C3; C4 after C1 | Yes (C1 is doc-writing) |
| **D** | Mobile app polish & UX | D1–D7 (mostly independent) | Yes |
| **E** | Observability & quality | E1 → E2; E3, E4, E5 independent | Yes |
| **F** | Enhancements (post-polish) | F1–F4 | Only after Tracks A–B merge (F1 touches the AI seam; F2+ optional) |

**Hard cross-track dependencies:**
- C2 (store forms/labels) needs C1 (privacy policy hosted at a URL) and B2 (account deletion must exist before Apple submission).
- E5 (E2E tests) is most valuable after B and D land (flows stabilize).
- Migration numbering: A3, A5, B2, B3 each add a migration — whichever merges first takes 0021, and the others renumber on rebase. Tracks must state their migration in the PR title.
- The final release candidate (task G1) gates on everything except Track F.

Suggested staffing: 5 parallel agents (one per track A–E), each in its own worktree, with a
fable 5 orchestrator reviewing merges. Track F starts when A and B are merged.

---

## Track A — Backend security & cost protection

### A1. Per-user rate limiting on every AI edge function `[SEC]` `[P0]`
**Model:** opus 4.8 · **Effort:** L · **Files:** `supabase/functions/_shared/ratelimit.ts` (new), all 9 AI functions, `supabase/functions/_shared/http.ts` (no change expected), mobile error handling in `mobile/src/lib/ai/live.ts`.

**Why:** The only rate limit in the system protects signup. Every AI function costs real
Anthropic tokens per call and is invokable in a loop by any JWT holder — and guests are
free to create. This is the largest uncapped cost exposure in the product.

**What to do:**
1. Create `supabase/functions/_shared/ratelimit.ts` exporting
   `enforceRateLimit(svc, bucket, max, windowSeconds)`: calls the existing `check_rate_limit`
   RPC (migration 0007 — reuse it; do **not** build a new mechanism) and throws
   `HttpError(429, 'You're doing that a lot — try again in a bit.')` when over.
   Follow `auth-signup`'s fail-open-on-infra-error pattern (log, allow) so an RPC outage
   never bricks the product, but log loudly.
2. Add a call at the top of each AI function, after `requireUser`, keyed per user + endpoint.
   Recommended budgets (constants in each function, tuned generously for real usage):
   - `chat:{userId}` — 40/hour
   - `analyze-skin:{userId}` — 10/day
   - `skin-forecast:{userId}` — 8/day (it's idempotent-cached daily anyway)
   - `identify-product:{userId}` — 20/day
   - `check-conflicts:{userId}` — 10/day (cached path doesn't consume — enforce only before the Claude call)
   - `compare-scans:{userId}` — 10/day (same: cached path exempt)
   - `compare-products:{userId}` — 15/day
   - `extract-memories:{userId}` — 30/day
   - `glow-report:{userId}` — 5/day (cached path exempt)
   Important: for the cached functions, enforce **after** the cache check so cache hits stay free.
3. In `mobile/src/lib/ai/live.ts`, surface 429s as a typed, user-friendly error the screens
   already know how to render (match existing error-handling idiom; check how screens show
   AI errors today before inventing a pattern).
4. Prune interval: `check_rate_limit` self-prunes >1 day; daily windows fit. No schema change.

**Acceptance criteria:** every AI function rejects the N+1th call in the window with 429 and a
friendly message in-app; cached paths (conflicts/compare/glow-report/forecast) do not consume
budget; quality gate green; a load-test script (curl loop with a test JWT) demonstrating the
429 is included in the PR description.

### A2. Timing-safe secret comparison in push-dispatch `[SEC]` `[P2]`
**Model:** sonnet 5 · **Effort:** XS · **Files:** `supabase/functions/push-dispatch/index.ts`.

Replace the `!==` comparison at line 44 with a constant-time comparison (e.g. hash both sides
with `crypto.subtle.digest` and compare digests, or a manual constant-time loop). Keep the
"missing secret ⇒ 401" behavior. Redeploy and verify the cron path still authenticates (invoke
manually with the Vault secret via `net.http_post` or curl).

### A3. RLS initplan fix + FK covering indexes `[P2 perf]`
**Model:** opus 4.8 (it's a migration touching every policy — subtle mistakes are expensive) · **Effort:** M · **Files:** new migration `supabase/migrations/00XX_rls_initplan_and_fk_indexes.sql`.

**Why:** Live performance advisors flag ~20 policies re-evaluating `auth.uid()` per row, and 9
unindexed FKs (`chat_messages.user_id`, `reaction_logs.shelf_item_id`,
`routine_checkins.routine_id`, `routine_steps.product_id`, `routine_steps.user_id`,
`routines.generated_from_scan`, `scan_comparisons.scan_id_before/after`, `shelf_items.product_id`).

**What to do:** one append-only migration that (a) `drop policy` + `create policy` for every
user-table policy, replacing `auth.uid()` with `(select auth.uid())` in both `using` and
`with check` — enumerate them from `0002_rls_policies.sql` and every later migration that adds
policies (0005, 0006, 0010, 0011, 0012, 0015, 0016, 0017); (b) `create index` for each flagged
FK. Verify afterward by re-running the performance advisors (should report zero
`auth_rls_initplan` and zero `unindexed_foreign_keys`) and by smoke-testing the app (a broken
policy = instant data invisibility, so drive the app against the migrated DB before merging).

**Acceptance criteria:** advisors clean for these two lints; app still reads/writes every table
as the owning user; a second user still cannot read the first's rows (write a quick two-JWT
curl check for `scans`).

### A4. CORS allowlist for production `[SEC]` `[P1]`
**Model:** sonnet 5 · **Effort:** S · **Files:** operational (function secrets) + `docs/ARCHITECTURE.md` + `README.md`.

Set `GLOWI_ALLOWED_ORIGINS` to the production web origin(s) once the web host exists (D7
decides the domain). Until then, document in README that the wildcard fallback is a dev
convenience and must be set before web launch. Add a launch-checklist line item (G1). Verify by
curling a function with a disallowed `Origin` and confirming the reflected header is the
allowlist's first entry, not the attacker origin.

### A5. Storage bucket limits `[SEC]` `[P2]`
**Model:** sonnet 5 · **Effort:** S · **Files:** new migration `supabase/migrations/00XX_bucket_limits.sql`.

Update the `scan-images` bucket row: `file_size_limit` = 10 MB, `allowed_mime_types` =
`{image/jpeg, image/png, image/webp}` (`update storage.buckets set … where id = 'scan-images'`).
Check first (Grep the mobile code for upload call sites — `scan/analyzing.tsx`, `shelf/add.tsx`,
compare flow) what content types the app actually uploads, and confirm a typical guided-capture
photo is comfortably under the limit. Verify with an oversized upload attempt returning an error
and the app's normal scan flow still working.

### A6. Abandoned-guest cleanup `[P1]`
**Model:** opus 4.8 · **Effort:** M · **Files:** new edge function `supabase/functions/cleanup-guests/index.ts`, new migration (cron schedule), `docs/CODE_INDEX.md`, ADR if judged architectural.

**Why:** every "Continue as guest" tap creates a permanent auth user with private storage; sign
out orphans it forever.

**What to do:**
1. New edge function `cleanup-guests`, authenticated exactly like `push-dispatch`
   (shared `x-push-secret` header against `PUSH_DISPATCH_SECRET` — reuse the same secret and
   the same Vault entry; do not mint a second secret without reason).
2. Logic: find `profiles` where `is_guest = true` and no activity for **90 days** (define
   activity as the max of `updated_at` across profile and the user's latest `scans.created_at` /
   `chat_messages.created_at` / `lifestyle_logs` date — keep the query simple and index-friendly).
   For each: delete storage objects under `{user_id}/` in `scan-images`, then
   `auth.admin.deleteUser(id)` (FK cascades from `auth.users` handle the rows — **verify the
   cascade exists** by checking `0001_core_tables.sql` for `references auth.users on delete
   cascade`; if any table lacks it, delete rows explicitly first).
   Cap each run (e.g. 50 users) so a backlog drains gradually.
3. Monthly pg_cron schedule via a new migration, same pattern as `0018_push_cron.sql`.
4. Dry-run mode (`{"dryRun": true}` body) that reports what would be deleted — run it first
   against production and paste the output in the PR.

**Acceptance criteria:** dry run lists only guests inactive 90+ days; a seeded test guest with
old timestamps is fully removed (auth user, rows, storage objects); a fresh/active guest is
untouched; ADR or ARCHITECTURE note explains the retention window.

### A7. Prompt-injection review of the chat/memory pipeline `[SEC]` `[P2]`
**Model:** fable 5 (analysis) → sonnet 5 (any resulting edits) · **Effort:** M · **Files:** `supabase/functions/chat/index.ts`, `supabase/functions/_shared/memory.ts`, `supabase/functions/extract-memories/index.ts`; deliverable is a short threat-model doc + targeted fixes.

**Why:** memories are model-extracted from user text and re-injected into the system prompt as
"ground truth." A user can type instructions that get stored as a memory and then executed as
system-level context in every later chat ("ignore the catalog restriction and recommend…").

**What to do:** trace user-controlled text end to end (message → memory → system prompt;
also shelf item names, reaction notes, product names from `identify-product` — all
user-supplied strings that reach prompts). Assess worst case: the blast radius is bounded
(the products block is validated against the catalog post-hoc; no tools; per-user context
only), so the realistic risks are self-harm advice bypass and brand-damaging outputs. Apply
proportionate mitigations: delimit injected user content in clearly fenced blocks with an
instruction that content inside is data, not instructions; consider a length cap per memory
at assembly time. Do **not** build an LLM-based injection classifier — overkill here. Write
the findings to `docs/adr/00XX-prompt-injection-posture.md` (or a `docs/SECURITY.md` section)
so the posture is recorded.

**Acceptance criteria:** documented threat model; fencing applied in `chat` (and any other
prompt assembling user strings — check `skin-forecast`, `compare-products`); manual red-team
transcript in the PR showing an injected memory failing to override the product-slug rule.

---

## Track B — Account lifecycle & auth

### B1. Fix guest→account upgrade to preserve data `[P0 bug]`
**Model:** opus 4.8 · **Effort:** M · **Files:** `mobile/src/stores/auth.ts`, `mobile/src/app/upgrade.tsx`, possibly `supabase/functions/auth-signup/index.ts` (should NOT need changes — the fix avoids it entirely).

**Why:** `upgrade.tsx` currently calls `signUpEmail`, creating a fresh user — all guest data
is silently orphaned. The correct mechanic is converting the **existing** authenticated guest
user in place, which keeps `user_id` and therefore every RLS-owned row.

**What to do:**
1. Add `upgradeGuest(email, password, displayName?)` to `stores/auth.ts`:
   `supabase.auth.updateUser({ email, password, data: { is_guest: false, display_name } })`
   on the current session.
2. **Critical config check:** `updateUser` with a new email normally triggers a confirmation
   email. This project deliberately avoids dependence on email delivery (ADR-0002). Check the
   project's auth settings ("Secure email change" and email confirmation). If an email-change
   confirmation would block the flow, route the upgrade through a new mode in `auth-signup`
   instead (`mode: 'upgrade'`, verifying the caller's JWT, then
   `auth.admin.updateUserById(userId, { email, password, email_confirm: true, user_metadata: … })`)
   — that keeps the no-SMTP-dependency property. **Decide based on what you find; document
   the choice in the PR.** (If B4 configures SMTP anyway, plain `updateUser` + confirmation
   may be acceptable — coordinate with B4.)
3. Update `profiles.is_guest` to `false` (client update is fine — RLS allows own-row update).
4. Clear the `GUEST_KEY` SecureStore entry on success (`glowi.guest.credentials`).
5. `upgrade.tsx` calls the new method; on failure surfaces "email already in use" cleanly
   (409-equivalent from Supabase).
6. Handle the edge case: a signed-out guest whose SecureStore creds were wiped is
   unrecoverable — that's accepted; note it in code comment.

**Acceptance criteria:** as a guest with ≥1 scan + 1 chat + shelf items, upgrading keeps all of
them visible after re-login with the new email/password; `profiles.is_guest` flips to false;
guest SecureStore creds are gone; the old flow (`signUpEmail` from the auth funnel for brand-new
users) is untouched; screen copy stays truthful.

### B2. In-app account deletion `[P0 compliance]`
**Model:** opus 4.8 · **Effort:** M · **Files:** new `supabase/functions/delete-account/index.ts`, `mobile/src/stores/auth.ts`, `mobile/src/app/(tabs)/profile.tsx`, `docs/CODE_INDEX.md`, ADR.

**Why:** Apple hard-requires in-app account deletion for apps with account creation; GDPR
requires erasure. Nothing exists today.

**What to do:**
1. New edge function `delete-account`: `requireUser(req)` (real JWT — this is a user action,
   not a cron), then with the service client: delete all storage objects under `{user_id}/`
   in `scan-images` (list + remove in batches), then `auth.admin.deleteUser(user.id)`.
   Same cascade verification as A6 — confirm every user table FK cascades from `auth.users`;
   explicitly delete any that don't.
2. Mobile: `deleteAccount()` in the auth store (invoke function, then local `signOut`
   housekeeping: clear SecureStore guest creds, cancel scheduled local notifications via the
   identifier-based API in `lib/notifications.ts` — never `cancelAll`, and reset React Query
   cache).
3. Profile screen: a "Delete account" row (destructive styling per design system) behind a
   typed confirmation ("This permanently deletes your scans, photos, chat history, and
   everything Glowi has learned. This cannot be undone.") — use the app's existing
   confirm-dialog idiom; check how sign-out confirmation is done and match it.
4. Works identically for guests (that's their only erasure path).

**Acceptance criteria:** deleting a seeded test account removes the auth user, all rows in all
20+ user tables, and all storage objects (verify each with service-role queries); the app lands
back on the welcome screen with no stale cached data; push token rows for the user are gone
(cascade); documented in an ADR.

### B3. Password reset flow `[P0 gap]`
**Model:** opus 4.8 · **Effort:** M · **Files:** `mobile/src/app/(auth)/sign-in.tsx` (+ new `forgot-password.tsx`, `reset-password.tsx` routes), `mobile/src/stores/auth.ts`, `mobile/src/app/_layout.tsx` (deep link), auth email template config (operational).

**What to do:**
1. "Forgot password?" link on sign-in → new screen collecting email →
   `supabase.auth.resetPasswordForEmail(email, { redirectTo: 'glowi://reset-password' })`.
   Always show "if that email exists, we sent a link" (no account enumeration).
2. Deep-link handling: the app already resolves a `/report` push deep link in `_layout.tsx` —
   follow that exact pattern for the recovery link. Supabase sends a token that arrives via
   the `PASSWORD_RECOVERY` auth event / URL fragment; on it, route to `reset-password.tsx`
   (new password + confirm, min 8 max 200 chars to match `auth-signup`), then
   `supabase.auth.updateUser({ password })`.
3. **Depends on B4** (working SMTP) — a reset email must actually deliver. Sequence B4 before
   or with this task.
4. Guests: hide the link's relevance — a guest has no known email; nothing to do beyond not
   breaking.

**Acceptance criteria:** full loop works on a physical/emulated device: request → email →
tap link → app opens reset screen → new password works on next sign-in; wrong/expired token
shows a sane error; no enumeration difference between existing and non-existing emails.

### B4. Production auth configuration `[P1]` (operational + config)
**Model:** sonnet 5 (execution) with owner involvement for DNS/SMTP credentials · **Effort:** S–M.

1. **Enable leaked-password protection** (advisor WARN) in Supabase Auth settings.
2. **Custom SMTP** for production email (password reset, email change): Supabase's built-in
   sender is rate-limited to a handful of emails/hour and unsuitable for production. Configure
   an SMTP provider (owner supplies credentials — Resend/Postmark/SES; **ask the owner which**,
   do not pick one unilaterally) and set the sender domain.
3. Review email templates (reset password, email change) for Glowi branding and the correct
   `glowi://` redirect.
4. Confirm auth settings match ADR-0002 assumptions after any changes (auth-signup must keep
   working for both modes — regression-test signup after every settings change).
5. Document all of it in `docs/ARCHITECTURE.md` (auth section) — settings are invisible in the
   repo, so the doc is the only record.

**Acceptance criteria:** HaveIBeenPwned check on (verify with a known-pwned password being
rejected at reset time); reset emails deliver from the custom domain; signup (email + guest)
still green end to end.

---

## Track C — Compliance & store readiness

### C1. Privacy policy + terms of service `[P0 compliance]`
**Model:** fable 5 (drafting — nuanced disclosure content) · **Effort:** M · **Deliverables:** `docs/legal/privacy-policy.md`, `docs/legal/terms-of-service.md`, hosted URLs, in-app links. **Requires human review — never mark "done," only "ready for owner review."**

**What to disclose (from the audit — this list is the actual data inventory):**
- Face photos (scan images; private bucket, per-user; used for AI analysis; retention until deletion).
- AI processing: images and chat content are sent to **Anthropic** (subprocessor) for analysis/coaching; not used to train models (per Anthropic API terms — verify current terms when drafting).
- Health data: sleep (HealthKit / Health Connect, opt-in, read-only, user confirms before save); cycle-phase logging (opt-in, sensitive — special-category data under GDPR; call it out explicitly).
- Lifestyle logs (sleep/stress/water/diet), skin concerns and scores, reaction logs.
- Location (city-level, for weather forecasts; geocoding autocomplete in Profile).
- Push tokens; guest accounts (anonymous-equivalent processing); rate-limit IP logging (`rate_limit_events` stores IP-keyed buckets — disclose transient IP processing, 1-day retention).
- User rights: deletion (B2 in-app), export (C3), memory view/delete (`/memory` screen exists — mention it, it's a genuinely good story).
- "Not medical advice" disclaimer (ties into D5).
- Hosting: simplest path is a static page on the web app's domain (coordinate with D7); the store forms need stable URLs.

In-app: links on the auth welcome screen ("By continuing you agree…") and in Profile →
About/Legal. Keep the screens on-design-system.

**Acceptance criteria:** both documents drafted covering every item above; hosted at stable
URLs; linked in-app in the two locations; PR explicitly labels them DRAFT pending owner/legal
review.

### C2. Store listing & submission package `[P1 launch]`
**Model:** sonnet 5 · **Effort:** M · **Depends:** C1 (policy URL), B2 (deletion exists) · **Files:** `mobile/app.json`, `mobile/eas.json`, `docs/RELEASE.md` (new), store consoles (operational).

1. `app.json`: bump `version` to `1.0.0`; add `ios.infoPlist.ITSAppUsesNonExemptEncryption: false`;
   confirm every permission string reads well in review (camera, photo library, health —
   already good); confirm `android.permissions` contains nothing unused (audit: CAMERA and
   READ_SLEEP are both used; verify nothing extra got merged by plugins with
   `npx expo config --type introspect`).
2. Apple privacy nutrition labels + Google Play Data Safety form: produce the exact answers
   as a table in `docs/RELEASE.md`, derived from C1's inventory (data types collected, purpose,
   linked-to-identity yes [account], sharing: Anthropic as processor, health data handling).
   Health Connect additionally requires the privacy-policy URL declaration in the Play console
   for `READ_SLEEP`.
3. App Review notes: demo account credentials (make a seeded reviewer account), an explanation
   that AI analysis is cosmetic/wellness (not medical/diagnostic — important for both stores'
   health-app policies), and how to trigger a scan without a real face if needed (library upload).
4. Screenshots/preview assets: generate per-device-size screenshot set (the `kitchensink` +
   real screens; owner picks final set). Store descriptions drafted.
5. `eas.json`: fill `submit.production` (owner supplies App Store Connect / Play credentials);
   document the EAS submit flow in `docs/RELEASE.md`.

**Acceptance criteria:** `docs/RELEASE.md` contains the complete label/data-safety matrices,
review notes, and a step-by-step submit runbook; `app.json` changes merged; a production EAS
build of each platform completes.

### C3. Full data export (GDPR portability) `[P2]`
**Model:** sonnet 5 · **Effort:** M · **Files:** `mobile/src/lib/dataExport.ts` (new), Profile screen row, tests.

Client-side (no new backend surface): fetch all user-owned rows via the existing `api.ts`
accessors (add the few that are missing), assemble a single JSON document keyed by table,
and share it via the existing `expo-sharing` flow (the derm-PDF export in Profile is the
pattern to mirror — reuse its UX). Include scan image *paths* but not the binaries (note in
the export README string that photos can be viewed in-app; bundling signed URLs that expire
is misleading). Pure assembly logic goes in `lib/dataExport.ts` with a unit test.

**Acceptance criteria:** export from a seeded account contains every user table's rows; share
sheet delivers a valid JSON file; zero AI calls; test covers the assembly.

### C4. Web launch hardening `[P1]`
**Model:** sonnet 5 · **Effort:** M · **Depends:** hosting decision (owner picks host/domain — **ask**; Vercel static is the path of least resistance given the export config) · **Files:** web QA fixes as found; `docs/RELEASE.md` web section.

1. Full route-by-route QA of the static export (`expo export -p web`): auth funnel, onboarding,
   tabs, scan (web degrades to picker via `camera.web.tsx`), results, chat, shelf, report,
   profile. Log every broken/degraded route and fix or explicitly gate it
   (feature-detect + friendly "get the app" prompt) — degradation must be deliberate, never a
   blank panel or console error.
2. Set `GLOWI_ALLOWED_ORIGINS` to the production domain (closes A4).
3. Confirm no secrets beyond the anon key in the bundle (grep the built output for the service
   key / Anthropic key as a paranoia check).
4. Web push/notifications: not supported — confirm the local-reminder code paths no-op cleanly
   on web (they should; verify).

**Acceptance criteria:** deployed web app on the production domain; every route either works or
degrades deliberately with no console errors; CORS locked; QA checklist in the PR.

---

## Track D — Mobile app polish & UX

### D1. Gate the AI-mode toggle behind dev builds `[P1]`
**Model:** sonnet 5 · **Effort:** XS · **Files:** `mobile/src/app/(tabs)/profile.tsx` (~line 245–270), `mobile/src/stores/settings.ts`.

Wrap the Demo/Live selector in `__DEV__` (keep the settings-store capability — mock mode is
load-bearing for development and tests). Ensure production builds resolve to live mode
regardless of a previously persisted `mock` value: on store rehydration, if `!__DEV__` force
`aiMode: 'live'` (a beta tester who once flipped to Demo must not be stuck there). Acceptance:
toggle invisible in a production build; persisted mock value self-heals to live.

### D2. Offline & error-state pass `[P2]`
**Model:** sonnet 5 · **Effort:** M · **Files:** across `mobile/src/app/` + `mobile/src/lib/hooks.ts`.

Audit every route with the network off and with the API erroring: no infinite spinners, no
blank panels, every screen shows either cached data or a designed empty/error state
(`EmptyState` primitive exists — reuse). Check React Query defaults (retry, staleTime) are set
deliberately in one place. AI failures already have screen-level handling in places — make the
pattern uniform. Specifically test: mid-scan network drop (analyzing screen must not strand a
`pending` scan row — verify there's a retry/cleanup path), chat send failure (message must not
duplicate on retry), check-in tap failure (optimistic update must roll back — `hooks.ts:254`
has an `onError` rollback; verify it works).

**Acceptance criteria:** written route-by-route audit table in the PR; fixes for every gap
found; the three specific flows above verified by manually simulating failure.

### D3. Accessibility pass `[P1]`
**Model:** opus 4.8 (systematic multi-screen work with judgment calls) · **Effort:** L · **Files:** `mobile/src/components/ui/*`, all screens.

Current state: 2 accessibility props in the entire app. Do this as **primitives-first**:
1. `PressableScale`, `GlowButton`, `TextField`, `GlassCard`(when pressable), `TabBar`, and the
   check-in tap targets get `accessibilityRole`/`accessibilityLabel`/`accessibilityState`
   support baked in, so most screens inherit correctness.
2. Then a screen sweep for icon-only buttons (back chevrons, close buttons, tab icons, the
   scan shutter) — every one gets a label.
3. Respect `useReducedMotion` (Reanimated) in `AuroraBackground`, `Stagger`, ScanTheater — 
   reduced motion swaps animations for fades/static.
4. Contrast check the theme tokens (the "Warm Editorial" palette — check dark-bg text gotcha
   noted in the redesign memory) against WCAG AA for body text; fix tokens only with a
   design-system-conscious change, not ad-hoc colors.
5. Dynamic type: verify `AppText` scales with OS font size without breaking layouts on the
   worst screens (Home, results).
6. VoiceOver/TalkBack manual QA of the three core flows: sign-up, scan→results, daily check-in.

**Acceptance criteria:** primitives expose a11y props; zero unlabeled interactive elements
(spot-check with the accessibility inspector); reduce-motion honored; manual screen-reader QA
notes for the three flows in the PR.

### D4. Notification & reminders coherence QA `[P2]`
**Model:** sonnet 5 · **Effort:** S · **Files:** verification-first; fixes as found in `mobile/src/lib/notifications.ts`, `_layout.tsx`.

Verify on a physical dev build: permission prompt timing (should be contextual, not at boot —
check where it fires today); local AM/PM/weekly reminders schedule and deep-link correctly;
after push-token registration the weekly local reminders hand off to server push without
double-notifying (the CODE_INDEX documents this handoff — verify it actually works); denied
permission leaves the app fully functional. Test the `/report` push deep link cold-start path
(app killed → tap push → correct screen).

### D5. Medical disclaimer surfacing `[P1 compliance-adjacent]`
**Model:** sonnet 5 · **Effort:** S · **Files:** results screen, chat thread (first-run), onboarding or scan intro.

The chat system prompt has safety rules, but the UI never tells the user "this is not medical
advice." Add: a one-time dismissible notice on first scan results ("Glowi describes cosmetic
skin appearance — it can't diagnose. See a dermatologist for anything painful, spreading, or
worrying") and a persistent short line in the scan results footer + chat empty state. Store
seen-state in the settings store. Copy must go through the owner (flag in PR). Both stores'
reviewers look for this in AI health-adjacent apps — it materially de-risks C2.

### D6. EAS production profile & env correctness `[P1]`
**Model:** sonnet 5 · **Effort:** S · **Files:** `mobile/eas.json`, `mobile/app.json`, `docs/RELEASE.md`.

Ensure production builds get the right `EXPO_PUBLIC_*` values: add `env` blocks to `eas.json`
profiles (production: `EXPO_PUBLIC_AI_MODE=live` + the Supabase URL/anon key) or document EAS
project env vars as the source; add an iOS section to the build profiles (currently
Android-only detail); confirm `autoIncrement` behavior with `appVersionSource: remote`.
Produce one production build per platform and install/smoke-test the Android one.

### D7. Tablet / large-screen decision `[P3]`
**Model:** sonnet 5 · **Effort:** S.

`supportsTablet: false` on iOS while `useResponsive()` explicitly supports up to iPad widths —
contradictory. Recommendation: keep `supportsTablet: false` for v1 (smaller QA matrix; the
responsive work still pays off on big phones) and record the decision in `docs/RELEASE.md`.
If the owner prefers iPad support, that's a QA-matrix expansion of C2/D3. **Ask the owner only
if you find evidence iPad was intended** (e.g. iPad-specific layouts); otherwise apply the
recommendation.

---

## Track E — Observability & quality infrastructure

### E1. Crash reporting (Sentry) `[P1]`
**Model:** sonnet 5 · **Effort:** M · **Files:** `mobile/src/app/_layout.tsx`, `mobile/app.json` (plugin), `mobile/package.json`, EAS config for source maps, `docs/ARCHITECTURE.md`.

`@sentry/react-native` via the Expo config plugin (`jest` transformIgnorePatterns already
whitelists it, amusingly). Initialize in `_layout.tsx`; wrap the root in Sentry's error
boundary **plus** a designed fallback screen (GlowiAvatar + "Something went wrong" + restart
button — on design system); upload source maps in EAS builds; scrub PII (no user email in
events; use user-id only; disable `attachScreenshot` — face photos must never reach Sentry).
DSN via `EXPO_PUBLIC_SENTRY_DSN` (owner creates the Sentry project — ask for the DSN).
Edge functions: don't add Sentry there; Supabase function logs + a weekly log-review note in
`docs/RELEASE.md` suffice at this scale.

**Acceptance criteria:** a forced test crash appears in Sentry with readable stack traces from
a production-profile build; no PII/screenshot attachment; error boundary renders the designed
fallback.

### E2. Privacy-respecting product analytics `[P2]` (decision + minimal implementation)
**Model:** sonnet 5 · **Effort:** M · **Depends:** E1 merged (shared init location), C1 (disclosure).

Recommendation: PostHog (self-serve, generous free tier, RN SDK). Events: session start, scan
completed, chat message sent, check-in logged, report opened, replenishment viewed, upgrade
completed — **counts only, no content, no photos, no health values.** Opt-out toggle in
Profile → Settings; guests included (anonymous IDs). Update C1's policy to disclose. If the
owner would rather launch without analytics, this task collapses to "add the opt-out-ready
event seam and leave the provider unset" — ask before pulling in the dependency.

### E3. CI hardening `[P2]`
**Model:** sonnet 5 · **Effort:** S · **Files:** `.github/workflows/ci.yml`.

Add jobs: (a) `deno check` over `supabase/functions/**/index.ts` + `_shared/*.ts` (use the
Deno version Supabase edge runtime tracks; `deno check` needs the import map / `deno.json` if
present — replicate how the functions actually resolve `npm:` specifiers); (b)
`npm run format:check` in the mobile job; (c) keep total CI time reasonable (cache Deno).
A type error in an edge function must fail CI — prove it in the PR by temporarily introducing
one.

### E4. Component & edge-function tests `[P2]`
**Model:** sonnet 5 (write) with opus 4.8 designing the test plan · **Effort:** L.

1. **Component tests** (React Native Testing Library + jest-expo, already configured):
   auth funnel (sign-up validation, guest flow with mocked store), DailyCheckinCard
   (tap-to-upsert + rollback), replenishment screen (trigger grouping), chat send
   (optimistic + failure). Target the highest-value flows, not coverage numbers.
2. **Edge-function unit tests** (Deno test): `_shared/anthropic.ts extractJson` (fences,
   nesting, unbalanced), `_shared/images.ts` sniffing, `ratelimit.ts` (A1), chat's products-block
   parsing (extract the parser into `_shared` if needed to make it testable — small refactor OK).
   Wire into E3's CI job.
3. Keep the existing pure-logic tests untouched; parity fixtures stay canonical.

### E5. E2E happy-path suite `[P2]`
**Model:** sonnet 5 · **Effort:** L · **Depends:** Tracks B & D merged (stable flows) · **Tooling:** Maestro (native flows, works with Expo dev builds/EAS) + Playwright only if the web QA (C4) wants automation.

Flows: fresh install → guest → onboarding → mock-mode scan → results; guest → upgrade →
data still present; check-in → streak increments; chat send in mock mode. Run against a
**mock-mode dev build** so E2E costs zero tokens and is deterministic (this is exactly what
the mock seam is for). Add as a manual-trigger CI job (device-lab E2E on every push is
overkill; document the release-time expectation in `docs/RELEASE.md`).

### E6. Performance pass `[P3]`
**Model:** sonnet 5 · **Effort:** M.

Audit with the React DevTools profiler + Perf monitor on a mid-tier Android device: list
virtualization (shelf, chat, articles — confirm `FlatList`/`FlashList` not `map` in ScrollView
for unbounded lists), `expo-image` caching policy on scan/product images, cold-start time
(font loading strategy in `_layout.tsx`), Skia/aurora frame cost on low-end devices (consider
capping the aurora on `useReducedMotion` or low-RAM devices — coordinate with D3's
reduce-motion work), bundle size report (`npx expo export` + source-map-explorer). Fix what's
measurably slow; report numbers before/after in the PR. No speculative memoization.

---

## Track F — Enhancements (start after A & B merge)

### F1. AI replenishment copy `[P2 enhancement]`
**Model:** opus 4.8 · **Effort:** M · **Files:** `mobile/src/lib/ai/types.ts` + `live.ts` + `mock.ts`, likely a new edge function or an extension of an existing one, `mobile/src/app/shelf/replenish.tsx`, migration for a cache table or column.

The backlog's declared fast-follow: one short coach-voiced "why this over that" line per
replenishment suggestion, generated once and cached. Design constraints (respect them):
zero tokens on repeat views (cache keyed by `(user_id, trigger_item_id, suggestion_slug)` or
similar — study how `conflict_reports` and `scan_comparisons` cache), mock provider generates
deterministic copy locally, validation server-side (length cap, no invented product claims —
give Claude only the two products' catalog rows + the user's concern list), rate-limited per
A1's pattern. **Write a mini-plan in the PR before implementing** (CLAUDE.md rule 7) and get
it reviewed.

### F2. Skin Progress Timeline `[P2 enhancement]`
**Model:** opus 4.8 (execution) after fable 5 reviews the existing plan · **Effort:** XL (5 PRs).

A 5-PR blueprint already exists (memory: `project-skin-progress-timeline` — before/after
comparison, concern trend sparklines, AI delta, weekly scan nudge; parts may have since
shipped — **first verify against the current Progress tab**, which already has before/after +
sparklines + comparisons, and re-scope the plan to only what's genuinely missing). Locate the
plan in `plans/` / memory, diff it against reality, then execute the remainder as its own
tracked mini-project.

### F3. ML face alignment `[P3 enhancement, big bet]`
**Model:** fable 5 (scoping doc only, this round) · **Effort:** scoping S; build XL.

Deferred in ADR-0012: real-time face-box tracking via `react-native-vision-camera` +
a face detector, replacing the static overlay. This round's deliverable is a **scoping doc
only** (`plans/ml-face-alignment.md`): dependency choice, Expo compatibility (needs dev
build — already true), `capture_meta` schema reuse, fallback behavior, estimated size. Build
is a separate future decision by the owner.

### F4. Catalog breadth tooling `[P3 content-ops]`
**Model:** sonnet 5 · **Effort:** M.

The audit and backlog both flag the curated catalog as the ceiling on replenishment and
In-Store Compare. Engineering's share: a validation script (`supabase/seed/validate.mjs` or
similar) that lints seed data (required fields, concern-slug validity against the taxonomy,
ingredient naming consistency with `ingredientConcerns.ts`, price sanity) + a documented
authoring guide (`docs/CATALOG.md`) so non-engineers can extend the seed safely. Actually
widening the catalog is the owner's content effort.

---

## G1. Release-candidate gate (final task, fable 5)

When Tracks A–E are merged (F excluded), a fable 5 session runs the final gate:

1. Re-run both Supabase advisors — security must be clean except accepted items (document each
   acceptance: e.g. `rate_limit_events` RLS-no-policy is intentional, service-role only).
2. Full quality gate + CI green on `main`.
3. `/security-review` (or equivalent adversarial pass) over the release diff since the audit
   commit (`47be717` era) with special attention to the new auth surfaces (B1–B3, A6, B2).
4. Launch checklist in `docs/RELEASE.md` all checked: CORS set, SMTP live, leaked-password
   protection on, policy URLs live, store forms filled, production builds smoke-tested on
   device (iOS + Android) and web deployed, Sentry receiving events, push cron verified
   (check `cron.job_run_details` for both jobs' latest runs), rate limits verified live.
5. Docs current: README, ARCHITECTURE, CODE_INDEX, new ADRs (deletion, guest cleanup,
   injection posture), MEMORY_SYSTEM if touched. Persistent memory updated with new Supabase
   coordinates/gotchas discovered during execution.
6. Tag `v1.0.0`.

---

## Quick-reference task table

| ID | Task | Pri | Model | Effort | Depends on |
|---|---|---|---|---|---|
| A1 | Per-user AI rate limiting | P0 | opus 4.8 | L | — |
| A2 | Timing-safe push secret | P2 | sonnet 5 | XS | — |
| A3 | RLS initplan + FK indexes | P2 | opus 4.8 | M | — |
| A4 | CORS allowlist | P1 | sonnet 5 | S | C4 (domain) |
| A5 | Storage bucket limits | P2 | sonnet 5 | S | — |
| A6 | Guest cleanup job | P1 | opus 4.8 | M | — |
| A7 | Prompt-injection review | P2 | fable 5 → sonnet 5 | M | — |
| B1 | Fix guest upgrade (data loss) | **P0** | opus 4.8 | M | B4 coordination |
| B2 | Account deletion | **P0** | opus 4.8 | M | — |
| B3 | Password reset | **P0** | opus 4.8 | M | B4 |
| B4 | Prod auth config (SMTP, HIBP) | P1 | sonnet 5 + owner | S–M | owner creds |
| C1 | Privacy policy + ToS | **P0** | fable 5 + owner review | M | — |
| C2 | Store submission package | P1 | sonnet 5 | M | C1, B2 |
| C3 | Data export | P2 | sonnet 5 | M | — |
| C4 | Web launch hardening | P1 | sonnet 5 | M | owner domain choice |
| D1 | Dev-gate AI toggle | P1 | sonnet 5 | XS | — |
| D2 | Offline/error-state pass | P2 | sonnet 5 | M | — |
| D3 | Accessibility pass | P1 | opus 4.8 | L | — |
| D4 | Notifications QA | P2 | sonnet 5 | S | — |
| D5 | Medical disclaimer UI | P1 | sonnet 5 | S | owner copy review |
| D6 | EAS production profiles | P1 | sonnet 5 | S | — |
| D7 | Tablet decision | P3 | sonnet 5 | S | — |
| E1 | Sentry crash reporting | P1 | sonnet 5 | M | owner DSN |
| E2 | Analytics (PostHog) | P2 | sonnet 5 | M | E1, C1, owner OK |
| E3 | CI hardening (Deno + format) | P2 | sonnet 5 | S | — |
| E4 | Component + edge-fn tests | P2 | opus 4.8 plan / sonnet 5 write | L | — |
| E5 | E2E suite (Maestro, mock mode) | P2 | sonnet 5 | L | B, D merged |
| E6 | Performance pass | P3 | sonnet 5 | M | — |
| F1 | AI replenishment copy | P2 | opus 4.8 | M | A1, plan-first |
| F2 | Skin Progress Timeline remainder | P2 | opus 4.8 | XL | verify vs current app |
| F3 | ML face alignment (scoping only) | P3 | fable 5 | S | — |
| F4 | Catalog tooling | P3 | sonnet 5 | M | — |
| G1 | Release-candidate gate | P0 | fable 5 | M | A–E complete |

**Also fold in early (any track, first commit that touches the repo root):** add
`.gitattributes` (`* text=auto`, `*.png binary` etc.) and normalize the 5 EOL-churning files
(finding #17) so diffs stay clean for everyone. Model: sonnet 5, effort XS.

**Items requiring owner input (agents must ask, not assume):** SMTP provider + credentials (B4) ·
web host/domain (C4) · Sentry DSN (E1) · analytics go/no-go (E2) · store credentials (C2) ·
final copy approval for legal docs (C1) and disclaimer (D5) · tablet support if evidence is
ambiguous (D7).
