# Feature Backlog — Consumer-Driven Priorities

Features derived from the ideal Glowi consumer persona: a 25–40 year old spending
$100–$200/month on skincare, owns 15+ products, and wants synthesis — not more information.

> **Status (2026-07-06):** #2 shipped 2026-06-15 ([ADR-0008](adr/0008-ingredient-conflict-checker.md));
> #3 shipped as the Reaction Log ([ADR-0009](adr/0009-reaction-log.md)); #4 shipped as
> derived wait times + order warnings on the routine screen; #5 shipped as In-Store
> Compare ([ADR-0010](adr/0010-in-store-compare.md)); #6 shipped as the Shelf Budget
> screen. #1 shipped 2026-07-07 as Scan-to-Trend Correlation — a pure client-side
> engine (`mobile/src/lib/correlation.ts`) that lines shelf additions and logged
> reactions up against scan movement and surfaces the insights on the Progress tab.
> **All six features are now shipped.**

---

## 1. Scan-to-Trend Correlation
**What:** Overlay scan history against routine changes and surface causal insights.
Example: "After you added niacinamide in Week 3, your hyperpigmentation score dropped 12 points."

**Why:** Users scan periodically but have no feedback loop. Without correlation, scans
are snapshots, not progress. This turns Glowi into a coach with memory, not just a camera.

---

## 2. Ingredient Conflict Checker
**What:** Pull products from The Shelf (or a manual scan) and flag ingredient interactions —
safe to layer, time-of-day constraints (e.g. retinol PM only), or combinations to avoid.
Back every flag with a citation.

**Why:** This is one of the most Googled skincare topics. Users own conflicting actives and
have no trusted, personalized answer. Glowi already knows what's on their shelf — this is
the natural next step.

---

## 3. Reaction / Sensitivity Log
**What:** Let users log a bad reaction (product, date, symptoms) instantly. The coach never
recommends that product again and cross-references ingredients to warn about similar formulations.

**Why:** Users currently track this in Notes apps. It's the highest-stakes personalization
signal Glowi could have — one breakout from a bad recommendation destroys trust. Making this
native and feeding it into the AI context closes the most dangerous gap.

---

## 4. Routine Step Sequencing with Wait Times
**What:** Go beyond AM/PM product lists. Generate an ordered routine with explicit wait
times between steps (e.g. "Apply vitamin C → wait 10 min → apply SPF"). Flag if the current
order undermines any active ingredient.

**Why:** Users know their products but not the chemistry. Wrong application order can
neutralize actives or irritate skin. This is actionable, low-effort to implement on top of
existing routine data, and immediately useful every morning.

---

## 5. In-Store Purchase Decision Support
**What:** Scan two products side-by-side in a store. Glowi compares them against the user's
last scan concerns, checks for shelf conflicts, and returns a ranked verdict with a one-line
rationale.

**Why:** The purchase moment is the highest-intent skincare moment. Users currently fall back
to Reddit or ingredient apps. Glowi already has the scan result, the shelf, and the AI — this
feature just combines them at the right moment.

---

## 6. Budget Tracking / Cost-per-Use
**What:** Track spend across products on The Shelf. Show quarterly spend, cost-per-use
(price ÷ estimated uses from stock level), and a ranked "value" leaderboard.

**Why:** Users have no idea what they're actually spending or whether premium products are
earning their place. This creates accountability, surfaces waste, and builds loyalty to
products with a proven ROI. It also increases engagement with The Shelf feature.

---

## Build order rationale

| Priority | Feature | Reason |
|---|---|---|
| 1 | Reaction Log | Highest trust impact; feeds directly into existing AI context |
| 2 | Ingredient Conflict Checker | High-value, Shelf data already exists |
| 3 | Routine Sequencing | Low lift on top of existing routine; immediate daily utility |
| 4 | Scan-to-Trend Correlation | Requires scan history depth — grows more useful over time |
| 5 | Purchase Decision Support | Compound feature; best after 1–3 are solid |
| 6 | Budget Tracking | Engagement/retention feature; lower urgency than trust/utility |

---

## "Next Four" orchestration (2026-07 — shipped)

Beyond the six consumer features above, a four-workstream orchestration
([docs/ORCHESTRATION_NEXT_FOUR.md](ORCHESTRATION_NEXT_FOUR.md)) hardened the app for
real use. **All four shipped:**

- **WS1 — Live AI seam.** The app defaults to live mode against real Claude; all 8 AI
  capabilities QA'd end to end.
- **WS2 — Brand assets + device build.** Real Glowi-branded app icon / splash /
  adaptive-icon set generated from the mascot (`npm run assets`), plus an EAS Android
  preview build for on-device install.
- **WS3 — Coach correlations.** The scan-to-trend correlation signal now reaches the
  coach via `assembleMemoryContext` ([ADR-0011](adr/0011-correlation-insights-in-coach-context.md)).
- **WS4 — Guided scan capture.** In-app camera with a face-alignment overlay + a
  post-capture lighting check, recording `capture_meta` on each scan
  ([ADR-0012](adr/0012-guided-scan-capture.md)).

## The Glow Loop (shipped 2026-07-09)

Three retention features selected by the user from a verified-clean baseline, all shipped
to `main`. Execution contract: [docs/ORCHESTRATION_GLOW_LOOP.md](ORCHESTRATION_GLOW_LOOP.md).

- **WS-A — Smart Replenishment.** ✅ Expiring/low-stock shelf items generate ranked,
  reaction-safe replacement suggestions from the catalog (`lib/replenishment.ts`,
  `/shelf/replenish`). Pure client-side, zero tokens.
- **WS-B — Lifestyle Diary + correlation v2.** ✅ 10-second daily check-in (sleep, stress,
  diet flags, water; cycle phase opt-in) feeding the correlation engine and coach context
  (migration 0015, [ADR-0013](adr/0013-lifestyle-diary.md)).
- **WS-C — Weekly Glow Report.** ✅ AI-written week-in-review with a branded shareable
  card and a weekly notification — one cached Claude call per user per week; stats computed
  server-side (migration 0016, `glow-report` fn, [ADR-0014](adr/0014-weekly-glow-report.md)).

**Fast-follow candidates (not yet built):**

- **AI replenishment copy.** A short, personalized "why this over that" line per suggestion,
  generated once and cached — turning the pure-client ranking into coach-voiced advice.

## The Retention Eight (shipped 2026-07-10)

An eight-feature batch spanning both Glow Loop fast-follows and the two big deferred
platform bets. All shipped to `main`, migrations 0017–0020 applied, functions deployed:

1. **Report history browser** — `/report` lists past Glow Reports (pure read over
   `glow_reports`), with a tap-to-unlock row for an ungenerated latest week.
2. **Streak milestones** — `lib/milestones.ts` (3/7/14/30/60/100 days) + a lockstep Deno
   mirror; badge on Progress, and the Glow Report celebrates a crossed milestone as a win.
3. **Cycle-phase correlation events** — the ADR-0013 fast-follow: same-phase runs of ≥3
   logged days are first-class correlation events in both `correlation.ts` mirrors.
4. **Derm-visit PDF export** — Profile → one-tap PDF of scans, routine, reactions, shelf
   via expo-print. No AI, no schema.
5. **Catalog AI fallback** — a no-catalog-match replenishment group hands off to the
   coach with a prefilled draft (reuses the chat seam; no new AI surface).
6. **Server push notifications** — pg_cron + pg_net → `push-dispatch` (Vault shared
   secret): Monday Glow Report doorbell + Wednesday lapsed-scan nudge
   ([ADR-0015](adr/0015-server-push-notifications.md)).
7. **Semantic memory retrieval** — pgvector + edge-runtime gte-small; chat context ranks
   by relevance to the message, importance/recency as structural fallback
   ([ADR-0016](adr/0016-semantic-memory-retrieval.md)).
8. **Health sleep auto-fill** — HealthKit / Health Connect suggest-and-confirm for the
   diary's sleep scale; opt-in, read-only, needs the next EAS dev build
   ([ADR-0017](adr/0017-health-sleep-autofill.md)).

**Flagged, not engineering:** catalog breadth. Replenishment and In-Store Compare are
bounded by the curated seed catalog; #5 softens the ceiling, but widening the catalog
itself is a content/data-operations effort.

## Deferred

- **ML face alignment (react-native-vision-camera).** Real-time face-box tracking
  (eyes level, centred, correct distance *before* the shutter) to replace WS4's static
  overlay. Needs a custom dev/EAS build (not Expo Go) and a native face-detector dep;
  `capture_meta` already reserves room for a richer alignment score. See
  [ADR-0012](adr/0012-guided-scan-capture.md) → "Deferred — ML face alignment".
