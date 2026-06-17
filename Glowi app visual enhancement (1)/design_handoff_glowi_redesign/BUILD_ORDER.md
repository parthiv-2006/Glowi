# BUILD_ORDER.md — fresh-session playbook (end to end, incl. unmocked pages)

A self-driving sequence for building the Glowi redesign from a **fresh Claude Code session**.
Run it phase by phase. **Gate every phase** (review before continuing) and **screenshot-compare
every screen**. A single "build the whole app" prompt is where polish dies — don't do it.

Reading order for the agent (once, up front):
`README.md` → `DESIGN_PRINCIPLES.md` → `COMPONENT_FIDELITY.md` → `SCREENS.md` → `MASCOT_AND_LOGO.md`.

---

## Session setup
1. Open Claude Code with the **`Glowi/` repo root** as the working directory (it must read
   `mobile/src/**` and `design_handoff_glowi_redesign/**` together).
2. Confirm present: this folder (incl. `COMPONENT_FIDELITY.md`), `mobile/src/theme/index.ts`,
   `mobile/src/components/**`, `mobile/src/app/**`.
3. Have the simulator or web build running so you can screenshot after each phase.

---

## Kickoff message (paste, then WAIT)
> You're rebuilding the visual layer of the Glowi RN app (Expo Router + Reanimated + Skia). Read,
> in order: `design_handoff_glowi_redesign/README.md` → `DESIGN_PRINCIPLES.md` →
> `COMPONENT_FIDELITY.md` → `SCREENS.md` → `MASCOT_AND_LOGO.md`. **Do not write code yet.** Then
> give me: (a) the three-tier GlassCard plan, (b) every route in `mobile/src/app/` split into
> "has a mockup" vs "no mockup", (c) which of the five COMPONENT_FIDELITY §0 effects each screen
> needs. Then wait for my go-ahead.

---

## Route inventory (so nothing gets skipped)

**Has a mockup** (build to the reference frame in `references/Glowi Redesign.dc.html`):
- `(auth)/welcome` · `(auth)/sign-up`
- `onboarding` (hi-guest, skin-type, goals)
- `(tabs)/index` Home — **empty + populated**
- `scan/index` (capture) · `scan/analyzing` · `results/[scanId]` (reveal + findings list)
- `concern/[scanId]/[slug]` (partly specced in SCREENS.md)
- `(tabs)/chat` Coach · `(tabs)/progress` · `(tabs)/learn` · `(tabs)/profile`
- `shelf/index` (empty)

**No mockup — build via the recipe** (DESIGN_PRINCIPLES "Designing a screen that was never
mocked up" + "check the tells"):
- `(auth)/sign-in`
- `forecast` · `memory` · `routine/index`
- `shelf/add` · `shelf/conflicts` · `shelf/[id]`
- `article/[slug]`
- (any new route added later)

---

## Phase 1 — tokens + the 5 hard effects + primitives  ⟵ THE GATE THAT MATTERS MOST
Everything after this is composition; if the primitives are right, the screens fall out easily.
> Phase 1 only — no screens. Add the depth/contrast tokens (DESIGN_PRINCIPLES §0). Build the five
> COMPONENT_FIDELITY §0 effects as reusable pieces: BlurView glass, the inset-highlight gradient
> line, the behind-view glow, MaskedView gradient text, the aurora. Then refactor GlassCard (3
> tiers), GlowButton, ProgressRing (dashoffset fill + count-up), GlowiAvatar (4 states) using the
> EXACT values. Add a throwaway `/_kitchensink` route showing all of them. Stop and show me.

**Acceptance:** screenshot `/_kitchensink`, paste beside the reference, say "match this." Iterate
until: a card visibly reads as *lit glass* (top highlight present), the glow tier has a real halo,
gradient text shows, and the ring fills while the number counts up. **Do not approve until these
are right.**

---

## Phase 2 — the scan (signature moment)
> Build the scan: capture → analyzing (face mesh `g-meshpulse`, sweeping `g-beam`, zones that ping
> with `g-pop` callouts) → reveal (ring fills + number counts 0→score, celebrating mascot).
> Exact timings in COMPONENT_FIDELITY §8. Screenshot each state and compare to the reference.

---

## Phase 3 — mocked screens (ONE AT A TIME, empty + populated)
For each mocked route, in this order: Onboarding → Home → Coach → Progress → Learn → Profile →
Shelf-empty → Results+concern.
> Build [screen], empty and populated. Transcribe values from COMPONENT_FIDELITY + SCREENS — do not
> approximate. Then screenshot it and compare to its frame in `references/Glowi Redesign.dc.html`;
> fix drift before the next screen.

---

## Phase 4 — unmocked pages (the part with no reference image)
These look native to Glowi **only if** the agent runs the existing recipe per screen. Don't accept
a batch.
> For each no-mockup route (sign-in, forecast, memory, routine, shelf/add, shelf/conflicts,
> shelf/[id], article/[slug]): follow the "Designing a screen that was never mocked up" recipe in
> DESIGN_PRINCIPLES.md step by step — choose the hero, the ONE Glow element, a tier for every card,
> the empty variant, the Fraunces emotional line. Reuse existing primitives only; invent no new
> component or color. Build one, run the "check the tells" checklist, show me a screenshot, then
> start the next.

**Per-screen "check the tells" (must pass before moving on):**
- [ ] No flat single-plane cards — every surface declares a tier (§1)
- [ ] Body copy is `textBody`, not muddy grey (§2)
- [ ] Exactly **one** Glow element on the screen (§1/§3)
- [ ] Fraunces on the emotional/headline line, with negative tracking (§7)
- [ ] One ambient aurora + purposeful motion only — no decorative jitter (§4/§8)
- [ ] Empty state has a living element + a promise + a concrete action (§5)
- [ ] Any metric is a ring/bar that fills — never a printed number (§5, COMPONENT_FIDELITY §5)
- [ ] None of the five §0 effects rendered as a flat `rgba()` fill

---

## Phase 5 — polish pass
> Walk every screen once more at device size. Verify Fraunces actually loaded (headlines not
> system serif), tab bar blur is real, all glows use the behind-view technique, and stagger/ease
> timings match §8. Fix console warnings.

---

## The two non-negotiables
1. **Gate every phase / one screen per turn.** You review, then say continue.
2. **Screenshot-compare every screen.** The agent is blind to its own output — pasting a sim
   screenshot beside the reference (or running "check the tells" for unmocked pages) is the loop
   that turns "close" into "exact."
