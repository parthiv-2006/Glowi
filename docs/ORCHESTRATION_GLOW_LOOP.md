# Orchestration Plan — The Glow Loop (Three Retention Features)

**Status:** WS-A ✅ (branch `feature/ws-a-smart-replenishment`, not yet merged) · WS-B ⬜ · WS-C ⬜
· **Written:** 2026-07-09 · **Owner:** orchestrator session

This document is an execution contract, in the same mold as
[ORCHESTRATION_NEXT_FOUR.md](ORCHESTRATION_NEXT_FOUR.md) (all four of whose workstreams
shipped). Each workstream below is written so a Claude agent (Sonnet or Opus, per the
routing table) can run it **autonomously, cold, with no other context** and land work at
senior-engineer quality. Read the whole preamble before touching your workstream. If a
step's premise turns out false in the repo, stop and report — don't improvise around it.

The three features form one loop: the **Lifestyle Diary** deepens what Glowi knows, the
**Weekly Glow Report** turns what it knows into a moment users come back (and share),
and **Smart Replenishment** turns the Shelf's expiry/stock signals into the next
purchase. Every piece rides on engines that already exist — the correlation engine, the
memory system, the shelf/PAO logic, the catalog.

| # | Workstream | Model | Why this model |
|---|---|---|---|
| WS-A | Smart Replenishment ("what to get next") | **Sonnet** | Pure, well-scoped ranking logic + one screen; zero AI plumbing; explicit spec below |
| WS-B | Lifestyle Diary + correlation v2 | **Opus** | New privacy-sensitive data class, a change to the correlation engine's public signature, the sacred memory seam, and two lockstep mirrors |
| WS-C | Weekly Glow Report + shareable card | **Sonnet impl + Opus review pass** | New edge function follows the established `skin-forecast` pattern; AI-seam addition; review gate before commit (WS4 precedent) |

**Decisions locked by the user (2026-07-09) — do not relitigate:**

1. **Glow Report ships the shareable image card in v1** (react-native-view-shot +
   expo-sharing). No user photos on the card by default.
2. **Diary tracks sleep quality, stress, diet flags (dairy/sugar/alcohol), and water
   intake.** Menstrual-cycle phase is included as an **opt-in, off-by-default** toggle;
   the schema reserves the column either way.
3. **Replenishment ranking is pure client-side** — no edge function, no tokens. AI copy
   is a possible fast-follow, not v1.

**Dependency graph / order:**

```
WS-A ────────────────────────► independent (merge any time)
WS-B ─────────► WS-C (the report consumes lifestyle-aware correlations,
                      and WS-B changes correlateScanTrends's signature)
```

Run **WS-A and WS-B in parallel**; **WS-C strictly after WS-B merges** (it calls the
extended engine and reads `lifestyle_logs`). Migration numbers: WS-B takes **0015**,
WS-C takes **0016** (0014 is the last applied). If WS-B were ever descoped, WS-C
renumbers to 0015 and drops its lifestyle content — but that is not the plan.

**Token-cost profile:** WS-A adds zero AI calls. WS-B adds no new AI calls (it enriches
the existing chat/forecast context; both functions get redeployed). WS-C adds exactly
one cached Claude call per user per week.

---

## Ground rules (every workstream, non-negotiable)

1. **Navigate via [docs/CODE_INDEX.md](CODE_INDEX.md) first.** Open only the files you
   need. Any change that adds/moves/removes a route, lib module, component, edge
   function, or migration updates CODE_INDEX.md **in the same commit**.
2. **Quality gate** — from `mobile/`, all green before any "done" claim, and
   `npm run format` before committing:
   ```bash
   npm run typecheck && npm run lint && npm test
   ```
3. **Commit protocol** — small, logically-grouped Conventional Commits with scopes
   (`feat(shelf): …`, `chore(supabase): …`, `docs: …`), one concern per commit, pushed
   in batches. Every commit ends with the co-author trailer used in this repo's history.
4. **The AI seam is sacred** ([ADR-0003](adr/0003-ai-provider-seam.md)). Any change to
   `mobile/src/lib/ai/live.ts` is mirrored in `mock.ts` in the same commit. Every
   feature must keep working offline in mock mode at zero token cost.
5. **Secrets never reach the client.** `ANTHROPIC_API_KEY` lives only in edge-function
   secrets. `EXPO_PUBLIC_*` vars are bundled into the app — publishable values only.
6. **Migrations are append-only.** Schema changes = new numbered file under
   `supabase/migrations/`. Never edit an applied one. **Merged ≠ applied**: after
   merging, cross-check MCP `list_migrations` against `supabase/migrations/*.sql` and
   apply what's missing (the 0011 drift incident is the cautionary tale).
7. **Visual system is enforced.** Before any UI work, read
   `Glowi app visual enhancement (1)/design_handoff_glowi_redesign/DESIGN_PRINCIPLES.md`,
   `COMPONENT_FIDELITY.md`, `BUILD_ORDER.md`. Transcribe exact values — never
   approximate. Never render the five §0 effects as flat `rgba()` fills. Every surface
   declares a GlassCard tier; max one Glow element per screen. For screens with no
   mockup, follow the "Designing a screen that was never mocked up" recipe and run
   "check the tells".
8. **Expo has changed.** SDK is 56 (`expo ~56.0.11`, RN 0.85.3). Consult
   https://docs.expo.dev/versions/v56.0.0/ before writing any Expo API code. Install
   Expo packages with `npx expo install <pkg>` so versions pin to the SDK.
9. **Verify like the repo expects.** TypeScript passing is not verification. Drive the
   affected route in the web preview, confirm zero console errors, confirm data flows
   end to end, screenshot when feasible. For live-AI verification never write into the
   shared demo account (`ae2bc5b2…`) — create a throwaway guest via the real sign-up
   flow, seed *its* rows via SQL, verify, then delete them (the WS3 pattern).
10. **Docs and memory in the same PR.** Each workstream lists its documentation and
    persistent-memory obligations; they are part of "done", not follow-ups.
11. **Edge-function deploys via MCP are flattened.** `deploy_edge_function` needs
    `entrypoint_path: "index.ts"` with every `_shared/*` file passed flat (no `_shared/`
    prefix) and imports rewritten to `./x.ts`. **Always re-fetch with
    `get_edge_function` after deploying and byte-diff against local source** — a
    truncated payload can deploy "successfully" while shipping broken code.
12. **Typed-routes gotcha.** After adding a new route file, regenerate
    `.expo/types/router.d.ts` (run `expo start` briefly) before `tsc` will accept the
    new path; kill any stale process on port 8081 first.

---

## WS-A — Smart Replenishment ("what to get next")

**Model: Sonnet.** Goal: the Shelf closes its loop. When a product is expiring or
running low, Glowi doesn't just nudge — it recommends what to buy next, ranked against
the user's latest scan concerns, disqualified by their reaction log, and priced against
what they currently pay. Zero AI calls; this is `budget.ts`-style pure domain logic.

**Grounding facts (verified 2026-07-09):**
- Expiry/stock signals already exist in `mobile/src/lib/shelf.ts`: `expiryStatus()`
  (kinds `sealed|fresh|expiring|expired`, `EXPIRY_WARNING_DAYS = 14`), `stockStatus()`
  (kinds `ok|low|out`, `LOW_STOCK_PCT = 20`), `summarizeShelf()`.
- `mobile/src/lib/api.ts` has **no catalog-wide product query** — only
  `getProductsForConcern(slug)` and `getProductsBySlug(slugs)`. You will add one.
- `Product` (`mobile/src/lib/types.ts`) carries `category`, `key_ingredients`,
  `price_usd`, `retailer_links`, `skin_types`, `slug`. `ShelfItem` carries
  `product_id | null`, `category | null`, `key_ingredients`, `price_usd | null`.
- Ingredient → concern targeting already exists:
  `concernsTargetedBy(ingredients: string[])` in
  `mobile/src/lib/ingredientConcerns.ts` (normalized, synonym-aware).
- Reaction disqualification precedent: `mobile/src/lib/reactions.ts`
  (`riskyShelfItems` — lowercase/trim ingredient intersection). Mirror its
  normalization, don't reinvent it.
- `ProductCard` (`mobile/src/components/ProductCard.tsx`) already renders a catalog
  product with retailer links — reuse it.
- The Shelf screen (`mobile/src/app/shelf/index.tsx`) already surfaces expiry/low-stock
  nudges and has entry-link precedents (budget, conflicts, compare).

### Steps

**A. Pure engine.** New `mobile/src/lib/replenishment.ts` (I/O-free, like `budget.ts`):

```ts
/** A shelf item that warrants replacement, and why. */
export interface ReplenishmentTrigger {
  item: ShelfItem;
  reason: 'expiring' | 'expired' | 'low_stock' | 'out';
}
export function replenishmentTriggers(items: ShelfItem[], today?: Date): ReplenishmentTrigger[];

/** Catalog candidates to replace a triggered item, best first (max 3). */
export interface ReplacementSuggestion {
  product: Product;
  /** Plain-language why, e.g. "Targets post-breakout marks · similar price". */
  why: string;
  score: number;
}
export function suggestReplacements(
  trigger: ReplenishmentTrigger,
  catalog: Product[],
  latestScan: Scan | null,
  reactions: ReactionLog[],
  shelf: ShelfItem[],
  skinType: SkinType | null,
): ReplacementSuggestion[];
```

Rules (constants named at top of file, tested):
- Candidates: same `category` as the triggered item only. Active shelf items' matched
  `product_id`s and the triggered item's own match are **excluded** (don't recommend
  what they already own).
- **Hard disqualifier:** any candidate whose `key_ingredients` intersect any reaction
  log's `key_ingredients` (reuse the `reactions.ts` normalization) is dropped, never
  down-ranked — a reacted ingredient is a "never again", per ADR-0009.
- Scoring: +2 per distinct latest-scan concern the candidate targets (via
  `concernsTargetedBy` × `scan.concerns[].concern_slug`); +1 if `skin_types` includes
  the user's skin type; +1 if `price_usd` ≤ the triggered item's `price_usd` (skip when
  either is null). Ties break by lower price. Return top 3 with a composed `why` line.
- Empty catalog / no triggers / no scan → sensible empties, never throws.

**B. Data access.** `api.ts`: `getCatalogProducts(): Promise<Product[]>` (full
`products` select, ordered by `brand, name` — the catalog is a small curated seed set,
no pagination needed). Register `qk.catalogProducts` in `query.ts`; add
`useCatalogProducts()` in `hooks.ts` with a long `staleTime` (catalog is static seed
data). Follow the exact patterns of the neighboring functions/hooks.

**C. Screen.** New route `mobile/src/app/shelf/replenish.tsx` — "What to get next".
For each trigger: a header row (item name + reason chip, reuse the existing
expiry/stock color helpers in `constants.ts`) and up to 3 `ProductCard`s each with a
caption-level `why` line. Empty state ("Nothing needs replacing — your shelf is
stocked") via `EmptyState`. Entry point: on `mobile/src/app/shelf/index.tsx`, when
`replenishmentTriggers(...).length > 0`, the existing expiry/low-stock nudge area gains
a "See what to get next →" link to `/shelf/replenish`. No mockup exists — run the
"never mocked up" recipe + "check the tells" (rule 7).

**D. Tests.** `mobile/src/lib/__tests__/replenishment.test.ts`: trigger detection
(expiring, expired, low, out, and none), reaction hard-disqualification, own-product
exclusion, concern-match scoring order, price tiebreak, null-scan/null-price paths,
max-3 cap. Match the table-driven style of `budget.test.ts`.

### Done when
- Engine + tests landed; screen renders in web preview with a seeded low-stock/expiring
  item, zero console errors (screenshot in report); mock mode works by construction
  (no AI involved); quality gate green.

**Commits:** `feat(shelf): replenishment engine (triggers + ranked replacements)` ·
`feat(shelf): what-to-get-next screen + nudge entry` ·
`docs: replenishment — ARCHITECTURE + CODE_INDEX`.

**Docs/memory:** ARCHITECTURE.md gains a short "Replenishment" paragraph next to the
budget/shelf sections (no ADR needed — pure client feature, same class as Shelf
Budget); CODE_INDEX.md (new lib module, test, route, api/hook entries); memory-store
note only if a non-obvious gotcha surfaced.

**WS-A shipped (2026-07-09):** `replenishment.ts` (18 unit tests) + `getCatalogProducts`/
`useCatalogProducts` + `/shelf/replenish` screen + nudge entry on `/shelf`, on branch
`feature/ws-a-smart-replenishment`. Quality gate green; verified end-to-end in the web
preview against real Supabase data (throwaway guest, seeded via the app's own Add-to-
Shelf UI — a direct SQL insert into the shared project was correctly blocked by the
sandbox as an unauthorized write to shared data, so the seeding used real app flows
instead). ARCHITECTURE.md + CODE_INDEX.md updated in this PR. **Not merged to main** —
awaiting explicit go-ahead. **Gotcha for whoever runs WS-B/WS-C next:** this repo has no
per-workstream worktree convention yet; if two sessions run in the same checked-out
working directory at once, a `git checkout -b` from either side drags the other's
uncommitted changes across branches. Use `git worktree add` (or the `EnterWorktree`
tool) per workstream to keep concurrent sessions isolated — see
`replenishment-ws-a-concurrency-incident` in persistent memory for the full story.

---

## WS-B — Lifestyle Diary + correlation v2

**Model: Opus.** Goal: Glowi can say "your breakouts track your low-sleep weeks" — a
10-second daily check-in becomes correlation evidence and coach context. This touches
the correlation engine's public signature, both lockstep mirrors, and the memory seam;
it also introduces the app's most privacy-sensitive optional field (cycle phase).

**Grounding facts (verified 2026-07-09):**
- Correlation engine: `mobile/src/lib/correlation.ts` — `buildEvents(shelfItems,
  reactions)`, `correlateScanTrends(...)`, `CorrelationEventKind = 'shelf_add' |
  'reaction'`, `MIN_EFFECT_DAYS = 3`, `MAX_INSIGHTS = 4`. ⚠ **Lockstep mirror** at
  `supabase/functions/_shared/correlation.ts`; parity enforced by the shared JSON
  fixture `mobile/src/lib/__tests__/fixtures/correlation-parity.json` (byte-identical
  copy under `supabase/functions/_shared/__fixtures__/`), asserted by
  `correlation.parity.test.ts`. Change both copies and the fixtures together or not
  at all.
- Context assembler: `supabase/functions/_shared/memory.ts` `assembleMemoryContext()` —
  already queries scans/shelf/reactions and emits a `ROUTINE CORRELATIONS` block.
  Consumed by `chat` (v7) and `skin-forecast` (v5); both must be redeployed (rule 11).
- Migration conventions: transcribe from `0012_reaction_logs.sql` (RLS `for all`
  crud_own policy, `updated_at` trigger wiring, index on `(user_id, <date> desc)`).
- Settings store: `mobile/src/stores/settings.ts` (zustand + AsyncStorage persist,
  store name `glowi-settings`) — pattern for the new `cycleTrackingEnabled` flag.
- Home screen: `mobile/src/app/(tabs)/index.tsx` — hosts `SkinWeatherCard` at top; the
  check-in card slots below it. `routine_checkins` proves the daily-habit UX works.

### Steps

**A. Migration `supabase/migrations/0015_lifestyle_logs.sql`.** Table
`lifestyle_logs`: `id uuid pk default gen_random_uuid()`, `user_id` (same reference +
cascade convention as `reaction_logs`), `log_date date not null`,
`unique (user_id, log_date)`, `sleep_quality smallint check (sleep_quality between 0 and 2)`,
`stress_level smallint check (…0 and 2)`, `water_level smallint check (…0 and 2)` (all
three nullable — unanswered ≠ zero), `diet_dairy boolean not null default false`,
`diet_sugar boolean not null default false`, `diet_alcohol boolean not null default false`,
`cycle_phase text check (cycle_phase in ('menstrual','follicular','ovulation','luteal'))`
nullable, `created_at`/`updated_at` + the standard trigger, RLS crud_own, index
`(user_id, log_date desc)`. Column comment on `cycle_phase`: opt-in, off by default in
the client. Apply to `rfuuznnbctfyqttslrbv` after merge (rule 6).

**B. Types + data access.** `types.ts`: `LifestyleLevel = 0 | 1 | 2`,
`CyclePhase`, `LifestyleLog` interface mirroring the table. `api.ts`:
`getLifestyleLogs(sinceISO: string)` and `upsertLifestyleLog(userId, log)` (PostgREST
upsert on `user_id,log_date`). `query.ts`: `qk.lifestyleLogs`. `hooks.ts`:
`useLifestyleLogs(days)` + `useUpsertLifestyleLog()` (optimistic update on today's row,
invalidate on settle).

**C. Check-in UI.** A compact "Today's check-in" `GlassCard` (tier `raised`) on Home
below the Skin Weather card: three 3-level tap scales (sleep 😴, stress, water) +
three toggle chips (dairy, sugar, alcohol). Each tap upserts immediately — no save
button. When `cycleTrackingEnabled`, a fourth row: a 4-segment cycle-phase control.
Collapsed state once fully logged ("Logged for today ✓" with an edit affordance).
Settings: `cycleTrackingEnabled: boolean` (default **false**) in the settings store +
a "Track cycle phase" toggle in the Profile tab near the existing settings, with one
caption line stating the data stays in their account and is deletable. No mockup —
rule 7 recipe applies.

**D. Correlation v2 (both mirrors + fixtures, one commit).** Extend the engine:
- New `CorrelationEventKind` value `'lifestyle'`. New builder input: lifestyle events
  are **sustained streaks**, not single days — ≥3 consecutive logged days (constant
  `MIN_STREAK_DAYS = 3`) of poor sleep (`sleep_quality === 0`), high stress
  (`stress_level === 2`), or a diet flag `true`, ending within the existing
  `MIN_EFFECT_DAYS`-compatible window before a scan. Event label e.g. "Low-sleep
  stretch (4 days)", "Sugar-heavy stretch (3 days)". Cycle phase is **not** an event
  in v1 (single days, no streak semantics) — it flows only into coach context (step E).
- Signature: `correlateScanTrends(scans, shelfItems, reactions, lifestyleLogs?)` —
  optional 4th param, `[]` default, so existing call sites compile unchanged.
- Measure effects with the existing delta machinery; insights keep `MAX_INSIGHTS` and
  the caveat. Direction semantics: a worsening after a negative streak is the expected
  correlation ("Breakouts rose 8 points after your low-sleep stretch").
- Port everything **verbatim** to `supabase/functions/_shared/correlation.ts`; keep the
  `⚠ Lockstep` headers; extend the parity fixture with ≥2 lifestyle cases (one streak
  hit, one streak-too-short miss) and mirror it byte-for-byte.
- Progress tab: pass `useLifestyleLogs` data into the existing call; lifestyle insights
  render through the existing card with no new UI.

**E. Memory seam.** In `assembleMemoryContext` (`_shared/memory.ts`): add
`lifestyle_logs` (last 14 days) to the existing `Promise.all`; pass logs into the
ported engine; emit a compact `LIFESTYLE (last 2 weeks)` block — logged-day count,
averages ("sleep mostly poor", "sugar flagged 5 of 9 days"), current cycle phase only
when present. Emit nothing when no logs (new users pay zero tokens). Redeploy `chat`
and `skin-forecast` per rule 11 with the post-deploy byte-diff.

**F. Tests + verification.** New engine tests in `correlation.test.ts` (streak
detection boundaries, unanswered-nulls ignored, optional-param default) + updated
parity suite. Web preview: log a check-in on Home, confirm the upsert lands (network
tab), confirm collapsed state on reload, zero console errors. Live coach: throwaway
guest (rule 9) with seeded logs + scans → ask "what's driving my breakouts?" — reply
must cite the lifestyle correlation with the caveat. Transcript in report.

### Done when
- Migration 0015 merged **and applied**; check-in card + settings toggle shipped;
  engine v2 in both mirrors with green parity; coach demonstrably cites a lifestyle
  correlation live; ADR-0013 written; quality gate green.

**Commits:** `chore(supabase): 0015 lifestyle_logs` ·
`feat(mobile): daily lifestyle check-in (home card + cycle opt-in)` ·
`feat(mobile): lifestyle-aware correlation engine (both mirrors + parity)` ·
`feat(supabase): lifestyle context in coach memory` ·
`docs: ADR-0013 + MEMORY_SYSTEM + CODE_INDEX`.

**Docs/memory:** ADR-0013 (`docs/adr/0013-lifestyle-diary.md`: the data class, the
privacy stance — RLS, cycle opt-in default-off, deletable; streak-event design;
rejected alternatives: AI-extracting lifestyle facts from chat, a separate diary tab);
`docs/MEMORY_SYSTEM.md` gains the LIFESTYLE context source; README feature bullet;
CODE_INDEX; memory-store note (new table, engine signature change, cycle-opt-in flag).

---

## WS-C — Weekly Glow Report + shareable card

**Model: Sonnet implementation, then a separate Opus review pass before commits are
finalized** (reviewer checks: prompt/validation quality against the `skin-forecast`
standard, seam lockstep, share-card visual fidelity, notification identifier hygiene).
Goal: once a week Glowi writes the user a report — what moved, what worked, what to
focus on — rendered beautifully, delivered by a local notification, and exportable as
a branded share card. **Runs after WS-B** (consumes lifestyle-aware correlations).

**Grounding facts (verified 2026-07-09):**
- The idempotent-cache pattern to copy: `skin-forecast` edge function + `skin_forecasts`
  table (one row per user per day, unique `(user_id, forecast_date)`; client triggers
  lazily; cache hit returns without calling Claude). The report is the same shape at
  weekly grain. There is **no server cron** on this project — generation is
  client-triggered on app open, which is a deliberate architecture decision to record
  in ADR-0014.
- Notifications are local + identifier-based (`mobile/src/lib/notifications.ts`:
  `glowi-routine-am/pm`, `glowi-weekly-scan`; never `cancelAll`). A response listener
  for deep-linking may not exist yet — check `_layout.tsx`; add
  `Notifications.addNotificationResponseReceivedListener` routing on
  `response.notification.request.content.data.url` if absent.
- AI seam: `AIProvider` (`mobile/src/lib/ai/types.ts`) has 8 methods; `live.ts` invokes
  edge functions, `mock.ts` mirrors deterministically. `getAIProvider()` in `index.ts`.
- Week data sources all exist: `scans` (scores/concerns), `routine_checkins` (adherence
  vs 14 possible AM+PM slots), correlation insights (`_shared/correlation.ts`, incl.
  WS-B lifestyle), `skin_forecasts` (week's environment), `shelf_items` events.
- Share deps do not exist yet: `npx expo install react-native-view-shot expo-sharing`
  (verify both are in the SDK-56 compatibility list first, rule 8).
- Brand surface: `GlowiAvatar` + theme tokens (clay `#BC5E38`, bgDarkDeep `#15110E`,
  ink `#EFE6D8`) — the card is a COMPONENT_FIDELITY-grade surface, not an afterthought.

### Steps

**A. Migration `supabase/migrations/0016_glow_reports.sql`.** Table `glow_reports`:
`id uuid pk`, `user_id` (reaction_logs conventions), `week_start date not null`
(Monday, ISO), `unique (user_id, week_start)`, `content jsonb not null`, `created_at`.
RLS crud_own; index `(user_id, week_start desc)`. Apply after merge (rule 6).

**B. Edge function `supabase/functions/glow-report/index.ts`.** Input
`{ week_start }` (client computes the Monday of the most recent **completed** week).
Flow, copying `skin-forecast`'s structure: validate input (date shape, not in the
future, not more than ~8 weeks past) → cache check on `(user_id, week_start)` → if
miss, service-client queries scoped to the week window (scans in-window + the last
scan before the window for the delta; check-in count; shelf adds; reaction logs;
week's forecasts condensed to counts like "5 high-UV days") + correlation insights via
the existing `_shared/correlation.ts` (with lifestyle logs, post-WS-B) → **one** Claude
call (temperature ≤ 0.4, structured-JSON system prompt, `extractJson` from
`_shared/anthropic.ts`) → validate the shape below field-by-field (reject, don't
patch, on violation — the `analyze-skin` discipline) → insert → return `{ report }`.

```ts
/** content jsonb — validated server-side, mirrored in types.ts as GlowReportContent */
{
  headline: string;            // "A steady week — your barrier thanks you"
  score_note: string;          // grounded in the actual delta, or honest about no scans
  wins: string[];              // 1–3, each grounded in a real datum (adherence, insight, streak)
  watchouts: string[];         // 0–2
  next_week_focus: string;     // one concrete, doable focus
  stats: { scans: number; checkins: number; checkin_possible: number; streak_days: number };
}
```

Prompt requirements: embed the correlation caveat verbatim when citing insights; a week
with no scans must produce an honest, encouraging report (never fabricate movement);
never mention data the user doesn't have. `verify_jwt: true` like its siblings; deploy
per rule 11.

**C. AI seam.** `types.ts` (lib/ai): `glowReport(input: { weekStart: string }):
Promise<GlowReport>` added to `AIProvider`. `live.ts`: invoke `glow-report`. `mock.ts`:
deterministic synthesis from the same local queries (scans/check-ins via existing api
helpers), keyed by `weekStart` so repeat calls are stable — same discipline as mock
forecasts. Domain types `GlowReport` + `GlowReportContent` in `lib/types.ts`. Hook:
`useGlowReport(weekStart)` (`staleTime: Infinity` — reports are immutable). `qk` entry.

**D. Report screen + entries.** New route `mobile/src/app/report/[weekStart].tsx`:
headline (the screen's one Glow element), score-delta ring (`ProgressRing`), stats row
(scans / adherence % / streak), wins + watchouts lists, next-week focus card, the
caveat caption when insights are cited. Entry points: a "Your week in review" card on
the Progress tab (latest completed week; shows a skeleton until generated) — and the
weekly notification (E). No mockup — rule 7 recipe + tells.

**E. Weekly notification.** In `notifications.ts`:
`scheduleGlowReportReminder()` — identifier `glowi-glow-report`, weekly trigger
(consult SDK-56 docs for the correct cross-platform weekly trigger type; Monday
morning, after the typical AM-routine slot), `data: { url: '/report/<computed>' }`,
cancel-by-identifier before scheduling (file convention). Wire the response listener
from the grounding note if absent. Schedule it alongside the existing weekly-scan
reminder call site so permission is only requested once.

**F. Shareable card.** `npx expo install react-native-view-shot expo-sharing`. New
component `mobile/src/components/GlowReportShareCard.tsx`: 4:5 branded card —
`bgDarkDeep` field, `GlowiAvatar` mark, wordmark, score-delta ring, one win line,
streak chip. **No user photos, no concern details by default** (share-safe by
design — record in ADR-0014). "Share my glow" `GlowButton` on the report screen:
`captureRef` → `Sharing.shareAsync` (native only; hide the button on web via
`Platform.OS === 'web'`, and note `Sharing.isAvailableAsync` gating).

**G. Verify.** Mock-mode web: report screen renders for a seeded week, zero console
errors, screenshot. Live: throwaway guest (rule 9) with a seeded week of scans +
check-ins → generate → assert one `glow_reports` row, reload → cache hit (no second
Claude call, check `get_logs`). Share sheet + notification firing need a device —
call both out explicitly as deferred device checks (WS4 precedent), don't claim them.

### Done when
- Migration 0016 merged **and applied**; edge fn deployed + byte-diffed; seam extended
  in live **and** mock; report screen + Progress entry + notification + share card
  shipped; live cache-hit proven; Opus review pass done, findings addressed; ADR-0014
  written; quality gate green.

**Commits:** `chore(supabase): 0016 glow_reports` ·
`feat(supabase): glow-report edge function` ·
`feat(mobile): weekly glow report — seam, screen, progress entry` ·
`feat(mobile): glow report notification + deep link` ·
`feat(mobile): shareable glow card` ·
`docs: ADR-0014 + README + MEMORY_SYSTEM + CODE_INDEX`.

**Docs/memory:** ADR-0014 (`docs/adr/0014-weekly-glow-report.md`: lazy client-triggered
generation vs server cron on the free tier, the weekly cache table, share-card privacy
stance, notification design); README "What it does" bullet; MEMORY_SYSTEM if the report
consumes `assembleMemoryContext` pieces (it queries directly — document either way);
CODE_INDEX (route, component, lib, edge fn, migration); memory-store note (new edge fn,
share deps, notification identifier).

---

## After all three workstreams — orchestrator close-out

1. **README.md** — the three capabilities read correctly at the top level (diary,
   report + share, replenishment).
2. **docs/ARCHITECTURE.md** — lifestyle data flow, the report's weekly-cache pattern,
   replenishment as a pure-client engine.
3. **docs/FEATURE_BACKLOG.md** — a "Glow Loop" section marking the three shipped, with
   fast-follow candidates (AI replenishment copy; cycle-phase correlation events;
   report history browser).
4. **Persistent memory store**
   (`~/.claude/projects/c--Users-Parthiv-Paul-Documents-Glowi/memory/`): update
   `glowi-project.md` (new tables 0015/0016, `glow-report` function, engine signature
   change, share deps) and the Glow Loop plan memory; index in `MEMORY.md`.
5. Final sweep: quality gate green on `main`, CI green, working tree clean,
   `list_migrations` matches `supabase/migrations/`, all edge functions byte-verified.
