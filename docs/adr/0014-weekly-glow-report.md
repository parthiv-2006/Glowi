# ADR 0014: Weekly Glow Report + shareable card

- Status: Accepted
- Date: 2026-07-09

## Context

Glowi accumulates a week of signal — scans, routine check-ins, shelf changes, reactions,
lifestyle streaks ([ADR-0013](0013-lifestyle-diary.md)), skin-weather forecasts — but
never steps back to tell the user what it *meant*. The retention opportunity is a weekly
moment: once a week, Glowi writes you a short, honest recap ("what moved, what worked,
what to focus on next"), delivered by a notification and exportable as a branded card the
user can share. It is the third feature of the Glow Loop, and the only one that turns the
accumulated data into a recurring reason to come back — and, via the card, a light growth
loop.

The engines already exist. The novelty is the delivery: a cached weekly artifact, one
Claude call per user per week, a notification, and a share surface — on a project with **no
server cron** and a free-tier posture. This ADR records how generation is triggered, why
the report is a cache table, what the model is and is not allowed to do, and the share
card's privacy stance.

## Decision

**Lazy, client-triggered generation into a `glow_reports` cache table** (migration
`0016_glow_reports.sql`), one immutable row per user per completed week, `UNIQUE (user_id,
week_start)`, `crud_own` RLS, `(user_id, week_start desc)` index — the exact idempotent
shape as `skin_forecasts` ([ADR-0005-era](../ARCHITECTURE.md)) at weekly grain. There is
**no server cron** on this project (Supabase free tier, and a cron would be one more thing
to secure and pay for). Instead the client triggers generation on app open: the Progress
tab and the report screen both call `useGlowReport(weekStart)` for the most recent
*completed* week, and the edge function returns the cached row if it exists or generates it
once. This trades "the report is ready the instant the week ends" for zero infrastructure —
acceptable because the user only sees the report when they open the app anyway, and the
weekly notification is what actually pulls them in.

**One Claude call, and it writes prose only — never numbers.** The `glow-report` edge
function copies `skin-forecast`'s discipline: validate input (`week_start` must be an ISO
date, a Monday, not in the future, not more than 8 weeks past) → cache check → gather the
week's real data with the service client (scan movement vs. the last scan before the
window, check-in adherence out of 14 AM/PM slots, the check-in streak, shelf adds,
reactions, forecast environment condensed to counts, and lifestyle-aware correlations via
the shared `_shared/correlation.ts`) → **one** `callClaude` at `temperature 0.4` with a
strict-JSON system prompt → validate field-by-field and **reject, don't patch** on
violation (the `analyze-skin` discipline) → insert. Crucially, **every statistic is
computed server-side** and attached as `stats`; the model is asked only for `headline`,
`score_note`, `wins`, `watchouts`, and `next_week_focus`. It never sees a way to invent a
number, a scan, or movement that didn't happen. The prompt forces an honest, encouraging
report when there were no scans, and requires the correlation caveat verbatim whenever an
insight is cited. `verify_jwt: true`, like its siblings.

**The AI seam gains a ninth method, mirrored in mock.** `glowReport(input)` is added to
`AIProvider`; `live.ts` invokes the edge function, and `mock.ts` synthesizes the *same*
report shape deterministically from the same local queries (scans, check-ins, correlations)
and persists it to `glow_reports`, so a mock-mode reload hits the cache exactly like live.
The report is immutable, so the hook uses `staleTime: Infinity`.

**The score ring is derived client-side, not stored.** `stats` deliberately carries only
counted facts (scans, checkins, checkin_possible, streak_days). The report screen and share
card render a skin-score-delta ring computed from the user's own scan history for the
reported week — keeping the stored content shape minimal and letting the visualization stay
a pure view concern. When the week had no scan, the ring falls back to the streak.

**The share card is share-safe by construction.** `GlowReportShareCard` is a 4:5
`bgDarkDeep` brand surface — mark, wordmark, the headline metric ring, one win line, streak
chip — with **no user photos and no concern details by default**. It renders off-screen and
is captured by `react-native-view-shot`; its ring is a **static** (non-animated) SVG so a
screenshot can't catch an arc mid-fill, and every text color is set explicitly for the dark
field (the Warm Editorial dark-bg text gotcha). "Share my glow" uses `expo-sharing`, is
hidden on web (`Platform.OS`), and gates on `Sharing.isAvailableAsync`.

**One weekly notification, identifier-based, with a fresh deep link.**
`scheduleGlowReportReminder()` schedules a `WEEKLY` trigger (Monday 09:00; SDK-56 weekday
`2`, since `1` is Sunday) under the identifier `glowi-glow-report`, cancel-by-identifier
before scheduling — never `cancelAll` — and rides alongside the existing weekly-scan
reminder so permission is requested once. Its deep link is the **parameterless marker
`/report`**; a root-layout `addNotificationResponseReceivedListener` resolves it to the
current completed week at *tap* time, so a repeating schedule never links to a stale week.

## Rejected alternatives

- **A server cron (pg_cron / scheduled edge function) to pre-generate reports.** Rejected:
  it adds infrastructure to secure and pay for on a free-tier project, for a report the user
  only reads on app open. Lazy client-trigger with a cache table is the same result with no
  moving server parts — consistent with how `skin-forecast` already works.
- **Letting the model return the stats.** Rejected outright: a weekly recap that fabricates
  "you scanned 3 times" or "up 8 points" is worse than no recap. Stats are computed from the
  data and the model only writes around them — the `analyze-skin` reject-don't-trust stance.
- **Storing the score delta in `content.stats`.** Rejected: the delta is a view concern the
  client can compute from scans it already has; keeping it out of the stored row keeps the
  cached artifact minimal and avoids a second source of truth for a number.
- **Putting the user's before/after photos or concern list on the share card.** Rejected on
  privacy grounds — a shared image should never leak skin detail. The card carries only a
  score/streak and one win line by default.
- **A fixed `data.url` computed at schedule time.** Rejected: the weekly trigger repeats, so
  a URL baked at schedule time would point at an ever-older week. The `/report` marker
  resolved at tap time is always fresh.

## Verification

Quality gate green: strict `tsc`, ESLint, and the full jest suite (124 tests) pass,
including new `mostRecentCompletedWeekStart`/`weekEndOf` week-math tests (mid-week, Sunday
boundary, Monday roll-forward, and a 40-day always-a-Monday property sweep). The typed-route
table was regenerated for `/report/[weekStart]`.

Live (post-merge, after the migration is applied and the function deployed): a throwaway
guest is seeded with a completed week of scans + check-ins; the first `glow-report` call
inserts exactly one `glow_reports` row, and a second call for the same week returns from
cache with **no second Claude call** (confirmed against `get_logs`). The share sheet and the
notification firing require a physical device and are called out as **deferred device
checks** (the WS4 precedent) — not claimed here.

## Consequences

**Advantages**

- A recurring retention moment and a light growth loop (the share card) with **zero new
  infrastructure** — one cached Claude call per user per week.
- The report is honest by construction: numbers are computed, prose is bounded to real
  facts, and a no-scan week produces an encouraging report instead of fabricated progress.
- Works identically in live and mock (same shape, same cache), so the whole feature is
  demonstrable offline at zero token cost — the AI seam invariant holds.

**Tradeoffs**

- Generation is only as timely as the next app open; a user who never opens the app never
  generates the report (but also never needs it). The notification mitigates this.
- The report cannot recompute if the underlying data is later corrected — it is an immutable
  snapshot of what was known when first generated. This is deliberate (a report is a moment,
  not a live view) but means a mistaken week can't be "refreshed" without a manual delete.
- The share sheet and notification delivery are unverifiable without a device and remain
  deferred device checks.
