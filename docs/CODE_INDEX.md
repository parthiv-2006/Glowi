# Code Index — AI Navigation Map

**Purpose:** let any AI tool (or new engineer) find the right file without exploratory
searching. Read this first, open only the files you need.

**Maintenance rule:** any PR that adds/moves/deletes a route, lib module, component,
edge function, or migration must update this file in the same PR. Stale entries are
worse than no entries.

---

## Where do I make a change?

| I need to… | Go to |
|---|---|
| Change a screen | `mobile/src/app/<route>` (see Routes below) |
| Add/adjust a DB table | New numbered file in `supabase/migrations/` (append-only, never edit applied ones) |
| Add a query/mutation | `mobile/src/lib/api.ts` (data access) → `query.ts` (query key) → `hooks.ts` (React Query hook) |
| Add an AI capability | `mobile/src/lib/ai/types.ts` (interface) → `live.ts` + `mock.ts` (both, always) → usually a new edge function |
| Add pure domain logic | New `mobile/src/lib/<name>.ts` + test in `lib/__tests__/` — keep it I/O-free |
| Touch UI primitives | `mobile/src/components/ui/` — reuse before creating |
| Change theme/tokens | `mobile/src/theme/index.ts` (design rules: `mobile/DESIGN.md` + design handoff dir) |
| Change an edge function | `supabase/functions/<name>/index.ts` (shared helpers in `_shared/`) — redeploy after |
| Seed/catalog data | `supabase/seed/` |

## Routes (`mobile/src/app/`, expo-router)

| Route | File | What it is |
|---|---|---|
| `/(auth)/welcome`, `sign-in`, `sign-up` | `(auth)/*.tsx` | Auth funnel (guest mode = pre-confirmed user via `auth-signup` fn, ADR-0002) |
| `/onboarding` | `onboarding.tsx` | Skin type + goals wizard |
| `/` (Home tab) | `(tabs)/index.tsx` | Skin Weather card, scan CTA, latest results |
| `/progress` | `(tabs)/progress.tsx` | Score trend, before/after + AI delta, concern sparklines, **scan-to-trend correlations**, streak, scan history |
| `/chat` | `(tabs)/chat.tsx` | Coach session list; thread at `chat/[sessionId].tsx` |
| `/learn` | `(tabs)/learn.tsx` | Articles; reader at `article/[slug].tsx` |
| `/profile` | `(tabs)/profile.tsx` | Profile, location (geocoding autocomplete), settings |
| `/scan` → `/scan/camera` → `/scan/analyzing` | `scan/*.tsx` | Capture entry (guided camera or library) → analysis theater (schedules weekly reminder). `camera.tsx` = guided in-app camera (alignment overlay + lighting check); `camera.web.tsx` = web picker fallback |
| `/results/[scanId]` | `results/[scanId].tsx` | Scan reveal; per-concern detail at `concern/[scanId]/[slug].tsx` |
| `/routine` | `routine/index.tsx` | AM/PM routine, wait-time chips, order warnings, daily check-in |
| `/shelf` | `shelf/index.tsx` | Inventory + nudges; `add.tsx` (photo→AI→form), `[id].tsx` (detail), `budget.tsx` (cost-per-use), `conflicts.tsx` (AI conflict report), `replenish.tsx` (Smart Replenishment — what to get next) |
| `/reactions`, `/reactions/add` | `reactions/*.tsx` | Reaction log (writes a gotcha ai_memory) |
| `/compare` | `compare.tsx` | In-store two-product photo comparison |
| `/forecast` | `forecast.tsx` | Full Skin Weather view |
| `/memory` | `memory.tsx` | View/delete AI memories |
| `/upgrade` | `upgrade.tsx` | Guest → account conversion |
| `/kitchensink` | `kitchensink.tsx` | Dev-only primitive gallery (not linked in nav) |

## Data layer (`mobile/src/lib/`)

| File | Exports / purpose |
|---|---|
| `types.ts` | All domain types mirroring the schema (Scan, ShelfItem, ReactionLog, AIDelta, …) |
| `supabase.ts` | Supabase client, `getSignedScanImageUrl` |
| `api.ts` | Every DB read/write (PostgREST calls) — no UI imports it directly except via hooks |
| `query.ts` | `qk` — the canonical React Query key registry |
| `hooks.ts` | React Query hooks over api.ts + AI provider (`useScans`, `useShelfItems`, `useScanComparison`, `useCatalogProducts`, …) |
| `constants.ts` | UI constants, color helpers (`expiryColor`, `FORECAST_ACTION`, `categoryIcon`) |
| `env.ts` | Typed `EXPO_PUBLIC_*` access |
| `notifications.ts` | Identifier-based scheduling (`glowi-routine-am/pm`, `glowi-weekly-scan`) — never `cancelAll` |
| `haptics.ts` / `responsive.ts` | Haptic + layout helpers |

**Pure domain logic (unit-tested in `lib/__tests__/`):**
`streak.ts` (check-in streaks) · `shelf.ts` (PAO expiry, stock) · `reactions.ts` (ingredient risk cross-referencing) · `routineSequence.ts` (wait times, order warnings) · `routineGenerator.ts` (scan → routine steps) · `budget.ts` (cost-per-use, quarter spend) · `replenishment.ts` (`replenishmentTriggers` — expiring/expired/low/out; `suggestReplacements` — ranked same-category catalog replacements, scored on scan-concern match + skin type + price, reaction-hard-excluded) · `correlation.ts` (scan-to-trend correlation insights; ⚠ lockstep mirror of `supabase/functions/_shared/correlation.ts`) · `ingredientConcerns.ts` (ingredient → concern targeting map for the correlation "why" line; ⚠ lockstep mirror of `supabase/functions/_shared/ingredientConcerns.ts`) · `captureQuality.ts` (`assessCapture` — pure rec-709 luma exposure verdict for guided-scan photos; Skia decode lives in `scan/camera.tsx`)

**AI seam (`lib/ai/`, ADR-0003 — sacred):** `types.ts` = `AIProvider` interface; `live.ts` invokes edge functions; `mock.ts` = deterministic offline twin (keep in lockstep); `forecast.ts` = pure mock-weather synthesis; `index.ts` = `getAIProvider()` (mode from `EXPO_PUBLIC_AI_MODE`).

**Stores (`mobile/src/stores/`):** `auth.ts` (session), `settings.ts` (AI mode, location, reminders — persisted).

## Components

**Primitives (`components/ui/` — always reuse first):** `AppText`, `Badge`, `EmptyState`, `GlassCard` (tier="sunken|raised|glow"), `GlowButton`, `PressableScale`, `ProgressRing`, `Screen`, `SectionHeader`, `Skeleton`, `Stagger`, `TextField`, `effects.tsx` (InnerHighlight, glowShadow, GradientText — never fake these as flat fills).

**Feature (`components/`):** `AuroraBackground` (+`.web`), `BeforeAfterSlider`, `ConcernTrendSparkline`, `GlowiAvatar` (the mascot — never draw a one-off), `Markdown`, `ProductCard`, `ScoreTrend`, `ShelfItemCard`, `SkinWeatherCard`, `SplashView`, `TabBar`, `chat/` (MessageBubble, TypingDots), `scan/` (ScanTheater +`.web`).

## Backend (`supabase/`)

**Edge functions (`functions/`, Deno; secrets `ANTHROPIC_API_KEY`, optional `GLOWI_ALLOWED_ORIGINS`):**

| Function | Does |
|---|---|
| `analyze-skin` | Scan photo → structured concerns/score onto the scan row |
| `chat` | Memory-aware coach turn (assembles memories, shelf, forecast, reactions) |
| `extract-memories` | Session → long-term `ai_memories` |
| `skin-forecast` | Open-Meteo weather + Claude guidance → daily forecast row |
| `identify-product` | Label photo → structured product for Shelf add |
| `check-conflicts` | Active shelf → cached ingredient conflict report |
| `compare-scans` | Two scan images → honest `AIDelta` (cached in `scan_comparisons`) |
| `compare-products` | Two label photos + user context → in-store verdict (stateless) |
| `auth-signup` | Pre-confirmed guest/user creation, IP rate-limited |
| `_shared/` | `http.ts` (CORS/serve), `anthropic.ts`, `images.ts` (magic-byte sniffing), `memory.ts` (`assembleMemoryContext`), `correlation.ts` + `ingredientConcerns.ts` (⚠ lockstep mirrors of the mobile modules of the same name, ported into the memory context), db helpers |

**Migrations (append-only source of truth):** 0001 core tables · 0002 RLS · 0003 storage+triggers · 0004 guest flag · 0005 skin_forecasts · 0006 shelf_items · 0007 rate limit · 0008 drop raw_model_output · 0009 lock trigger fns · 0010 conflicts + key_ingredients · 0011 scan_comparisons · 0012 reaction_logs · 0013 shelf price_usd · 0014 scans.capture_meta (guided-capture context).

Every user table has RLS (`crud_own` convention); the scan-images bucket is private per-user.

## Docs & meta

`README.md` (overview/quick-start) · `docs/ARCHITECTURE.md` (system design) · `docs/MEMORY_SYSTEM.md` (AI memory pipeline) · `docs/FEATURE_BACKLOG.md` (roadmap + status) · `docs/adr/` (decisions) · `mobile/DESIGN.md` + `Glowi app visual enhancement (1)/design_handoff_glowi_redesign/` (visual system — mandatory before UI work) · `plans/` (feature blueprints) · CI: `.github/workflows/ci.yml` (typecheck, lint, test).

## Build & assets (`mobile/`)

`assets/brand/` (`glowi-mark.svg`, `glowi-mark-mono.svg` — exact transcriptions of
`GlowiAvatar`, the source of truth for the app icon) · `scripts/generate-assets.mjs`
(`npm run assets` — renders every icon/splash/favicon PNG from the brand marks via
`sharp`; idempotent) · `eas.json` (EAS build profiles: `development` dev-client,
`preview` internal APK, `production` app-bundle).

**Quality gate (run from `mobile/`):** `npm run typecheck && npm run lint && npm test`, `npm run format` before committing.
