# Architecture

Glowi is a React Native (Expo) client backed by a single Supabase project. All
intelligence runs server-side in Deno edge functions that call the Anthropic API,
behind a provider seam that also supports a fully on-device mock.

## System overview

```
┌──────────────────────────────────────────────────────────┐
│ mobile/ — Expo + TypeScript                                │
│                                                            │
│  expo-router screens                                       │
│    (auth) · onboarding · (tabs) · scan · results ·         │
│     concern · chat · routine · article · memory ·          │
│     forecast · shelf (+budget/conflicts/replenish) ·       │
│     reactions · compare                                    │
│        │                                                   │
│        ▼                                                   │
│  data hooks (TanStack Query)  ── lib/api.ts ──┐            │
│  stores (Zustand): auth, settings             │            │
│        │                                      │            │
│        ▼                                      ▼            │
│  AIProvider seam ──► Live | Mock        supabase-js        │
└────────┬───────────────────────────────────┬──────────────┘
         │ fetch (JWT)                        │ auth · db · storage
         ▼                                    ▼
┌──────────────────────────────────────────────────────────┐
│ Supabase                                                  │
│  Postgres + Row Level Security                            │
│  Auth (email + pre-confirmed guest)                       │
│  Storage: private scan-images bucket (per-user prefix)    │
│  Edge Functions (Deno):                                   │
│    analyze-skin · chat · extract-memories ·               │
│    skin-forecast · identify-product · auth-signup ·       │
│    compare-scans · check-conflicts · compare-products ·   │
│    glow-report · push-dispatch                            │
│        ├──────────► Anthropic Claude API (secret key)     │
│        ├──────────► Open-Meteo (keyless weather)          │
│        └──────────► Expo push API (token = credential)    │
│  pg_cron + pg_net: scheduled push dispatch                │
└──────────────────────────────────────────────────────────┘
```

The Anthropic key exists only as an edge-function secret. The mobile bundle never
contains it; the app reaches AI exclusively through authenticated function calls.

## Client

- **Routing** — `expo-router` file routes under `mobile/src/app`. A root auth gate
  (`app/_layout.tsx`) redirects between `(auth)`, `onboarding`, and `(tabs)` based on
  session and `profiles.onboarded_at`.
- **State** — Server state via **TanStack Query** (`lib/hooks.ts` over `lib/api.ts`,
  keyed by `lib/query.ts`). Local/session state via **Zustand** (`stores/auth.ts`,
  `stores/settings.ts`).
- **Design system** — `theme/index.ts` holds every token (palette, spacing, radii,
  type ramp, motion curves, severity/score color logic, gradients). `components/ui`
  are the primitives: `GlassCard` (tier `sunken`/`raised`/`glow` — one `glow` per
  screen max), `GlowButton`, `ProgressRing`, `Stagger`, `AppText`, and
  `effects.tsx` (the five §0 techniques that can't be expressed as flat fills —
  `InnerHighlight`, `glowShadow`, `GradientText`). `GlowiAvatar` (`components/GlowiAvatar.tsx`)
  is the brand mascot (jade Skia sphere, 4 animated states); always reuse it, never
  draw a one-off mascot. `SplashView` shows during font/auth init. No screen uses
  ad-hoc colors. Design principles, component recipes, and per-screen specs live in
  `Glowi app visual enhancement (1)/design_handoff_glowi_redesign/`; `mobile/DESIGN.md`
  is the entry point. `lib/responsive.ts` exposes `useResponsive()` — a single hook
  that derives screen-adaptive values (`hPadding`, `isTablet`) from
  `useWindowDimensions`. `Screen` and `TabBar` consume it so all tabs adapt from
  iPhone SE (375 px) through iPad (820 px) without per-screen breakpoint logic.
- **Animation** — Reanimated 4 for transitions and the staggered reveals; React Native
  Skia for the scan theater (`components/scan/ScanTheater.tsx`) and the aurora
  background. Haptics fire only on meaningful moments.

## Data model

Two families of tables (full DDL in `supabase/migrations/0001_core_tables.sql`):

- **Catalog** (authenticated read-only): `concerns` (12-item taxonomy), `products`
  (+ `product_concerns` join with relevance/rationale), `nutrition_guides`, `tips`,
  `articles`.
- **User-owned** (RLS: owner only): `profiles`, `scans`, `chat_sessions`,
  `chat_messages`, `ai_memories`, `routines`, `routine_steps`, `routine_checkins`,
  `reminder_settings`, `skin_forecasts` (one Skin Weather forecast per user per day),
  `shelf_items` (The Shelf — the products a user owns, incl. `key_ingredients` and an
  optional `price_usd` that powers the budget/cost-per-use screen),
  `conflict_reports` (cached Ingredient Conflict Checker results per user),
  `scan_comparisons` (cached AI delta between two completed scans — unique on
  `(user_id, scan_id_before, scan_id_after)`; populated by the `compare-scans` edge
  function and never re-generated for the same pair),
  `reaction_logs` (the Reaction Log — products that reacted badly, with an ingredient
  snapshot taken at log time; inserting one also writes a top-ranked `gotcha`
  `ai_memories` row so every AI surface inherits the constraint — see
  [ADR-0009](adr/0009-reaction-log.md)),
  `push_tokens` (one row per device Expo push token, registered on sign-in, self-pruned
  when Expo reports a dead device — see [ADR-0015](adr/0015-server-push-notifications.md)).
  `ai_memories` additionally carries a nullable pgvector `embedding vector(384)` used by
  semantic retrieval ([ADR-0016](adr/0016-semantic-memory-retrieval.md)).

**Replenishment** (`lib/replenishment.ts`) is a pure-client engine, the same class as
Shelf Budget — zero AI calls, no new table for the ranking itself. `replenishmentTriggers`
flags shelf items that are expiring, expired, low, or out, reusing `shelf.ts`'s PAO/stock
logic. `suggestReplacements` ranks same-category catalog products (`getCatalogProducts`)
against the latest scan's concerns (via `ingredientConcerns.ts`), the user's skin type,
and price, hard-excluding anything already owned and anything sharing an ingredient
with a logged reaction (`reactions.ts` — a reacted ingredient is a "never again", per
[ADR-0009](adr/0009-reaction-log.md)). Surfaced from the Shelf via a "See what to get
next" link into `/shelf/replenish` whenever a trigger exists. A thin AI layer on top
(F1) gives each ranked suggestion one coach-voiced "why this over that" line: the
`replenishment-copy` edge function batches every uncached candidate for a trigger into
one Claude call and caches results per `(user, trigger_item, product)` in
`replenishment_copy` (migration 0025), so the deterministic ranking stays free and only
the coach copy ever costs a token — and only once per pairing.

**Weekly Glow Report** (`glow_reports`, migration 0016) reuses the `skin_forecasts`
idempotent-cache pattern at weekly grain: one immutable row per user per completed week,
unique `(user_id, week_start)`. There is no server cron on this project — generation is
**lazy and client-triggered** on app open (the Progress tab and the report screen call
`useGlowReport`), and the `glow-report` edge function returns the cached row or generates
it with exactly one Claude call. Every statistic (scans, adherence, streak) is computed
server-side and attached as `content.stats`; the model writes only the prose, and the
output is validated field-by-field and rejected (never patched) on violation, the
`analyze-skin` discipline. The report is delivered by a weekly local notification and
exported as a share-safe branded card (no photos/concern details) captured with
react-native-view-shot ([ADR-0014](adr/0014-weekly-glow-report.md)).

### Security boundary — RLS

Every user table has `enable row level security` with a policy scoping all access to
`auth.uid() = user_id` (`profiles` keys on `id`). Catalog tables allow `select` to
`authenticated` only. The `scan-images` storage bucket is private with policies that
restrict each user to their own `{user_id}/…` prefix. Despite the name, this bucket also
holds The Shelf's product photos under `{user_id}/shelf/…`; the per-user prefix policy
secures both equally, so they share one private bucket rather than two. RLS — not
application code — is the authorization boundary, so it is covered explicitly
([ADR-0001](adr/0001-supabase-backend.md)).

A `handle_new_user` trigger creates a `profiles` row on signup (honoring the guest
flag); `set_updated_at` triggers maintain timestamps.

## AI pipeline

The app depends only on the `AIProvider` interface (`lib/ai/types.ts`):
`analyzeScan`, `chat`, `extractMemories`, `skinForecast`, `identifyProduct`,
`checkConflicts`, `compareScans`, `compareProducts`, `glowReport`,
`replenishmentCopy`. Two implementations ([ADR-0003](adr/0003-ai-provider-seam.md)):

- **Live** (`lib/ai/live.ts`) invokes edge functions.
- **Mock** (`lib/ai/mock.ts`) runs on-device with realistic, staged behavior and writes
  through the same tables, so every screen is identical in either mode.

### Edge functions (`supabase/functions`)

| Function | Role |
|---|---|
| `analyze-skin` | Downloads the private scan image, runs Claude vision constrained to the concern taxonomy, **validates** the JSON server-side, persists the result, and writes a scan-event memory. Rejects non-skin images. |
| `chat` | Assembles memory context + the product catalog into the system prompt, generates a reply, extracts an optional inline product-recommendation block (validated against the catalog), persists both turns. |
| `extract-memories` | Mines new conversation turns for durable memories (add/update/supersede ops) and refreshes the session summary. Idempotent per turn via `memory_extracted_until`. |
| `skin-forecast` | Fetches today's local weather + air quality from Open-Meteo (keyless), assembles memory context (incl. the user's shelf), asks Claude for environment-grounded routine guidance that **names products the user owns**, **validates** it against the action enum, and upserts the day's forecast. Falls back to a deterministic forecast if Open-Meteo or Claude is unavailable. Idempotent per user per day ([ADR-0005](adr/0005-skin-weather-forecasting.md)). |
| `identify-product` | Reads a product photo with Claude vision and returns structured details (name, brand, category, key ingredients, PAO, catalog match) for The Shelf, **validated** against the category enum and catalog. Persists nothing — the client confirms before saving ([ADR-0006](adr/0006-the-shelf-inventory.md)). |
| `check-conflicts` | Filters the user's active shelf items down to those with known `key_ingredients`; if a cached `conflict_reports` row is at least as new as the latest shelf change, returns it with no Claude call. Otherwise asks Claude (temperature 0) for strict-JSON ingredient interactions, parses via `extractJson`, caches, and returns the report ([ADR-0008](adr/0008-ingredient-conflict-checker.md)). |
| `compare-products` | In-store decision support: reads two product photos in a single Claude vision call whose prompt embeds the user's latest scan concerns, shelf ingredients, and reaction log; **validates** the verdict/category enums server-side and persists nothing ([ADR-0010](adr/0010-in-store-compare.md)). |
| `replenishment-copy` | One short coach-voiced line per Smart Replenishment suggestion (F1): batches every uncached candidate for a triggered shelf item into one Claude call, maps lines back to candidates by ordinal position (never a model-authored key), and caches per `(user, trigger_item, product)` in `replenishment_copy` so a repeat visit costs no Claude call. |
| `auth-signup` | Creates pre-confirmed email and guest users via the admin API ([ADR-0002](adr/0002-prefilled-auth-signup-function.md)). |
| `push-dispatch` | Sends scheduled Expo push notifications (Monday "Glow Report ready", Wednesday lapsed-scan nudge). Called by pg_cron via pg_net, authenticated by a Vault-held shared secret instead of a user JWT; dead tokens self-prune ([ADR-0015](adr/0015-server-push-notifications.md)). |

A `_shared` module holds the Anthropic client (with balanced-JSON extraction), the
memory context assembler (which also surfaces today's Skin Weather forecast and the
user's shelf, so the coach is weather- and cabinet-aware), RLS-scoped vs service
clients, and HTTP/CORS helpers. All AI functions require a valid JWT.

Memory retrieval is semantic when there's a message to match against: memories are
embedded at write time with the edge runtime's built-in gte-small model (384-dim, no
external provider), and `chat` ranks context by cosine similarity to the user's message
via a `match_memories` RPC over an HNSW index — falling back to importance/recency
ranking whenever embeddings are unavailable ([ADR-0016](adr/0016-semantic-memory-retrieval.md)).

## Request flow: a scan

0. **Guided capture** (`scan/camera.tsx`, native): a front-camera `CameraView` is framed
   against a fixed, versioned alignment overlay (face oval + chin/forehead ticks). On
   shutter, Skia decodes a ≤64px copy of the photo and the pure `captureQuality.ts`
   returns an exposure verdict; a non-`good` verdict offers a retake (never a hard block).
   The chosen photo's context — `{ guided, overlay_version, mean_luminance, verdict }` —
   rides to the analyzing screen as a param. Library uploads (and web, which degrades to
   the picker via `scan/camera.web.tsx`) skip this and carry no capture metadata.
1. The analyzing screen creates a `scans` row (`pending`, with `capture_meta` set from the
   param or `null`) and uploads the photo to `scan-images/{user}/{scan}.jpg`.
2. It calls `AIProvider.analyzeScan(scanId)` while the Skia theater plays for a minimum
   duration.
3. Live mode: `analyze-skin` reads the image, calls Claude vision, validates and
   persists concerns + score, and inserts a scan memory. Mock mode does the equivalent
   on-device.
4. The screen routes to results, which read the persisted row — a single source of truth
   regardless of provider. `capture_meta` persists alongside for future
   consistency-weighted trends ([ADR-0012](adr/0012-guided-scan-capture.md)).

## Quality & tooling

- TypeScript strict; ESLint (expo flat config); Jest unit tests for the pure logic
  (streak math, routine generation and sequencing, Skin Weather forecast derivation,
  Shelf expiry/stock, budget/cost-per-use, replenishment triggers/ranking,
  reaction–shelf ingredient matching,
  scan-to-trend correlation, guided-capture lighting assessment).
- The React Compiler `immutability`/`purity` lint rules are scoped off because they
  don't model Reanimated's `sharedValue.value` API; `rules-of-hooks`, dependency checks,
  and type safety remain enforced.
- CI (`.github/workflows/ci.yml`) runs typecheck + lint + tests on every push and PR.

## Scheduled jobs

Three pg_cron jobs call edge functions through pg_net with the Vault-held
`push_dispatch_secret`: Monday's Glow Report doorbell and Wednesday's lapsed-scan nudge
(migration 0018 → `push-dispatch`), and a monthly abandoned-guest sweep (migration 0023
→ `cleanup-guests`, ADR-0018 — guests inactive 90+ days lose storage, rows, and auth
user, capped per run). Report generation stays lazy — the push is only the doorbell, so
lapsed users still cost zero Claude tokens until they return. Devices that can't
register for push (web, Expo Go, denied permission) keep the local weekly reminders
instead; the client hands those two schedules to the server only after a successful
token registration. `cron.job_run_details` is the audit trail for all three.

## Auth operations

Settings live in the Supabase dashboard, not the repo — this section is the record.

- **Account lifecycle.** Signup (email + guest) runs through the `auth-signup` function
  (ADR-0002, pre-confirmed via admin API — independent of email delivery). Guest →
  account conversion is `auth-signup` mode `upgrade` (JWT-verified, in-place, same user
  id; duplicate emails 409 via the `email_taken` helper, migration 0024). Erasure is the
  `delete-account` function (ADR-0019). Abandoned guests are reclaimed monthly
  (ADR-0018).
- **Password reset.** `(auth)/forgot-password` → `resetPasswordForEmail` with a
  `glowi://reset-password` redirect; the deep-link handler in `_layout.tsx` establishes
  the recovery session and opens `/reset-password`. **Operational prerequisite:**
  `glowi://reset-password` must be listed under Auth → URL Configuration → Redirect
  URLs, or the recovery link falls back to the Site URL.
- **Email delivery.** The project currently uses Supabase's built-in sender: fine for
  development, rate-limited to a handful of emails per hour, and unsuitable for real
  traffic. The production path (pending a custom domain) is Resend via Auth → SMTP:
  host `smtp.resend.com`, port 465, username `resend`, password = the Resend API key,
  sender on the verified domain — then re-test signup (both modes) and a reset email,
  since ADR-0002's assumptions must survive any auth-settings change.
- **Leaked-password protection (HIBP)** is currently **off** (security-advisor WARN,
  owner-deferred 2026-07-11). Enable under Auth → Sign In / Providers → password
  settings before launch; it is a G1 launch-checklist blocker.

## Deferred (v1 scope)

Payments and store-submission assets. (Server push and semantic memory retrieval, both
deferred at v1, shipped 2026-07-10 — ADR-0015 / ADR-0016.)
