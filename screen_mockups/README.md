# Screen mockups — reference images for Claude Code

15 PNGs, one per screen, rendered from `references/Glowi Redesign.dc.html`. These are the
**visual target**. Recreate each in React Native to match — pair them with `COMPONENT_FIDELITY.md`
(exact values) and `SCREENS.md` (intent + states).

> Note: these are static frames of an animated design. Where a screen animates (analyzing beam,
> reveal count-up, typing dots), the still shows one moment — see `COMPONENT_FIDELITY.md §8` for the
> motion. Headline font in these renders is a serif fallback; the real face is **Fraunces** (§7).

| File | Screen | Route | Notes |
|---|---|---|---|
| `01-splash.png` | Splash | app launch | Wordmark + tagline over aurora |
| `02-onboarding-welcome.png` | Welcome | `(auth)/welcome` | Living orb + three-beat promise + sheen CTA |
| `03-onboarding-skin-type.png` | Skin type | `onboarding` | Selected row = glow tier; rest recede |
| `04-home-empty.png` | Home, first run | `(tabs)/index` | Empty state → first-scan prompt |
| `05-home-populated.png` | Home, returning | `(tabs)/index` | Latest scan strip + ring |
| `06-scan-capture.png` | Capture | `scan/index` | Framing well, capture CTA |
| `07-scan-analyzing.png` | Analyzing | `scan/analyzing` | Face mesh + sweeping beam + pinging zones |
| `08-scan-reveal.png` | Reveal | `results/[scanId]` | Score ring fills + number counts up |
| `09-results.png` | Results | `results/[scanId]` | Findings list, severity tags/meters |
| `10-concern-detail.png` | Concern | `concern/[scanId]/[slug]` | Tabbed, tactile detail |
| `11-coach-empty.png` | Coach, empty | `(tabs)/chat` | Empty becomes a prompt |
| `12-coach-conversation.png` | Coach, active | `(tabs)/chat` | Message bubbles + typing dots |
| `13-progress.png` | Progress | `(tabs)/progress` | Timeline of scans |
| `14-learn.png` | Learn | `(tabs)/learn` | Editorial feed + search + chips |
| `15-profile.png` | Profile | `(tabs)/profile` | Real controls, tiers, toggle |

**Screens with no mockup** (sign-in, forecast, memory, routine, shelf/*, article/[slug]) are built
from the recipe in `DESIGN_PRINCIPLES.md` — there's intentionally no image for them.

## How to use in Claude Code
1. Upload this folder with the rest of `design_handoff_glowi_redesign/`.
2. When building a screen, attach its PNG to the message and say: *"match this exactly — transcribe
   values from COMPONENT_FIDELITY.md."*
3. After building, screenshot your simulator and compare it to the PNG; fix drift before moving on.
