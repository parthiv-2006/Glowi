# CLAUDE.md

@AGENTS.md

Guidance for Claude Code (and any AI agent) working in the **Glowi** repository.
Read this before making changes. These instructions are not optional.

Glowi is an AI-powered skincare app: an Expo / React Native mobile client backed by
Supabase (Postgres + RLS, Auth, Storage, Deno edge functions) and Anthropic Claude.
See [README.md](README.md), [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), and
[docs/adr](docs/adr) for the full picture.

---

## How to work here

### 1. Ask, don't assume
- If a requirement is ambiguous, the desired behavior is unclear, or there are two
  reasonable interpretations — **stop and ask**. A clarifying question is always
  cheaper than building the wrong thing.
- Do not invent product behavior, copy, data shapes, or scope that wasn't requested.
- State your assumptions explicitly when you must make one, so they can be corrected.
- Only implement what was asked. No speculative features, no "while I'm here" extras.

### 2. Write the simplest thing that satisfies the request
- Prefer the smallest, clearest implementation that fully solves the problem. No
  premature abstraction, no configuration nobody asked for, no extra layers.
- Reuse what already exists before adding new code — design-system primitives in
  `mobile/src/components/ui/`, hooks in `mobile/src/lib/hooks.ts`, types in
  `mobile/src/lib/types.ts`, shared edge helpers in `supabase/functions/_shared/`.
- Delete dead code rather than leaving it commented out.
- If a change is getting large or complex, that's a signal to pause and confirm the
  approach before continuing.

### 3. Maintain high code quality
- **Match the surrounding code** — naming, file layout, comment density, and idioms.
  Make new code indistinguishable from what a senior engineer here already wrote.
- TypeScript is **strict**. No `any` escape hatches, no `// @ts-ignore` to silence the
  compiler. Type the data, fix the cause.
- Validate external data at the boundary (AI responses, network payloads, user input).
  Never trust the shape of something that came from outside the app.
- Before claiming any task is done, run the full quality gate (see below) and report
  the actual results. If tests fail, say so with the output — don't paper over it.
- Verify user-facing changes the way the project expects (the global self-verification
  protocol applies: screenshot / inspect the route, confirm no console errors, confirm
  data flows end to end).

### 4. Respect the architecture
- **The AI seam is sacred.** All AI access goes through the `AIProvider` interface in
  `mobile/src/lib/ai/`. Keep `live.ts` and `mock.ts` in lockstep — every feature must
  work offline in `mock` mode at zero token cost. See
  [ADR-0003](docs/adr/0003-ai-provider-seam.md).
- **Security at the data layer.** Every user table has Row Level Security; the image
  bucket is private and per-user. The `ANTHROPIC_API_KEY` lives **only** in
  edge-function secrets — it must never reach the app bundle or client code. Never add
  a path that bypasses RLS or exposes a secret.
- **Migrations are the source of truth** for the schema. Schema changes go in a new
  numbered file under `supabase/migrations/` — never edit an applied migration. Seed
  data goes in `supabase/seed/`.
- Keep authoring and reviewing as separate passes. Don't self-approve substantial
  changes — get a review pass before declaring done.

### 5. Commit like a senior engineer
- **Small, batched, logically-grouped commits — never one giant commit.** One concern
  per commit (fix X, then refactor Y, then add Z). A reviewer should be able to read
  the history and understand the change in order.
- Follow the existing Conventional Commits style with scopes, e.g.
  `feat(mobile): …`, `fix(chat): …`, `docs: …`, `chore(supabase): …`.
- Commit only related changes together; don't mix a refactor into a feature commit.
- Commit/push only when the user asks. If on `main`, branch first.
- End commit messages with the required co-author trailer:
  `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

### 6. Keep documentation and memory current
- **After any major feature or architectural change, update the docs in the same PR:**
  - `README.md` if the capability, stack, or quick-start changed.
  - `docs/ARCHITECTURE.md` for structural changes.
  - `docs/MEMORY_SYSTEM.md` if the AI memory pipeline changed.
  - A new **ADR** in `docs/adr/` for any decision with lasting architectural impact
    (new dependency, data-flow change, security boundary, trade-off). Follow the
    existing ADR format.
- **Update persistent memory** (the `.claude/.../memory/` store and its `MEMORY.md`
  index) after major features so future sessions inherit the context — new non-obvious
  constraints, Supabase coordinates, gotchas, or decisions that aren't derivable from
  the code or git history. Don't record what the repo already states.
- Documentation should read at a senior level: explain the *why*, not just the *what*.

### 7. Plan before you build
- For any new feature or non-trivial change, **produce a plan and confirm it before
  writing code.** Lay out the approach, the files you'll touch, the data/schema
  changes, and the trade-offs — then execute once it's agreed.
- Trivial, single-file, or obvious fixes don't need a formal plan; use judgment.
- Planning surfaces wrong assumptions early and keeps changes small and reviewable.

### 8. Model orchestration and delegation
- When running on a strong model, **the strongest model acts as the orchestrator.** It
  owns planning, architecture, security-sensitive work, final review, and the overall
  thread of the task.
- **Delegate execution to more cost-effective models based on task complexity** —
  route straightforward, well-scoped work (lookups, mechanical edits, boilerplate,
  routine implementation) to cheaper models, and reserve the strongest model for
  architecture, ambiguous problems, deep debugging, and verification.
- Match the model to the job; don't default to the strongest model for everything.
- The orchestrator stays responsible for verifying delegated work before declaring it
  done — a cheaper model doing the work doesn't lower the quality bar.

---

## Quality gate

Run from `mobile/` and make all three green before declaring work complete:

```bash
npm run typecheck   # tsc --noEmit (strict)
npm run lint        # eslint (expo config)
npm test            # jest unit tests
npm run format      # prettier (run before committing)
```

CI runs typecheck, lint, and test on every push and PR
([.github/workflows/ci.yml](.github/workflows/ci.yml)). Don't push red.

---

## Repository map

```
mobile/                 Expo app (TypeScript, strict)
  src/
    app/                expo-router routes (auth, onboarding, tabs, scan, results, …)
    components/ui/       design-system primitives — reuse these first
    components/          feature components
    lib/                supabase client, AI providers (ai/), data hooks, domain types
    stores/             zustand stores (auth, settings)
    theme/              design tokens — "clinical luxe"
supabase/
  migrations/           schema, RLS, storage, triggers — source of truth, append-only
  functions/            analyze-skin · chat · extract-memories · auth-signup · _shared
  seed/                 curated catalog (products, nutrition, tips, articles)
docs/                   ARCHITECTURE · MEMORY_SYSTEM · adr/
```

When in doubt about conventions, look at how the nearest existing file solves the same
problem and follow it.

---

## Glowi visual system — enforced every session

The design system lives in
`Glowi app visual enhancement (1)/design_handoff_glowi_redesign/`. Before any UI work:

1. Read `DESIGN_PRINCIPLES.md`, `COMPONENT_FIDELITY.md`, and `BUILD_ORDER.md`.
2. **Transcribe exact values** from `COMPONENT_FIDELITY.md` — never approximate fills,
   borders, radii, gradient stops, shadow offsets, or motion timings.
3. **Never** render any of the five §0 effects (BlurView glass, inset-highlight line,
   behind-view glow, MaskedView gradient text, aurora) as a flat `rgba()` fill.
4. Every surface declares a GlassCard tier; **one Glow element per screen, max**.
5. For any screen without a mockup, follow the "Designing a screen that was never mocked
   up" recipe and run **"check the tells"** before finishing it.
6. Build primitives first, one screen per turn, and stop for review after each.
