# Handoff: Glowi Visual Redesign + Mascot

## Overview
This bundle is the visual redesign of the **Glowi** skincare app — moving it from a flat, "vibe-coded" surface to a polished, premium product with depth, editorial rhythm, a cinematic skin-scan moment, and a brand mascot ("Glowi") used throughout.

It contains:
- The design **principles** that define the look (this is the most important file — it lets you style screens that were never mocked up).
- A **screen-by-screen** spec of everything that was designed.
- The **mascot + logo** spec.
- The original **HTML reference prototypes** (in `references/`).
- A ready-to-paste **prompt** for Claude Code.

## About the Design Files
The files in `references/` are **design references created in HTML** (specifically, single-file streaming "Design Component" `.dc.html` prototypes). They show the intended *look, motion, and behavior*. **They are not production code to copy.**

Your existing app is **React Native (Expo Router + Reanimated + Skia)** with a real token system in `src/theme/index.ts` and a component library in `src/components/ui/`. The task is to **recreate these designs inside that codebase, using its existing patterns** — extend `theme/index.ts`, `GlassCard`, `AppText`, `GlowButton`, `ScanTheater`, etc. Do not introduce a second styling system or copy HTML/CSS verbatim.

## Fidelity
**High-fidelity.** Colors, typography, spacing, radii, motion, and component recipes are final and exact. Recreate the UI faithfully using the codebase's libraries. Where a value here differs from the current code, **this spec wins** (it's the redesign).

## How to view the reference prototypes
Open either file in `references/` in a Chromium browser:
- `Glowi Redesign.dc.html` — the full redesign deck: diagnosis, the visual system, the brand/mascot section, all redesigned screens (empty + populated), and the cinematic scan (animated). Let it run — the scan mesh and score count-up are live.
- `GlowiAvatar.dc.html` — the mascot on its own (idle state). Change the `state` prop to see `thinking` / `scanning` / `celebrating`.

> The `.dc.html` files use inline styles only and load Fraunces + Inter from Google Fonts. They render standalone with no build step.

## Read these in order
1. **`DESIGN_PRINCIPLES.md`** — the durable system. Read first. This is what makes new, un-mocked screens look like Glowi.
2. **`SCREENS.md`** — exact spec for each screen that was designed.
3. **`MASCOT_AND_LOGO.md`** — the Glowi mascot component + logo lockups + app icon.
4. **`PROMPT_FOR_CLAUDE_CODE.md`** — the prompt to give Claude Code, and what to upload.

## Files
- `DESIGN_PRINCIPLES.md`
- `SCREENS.md`
- `MASCOT_AND_LOGO.md`
- `PROMPT_FOR_CLAUDE_CODE.md`
- `references/Glowi Redesign.dc.html`
- `references/GlowiAvatar.dc.html`
