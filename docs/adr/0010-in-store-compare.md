# ADR 0010: In-Store Purchase Decision Support

- Status: Accepted
- Date: 2026-07-06

## Context

The purchase moment is the highest-intent point in a skincare journey, and the one
where users leave the app for Reddit or ingredient databases. Glowi already holds
everything a good answer needs — the latest scan's concerns, the Shelf's ingredient
inventory, and (since [ADR-0009](0009-reaction-log.md)) the reaction log. The feature
is the combination, delivered fast enough to use while standing in an aisle.

## Decision

**Stateless, like identify-product** — a new `compare-products` edge function takes
two base64 product photos, returns a `ProductComparison`
(`verdict: 'a' | 'b' | 'either' | 'neither'`, both identifications, a rationale,
consideration bullets), and persists nothing. No cache table: unlike the conflict
checker, the inputs (two arbitrary photos) have no server-side identity to key a
cache on, and a purchase decision is a one-shot moment.

**One vision call, not three** — both labels are read and judged in a single Claude
request (two image blocks, temperature 0) whose system prompt embeds the user
context assembled server-side: skin type + latest scan concerns, active shelf items
with ingredients, and every reaction log entry marked as an instant disqualifier.
Halving the latency of a read-then-judge pipeline matters more in a store aisle than
anywhere else in the app.

**Hardening matches the existing bar** — JWT required; both payloads size-capped and
magic-byte sniffed (`_shared/images.ts`); model output validated against the verdict
enum and category enum, strings truncated, considerations capped at 4. Non-product
photos resolve to verdict `neither` with the reason in the rationale rather than an
error.

**AI seam** — `compareProducts(input)` joins the `AIProvider` interface. The mock
picks two catalog-plausible identifications deterministically from the image payload
lengths and grounds its rationale in the user's real latest scan concern, so the demo
flow reads personalized while remaining fully offline.

**Entry point** — `/compare` (two capture slots → verdict card) is reached from the
Shelf ("Comparing in a store?"), keeping Home uncluttered and placing the feature
next to the inventory it reasons over.

## Consequences

**Advantages**

- Answers the highest-intent question with data no ingredient app has: *your* scan,
  *your* cabinet, *your* reaction history.
- Statelessness means no cache invalidation, no schema, no cleanup.
- The reaction-log integration makes ADR-0009's safety net actionable at the exact
  moment money is about to change hands.

**Tradeoffs**

- Two images per call makes this the largest request payload in the app; the 8 MB
  per-image cap and 0.6 JPEG quality keep it inside function limits.
- No caching means repeating the same comparison costs a second Claude call — an
  acceptable property for a genuinely one-shot flow.
- Verdict quality depends on label legibility; the prompt instructs the model to read
  only what it can see, and the UI surfaces both identifications so a misread is
  visible to the user rather than silent.
