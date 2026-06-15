# ADR 0005: Skin Weather — Environmental Skin Forecasting

- Status: Accepted
- Date: 2026-06-14

## Context

Every other surface in Glowi is **reactive** — it analyzes a photo of skin after
something has already gone wrong. The product opportunity is to be **proactive**:
tell the user what their skin will need *today*, before they touch their face,
by cross-referencing the local environment (UV, humidity, temperature swing, air
quality, pollen) with what we already know about how their skin responds.

This is also a retention play. A daily, personalized forecast turns Glowi into a
morning habit — opened like a weather app — rather than a tool people remember to
use only when a concern flares.

The constraints were the usual Glowi ones (see [ADR-0003](0003-ai-provider-seam.md)):
the feature must work fully offline in `mock` mode at zero token cost, keep the
`AIProvider` seam in lockstep, respect RLS and the secret boundary, and reuse the
existing AI memory system rather than inventing a parallel one.

## Decision

Add a fourth capability to the `AIProvider` seam:

```typescript
skinForecast(input?: SkinForecastInput): Promise<SkinForecast>;
```

**Data model** — a new append-only migration (`0005_skin_forecasts.sql`) adds a
`skin_forecasts` table: one row per user per day (`unique (user_id, forecast_date)`),
RLS `crud_own` like every other user-owned table. It stores the day's
`environment` (jsonb), a `headline`, a personalized `summary`, and a `guidance`
array of `{ kind: add|swap|skip|maintain, text }` adjustments. Generation is
idempotent per day: a second request returns the existing row.

**Weather source: Open-Meteo.** Chosen because it is free and **keyless** — no new
secret enters the system, preserving the rule that only `ANTHROPIC_API_KEY` lives
in edge-function secrets. The live function fetches the forecast + air-quality
endpoints, then validates and clamps every field at the boundary (pollen is often
`null` for US locations and degrades to `low`).

**Live provider** (`skin-forecast` edge function): fetches the environment,
assembles the user's memory context (the same `assembleMemoryContext` used by
chat), and asks Claude for guidance grounded in **both** the readings and the
user's documented skin tendencies. Model output is validated against the action
enum and length caps before it is persisted; if Open-Meteo or Claude fails, a
deterministic fallback still produces a sensible (gentle) forecast so the feature
never hard-fails.

**Mock provider**: synthesizes a deterministic environment from the date and runs
the same personalization heuristic (`deriveForecast` in `lib/ai/forecast.ts`),
persisting through the identical `skin_forecasts` table. The whole feature —
including the home card and detail screen — works offline.

**Location**: the seam accepts optional coordinates and defaults to a shared
constant (`DEFAULT_LOCATION`). This keeps device GPS (`expo-location`) a drop-in
future enhancement without unused columns or speculative UI today.

**Memory loop**: `assembleMemoryContext` now appends today's forecast as a context
line, so the coach is **weather-aware** — ask it "what should I change today?" and
it answers against the same forecast. This closes the loop the feature was pitched
on: environmental context becomes another signal the memory system carries.

## Consequences

**Advantages**

- Proactive, personalized morning surface — a genuine differentiator and a daily
  habit loop, not another reactive analyzer.
- Reuses the memory system and the provider seam; no new architecture, no new
  secret, no RLS exception.
- Works fully offline in mock mode; the live path degrades gracefully if either
  external dependency is unavailable.
- Cross-feature integration: the forecast feeds the coach for free.

**Tradeoffs**

- Forecast quality depends on Open-Meteo coverage; pollen is sparse outside Europe
  and falls back to `low`.
- Location is a fixed default until device GPS is wired in, so the forecast is for
  that location rather than the user's exact position.
- Like all of mock, the offline heuristic must be maintained alongside the live
  prompt contract so the two stay in lockstep.
- A daily row per user accumulates; acceptable (one small row/day) and trivially
  prunable later if needed.
