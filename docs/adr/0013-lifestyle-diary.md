# ADR 0013: Lifestyle Diary + lifestyle-aware correlation

- Status: Accepted
- Date: 2026-07-09

## Context

Glowi can already say "since you added niacinamide, your dark spots dropped 12 points"
by lining routine changes up against the scan history ([ADR-0011](0011-correlation-insights-in-coach-context.md)).
But the biggest drivers of skin — sleep, stress, diet, hydration, hormonal cycle — leave
no trace in the app, so the correlation engine is blind to them and the coach can only
guess. The goal: a 10-second daily check-in that turns those lifestyle signals into the
same kind of evidence ("your breakouts track your low-sleep weeks") without adding an AI
call or a new place to visit.

This introduces the app's first **behavioral** data class and its most privacy-sensitive
optional field (menstrual-cycle phase), so the design leads with the data model and the
privacy stance.

## Decision

**A dedicated `lifestyle_logs` table, one row per user per day** (migration
`0015_lifestyle_logs.sql`). Columns: three 0–2 self-report scales (`sleep_quality`,
`stress_level`, `water_level`) that are **nullable** — an unanswered scale is not the
same as "zero" and must never be scored as a bad day; three boolean diet flags
(`diet_dairy`, `diet_sugar`, `diet_alcohol`) that default `false` (an untoggled chip is a
real "not today" answer); and a nullable `cycle_phase` enum. `UNIQUE (user_id, log_date)`
makes the daily check-in an upsert. Standard `crud_own` RLS, the shared `set_updated_at`
trigger, and a `(user_id, log_date desc)` index — transcribed from `reaction_logs`
([ADR-0009](0009-reaction-log.md)), the closest precedent.

**Privacy stance, stated in the schema and the UI.** Every row is RLS-scoped to its owner
like every other user table. Cycle tracking is **opt-in and off by default**: the
`cycle_phase` column exists either way (the schema reserves it), but the client only
shows the cycle row when the user flips "Track cycle phase" in Profile, which carries a
one-line notice that the data stays in their account, is never shared, and is deleted the
moment they clear a day's log. A `COMMENT ON COLUMN` records the opt-in intent at the
schema level so it survives independently of the client.

**Streak events, not single days, feed the correlation engine.** A single rough night
correlates with nothing; a *sustained* stretch is the signal. The engine gains a
`'lifestyle'` `CorrelationEventKind` and a `lifestyleEvents()` builder that emits an event
only for a run of **≥ `MIN_STREAK_DAYS` (3) consecutive logged days** of poor sleep
(`sleep_quality === 0`), high stress (`stress_level === 2`), or a diet flag `true`. Each
event is anchored to the **first day of the run** so the existing baseline→endpoint delta
machinery measures the scan history from *before* the stretch; the label carries the
duration ("Low-sleep stretch (4 days)"). A worsening after a negative stretch is the
expected correlation and surfaces through the same headline/direction logic already used
for shelf adds and reactions — no new measurement code, no new UI on the Progress tab.

**Cycle phase is context, not an event (v1).** Cycle phase is a single-day attribute with
no streak semantics, and phase→skin effects are individual and non-linear. Rather than
invent a dubious event model, cycle phase flows only into the coach's memory context as a
current-phase note. Turning it into a correlation event is a deliberate fast-follow, not
this change.

**Signature stays backward-compatible.** `correlateScanTrends` gains an optional 4th
parameter `lifestyleLogs` defaulting to `[]`, so every existing call site compiles
unchanged; the Progress tab and `assembleMemoryContext` opt in by passing the logs. Both
`correlation.ts` mirrors are updated together and the parity fixture gains two lifestyle
cases (one streak hit, one too-short miss), per the lockstep discipline ADR-0011
established.

**Memory seam gains a `LIFESTYLE` block.** `assembleMemoryContext` queries the last 14
days of logs, feeds them into the ported engine (so lifestyle correlations reach the
coach with zero per-feature wiring), and emits a compact recap — logged-day count,
sleep/stress tendencies, diet-flag frequencies, and the current cycle phase when present.
The block is **absent entirely when nothing is logged**, so new users pay zero extra
tokens, matching the ADR-0011 cost profile. No new AI call is added; `chat` and
`skin-forecast` inherit the block on their next deploy.

## Rejected alternatives

- **AI-extract lifestyle facts from chat** instead of a structured log. Rejected: it is
  non-deterministic, can't produce streak arithmetic, costs tokens on every extraction,
  and gives the user no direct control over a privacy-sensitive record. A typed table is
  auditable, free to query, and deletable row-by-row.
- **A separate "Diary" tab.** Rejected: a new tab is a new place to forget. The check-in
  lives on Home under the Skin Weather card where the daily-habit surface (routine
  check-ins) already proves users return, and collapses to a one-line summary once logged.
- **Score unanswered scales as zero** (fewer nulls, simpler math). Rejected: it fabricates
  bad days out of missing data and would manufacture phantom streaks. Nullable-until-
  answered is the honest model.
- **Cycle phase as a correlation event in v1.** Rejected for now (see above) — kept as a
  fast-follow rather than shipping a weak event model.

## Verification

Quality gate green: strict `tsc`, ESLint, and the full jest suite (119 tests) pass,
including new `lifestyleEvents` streak-boundary tests (exact-threshold hit, one-day-short
miss, non-consecutive-gap break, null-ignored, high-stress/diet-flag labels) and the
optional-param-default behavior, plus two new lifestyle cases in the byte-identical
correlation parity fixture. The two `correlation.ts` mirrors differ only in the lifestyle
type annotation (`LifestyleLog` vs the self-contained `CorrelationLifestyleLog`), verified
by diff.

Deferred to post-merge (the `lifestyle_logs` table is applied after merge, per the
migration discipline): the interactive web check-in round-trip (tap → upsert → collapsed
state on reload) and a live-coach citation of a lifestyle correlation against a seeded
throwaway guest. Both require the migration applied and `chat`/`skin-forecast` redeployed,
which are the explicit post-merge steps.

## Consequences

**Advantages**

- Lifestyle signal reaches every AI surface reading `assembleMemoryContext` (chat,
  skin-forecast) and the Progress tab with no new wiring and no new AI call.
- The check-in is a DB-only write, so it works identically in live and mock modes — the
  AI seam is untouched.
- Privacy is enforced at the data layer (RLS) and defaulted conservatively (cycle off),
  with the intent recorded in the schema, not just the client.

**Tradeoffs**

- A third lockstep pair obligation is not added, but the existing `correlation.ts` pair
  now carries lifestyle logic — the ongoing lockstep cost from ADR-0011 grows slightly.
- Streak detection is calendar-consecutive: a missed check-in day breaks a run. This is
  intentional (a gap genuinely breaks the "sustained" claim) but means sparse loggers
  generate fewer lifestyle insights.
- Cycle-phase correlation is deferred, so that field is context-only until a follow-up.
