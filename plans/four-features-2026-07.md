# Four Features — July 2026

User-approved scope (from docs/FEATURE_BACKLOG.md): Reaction/Sensitivity Log,
Routine Sequencing + Wait Times, Budget/Cost-per-Use, In-Store Purchase Decision
Support. Build in backlog priority order. Every feature must work in mock mode
(ADR-0003); all new schema goes in append-only migrations; RLS on every user table.

---

## Phase 0 — Audit & verification (done first)

- Static gate: typecheck ✓ lint ✓ 33 tests ✓.
- Supabase project had auto-paused (free tier, 11 days idle) → restored with
  user approval.
- Runtime walk of every route via Expo web + Playwright: auth (guest), home,
  scan → analyzing → results, concern tabs, chat, routine + check-in, progress
  (timeline, sparklines, streak), shelf (add/detail/conflicts), forecast,
  learn/article, profile, memory. Fix anything broken before building.

## Feature 1 — Reaction / Sensitivity Log (backlog #1)

**Schema** — migration `0012_reaction_logs.sql`:
`reaction_logs` (id uuid pk, user_id fk, shelf_item_id uuid null fk→shelf_items
on delete set null, product_name text not null, brand text null,
key_ingredients text[] default '{}', reacted_on date not null, symptoms text[]
not null, severity text check in ('mild','moderate','severe'), notes text null,
created_at, updated_at + trigger). RLS `for all using (auth.uid() = user_id)`.

**Data layer** — `api.ts`: getReactionLogs / addReactionLog / deleteReactionLog.
`hooks.ts`: useReactionLogs / useAddReactionLog / useDeleteReactionLog.
On add: also insert an `ai_memories` row (type `gotcha`, importance 5, source
`system`, content "Reacted badly to {product} on {date}: {symptoms}. Never
recommend it or similar formulations ({ingredients}).") — this feeds the coach,
Skin Weather, and scan memory context **with zero edge-function changes**,
because assembleMemoryContext already surfaces gotchas first.

**Pure logic** — `lib/reactions.ts`: `sharedRiskIngredients(reaction, item)` →
overlap of normalized key_ingredients; `riskyShelfItems(reactions, items)` →
items sharing ≥1 ingredient with any logged reaction. Unit tests.

**UI** — `/reactions` list screen (log entries, severity chips, delete);
`/reactions/add` form (pick shelf item or free-text product, symptoms multi-
select chips, severity, date, notes); entry points: Shelf header button +
shelf item detail "Log a reaction"; warning banner on shelf items that share
ingredients with a logged reaction.

## Feature 2 — Routine Sequencing + Wait Times (backlog #4)

No schema change — derived, deterministic client logic.

**Pure logic** — `lib/routineSequence.ts`:
- `waitAfterMinutes(step)` by category/ingredient heuristics (vitamin C serum
  → 10 min before SPF; exfoliant/treatment (retinoid, AHA/BHA) → 20 min;
  toner → 1 min; moisturizer before SPF → 5; default 0/“no wait”).
- `sequenceWarnings(steps, period)` → ordered flags: SPF not last in AM /
  SPF in PM (already filtered), cleanser not first, exfoliant + retinoid same
  period, vitamin C + retinoid same period, moisturizer before serum
  (occlusive blocks actives). Each: severity + message + fix hint.
Unit tests for both.

**UI** — routine screen: wait-time connector chips between step cards
("wait ~10 min"), and a warnings GlassCard above the list when
`sequenceWarnings` is non-empty.

## Feature 3 — Budget / Cost-per-Use (backlog #6)

**Schema** — migration `0013_shelf_budget.sql`: `alter table shelf_items add
column price_usd numeric(8,2) null check (price_usd >= 0)`.

**Data layer** — include `price_usd` in SHELF_COLS + ShelfItemInput; price
field in add/edit forms (prefill from catalog match `price_usd` when present).

**Pure logic** — `lib/budget.ts`: `costPerUse(item)` (price / max(1, times_used),
null when unpriced or unused), `shelfValue(items)` (sum of active prices),
`quarterSpend(items, today)` (priced items created in last 90 days),
`valueLeaderboard(items)` (priced+used items sorted by cost-per-use asc).
Unit tests.

**UI** — `/shelf/budget` screen: 3 stat tiles (shelf value, 90-day spend,
avg cost-per-use) + leaderboard list (best value → worst, cost-per-use badge);
"Budget" entry button on Shelf; cost-per-use line on item detail.

## Feature 4 — In-Store Purchase Decision Support (backlog #5)

**AI seam** — new `compareProducts(input)` on `AIProvider`:
input `{ imageABase64, imageBBase64 }` → `ProductComparison`
`{ verdict: 'a' | 'b' | 'either' | 'neither', products: [identA, identB],
rationale, considerations: string[] }` (types in `types.ts`, validated at the
boundary). Stateless — persists nothing, like identify-product.
- **Edge function** `compare-products`: JWT-required; sniffs both images'
  magic bytes (`_shared/images.ts`); prompt = both labels + latest completed
  scan concerns + shelf key_ingredients (conflict awareness) + catalog match;
  strict JSON, temperature 0, validated server-side against the verdict enum.
- **Mock**: reuses MOCK_IDENTIFICATIONS rotation; deterministic verdict keyed
  by hash of image lengths; realistic staged delay.

**UI** — route `/compare`: two photo slots (camera/library, same base64 flow
as shelf/add), "Compare" GlowButton → verdict card (winner highlighted,
rationale, considerations list, add-winner-to-shelf shortcut). Entry point:
button on Shelf screen ("Comparing in a store?") — keeps home uncluttered.

## Verification (per feature + final)

Quality gate (typecheck/lint/test/format) + Playwright walk of the new routes
in mock mode: screenshots, console-error check, data-presence assertions.
Regression pass over adjacent screens (shelf, routine, progress, home).

## Docs & memory

README feature list, ARCHITECTURE (tables + seam methods + functions table),
new ADR-0009? (numbering: next is 0009 in docs/adr? existing goes to 0008 —
new ADRs: reaction log 0009, purchase decision support 0010; sequencing and
budget are minor, documented in ARCHITECTURE), FEATURE_BACKLOG check-off.
Update persistent memory (glowi-project.md) with new tables/functions/routes.

## Commit plan (small, logical, Conventional Commits)

1. `chore(repo): commit plans/` (existing untracked plans + this one)
2. Fixes from the audit, one commit each (if any)
3. `feat(supabase): reaction_logs table + RLS` → 4. `feat(mobile): reaction log
   data layer + risk matching` → 5. `feat(mobile): reaction log screens + shelf
   warnings`
6. `feat(mobile): routine sequence logic + tests` → 7. `feat(mobile): wait-time
   chips + order warnings in routine`
8. `feat(supabase): shelf price column` → 9. `feat(mobile): budget logic +
   tests` → 10. `feat(mobile): shelf budget screen`
11. `feat(supabase): compare-products edge function` → 12. `feat(mobile):
    compareProducts AI seam (live+mock)` → 13. `feat(mobile): in-store compare
    screen`
14. `docs: README/ARCHITECTURE/ADRs/backlog updates`
Push after each feature block is green.
