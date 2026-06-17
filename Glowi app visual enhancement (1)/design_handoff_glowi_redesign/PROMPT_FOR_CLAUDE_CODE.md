# Prompt for Claude Code

## What to upload / open
Run Claude Code **inside your existing Glowi repo** (the `Glowi/` monorepo — it needs the real `mobile/` app to work with). Then add this handoff folder to the repo and reference it. Concretely:

1. Open Claude Code with the **`Glowi/` repository** as the working directory (so it can read `mobile/src/theme/index.ts`, `mobile/src/components/`, `mobile/src/app/`).
2. Drop this entire **`design_handoff_glowi_redesign/`** folder somewhere in the repo (e.g. `mobile/design_handoff_glowi_redesign/`).
3. Make sure these are present for it to read:
   - `design_handoff_glowi_redesign/` (all the `.md` files + `references/*.dc.html`)
   - `mobile/src/theme/index.ts`, `mobile/src/components/ui/*`, `mobile/src/components/*`, `mobile/src/app/*`
4. (Optional) Open `references/Glowi Redesign.dc.html` in a browser yourself so you can see the animations the docs describe.

You do **not** need to upload anything else — the spec is self-contained.

---

## The prompt (paste this)

> You're upgrading the **Glowi** React Native app (Expo Router + Reanimated + Skia) from a flat, "vibe-coded" look to a polished, premium design. The complete design system and screen specs are in `design_handoff_glowi_redesign/`. **Read `README.md`, then `DESIGN_PRINCIPLES.md` (most important), then `SCREENS.md` and `MASCOT_AND_LOGO.md` before writing any code.** The HTML files in `references/` are visual prototypes — recreate their look and motion in the existing RN codebase, do not copy HTML/CSS.
>
> **Ground rules:**
> - Work within the existing architecture. Extend `src/theme/index.ts` (add the depth + contrast tokens from DESIGN_PRINCIPLES §0) and the existing components (`GlassCard`, `AppText`, `GlowButton`, `ScanTheater`, `AuroraBackground`, `ProgressRing`, `Stagger`, `PressableScale`). Don't add a second styling system or new UI libraries.
> - Where this spec disagrees with current code, the spec wins (it's the redesign).
> - Keep all existing data, navigation, hooks, and API logic intact — this is a visual/interaction upgrade only.
>
> **Phase 1 — foundation.** Add the new tokens. Refactor `GlassCard` to a three-tier system (`tier="sunken" | "raised" | "glow"`) per DESIGN_PRINCIPLES §1, with the top inner-highlight + tier-specific fills/shadows. Bump body copy to the new `textBody` token (§2). Build the reusable `GlowiAvatar` component with the four states (`MASCOT_AND_LOGO.md`). Show me these before moving on.
>
> **Phase 2 — the scan.** Upgrade `ScanTheater` + the analyzing/reveal screens into the cinematic moment: face-mapping mesh, detected-zone callouts, sweeping beam, and a score ring that fills while the number counts up, with the `celebrating` mascot. (SCREENS.md → Scan.)
>
> **Phase 3 — screens.** Recreate each screen in SCREENS.md, **both empty and populated states**, applying the principles. Wire `GlowiAvatar` into onboarding, Coach (identity + typing + empty), the scan, the reveal, and empty states. Add splash + app icon.
>
> **Phase 4 — new + future surfaces.** For any screen NOT mocked up (now or later), follow the "Designing a screen that was never mocked up" recipe in DESIGN_PRINCIPLES.md and the component recipes. Before finishing any new screen, run the "check the tells" list. The goal: a teammate adding a feature next month can read DESIGN_PRINCIPLES.md and produce a screen indistinguishable from these.
>
> Also add a short `mobile/DESIGN.md` (or extend `CLAUDE.md`) that points future contributors to these principles, so the system is enforced going forward.
>
> Verify on web/simulator after each phase and fix console errors before continuing. Ask me if anything in the spec is ambiguous rather than guessing.

---

## Tips
- Let it do **Phase 1 first and review it** — the token + `GlassCard` + `GlowiAvatar` foundation is what makes every later screen easy. If the depth tiers and the mascot land, the rest follows.
- If you want it to also enforce the system long-term, keep the "add `DESIGN.md` / extend `CLAUDE.md`" instruction — that's what makes *future* pages (ones nobody mocks up) stay on-brand.
- The cinematic scan (Phase 2) is the highest-impact, highest-effort piece. If you're time-boxed, prioritize Phase 1 + 2.
