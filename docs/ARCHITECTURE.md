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
│     concern · chat · routine · article · memory            │
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
│    analyze-skin · chat · extract-memories · auth-signup   │
│        └──────────► Anthropic Claude API (secret key)     │
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
  are the primitives (GlassCard, GlowButton, ProgressRing, Stagger, …). No screen uses
  ad-hoc colors.
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
  `reminder_settings`.

### Security boundary — RLS

Every user table has `enable row level security` with a policy scoping all access to
`auth.uid() = user_id` (`profiles` keys on `id`). Catalog tables allow `select` to
`authenticated` only. The `scan-images` storage bucket is private with policies that
restrict each user to their own `{user_id}/…` prefix. RLS — not application code — is
the authorization boundary, so it is covered explicitly
([ADR-0001](adr/0001-supabase-backend.md)).

A `handle_new_user` trigger creates a `profiles` row on signup (honoring the guest
flag); `set_updated_at` triggers maintain timestamps.

## AI pipeline

The app depends only on the `AIProvider` interface (`lib/ai/types.ts`):
`analyzeScan`, `chat`, `extractMemories`. Two implementations
([ADR-0003](adr/0003-ai-provider-seam.md)):

- **Live** (`lib/ai/live.ts`) invokes edge functions.
- **Mock** (`lib/ai/mock.ts`) runs on-device with realistic, staged behavior and writes
  through the same tables, so every screen is identical in either mode.

### Edge functions (`supabase/functions`)

| Function | Role |
|---|---|
| `analyze-skin` | Downloads the private scan image, runs Claude vision constrained to the concern taxonomy, **validates** the JSON server-side, persists the result, and writes a scan-event memory. Rejects non-skin images. |
| `chat` | Assembles memory context + the product catalog into the system prompt, generates a reply, extracts an optional inline product-recommendation block (validated against the catalog), persists both turns. |
| `extract-memories` | Mines new conversation turns for durable memories (add/update/supersede ops) and refreshes the session summary. Idempotent per turn via `memory_extracted_until`. |
| `auth-signup` | Creates pre-confirmed email and guest users via the admin API ([ADR-0002](adr/0002-prefilled-auth-signup-function.md)). |

A `_shared` module holds the Anthropic client (with balanced-JSON extraction), the
memory context assembler, RLS-scoped vs service clients, and HTTP/CORS helpers. All AI
functions require a valid JWT.

## Request flow: a scan

1. Capture screen creates a `scans` row (`pending`) and uploads the photo to
   `scan-images/{user}/{scan}.jpg`.
2. The analyzing screen calls `AIProvider.analyzeScan(scanId)` while the Skia theater
   plays for a minimum duration.
3. Live mode: `analyze-skin` reads the image, calls Claude vision, validates and
   persists concerns + score, and inserts a scan memory. Mock mode does the equivalent
   on-device.
4. The screen routes to results, which read the persisted row — a single source of truth
   regardless of provider.

## Quality & tooling

- TypeScript strict; ESLint (expo flat config); Jest unit tests for the pure logic
  (streak math, routine generation).
- The React Compiler `immutability`/`purity` lint rules are scoped off because they
  don't model Reanimated's `sharedValue.value` API; `rules-of-hooks`, dependency checks,
  and type safety remain enforced.
- CI (`.github/workflows/ci.yml`) runs typecheck + lint + tests on every push and PR.

## Deferred (v1 scope)

Server-sent push notifications (local reminders only), payments, semantic
(pgvector) memory retrieval — the importance/recency ranking is sufficient for now and
the seam is ready — and store-submission assets.
