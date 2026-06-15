# ADR 0006: The Shelf — Living Product Inventory

- Status: Accepted
- Date: 2026-06-14

## Context

[Skin Weather](0005-skin-weather-forecasting.md) makes Glowi proactive — it tells
you what to change today. The immediate gap it exposes: Glowi says "swap to a richer
moisturizer," but it doesn't know whether you *own* one, where it is, or whether it's
expired. Generic advice creates intent; it doesn't remove friction.

The Shelf is a living inventory of the products a user actually owns. Once a product
is on the shelf, the rest of the app can route through it:

- **Skin Weather names what you own** — "use your CeraVe Moisturizing Cream" instead
  of "use a richer moisturizer."
- **Expiry alerts** before a product oxidizes (vitamin C serums turn in ~3–6 months).
- **Low-stock awareness** so a high-UV week doesn't catch you without SPF.
- **Usage tracking** lays the groundwork for correlating real product use with scan
  outcomes over time.

The constraints are unchanged from prior ADRs: keep the `AIProvider` seam in lockstep
(mock must work offline at zero token cost), RLS on the new table, the secret boundary
intact, migrations append-only, and reuse the memory system rather than a parallel one.

## Decision

**Data model** — append-only migration `0006_shelf_items.sql` adds `shelf_items`
(one row per owned product): optional catalog `product_id`, `name`/`brand`/`category`,
`opened_at`, `shelf_life_months`, `amount_remaining`, `times_used`/`last_used_at`,
`status`, and an optional `image_path`. RLS `crud_own` and an `updated_at` trigger,
matching every other user-owned table. Product photos reuse the existing private
`scan-images` bucket under a `{user}/shelf/…` path — the per-user storage policies
already cover it, so no new bucket or policy was needed.

**AI seam** — a fifth capability, `identifyProduct({ imageBase64 })`:
- **Live** = a new `identify-product` vision edge function. Claude reads the label and
  returns structured JSON (name, brand, category, key ingredients, typical PAO, and a
  catalog `matched_slug`), validated against the category enum and the real catalog
  before returning. It persists nothing — the client confirms before saving.
- **Mock** = deterministic identification rotating through plausible catalog products,
  fully offline.

**Pure logic** — `lib/shelf.ts` holds the testable rules: period-after-opening expiry
(`opened_at` + effective shelf life, warning within 14 days), stock level, default PAO
by category (vitamin C deliberately short), and the shelf summary that drives the
nudges. No I/O, so it is shared by the UI and unit-tested directly.

**Cross-feature integration** (the point of the feature):
- Skin Weather routes through owned products. The mock `deriveForecast` and the
  `skin-forecast` prompt both name a product the user owns when advice calls for that
  category.
- `assembleMemoryContext` gains a shelf summary line, so the **coach** recommends what
  the user already has and knows what's running low.

**Mobile** — `/shelf` (inventory with expiry/low-stock nudges), `/shelf/add` (photo →
AI identify → editable form, with manual entry always available), and `/shelf/[id]`
(detail with mark-used, amount, opened-date, and remove). A Home entry point ties it in.

## Consequences

**Advantages**

- Turns Skin Weather's intent into frictionless action with what the user already owns —
  the two features compound into a "skincare OS" feel that's hard to replicate.
- No new architecture: same seam, same RLS shape, same memory system, same storage
  bucket, no new secret.
- Works fully offline in mock mode; the live identifier validates all model output at
  the boundary and never persists unconfirmed data.
- Usage fields (`times_used`, `last_used_at`, `amount_remaining`) start capturing the
  data needed to later correlate product use with scan outcomes.

**Tradeoffs**

- Identification accuracy depends on label legibility and catalog coverage; the user
  always confirms before saving, which keeps bad reads out of the inventory.
- Expiry is PAO-based, so it relies on the user marking when a product was opened;
  unopened items are "sealed" with no clock until then.
- The scan-outcome correlation is set up (data captured) but not yet surfaced — a
  deliberate future step, not built speculatively now.
- Like all of mock, the offline heuristic and the live prompt contract must be kept in
  lockstep.
