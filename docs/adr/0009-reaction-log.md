# ADR 0009: Reaction / Sensitivity Log

- Status: Accepted
- Date: 2026-07-06

## Context

A bad product reaction is the highest-stakes personalization signal Glowi can hold:
one breakout caused by a recommended product destroys more trust than a hundred good
recommendations build. Users currently track reactions in Notes apps, which means the
coach can happily re-recommend the exact product that burned them last month — or a
different product with the same active.

The memory system already has the right primitive for hard constraints: `gotcha`
memories rank first in `assembleMemoryContext`, which feeds the coach, Skin Weather,
and memory extraction. What's missing is a structured, user-visible record and a
guaranteed path from "this product hurt me" into that context.

## Decision

**Schema** — a new `reaction_logs` table (migration `0012_reaction_logs.sql`): product
name/brand, an optional `shelf_item_id` (`ON DELETE SET NULL` — the log must outlive
the product), a `key_ingredients text[]` snapshot taken at log time, `reacted_on`,
`symptoms text[]`, a three-level `severity` check constraint, and notes. RLS
`crud_own`, `updated_at` trigger, indexed by `(user_id, reacted_on DESC)`.

**AI integration by memory, not plumbing** — `addReactionLog` inserts the log row and
a type-`gotcha`, importance-5 `ai_memories` row in the same call
(`reactionMemoryContent` in `lib/reactions.ts` phrases it as a hard constraint:
"Never recommend this product again … treat similar formulations with caution").
Because gotchas already surface first in every assembled memory context, **zero edge
functions changed** — the coach, Skin Weather, and scan pipeline inherit the
constraint immediately, in both live and mock modes.

**Similar-formulation warnings are pure client logic** — `riskyShelfItems()` in
`lib/reactions.ts` cross-references logged reactions' ingredient snapshots against
active shelf items (normalized, case-insensitive) and excludes the item the reaction
was logged against. The Shelf shows a danger nudge when any owned product shares an
ingredient with a logged reaction. No AI call; unit-tested.

**Ingredient snapshot over foreign key** — copying `key_ingredients` onto the log at
creation time (instead of joining through `shelf_items`) means deleting the product
from the shelf never weakens the safety signal.

**Entry points** — a `/reactions` list + `/reactions/add` form (pick a shelf item to
inherit its ingredients, or free-text), a "Log a reaction to this" button on shelf
item detail, and a "Reaction log" button on the Shelf.

## Consequences

**Advantages**

- The most dangerous failure mode (re-recommending a product that caused a reaction)
  is closed with a durable, user-visible, user-deletable record.
- Riding the existing gotcha lane means every AI surface — present and future — honors
  the constraint without per-feature work.
- Free-text logging works for products never added to the Shelf.

**Tradeoffs**

- Free-text logs carry no ingredients, so they block only the exact product, not
  similar formulations. Logging from a shelf item is strictly better and the UI
  nudges toward it.
- Deleting a reaction log does not retract the gotcha memory it created; the memory
  screen already offers deletion for that (`source_ref` links the two for a future
  cascade if it proves annoying).
- Ingredient matching is exact-string after normalization — "retinol" ≠ "retinal".
  Good enough for label-derived lists that come from the same identification model.
