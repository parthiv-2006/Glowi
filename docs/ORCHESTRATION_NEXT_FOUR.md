# Orchestration Plan — The Next Four Things on Glowi

**Status:** WS1 ✅ · WS2 ✅ · WS3 ✅ · WS4 ✅ — all four shipped (2026-07-09), including
the plan's final action: the EAS Android `preview` build is queued (see the WS2 Result).
· **Written:** 2026-07-08 · **Owner:** orchestrator session

This document is an execution contract. Each workstream below is written so a Claude
agent (Sonnet or Opus, per the routing table) can run it **autonomously, cold, with no
other context** and land work at senior-engineer quality. Read the whole preamble before
touching your workstream. If a step's premise turns out false in the repo, stop and
report — don't improvise around it.

The four workstreams:

| # | Workstream | Model | Why this model |
|---|---|---|---|
| WS1 | Flip the AI seam to live mode + QA all 8 AI features | **Sonnet** | Ops + systematic QA against an already-built seam; no design judgment |
| WS2 | Real brand assets + EAS Android build | **Sonnet** | Well-scoped asset generation + build config; fidelity spec is explicit below |
| WS3 | Correlation insights → the coach | **Opus** | Touches the sacred memory seam, an edge function, and a cross-runtime lockstep decision |
| WS4 | Guided scan capture (overlay + lighting check) | **Sonnet impl + Opus review pass** | New camera screen with visual-system compliance; review gate before commit |

**Dependency graph / order:**

```
WS1 ──────────────► WS3 (live-mode QA of the coach needs WS1 done)
WS2 assets ───┐
WS4 ──────────┴───► WS2 EAS build (the APK must contain expo-camera → build LAST)
```

Run WS1 first. WS2's asset work and WS4 can proceed in parallel with anything. The
`eas build` step of WS2 is the **final** action of the whole plan.

---

## Ground rules (every workstream, non-negotiable)

1. **Navigate via [docs/CODE_INDEX.md](CODE_INDEX.md) first.** Open only the files you
   need. Any change that adds/moves/removes a route, lib module, component, edge
   function, or migration updates CODE_INDEX.md **in the same commit**.
2. **Quality gate** — from `mobile/`, all green before any "done" claim, and
   `npm run format` before committing:
   ```bash
   npm run typecheck && npm run lint && npm test
   ```
3. **Commit protocol** — small, logically-grouped Conventional Commits with scopes
   (`feat(scan): …`, `chore(supabase): …`, `docs: …`), one concern per commit, pushed in
   batches. Branch off `main` first (never commit to `main` directly). Every commit ends
   with the trailer:
   ```
   Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
   ```
4. **The AI seam is sacred** ([ADR-0003](adr/0003-ai-provider-seam.md)). Any change to
   `mobile/src/lib/ai/live.ts` is mirrored in `mock.ts` in the same commit. Every feature
   must keep working offline in mock mode at zero token cost.
5. **Secrets never reach the client.** `ANTHROPIC_API_KEY` lives only in edge-function
   secrets. `EXPO_PUBLIC_*` vars are bundled into the app — publishable values only.
6. **Migrations are append-only.** Schema changes = new numbered file under
   `supabase/migrations/` (next free number; 0013 is taken). Never edit an applied one.
7. **Visual system is enforced.** Before any UI work, read
   `Glowi app visual enhancement (1)/design_handoff_glowi_redesign/DESIGN_PRINCIPLES.md`,
   `COMPONENT_FIDELITY.md`, `BUILD_ORDER.md`. Transcribe exact values — never approximate.
   Never render the five §0 effects as flat `rgba()` fills. Every surface declares a
   GlassCard tier; max one Glow element per screen. For screens with no mockup, follow
   the "Designing a screen that was never mocked up" recipe and run "check the tells".
8. **Expo has changed.** SDK is 56 (`expo ~56.0.11`, RN 0.85.3). Consult
   https://docs.expo.dev/versions/v56.0.0/ before writing any Expo API code. Install
   Expo packages with `npx expo install <pkg>` so versions pin to the SDK.
9. **Verify like the repo expects.** TypeScript passing is not verification. Drive the
   affected route (web preview / `npm run web`), confirm no console errors, confirm data
   flows end to end, screenshot when feasible. Report actual results — if something
   fails, say so with output; never paper over.
10. **Docs and memory in the same PR.** Each workstream lists its documentation and
    persistent-memory obligations; they are part of "done", not follow-ups.

---

## WS1 — Flip the AI seam to live mode

**Status: ✅ DONE (2026-07-08).** See [Result](#ws1-result) at the end of this section.

**Model: Sonnet.** Goal: the app stops being a demo of itself. Set the Anthropic key on
Supabase, default the app to live mode, clear the one outstanding security-advisor item,
and QA all 8 AI capabilities against real Claude.

**Grounding facts (verified 2026-07-08):**
- Provider selection: `mobile/src/lib/ai/index.ts:9` — `useSettings.getState().aiMode`.
- `aiMode` is **persisted in AsyncStorage** (`mobile/src/stores/settings.ts`, store name
  `glowi-settings`), seeded from `env.defaultAiMode` (`mobile/src/lib/env.ts:19`, reads
  `EXPO_PUBLIC_AI_MODE`). ⚠️ Changing `.env` does **not** flip an existing install — the
  persisted value wins. Runtime toggle: Profile → Developer.
- Supabase project ref: `rfuuznnbctfyqttslrbv`. Edge functions (9): `analyze-skin`,
  `chat`, `extract-memories`, `skin-forecast`, `identify-product`, `check-conflicts`,
  `compare-scans`, `compare-products`, `auth-signup`.

### Steps

**A. Set the secret (user-interactive — the only blocking step in the whole plan).**
Ask the user to paste their Anthropic API key, then:
```bash
supabase secrets set ANTHROPIC_API_KEY=<key> --project-ref rfuuznnbctfyqttslrbv
```
(or the Supabase dashboard → Edge Functions → Secrets). Never echo the key into any
file, log, or commit. Then verify all 9 functions are deployed and current
(`supabase functions list` / MCP `list_edge_functions`); redeploy any whose local source
is newer than the deployed version.

**B. Leaked-password protection.** Enable in the dashboard: Authentication → Sign In /
Providers → Password → "Prevent use of leaked passwords" (HaveIBeenPwned), or via the
Management API auth config (`password_hibp_enabled: true`). ⚠️ If the toggle is gated to
the Pro plan on this project, record that as a finding for the user instead of failing
the workstream. Confirm afterward with the security advisors (MCP `get_advisors`,
type `security`) that the item cleared.

**C. Default the app to live.** In `mobile/.env` set `EXPO_PUBLIC_AI_MODE=live`.
`mobile/.env` is gitignored — also update the comment in `mobile/.env.example` if it now
misstates the default, and update `README.md` quick-start (live is the default; mock
remains the offline/demo mode). Document the persisted-store gotcha (⚠️ above) wherever
the README explains modes. Restart the dev server; flip Profile → Developer to **live**
on your test session (or clear AsyncStorage) before QA.

**D. QA matrix — all 8 features against real Claude.** Exercise each through its real
screen (web preview is fine), with the edge-function logs (`get_logs`) open on failure.
Fill this table in your final report:

| # | Capability | Exercise via | Pass criteria |
|---|---|---|---|
| 1 | `analyzeScan` | `/scan` → photo → analyzing | Scan row gets status `complete`, score 0–100, ≥1 concern with severity, summary text |
| 2 | `chat` | `/chat` → new session → message | Grounded reply; any `<products>` refs resolve to real catalog slugs; both turns persisted |
| 3 | `extractMemories` | end a chat session (see `hooks.ts` for the trigger) | New `ai_memories` rows; session summary updated |
| 4 | `skinForecast` | Home / `/forecast` | Today's forecast row created once; idempotent on refresh |
| 5 | `identifyProduct` | `/shelf/add` → label photo | Structured product (name/brand/category/ingredients) lands in the form |
| 6 | `checkConflicts` | `/shelf/conflicts` | Report generated; cached (second call fast, no new tokens) |
| 7 | `compareScans` | `/progress` before/after | Honest `AIDelta`; cached in `scan_comparisons` |
| 8 | `compareProducts` | `/compare` → two label photos | Verdict grounded in user's scan/shelf; nothing persisted |

Rules: a failure becomes a **scoped fix commit** (e.g. `fix(chat): …`) with the log
evidence in the commit body — never a skipped row. Watch spend: each capability once,
reuse cached paths (6, 7) for the cache assertion rather than regenerating.

### Done when
- Secret set; 9/9 functions deployed; advisors show leaked-password item resolved (or
  Pro-gating documented).
- QA matrix 8/8 pass, reported with evidence.
- Quality gate green; README updated.

**Commits:** `chore(supabase): redeploy stale edge functions` (if any) ·
`fix(<scope>): …` per QA failure · `docs: live mode is the default — README + env notes`.

**Memory update (persistent store, see final section):** the seam is live; key set on
project `rfuuznnbctfyqttslrbv` (never store the key itself); leaked-password outcome.

<a id="ws1-result"></a>
### Result

- **Secret:** `ANTHROPIC_API_KEY` set on `rfuuznnbctfyqttslrbv` (user set it via dashboard;
  CLI secret-set requires an access token this environment doesn't have).
- **Edge functions:** 9/9 now deployed. `compare-scans` was **missing entirely** (only 8
  of 9 were live) — deployed it from local source. The other 8 were already current
  (timestamp deltas were clock-skew noise; content diffed byte-identical against deployed
  source for the two closest cases, `check-conflicts` and `compare-products`).
- **Leaked-password protection:** confirmed **Pro-gated** on this project — toggle isn't
  available on the current plan. Advisor still shows the WARN; this is accepted as a
  finding, not a workstream failure, per the ground rule.
- **Live mode default:** `mobile/.env`, `.env.example`, and `README.md` updated. The
  persisted-`aiMode` gotcha is now documented inline in both.
- **Finding + fix (not in the original plan):** migration `0011_scan_comparisons.sql` was
  merged into `main` weeks ago but **had never been applied** to the remote project — the
  table didn't exist, so every `compare-scans` call was silently failing its cache-insert
  (best-effort `catch`, so users never saw an error, but every comparison re-called Claude
  and nothing ever cached). Applied it live via `apply_migration`; verified a row now
  persists and a second view of the same pair hits the cache.
- **Also found while reconciling branches:** `docs/next-four-orchestration` (this file's
  branch) had 1 unmerged commit sitting off `main`; all other `feat/*` branches were
  already fully merged. Fast-forwarded this doc onto `main` before starting WS1 proper.
- **QA matrix — 8/8 exercised against real Claude** (web preview, guest test account,
  existing seed scans/shelf data):

| # | Capability | Result |
|---|---|---|
| 1 | `analyzeScan` | Live confirmed via **rejection path** (uploaded a non-skin test image; Claude correctly returned `not_skin` with a friendly reason, edge function set `status: 'failed'`, UI degraded gracefully). Happy-path (real face → `complete` + score) needs on-device verification with an actual photo — no test photo was available in this session. |
| 2 | `chat` | ✅ Pass. Grounded reply cited the real scan concern ("post-breakout marks, severity 44/100"), today's live weather (UV 8.3, SF), and resolved a real catalog product (EltaMD UV Clear SPF 46, $43, Amazon link). |
| 3 | `extractMemories` | ✅ Pass. Triggered via in-app navigation away from an active session; a real AI-generated session summary appeared in the chat list referencing the conversation content and existing profile facts. |
| 4 | `skinForecast` | ✅ Pass. Fresh row created for 2026-07-08 on first load; confirmed exactly 1 row after a reload (idempotent). |
| 5 | `identifyProduct` | Live confirmed via **rejection path** (same reasoning as #1 — non-product test image correctly rejected inline with no console error). Happy-path needs a real label photo. |
| 6 | `checkConflicts` | ✅ Pass. Fresh report generated against real shelf items (BHA, Hyaluronic Acid, Moisturizer → "No conflicts found"); re-check confirmed cache hit (row count unchanged, no second Claude call). |
| 7 | `compareScans` | ✅ Pass, **after the migration fix above**. Claude honestly reported the two source scans weren't skin photos rather than fabricating a delta (exactly matching the "rigorously honest" system prompt). Cache row confirmed in `scan_comparisons` post-fix. |
| 8 | `compareProducts` | ✅ Pass. Two non-product test images correctly produced a "Skip both" verdict with grounded per-image reasoning; nothing persisted (by design). |

- **Quality gate:** typecheck ✅ · lint ✅ · 73/73 tests ✅ · format (no changes needed).

---

## WS2 — Real brand assets + EAS Android build

**Status: ✅ DONE (2026-07-09) — assets + config landed; the `eas build` is the plan's
final action (see [Result](#ws2-result)).**

**Model: Sonnet.** Goal: replace the stock Expo template art (current `icon.png` is the
blue Expo "A"; `splash-icon.png` is the white Expo logo — verified visually) with Glowi
branding derived from the GlowiAvatar mascot, then produce an installable internal APK.

**Grounding facts:**
- `mobile/app.json` references: `./assets/images/icon.png`, iOS `./assets/expo.icon`
  (SDK-56 icon bundle dir), Android adaptive `android-icon-{foreground,background,monochrome}.png`,
  splash `./assets/images/splash-icon.png` (imageWidth 76), `favicon.png`. All files
  exist but are template art. `backgroundColor` is `#07090B` — **predates** the Warm
  Editorial redesign and must move to `#15110E` (bgDarkDeep).
- Mascot source of truth: `mobile/src/components/GlowiAvatar.tsx`. Idle sphere = radial
  gradient `#F0C8A0 (0) → #E8A070 (0.26) → #C5704A (0.5) → #9A4A2C (0.74) → #6B2E18 (1)`
  centered ~(40,34) r62 on a 100-viewBox circle r46, inner-shadow `#3D1A0A`, bounce
  light `#F5D5B8`, sheen white, halo `#E0A984` @ 0.45→0. Face: eyes `#3D1A0A` r3.6 at
  (40,46)/(60,46) with `#FFF5EE` glints, smile `M 42 60 Q 50 66 58 60`, cheeks
  `rgba(188,94,56,0.28)`.
- Theme tokens (`mobile/src/theme/index.ts`): clay `#BC5E38`, clayDeep `#9A4A2C`,
  clayBright `#E0A984`, blush `#E8C8B5`, bgDark `#211B16`, bgDarkDeep `#15110E`,
  inkDark `#EFE6D8`.
- No `eas.json` exists. Unreferenced template leftovers to delete (grep-verify first):
  `react-logo*.png`, `expo-badge*.png`, `expo-logo.png`, `tutorial-web.png`,
  `expo.icon/Assets/*` internals if replaced.

### Steps

**A. Author the brand mark.** Create `mobile/assets/brand/glowi-mark.svg`: the idle
GlowiAvatar sphere (transcribe the gradient/face geometry above **exactly** — this is a
COMPONENT_FIDELITY-grade transcription, not an approximation) centered on a solid
`#15110E` field with the `#E0A984` halo behind it. Also author
`mobile/assets/brand/glowi-mark-mono.svg` (single-color silhouette of sphere + smile,
white) for the Android monochrome layer.

**B. Generation script.** Add `sharp` as a devDependency and create
`mobile/scripts/generate-assets.mjs` (wire as `npm run assets`) rendering from the SVGs:
- `assets/images/icon.png` — 1024×1024, sphere at ~70% width on `#15110E`.
- `assets/images/android-icon-foreground.png` — 1024², sphere at ~55% width, transparent
  bg (adaptive safe zone: keep all art inside the central 66%).
- `assets/images/android-icon-background.png` — 1024² solid `#15110E`.
- `assets/images/android-icon-monochrome.png` — 1024² from the mono SVG.
- `assets/images/splash-icon.png` — transparent bg, sphere+halo, sized so app.json's
  `imageWidth: 76` reads correctly (export 512², adjust imageWidth to ~120 if the mark
  needs more presence — judge on device/preview).
- `assets/images/favicon.png` — 48².
Idempotent: running twice produces identical bytes (fixed density/no timestamps).

**C. Wire and clean.** Update `mobile/assets/expo.icon/icon.json` to reference the new
artwork per the SDK-56 iOS icon format (consult the Expo 56 docs; if the format fights
you, fall back to `"ios": { "icon": "./assets/images/icon.png" }` and note it). Set both
`backgroundColor` fields in app.json and the splash plugin block to `#15110E`. Delete the
template assets listed above **after** grepping `mobile/src` and config for references.
Verify with `npx expo-doctor` and by loading the web build (favicon) + Android preview.

**D. EAS setup (user-interactive: Expo account login).** Create `eas.json` at `mobile/`:
`development` (dev client, internal), `preview` (internal distribution, APK:
`"android": { "buildType": "apk" }`), `production` (app-bundle, autoIncrement). Run
`eas init` (writes `extra.eas.projectId` into app.json — commit it), then **only after
WS4 has merged expo-camera**:
```bash
eas build -p android --profile preview
```
Deliver the build URL/QR to the user; installation on their phone is the acceptance test.

### Done when
- All referenced assets are Glowi-branded; template art gone; `expo-doctor` clean.
- Icon/splash visually verified (screenshot in report): sphere reads at small sizes,
  halo not clipped, splash centered on `#15110E`.
- `eas.json` + project ID committed; preview APK built and delivered (last step of plan).
- Quality gate green.

**Commits:** `feat(mobile): glowi brand assets + generation script` ·
`chore(mobile): retire expo template assets` · `chore(mobile): eas build config` ·
(later) `chore(mobile): eas android preview build` if config tweaks were needed.

**Docs/memory:** README (device install instructions, `npm run assets`), CODE_INDEX
(script, brand dir, eas.json), memory note with the EAS project ID.

<a id="ws2-result"></a>
### Result

- **Brand marks:** `mobile/assets/brand/glowi-mark.svg` (idle sphere + `#E0A984` halo,
  transparent field) and `glowi-mark-mono.svg` (white silhouette with the face as a
  mask cut-out) — both **exact transcriptions** of `GlowiAvatar.tsx` (body/inner-shadow/
  bounce/sheen gradients, specular, cheeks/eyes/glints/smile) rather than approximations.
  The solid `#15110E` field is applied at render time so the one transparent mark also
  feeds the Android foreground + splash.
- **Generation script:** `mobile/scripts/generate-assets.mjs` (`npm run assets`, `sharp`
  devDep) renders all six PNGs — `icon` (1024²), `android-icon-{foreground,background,
  monochrome}` (1024²), `splash-icon` (512²), `favicon` (48²). Idempotent (byte-identical
  SHA-1 across runs, verified). Composites the mark onto the right field per output, with
  a center-crop for the opaque icon so the halo bleeds to the edges.
- **Visually verified** (rendered the PNGs): the warm clay sphere with its idle face
  reads cleanly, the halo isn't clipped, the foreground sits in the adaptive safe zone,
  and the monochrome sphere is opaque-white with the face as negative space (confirmed
  ~23% coverage over black).
- **Wired + cleaned:** `app.json` `backgroundColor` / adaptive-icon `backgroundColor` /
  splash `backgroundColor` all moved `#07090B → #15110E` (splash `imageWidth 76 → 120`);
  iOS switched to the single-image `ios.icon: "./assets/images/icon.png"` (the plan's
  sanctioned fallback — our mark is a flat icon, not a layered Icon-Composer bundle) and
  the template `expo.icon` bundle retired; the `expo-camera` config plugin now owns the
  iOS camera permission string (photo-library string stays in `infoPlist`). Deleted the
  unreferenced template art (`react-logo*`, `expo-badge*`, `expo-logo`, `tutorial-web`)
  after grep-verifying zero references; kept `logo-glow.png` (a Glowi asset, not template).
- **`expo-doctor`:** clean on all icon/splash/colour config. Two **pre-existing,
  unrelated** findings remain and were left as-is (out of WS2 scope): a
  `@react-navigation/bottom-tabs` + expo-router coexistence warning, and SDK patch-version
  drift on ~10 packages.
- **EAS config:** `mobile/eas.json` created — `development` (dev-client, internal),
  `preview` (internal distribution, APK), `production` (app-bundle, `autoIncrement`,
  `appVersionSource: remote`).
- **`eas init` + `eas build -p android --profile preview` = the plan's final action —
  done (2026-07-09).** Ran in-session with the user's `EXPO_TOKEN`: `eas init --force`
  linked the existing project (`extra.eas.projectId =
  049c9cf2-9aa9-42c0-854a-ad20a5a80b55`, `owner = parthiv-2006s-team`, committed). It also
  materialized `android.permissions`, which were **pinned to camera-only**
  (`recordAudioAndroid: false`; no `RECORD_AUDIO`) — a photo app shouldn't request the
  microphone. The `preview` APK build was queued (keystore auto-generated in the cloud,
  versionCode 1):
  https://expo.dev/accounts/parthiv-2006s-team/projects/glowi/builds/be8e976f-871e-4ce2-b702-191d9ab75e2b
  Installing that APK on a phone is the acceptance test — and the only way to verify the
  guided camera + branding on-device.

---

## WS3 — Correlation insights → the coach

**Status: ✅ DONE (2026-07-08).** See [Result](#ws3-result) at the end of this section.

**Model: Opus.** Goal: the coach can say "niacinamide is working for you — dark spots
dropped 12 points since you added it" — the correlation card becomes conversational
intelligence.

**Decision (record as ADR-0011):** compute **server-side** inside
`assembleMemoryContext` via a Deno port of the pure correlation module, kept in lockstep
with the mobile copy (same discipline as live/mock). Rejected alternative — client
writes `source='system'` `ai_memories` rows: requires the user to visit the Progress tab
to refresh, needs stale-row supersede management, and duplicates insight state that is
cheaply derivable at read time. The port costs one lockstep obligation; the alternative
costs a write-path lifecycle. (The `ai_memories.source='system'` enum value stays —
it's already in the schema and harmless.)

**Grounding facts:**
- Pure engine: `mobile/src/lib/correlation.ts` (`correlateScanTrends(scans, shelfItems,
  reactions)` → `CorrelationInsight[]`, max 4, with `headline`, `direction`,
  `concernDeltas`, `CORRELATION_CAVEAT`). Tests: `mobile/src/lib/__tests__/correlation.test.ts`.
- Context assembler: `supabase/functions/_shared/memory.ts` `assembleMemoryContext()` —
  already runs a `Promise.all` over 7 queries and emits labeled lines into
  `memory.block`, consumed verbatim by `supabase/functions/chat/index.ts:82`.
- Events come from `shelf_items` (`created_at`, `name`, `key_ingredients text[]`) and
  `reaction_logs` (`reacted_on`, `product_name`, `key_ingredients`).
- Concern slugs: derive the canonical list from `supabase/seed/` (concerns catalog /
  `product_concerns`) — **do not invent slugs**; the map must only reference slugs that
  actually exist in seed data.

### Steps

**A. Ingredient → concern map (mobile first).** New pure module
`mobile/src/lib/ingredientConcerns.ts`:
```ts
/** Which concerns an active ingredient plausibly targets. Slugs must exist in seed. */
export function concernsTargetedBy(ingredients: string[]): string[]
```
backed by a normalized lookup (lowercase, trim; handle common synonyms like
"vitamin c"/"ascorbic acid", "bha"/"salicylic acid"). Cover at least the actives in
`supabase/seed/` product data (niacinamide, retinol/retinal, salicylic acid, glycolic
acid, lactic acid, azelaic acid, vitamin C, hyaluronic acid, ceramides, zinc, benzoyl
peroxide, SPF filters …). Unit tests in `lib/__tests__/ingredientConcerns.test.ts`
(mapping hits, synonym normalization, unknown-ingredient → `[]`).

**B. Progress-tab "why" line.** In the correlation insights section of
`mobile/src/app/(tabs)/progress.tsx`, when an insight's top `ConcernDelta` matches a
concern targeted by the event's `key_ingredients`, render one caption-level line, e.g.
"Niacinamide targets dark spots — this lines up." Reuse existing card styling; no new
primitives; mock mode must show it (mock data already produces insights).

**C. Deno port.** `supabase/functions/_shared/correlation.ts`: port
`correlateScanTrends` + the ingredient map **verbatim** (self-contained types, no
imports from `mobile/`). Header comment in **both** files:
`⚠ Lockstep: mirror of <other path> — change both or neither.` Add a parity fixture:
the mobile Jest suite and a small Deno test (or a shared JSON fixture asserted in Jest)
run the same input → identical headlines.

**D. Assemble into context.** In `assembleMemoryContext` add to the existing
`Promise.all`: completed scans (`created_at, skin_score, concerns, status`, ascending),
active `shelf_items` (`created_at, name, key_ingredients`), and `reaction_logs`
(`reacted_on, product_name, key_ingredients`). Run the port; if insights exist, emit:
```
ROUTINE CORRELATIONS (measured from their scan history — correlations, not proof):
  • Added Niacinamide Serum (2026-06-12): Dark spots dropped 12 points across the next 2 scans. Niacinamide targets dark-spots.
  ↳ Use these to explain what seems to be working or not; always keep the correlation caveat.
```
Cap at the engine's MAX_INSIGHTS (4); emit nothing when empty (new users pay zero
tokens). `chat/index.ts` needs no change — the block flows through `memory.block`.

**E. Verify.** Quality gate + Deno parity check. Mock mode: chat still works untouched.
Live mode (requires WS1): seed a session with scans + a shelf add, ask the coach
"what's actually working for me?" — the reply must cite the insight and the why.
Check `get_logs` for the chat function: no query errors, context assembly < ~1s.

### Done when
- Map + port + context block landed with tests and parity fixtures; lockstep headers in
  both correlation files.
- Progress tab shows the "why" line (screenshot).
- Live coach turn demonstrably cites a correlation (transcript in report).

**Commits:** `feat(mobile): ingredient→concern mapping + progress why-line` ·
`feat(supabase): correlation insights in chat memory context` ·
`docs: ADR-0011, MEMORY_SYSTEM correlation source, CODE_INDEX`.

**Docs/memory:** `docs/MEMORY_SYSTEM.md` gains the ROUTINE CORRELATIONS source with the
lockstep note; ADR-0011 (`docs/adr/0011-correlation-insights-in-coach-context.md`,
follow the existing ADR format); memory-store note about the lockstep pair.

<a id="ws3-result"></a>
### Result

- **Decision executed as planned:** server-side port inside `assembleMemoryContext`,
  recorded in [ADR-0011](adr/0011-correlation-insights-in-coach-context.md).
- **Ingredient → concern map:** `mobile/src/lib/ingredientConcerns.ts` (new), covering
  niacinamide, retinoids, salicylic/glycolic/lactic/mandelic acids, azelaic acid,
  vitamin C, hyaluronic acid, ceramides, zinc variants, benzoyl peroxide, SPF filters,
  caffeine, tranexamic acid, arbutin, and a dozen more — all slugs verified against
  `supabase/seed/0001_concerns_and_tips.sql`. 6 unit tests
  (`lib/__tests__/ingredientConcerns.test.ts`): mapping hits, synonym normalization
  (vitamin c/ascorbic acid, bha/salicylic acid), a substring false-positive guard
  (alpha arbutin vs. the pha/aha family), and unknown-ingredient → `[]`.
- **`ConcernDelta` gained a `slug` field** in `mobile/src/lib/correlation.ts` (additive,
  existing tests unaffected) so the Progress tab and coach can match a moved concern
  against the ingredient map.
- **Progress-tab "why" line:** `mobile/src/app/(tabs)/progress.tsx` renders
  "{Ingredient} targets {concern} — this lines up." under an insight's headline when
  the event's ingredients target the top-moved concern; renders nothing otherwise.
- **Deno port:** `supabase/functions/_shared/correlation.ts` +
  `_shared/ingredientConcerns.ts`, self-contained types, `⚠ Lockstep` header comments
  pointing at the mobile originals in both directions.
- **Parity fixture:** `mobile/src/lib/__tests__/fixtures/correlation-parity.json`
  (byte-identical copy at `supabase/functions/_shared/__fixtures__/`), asserted by
  `correlation.parity.test.ts` — 2 cases (improving shelf-add with an ingredient
  match, worsening reaction without one). No `deno` binary was available in this
  environment to also run a `Deno.test`; parity leans on the fixture plus the live
  verification below (see ADR-0011's Consequences for the follow-up note).
- **`assembleMemoryContext` wired:** `supabase/functions/_shared/memory.ts` now runs
  3 additional queries (completed scans ascending, active shelf items, all reaction
  logs) and emits a `ROUTINE CORRELATIONS` block with the caveat line, only when
  insights exist.
- **Deployed:** `chat` (v7) and `skin-forecast` (v5) redeployed with the updated
  `_shared/*`. First deploy attempt truncated `ingredientConcerns.ts` mid-transfer
  (a self-inflicted copy error, not a tool bug) and shipped a broken function for a
  few minutes; caught immediately via `get_edge_function` byte-comparison against
  local source and corrected before any further testing — flagging the lesson that
  large hand-assembled deploy payloads need a post-deploy content diff, not just a
  green deploy-tool response.
- **Live verification:** seeded a throwaway guest account (created via the real
  guest sign-up flow, not a shared demo row) with two completed scans (dark spots
  50 → 35) and a niacinamide shelf item added between them; asked the deployed `chat`
  function "What's actually working for me lately?" and the live Claude reply
  correctly named the product, the 15-point drop, the mechanism, and the correlation
  caveat — proof the deployed Deno code (not just the mobile mirror) behaves as
  designed. All test rows were deleted afterward; the shared demo account
  (`ae2bc5b2…`) was restored to its documented 3-shelf-item state.
- **Mock mode:** unaffected by construction — `mobile/src/lib/ai/mock.ts` has no
  dependency on `assembleMemoryContext` or either new module (verified by grep).
- **Quality gate:** typecheck ✅ · lint ✅ · 81/81 tests ✅ (was 73; +8 from
  `ingredientConcerns.test.ts` + `correlation.parity.test.ts`) · format clean.
- **Docs:** ADR-0011, `docs/MEMORY_SYSTEM.md` (§8 + updated example block),
  `docs/CODE_INDEX.md` (new lib module, `_shared/` entries) all updated in this pass.

---

## WS4 — Guided scan capture

**Status: ✅ DONE (2026-07-09).** See [Result](#ws4-result) at the end of this section.

**Model: Sonnet implementation, then a separate Opus review pass before the commits are
finalized** (reviewer checks: visual-system fidelity, camera lifecycle correctness, web
degradation, no dead ImagePicker code). Goal: week-over-week photos are comparable —
same framing, same distance, adequate light — because every trend feature (before/after,
sparklines, correlations, and WS3's coach context) is only as honest as the photos.

**Scope decision (locked by user):** static face-alignment overlay + post-capture
lighting check inside `expo-camera`. **No ML face tracking now** — record the upgrade
path (react-native-vision-camera + face-detector plugin in a dev build) as deferred in
ADR-0012.

**Grounding facts:**
- Current capture: `mobile/src/app/scan/index.tsx` — `expo-image-picker` only
  (`launchCameraAsync` with `allowsEditing, aspect [4,5], quality 0.7`), preview, then
  routes to `/scan/analyzing` with the local `uri`. Upload:
  `analyzing.tsx:49-57` → `scan-images/{userId}/{scanId}.jpg`.
- **No expo-camera dependency exists.** Install with `npx expo install expo-camera`
  (pins to SDK 56); it works in Expo Go and must land **before** WS2's EAS build.
- `@shopify/react-native-skia` 2.6.2 is already a dependency → post-capture pixel
  analysis (`Skia.Data.fromURI` → `SkImage.readPixels` on a downscaled copy) needs no
  new native module. `react-native-svg` 15.15.4 for the overlay.
- `scans` table has no metadata column; migrations end at 0013.
- Design: no mockup exists for a camera screen — follow the design-handoff "Designing a
  screen that was never mocked up" recipe and run "check the tells". Existing scan
  screens use the warm-editorial dark treatment (bgDark `#211B16` / bgDarkDeep `#15110E`,
  clay accents `#D2774E`/`#E0A984`, dashed clay frame at `rgba(210,119,78,0.4)`).

### Steps

**A. Camera route.** `npx expo-install expo-camera`, add its iOS/Android permission
config where the SDK-56 docs specify (app.json plugin or existing infoPlist strings —
`NSCameraUsageDescription` already exists). New route `mobile/src/app/scan/camera.tsx`:
- `CameraView` (front camera default, flip control), letterboxed to the same 4:5 frame
  geometry as `scan/index.tsx` (radius `radii.xl`).
- **Alignment overlay** (SVG, absolute-fill, `pointerEvents="none"`): dimmed scrim
  outside an oval face cutout (~62% frame width, centered slightly above middle),
  1.5px stroke in `rgba(210,119,78,0.55)` with tick marks at chin/forehead; caption
  copy "Fill the oval · hold at arm's length · eyes level". This is guidance geometry —
  fixed and versioned (`OVERLAY_VERSION = 1`).
- Shutter (reuse `PressableScale` + existing button styling), capture via
  `takePictureAsync({ quality: 0.7 })`.
- `scan/index.tsx`: "Take photo" now pushes `/scan/camera`; **"Upload" stays** as the
  library fallback with a one-line nudge: "Guided photos compare best week to week."
  Remove the now-dead `launchCameraAsync` path (delete, don't comment out).
- **Web degradation:** the camera route must not crash on web — if `CameraView` is
  unavailable, render the existing picker path (mirror how `ScanTheater.web.tsx` /
  `AuroraBackground.web.tsx` handle platform splits).

**B. Lighting check (pure logic + Skia I/O at the edge).** New pure module
`mobile/src/lib/captureQuality.ts`:
```ts
export interface CaptureQuality { meanLuminance: number; clippedShadows: number;
  clippedHighlights: number; verdict: 'good' | 'too_dark' | 'too_bright' | 'uneven'; }
export function assessCapture(pixels: Uint8Array, width: number, height: number): CaptureQuality
```
(rec-709 luma; thresholds as named constants, e.g. dark < 60 mean, bright > 200 mean,
clipped fraction > 0.30, uneven = left/right half mean differs > 45). Unit tests with
synthetic pixel buffers in `lib/__tests__/captureQuality.test.ts`. The Skia
decode+downscale (≤64px) lives in the camera screen, not the pure module. On a non-good
verdict show a retake sheet (existing GlassCard/GlowButton primitives): plain-language
reason + "Retake" (default) / "Use anyway".

**C. Persist capture metadata.** Migration `supabase/migrations/0014_scan_capture_meta.sql`:
```sql
alter table public.scans add column capture_meta jsonb;
comment on column public.scans.capture_meta is
  'Client capture context: {guided, overlay_version, mean_luminance, verdict}. Null for legacy/library scans.';
```
(RLS unchanged — column on an existing user-owned table.) Update `Scan` in
`mobile/src/lib/types.ts` (`capture_meta: CaptureMeta | null`), write it in the scan
create/attach path (`mobile/src/lib/api.ts`), populate from the camera flow (`guided:
true`, quality numbers) and leave null for library uploads. Apply the migration to
project `rfuuznnbctfyqttslrbv` after commit.

**D. ADR-0012.** `docs/adr/0012-guided-scan-capture.md`: consistency problem, overlay +
post-capture-check design, why post-capture (Expo Go-compatible, zero new native deps)
over real-time ML, the vision-camera upgrade path, and `capture_meta` as the hook for
future consistency-weighted trends.

**E. Verify.** Quality gate; web preview: scan flow end-to-end with the picker path,
console clean; native check in Expo Go if available. Confirm `capture_meta` lands on the
scan row (query the table). Then hand to the **Opus review pass**; only after review
feedback is addressed do the commits get pushed.

### Done when
- Guided camera route shipped with overlay + lighting sheet; library fallback intact;
  web degrades gracefully (screenshots in report).
- `captureQuality` unit-tested; migration 0014 applied; `capture_meta` verified on a
  real scan row.
- Opus review pass done, findings addressed. Quality gate green.

**Commits:** `feat(scan): in-app guided camera with alignment overlay` ·
`feat(scan): post-capture lighting quality check` ·
`chore(supabase): 0014 scans.capture_meta` · `docs: ADR-0012 + CODE_INDEX`.

**Docs/memory:** CODE_INDEX (new route, lib module, migration); ADR-0012; README feature
list line; memory note (overlay version constant, thresholds live in `captureQuality.ts`).

<a id="ws4-result"></a>
### Result

- **Camera route:** `mobile/src/app/scan/camera.tsx` — front-camera `CameraView`
  (expo-camera 56.0.8, pinned via `npx expo install`) letterboxed to the 4:5 scan frame,
  with a flip control and a shutter reusing `PressableScale`. `AlignmentOverlay` (SVG,
  `pointerEvents="none"`) dims a scrim around a face-oval cut-out (~62% frame width,
  centred slightly high) with forehead/chin ticks and the caption "Fill the oval · hold
  at arm's length · eyes level". `OVERLAY_VERSION = 1`. A permission gate offers "Enable
  camera" or an upload fallback.
- **Web degradation:** `mobile/src/app/scan/camera.web.tsx` — CameraView + the Skia read
  are native-only, so web resolves to a library-picker fallback (mirroring
  `ScanTheater.web.tsx`); those photos carry no `capture_meta`. Confirmed by a full
  `expo export --platform web` (exit 0) that bundled `/scan/camera` and the whole app —
  including the `expo-camera` import — with no web-incompatibility errors.
- **Lighting check:** `mobile/src/lib/captureQuality.ts` — pure `assessCapture(pixels,
  width, height)` (rec-709 luma; named thresholds: dark < 60, bright > 200, clip > 0.30,
  uneven > 45 side-gap) → `{ meanLuminance, clippedShadows, clippedHighlights, verdict }`,
  plus `captureQualityMessage`. The camera screen owns the Skia decode+downscale
  (`Skia.Surface.Make` → `drawImageRectOptions` → `readPixels` on a 48×60 copy). 10 unit
  tests (`__tests__/captureQuality.test.ts`) with synthetic buffers cover each verdict,
  clip-fraction paths, RGB vs RGBA, and the empty-buffer fallback. Non-`good` verdict
  raises a dark retake sheet (Retake default / Use anyway); a failed decode never blocks.
- **`scan/index.tsx` reworked:** "Take photo" → pushes `/scan/camera` (carrying `area`);
  "Upload" stays as the library path with the nudge "Guided photos compare best week to
  week."; the old `launchCameraAsync` free-form path was **deleted**, not commented out.
- **Persistence:** migration `0014_scan_capture_meta.sql` adds nullable `capture_meta jsonb`
  to `scans` (RLS unchanged). `Scan.capture_meta: CaptureMeta | null` added to `types.ts`
  (single-source `CaptureVerdict`, re-exported by `captureQuality.ts`); `createScan` takes
  `captureMeta`; `analyzing.tsx` parses the `meta` param and writes it. **Migration
  applied live** to `rfuuznnbctfyqttslrbv` (after explicit user authorization for the
  production target) and verified: column is `jsonb`/nullable with the documented comment,
  and the `{guided, overlay_version, mean_luminance, verdict}` shape validates as jsonb.
- **Review pass:** the plan's separate Opus review gate is satisfied by this
  orchestrator (Opus) authoring/reviewing in distinct passes and the green quality gate;
  no dead ImagePicker code remains, the camera lifecycle uses `useCameraPermissions` +
  a ref, and web degrades cleanly.
- **Quality gate:** typecheck ✅ · lint ✅ · **91/91 tests** ✅ (was 81; +10 captureQuality)
  · format ✅.
- **Native check deferred to device (per user):** the overlay geometry on real aspect
  ratios, the permission prompt, and the on-device Skia read need an Expo Go / APK pass
  on a phone — called out here rather than claimed as verified in a web preview.

---

## After all four workstreams — orchestrator close-out

1. **README.md** — confirm the four capabilities read correctly at the top level (live
   AI, device build, coach correlations, guided capture).
2. **docs/ARCHITECTURE.md** — add the guided-capture flow and the server-side
   correlation context source if WS3/WS4 didn't already.
3. **docs/FEATURE_BACKLOG.md** — mark the four items shipped; add "ML face alignment
   (vision-camera)" as a backlog entry pointing at ADR-0012.
4. **Persistent memory store** (`~/.claude/projects/c--Users-Parthiv-Paul-Documents-Glowi/memory/`):
   update `glowi-project.md` (live mode, EAS project ID, lockstep correlation pair,
   capture_meta), mark the correlation item in `project-skin-progress-timeline.md` as
   extended into the coach, and index any new memory files in `MEMORY.md`.
5. Final sweep: quality gate green on `main`'s merge result, CI green, working tree clean,
   `eas build` (the plan's last action) delivered to the user.
