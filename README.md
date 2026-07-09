<div align="center">

# Glowi

**AI-powered skincare analysis — scan your skin, understand it, fix it.**

Photograph a skin concern, watch a cinematic AI scan, and get a personalized
protocol: curated products with real retailer links, an evidence-based
nutrition guide, and routines built around what the scan finds — plus a
skincare coach that remembers you across every conversation.

[Architecture](docs/ARCHITECTURE.md) · [Memory system](docs/MEMORY_SYSTEM.md) · [ADRs](docs/adr) · [Contributing](CONTRIBUTING.md)

</div>

---

## What it does

- **Scan** — A guided in-app camera frames your face against a fixed alignment overlay
  and runs a post-capture lighting check (retake if it's too dark, blown out, or
  side-lit) so week-over-week photos stay comparable — or upload one from your library.
  A Skia-rendered scanning theater (sweeping beam, measurement grid, particles, haptics)
  then plays while Claude vision analyzes the image into a structured, validated result:
  an overall skin score and ranked concerns with severity, confidence, and affected areas.
- **Understand & fix** — Each concern opens to three evidence-led tabs: **Products**
  (curated, ranked, with retailer links and an AI rationale), **Nutrition**
  (foods, nutrients, and what to limit — each with PubMed-linked citations), and
  **Tips**.
- **Skin Weather** — A proactive daily forecast. Glowi pulls today's local
  environment (UV, humidity, temperature swing, air quality, pollen) and
  cross-references it with your documented skin history to tell you what to change
  *before* you touch your face — swap to a richer moisturizer, add SPF 50, skip
  tonight's exfoliant — as concrete add/swap/skip adjustments.
- **The Shelf** — A living inventory of the products you actually own. Photograph a
  product and the AI reads the label; Glowi then tracks expiry (period-after-opening),
  stock level, and usage. Skin Weather routes its advice through what's on your shelf
  ("use your CeraVe Moisturizing Cream"), and you get expiry and low-stock nudges before
  they bite.
- **Ingredient Conflict Checker** — Glowi reads the ingredients behind every product on
  your shelf and asks Claude to flag real interactions — layering a BHA with a retinoid,
  applying a photosensitizing retinoid in the morning — with severity, a citation, and a
  concrete recommendation, not just a warning.
- **Reaction Log** — Log a product that broke you out (symptoms, severity, when) and
  the coach never recommends it again. Glowi snapshots the product's ingredients and
  warns you when anything else on your shelf shares a formulation with something that
  already burned you.
- **Lifestyle Diary** — A 10-second daily check-in on the Home screen (sleep, stress,
  water, diet flags, and an optional opt-in cycle phase). Glowi turns sustained rough
  stretches into correlation evidence ("your breakouts track your low-sleep weeks") and
  feeds a two-week recap into the coach's context — no extra AI call ([ADR-0013](docs/adr/0013-lifestyle-diary.md)).
- **In-Store Compare** — Standing in an aisle holding two products? Photograph both
  labels and get a one-shot verdict judged against your latest scan, what's already
  in your cabinet, and your reaction log.
- **Coach** — A memory-aware chatbot answers anything skincare, recommends products
  inline, and *remembers you*: skin type, goals, what's reacted badly, and where you
  left off last time. It's also weather-aware and shelf-aware — it sees today's forecast
  and what's in your cabinet.
- **Routine** — An AM/PM routine generated from your scan, editable and persisted —
  with derived wait times between steps ("vitamin C → wait 10 min") and warnings when
  the order undermines an active (SPF not last, retinoid in the morning, acid layered
  with retinoid).
- **Shelf Budget** — Attach what you paid and Glowi tracks your shelf's value, 90-day
  spend, and a cost-per-use "value leaderboard" showing which products actually earn
  their price.
- **Progress** — Scan history, a skin-score trend, before/after comparison, daily
  routine streaks with reminders.
- **Learn** — A library of evidence-based articles with a clean reader.

## The headline engineering

- **Cross-session AI memory.** Every new chat starts with durable context — profile
  facts, ranked memories, safety-critical "gotchas" (allergies, bad reactions), the
  latest scan, and the last session summary. Memories are written back by an extraction
  pass after each conversation. Fully documented in
  [docs/MEMORY_SYSTEM.md](docs/MEMORY_SYSTEM.md).
- **A swappable AI seam.** One `AIProvider` interface; a live provider backed by Claude
  edge functions and an on-device mock provider that makes the *entire* app — including
  the memory system and Skin Weather — work offline at zero token cost ([ADR-0003](docs/adr/0003-ai-provider-seam.md)).
- **Proactive environmental forecasting.** Skin Weather joins live weather (keyless
  Open-Meteo — no new secret) with the memory system to produce a personalized daily
  forecast, and feeds it back into the coach's context ([ADR-0005](docs/adr/0005-skin-weather-forecasting.md)).
- **A product inventory that closes the loop.** The Shelf logs what you own via AI label
  reading, tracks expiry/stock, and routes Skin Weather and the coach through your actual
  cabinet ([ADR-0006](docs/adr/0006-the-shelf-inventory.md)).
- **Server-cached AI safety analysis.** The Ingredient Conflict Checker reasons over your
  whole shelf but only calls Claude when the shelf actually changes — results are cached
  per user and invalidated against `shelf_items.updated_at`
  ([ADR-0008](docs/adr/0008-ingredient-conflict-checker.md)).
- **A safety net that rides the memory system.** Logging a reaction writes a structured
  row *and* a top-ranked "gotcha" memory in one call, so every AI surface — coach,
  forecast, in-store compare — honors "never again" with zero new plumbing
  ([ADR-0009](docs/adr/0009-reaction-log.md)).
- **Purchase decisions in one vision call.** In-Store Compare reads two labels and
  judges them in a single Claude request whose prompt embeds the scan, shelf, and
  reaction context server-side ([ADR-0010](docs/adr/0010-in-store-compare.md)).
- **Honest trends start at capture.** Guided scan capture pairs a versioned alignment
  overlay with a pure, unit-tested lighting check (`captureQuality.ts`; Skia decodes a
  ≤64px copy on-device) and records the result in a nullable `capture_meta` on each scan,
  so every trend feature — before/after, sparklines, the coach's correlations — compares
  like-for-like photos ([ADR-0012](docs/adr/0012-guided-scan-capture.md)).
- **Security at the data layer.** Row Level Security on every user table; a private,
  per-user image bucket; the Anthropic key lives only in edge-function secrets and never
  ships in the app bundle.

## Stack

| Layer | Technology |
|---|---|
| Mobile | React Native · Expo SDK 56 · TypeScript (strict) · expo-router |
| Animation | Reanimated 4 · React Native Skia |
| State / data | Zustand · TanStack Query |
| Backend | Supabase — Postgres + RLS · Auth · Storage · Edge Functions (Deno) |
| AI | Anthropic Claude (vision + chat) with an offline mock provider |

## Quick start

```bash
# 1. Mobile app
cd mobile
npm install
cp .env.example .env        # fill in your Supabase URL + publishable key
npx expo start              # press i / a, or scan the QR with Expo Go
```

**Live AI is the default** (`EXPO_PUBLIC_AI_MODE=live`) — it calls the deployed edge
functions, which requires an `ANTHROPIC_API_KEY` secret set on your Supabase project
(see step 2). No key yet, or want to demo offline? Switch to **mock** in
Profile → Developer — the full app (scans, chat, memory) runs realistically with no
API key and zero token cost. ⚠️ The mode is persisted on-device once launched, so
editing `.env` only affects fresh installs; use the in-app toggle to change an
existing one.

```bash
# 2. Backend (optional — only to run your own)
supabase link --project-ref <your-ref>
supabase db push                      # apply migrations in supabase/migrations
# seed catalog: run the SQL files in supabase/seed in order
supabase functions deploy             # analyze-skin, chat, extract-memories, skin-forecast, identify-product, check-conflicts, compare-scans, compare-products, auth-signup
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
# optional: lock edge-function CORS to specific browser origins (comma-separated).
# Unset → '*', which is fine for native clients. See ADR-0007.
supabase secrets set GLOWI_ALLOWED_ORIGINS=https://app.glowi.example
```

```bash
# 3. Brand assets + a device build (optional)
cd mobile
npm run assets              # regenerate app icon / splash / adaptive-icon PNGs from
                           # assets/brand/*.svg (the Glowi mascot) — idempotent
npx eas login              # one-time; needs an Expo account
npx eas build -p android --profile preview   # internal APK; install on your phone
```

The guided camera uses `expo-camera`, which runs in Expo Go — but the installable
APK is how you test it (and the branding) on a real device end to end.

## Repository layout

```
mobile/                 Expo app
  src/
    app/                expo-router routes (auth, onboarding, tabs, scan, results, …)
    components/         design-system primitives (ui/) + feature components
    lib/                supabase client, AI providers, data hooks, domain types
    stores/             zustand stores (auth, settings)
    theme/              design tokens — "clinical luxe"
supabase/
  migrations/           schema, RLS, storage, triggers (source of truth)
  functions/            analyze-skin · chat · extract-memories · skin-forecast · identify-product · check-conflicts · compare-scans · compare-products · auth-signup · _shared
  seed/                 curated catalog (products, nutrition, tips, articles)
docs/                   ARCHITECTURE · MEMORY_SYSTEM · ADRs
```

## Quality

```bash
cd mobile
npm run typecheck   # tsc --noEmit (strict)
npm run lint        # eslint (expo config)
npm test            # jest unit tests
```

CI runs all three on every push and PR ([.github/workflows/ci.yml](.github/workflows/ci.yml)).

## Disclaimer

Glowi provides informational guidance only and is not a substitute for professional
medical advice. For persistent, painful, or worsening conditions — or any concern about
a mole or lesion — see a board-certified dermatologist.

## License

MIT © 2026 Parthiv Paul
