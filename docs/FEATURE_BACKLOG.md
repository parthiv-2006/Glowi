# Feature Backlog — Consumer-Driven Priorities

Features derived from the ideal Glowi consumer persona: a 25–40 year old spending
$100–$200/month on skincare, owns 15+ products, and wants synthesis — not more information.

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
