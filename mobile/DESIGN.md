# DESIGN.md

Glowi's visual system — **clinical luxe**: near-black depths, frosted-glass surfaces lit
from above, a single jade glow accent, editorial serif headlines, and motion that explains
rather than decorates.

## Read this first

The full design system lives in
[`design_handoff_glowi_redesign/DESIGN_PRINCIPLES.md`](../design_handoff_glowi_redesign/DESIGN_PRINCIPLES.md).
**Read it before building or restyling any screen** — it is the durable spec, not just a
list of screens that were mocked up. It covers:

- The depth tokens (`textBody`, `surfaceSunken`/`surfaceRaised`/`surfaceGlow`) and the
  three-tier `GlassCard` system (§1) — every surface must declare a tier, never a flat
  `rgba(255,255,255,0.05)` plane.
- Contrast rules for body copy (§2), editorial rhythm (§3), motion (§4), empty states (§5),
  the `GlowiAvatar` mascot (§6), color-as-meaning (§7), iconography (§8), spacing (§9), and
  copy voice (§10).
- A step-by-step recipe for **"designing a screen that was never mocked up"** and a
  **"check the tells"** checklist — use both for any new surface.
- Exact component recipes (buttons, cards, score rings, concern cards, product cards,
  chips, toggles, chat bubbles, tab bar, the cinematic scan).

[`design_handoff_glowi_redesign/SCREENS.md`](../design_handoff_glowi_redesign/SCREENS.md) has
the exact spec for every screen that was redesigned, mapped to its file in `src/app/`.
[`design_handoff_glowi_redesign/MASCOT_AND_LOGO.md`](../design_handoff_glowi_redesign/MASCOT_AND_LOGO.md)
covers the `GlowiAvatar` mascot and logo lockups in detail.

## The non-negotiables

- Extend `src/theme/index.ts` and the existing primitives in `src/components/ui/`
  (`GlassCard`, `AppText`, `GlowButton`, `ProgressRing`, `Stagger`, `PressableScale`) and
  `src/components/GlowiAvatar.tsx`. Never introduce a second styling system or a one-off
  mascot drawing.
- Every card declares a `GlassCard` `tier`: `"sunken"` for wells (inputs, search, empty-state
  interiors), `"raised"` for the default card, `"glow"` for the one hero/active element on
  a screen — never more than one `glow` per screen.
- Body copy uses `AppText variant="body"` or `"subheading"` (now `textBody`, not
  `textSecondary`) — `textSecondary` is for genuinely secondary metadata only.
- Any metric (score, severity, streak) gets a ring or bar that fills and counts up, colored
  by `scoreColor`/`severityColor`/`toneColor` — never a printed number.
- Empty/guest/first-run states get the same care as the populated state: a living element
  (`GlowiAvatar`, a pinging ring, the aurora), a one-line Fraunces promise, and a concrete
  next action. Never a bare list or a dead center-space.
- Before shipping a new screen, run the "check the tells" list in
  `DESIGN_PRINCIPLES.md` §"Designing a screen that was never mocked up".
