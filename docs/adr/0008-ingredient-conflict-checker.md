# ADR 0008: Ingredient Conflict Checker

- Status: Accepted
- Date: 2026-06-15

## Context

[The Shelf](0006-the-shelf-inventory.md) gives Glowi a record of every product a user
owns, but it doesn't yet reason about how those products interact. A user can easily end
up layering a BHA exfoliant with a retinoid every night, or applying a photosensitizing
retinoid in the morning without realizing it — both are real, evidence-backed irritation
risks that a dermatologist would flag immediately and an app with full visibility into
the user's cabinet should too.

The Ingredient Conflict Checker closes that gap: it reads the ingredients behind each
active shelf item and asks Claude to flag interactions, with the same constraints as
every prior feature — the `AIProvider` seam stays in lockstep (mock works offline at
zero token cost), RLS on any new table, the secret boundary intact, and migrations
append-only.

## Decision

**Ingredient source** — rather than re-deriving ingredients at check time, `key_ingredients
text[]` is added directly to `shelf_items` (migration `0010_ingredient_conflicts.sql`) and
populated once, at add-time, from the same `identify-product` vision response already used
to fill in name/brand/category. This keeps the conflict checker a pure read over existing
data with no extra AI call per check.

**Caching** — conflict analysis is the most expensive AI call in the app per invocation
(it reasons over the user's entire shelf), so results are cached server-side in a new
`conflict_reports` table (one growing log per user, RLS `crud_own`, indexed by
`user_id, created_at DESC`). The `check-conflicts` edge function compares
`max(shelf_items.updated_at)` against the most recent report's `created_at`: if nothing on
the shelf has changed since the last report, it's returned as-is with no Claude call. This
mirrors Skin Weather's "idempotent per day" pattern but keyed on shelf mutation rather than
calendar date.

**AI seam** — a sixth capability, `checkConflicts(): Promise<ConflictReport>`:
- **Live** = `check-conflicts` edge function. Loads active shelf items with non-empty
  `key_ingredients`; on a cache miss, builds a plain-text shelf summary and asks Claude
  (temperature 0, for determinism) for strict JSON matching
  `{ conflicts: Array<{ severity, ingredients, products, reason, citation, recommendation }> }`,
  parsed via the existing `extractJson` helper. The system prompt instructs Claude to flag
  only real, evidence-backed interactions, not speculative ones.
- **Mock** = two static demo conflicts (a BHA + retinol caution, a retinol AM-photosensitivity
  time-of-day flag), fully offline.

**Conflict severity model** — three categories drive UI color-coding: `avoid` (never combine),
`caution` (usable but risks irritation/reduced efficacy if layered), `time_of_day` (one
ingredient must be restricted to AM or PM). Each conflict carries a `citation` and a concrete
`recommendation`, not just a warning — the point is to tell the user what to do, not just
that something is wrong.

**Entry point** — a "Check for conflicts" ghost button on the shelf screen (only shown once
the shelf is non-empty) opens a dedicated `/shelf/conflicts` screen, mirroring the
"button on a hub screen → dedicated results screen" pattern Skin Weather established for
its own forecast.

## Consequences

**Advantages**

- Zero additional AI cost at add-time — ingredients are captured incidentally as part of
  the identification call Shelf already makes.
- The shelf-mutation cache keeps repeat opens of the conflicts screen free; a Claude call
  only happens when the shelf actually changes.
- Severity + citation + recommendation gives the user something actionable, not just an
  alarm.
- Works fully offline in mock mode with no behavior difference from the user's perspective
  beyond using canned data.

**Tradeoffs**

- Conflict quality is bounded by `key_ingredients` accuracy from the vision identification
  step; a product identified with a wrong or incomplete ingredient list won't be flagged
  correctly. Manually-entered shelf items without ingredients are silently excluded from
  analysis rather than blocking the check.
- The cache invalidates on *any* shelf change (add, remove, edit), even ones unrelated to
  ingredients (e.g. marking a product as used) — slightly over-invalidates in exchange for
  a much simpler comparison than a content-based fingerprint.
- Like all mock/live pairs, the two-conflict mock data and the live prompt contract must be
  kept in lockstep as the severity model evolves.
