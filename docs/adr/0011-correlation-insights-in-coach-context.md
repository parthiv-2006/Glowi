# ADR 0011: Correlation Insights in the Coach's Memory Context

- Status: Accepted
- Date: 2026-07-08

## Context

The Progress tab already runs `correlateScanTrends` client-side to show "What changed
your skin" — routine changes (shelf additions, logged reactions) lined up against the
scan history that followed. It's a good insight, but it's stranded on one tab: the
coach can't reference it, so a user who asks "is anything actually working?" gets a
generic answer even when their own data has a clear signal. The insight needs to reach
`assembleMemoryContext`, the single read path every AI surface shares.

## Decision

**Compute server-side, in `assembleMemoryContext`** — a Deno port of the pure
correlation module runs inside the context assembler on every chat/forecast call,
rather than having the client write `source='system'` `ai_memories` rows when the
Progress tab is viewed. Rejected alternative: client-authored memory rows require the
user to visit Progress to refresh the signal, need stale-row supersede management as
new scans arrive, and duplicate state that's cheaply derivable at read time from data
`assembleMemoryContext` already has query access to. The port costs one lockstep
obligation (same discipline as `ai/live.ts` / `ai/mock.ts`); the alternative costs a
write-path lifecycle. The `ai_memories.source='system'` enum value stays — it's already
in the schema and harmless, just unused by this feature.

**Ingredient → concern map, not free-text inference** — a new pure module
(`mobile/src/lib/ingredientConcerns.ts`, ported verbatim to
`supabase/functions/_shared/ingredientConcerns.ts`) maps normalized active-ingredient
names to the concern slugs they plausibly target (niacinamide → oiliness/pores/
hyperpigmentation, salicylic acid → acne/blackheads/pores/oiliness, etc.), sourced only
from slugs that exist in `supabase/seed/0001_concerns_and_tips.sql`. When a
correlation's top-moved concern matches a concern targeted by the event's
`key_ingredients`, both the Progress tab and the coach's context render a "why" line —
e.g. "Niacinamide targets dark spots — this lines up." A static map is auditable and
free; an LLM call per insight would add latency and cost to every chat turn for a
line that's structurally the same every time.

**`ConcernDelta` gained a `slug` field** — the existing engine only carried
`display_name` on each delta, which is fine for rendering but not for matching against
the ingredient map's slug-keyed output. Both `correlation.ts` files now populate
`slug` from the scan's `concern_slug` alongside the existing `name`; this is additive
and doesn't change any existing headline/direction behavior.

**Lockstep port, not a shared package** — `supabase/functions/_shared/correlation.ts`
and `_shared/ingredientConcerns.ts` mirror the mobile originals with self-contained
types (no cross-imports from `mobile/`), each carrying a `⚠ Lockstep: mirror of <path>`
header comment in both directions. A shared npm/JSR package was rejected as
disproportionate machinery for ~350 lines of pure logic with no external consumers;
the existing `ai/live.ts` + `ai/mock.ts` precedent already establishes that this
codebase accepts a documented lockstep pair over a shared-package abstraction.

**Parity enforced by a shared fixture, not a Deno test runner** — this sandbox has no
`deno` binary, so a `Deno.test` file couldn't be executed or verified here. Instead,
`mobile/src/lib/__tests__/fixtures/correlation-parity.json` (mirrored byte-for-byte at
`supabase/functions/_shared/__fixtures__/correlation-parity.json`) encodes two cases —
an improving shelf-add and a worsening reaction, one with an ingredient match and one
without — and `correlation.parity.test.ts` asserts the mobile engine's exact output
against it. The Deno port was verified two ways instead: a line-by-line diff against
the mobile source (only the type-shape and import-path lines differ), and a real
end-to-end call against the deployed `chat` function (see Verification below), which
exercises the live Deno code path directly — a stronger guarantee than a local unit
test for this specific risk (a bundle-time or runtime divergence would have surfaced
as a broken or missing correlation citation in the actual reply).

**Format emitted into the context block:**

```
ROUTINE CORRELATIONS (measured from their scan history — correlations, not proof):
  • Added Niacinamide 10% + Zinc 1% (2026-06-23): Dark spots dropped 15 points across the next scan. Niacinamide targets dark spots.
  ↳ Use these to explain what seems to be working or not; always keep the correlation caveat.
```

Emitted only when `correlateScanTrends` returns at least one insight (capped at its
existing `MAX_INSIGHTS = 4`); a new user with fewer than two completed scans pays zero
extra tokens, since the block is simply absent.

## Verification

Live end-to-end: seeded a throwaway guest account with two completed scans (dark
spots 50 → 35) and a niacinamide shelf item added between them, asked the deployed
`chat` function "What's actually working for me lately?", and the live Claude reply
correctly named the product, the 15-point drop, the ingredient mechanism, and closed
with the correlation caveat — confirming the ported Deno code, not just the mobile
mirror, produces the intended behavior in production. Test data was removed after
the check.

## Consequences

**Advantages**

- The correlation signal reaches every AI surface that reads `assembleMemoryContext`
  (today: chat, skin-forecast) with zero per-feature wiring, the same leverage
  ADR-0009's gotcha-memory approach gets from the same read path.
- Zero cost for users without enough history — the block only appears when there's a
  real signal to report.
- The "why" line is fully deterministic and free (no extra model call), auditable
  against seed data, and shared unchanged between the Progress tab and the coach.

**Tradeoffs**

- Two files (mobile + Deno) must be kept in lockstep for both `correlation.ts` and
  `ingredientConcerns.ts` — a real ongoing cost, mitigated by the header comments and
  the parity fixture, but not eliminated by them.
- The ingredient map is a curated list, not exhaustive — an active ingredient absent
  from the map simply contributes no "why" line rather than a wrong one, which is the
  safe failure mode but means coverage will lag new actives until the map is extended.
- No Deno test runner was available in this environment to execute `Deno.test`
  directly against the port; parity rests on the fixture-driven mobile test plus the
  live verification above rather than an automated Deno-side unit test. A follow-up
  session with `deno` available could add one for regression coverage.
