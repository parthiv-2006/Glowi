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

- **Scan** — Capture or upload a photo. A Skia-rendered scanning theater (sweeping
  beam, measurement grid, particles, haptics) plays while Claude vision analyzes the
  image into a structured, validated result: an overall skin score and ranked concerns
  with severity, confidence, and affected areas.
- **Understand & fix** — Each concern opens to three evidence-led tabs: **Products**
  (curated, ranked, with retailer links and an AI rationale), **Nutrition**
  (foods, nutrients, and what to limit — each with PubMed-linked citations), and
  **Tips**.
- **Coach** — A memory-aware chatbot answers anything skincare, recommends products
  inline, and *remembers you*: skin type, goals, what's reacted badly, and where you
  left off last time.
- **Routine** — An AM/PM routine generated from your scan, editable and persisted.
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
  the memory system — work offline at zero token cost ([ADR-0003](docs/adr/0003-ai-provider-seam.md)).
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

The app runs fully in **demo mode** (`EXPO_PUBLIC_AI_MODE=mock`) with no API key —
realistic scans, chat, and memory all work offline. Flip to **live AI** in
Profile → AI engine once an `ANTHROPIC_API_KEY` secret is set on your Supabase project.

```bash
# 2. Backend (optional — only to run your own)
supabase link --project-ref <your-ref>
supabase db push                      # apply migrations in supabase/migrations
# seed catalog: run the SQL files in supabase/seed in order
supabase functions deploy             # analyze-skin, chat, extract-memories, auth-signup
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
```

## Repository layout

```
mobile/                 Expo app
  src/
    app/                expo-router routes (auth, onboarding, tabs, scan, results, …)
    components/         design-system primitives (ui/) + feature components
    features/lib/       supabase client, AI providers, data hooks, domain types
    stores/             zustand stores (auth, settings)
    theme/              design tokens — "clinical luxe"
supabase/
  migrations/           schema, RLS, storage, triggers (source of truth)
  functions/            analyze-skin · chat · extract-memories · auth-signup · _shared
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
