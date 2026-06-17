# COMPONENT_FIDELITY.md — exact values, transcribe don't reinterpret

**Read this alongside `DESIGN_PRINCIPLES.md`.** That file explains *why*; this file gives the
*exact numbers* from `references/Glowi Redesign.dc.html` and the **React Native technique** for
each effect that has no 1:1 CSS equivalent. When a value here disagrees with prose elsewhere,
**this file wins** — it's measured from the reference, not described.

> **Rule for the agent:** do not re-derive opacities, offsets, radii, or gradient stops from a
> verbal description. Copy the literal numbers below into `theme/index.ts` and the components.
> "Looks roughly like glass" is the failure mode this file exists to prevent.

---

## 0. The five effects RN cannot do natively (this is where fidelity dies)

| CSS in the reference | Why RN drops it | The RN technique to use instead |
|---|---|---|
| `backdrop-filter: blur(16px)` (tab bar, callouts) | No RN equivalent; collapses to a flat fill | `expo-blur` → `<BlurView intensity={24} tint="dark">` with the translucent fill **on top** as an overlay. Never fake it with plain `rgba()`. |
| `box-shadow: inset 0 1px 1px rgba(255,255,255,.12)` (top inner highlight on every card) | RN shadows can't be `inset` | 1px-tall absolutely-positioned `<LinearGradient>` line pinned to the card's top edge (`rgba(255,255,255,.12)` → transparent), clipped by the card's `borderRadius` + `overflow:hidden`. This highlight is 50% of the "lit glass" read — never omit it. |
| `box-shadow: 0 12px 34px -8px rgba(...)` (negative spread glow) | RN has no spread; Android ignores colored shadows | A separate **glow view behind** the element: same shape, `backgroundColor` = the glow color, `opacity`, wrapped so it sits under via `position:absolute`. Or `shadowColor/shadowRadius/shadowOpacity` on iOS only + a behind-view fallback for Android. |
| Text gradient (jade "scientifically.", "Guest") | No native gradient text | `@react-native-masked-view/masked-view` + `expo-linear-gradient` as the fill. |
| `filter: blur(18px)` on aurora blobs | No filter primitive | Pre-baked radial PNG, OR a `<RadialGradient>` (react-native-svg) sized 1.4× and clipped — the reference radials already fade to `transparent 70%`, so a soft radial reads correctly without a real blur. |

If any of these five render flat, the whole screen reads "vibe-coded." Build them as shared
primitives first (see §7 checklist) and screenshot-compare before touching screens.

---

## 1. Phone frame & canvas (reference uses these on every mock)

- **Screen body:** `width: 340 · height: 736 · borderRadius: 44 · background: #07090B · overflow:hidden`
  (the `362 / padding 11 / radius 54` outer bezel is the *web mockup's* device frame — **skip it in RN**, the OS provides the device).
- **Page backdrop (cover):** `radial-gradient(120% 80% at 50% -10%, #0e1413, #080b0a 55%, #060807)`.
- **Aurora blob (most screens):** circle `240×240`, `top:-70 left:-40`, `radial-gradient(circle, rgba(15,118,110,.4), transparent 70%)`, `blur(18px)`, animance `g-aurora 18s`. Reveal screen uses a green one: `320×320`, `rgba(52,211,153,.22) → transparent 65%`, `blur(20px)`.

---

## 2. Color tokens — already correct in `theme/index.ts`, plus these literals the reference uses

The theme file matches the reference. A few **exact values that appear inline** and must not drift:

- Jade gradient button fill: `linear-gradient(120deg, #5EEAD4, #2DD4BF)` — text on it is `#04211C`.
- Aurora teals: `rgba(15,118,110,.4–.5)`, `rgba(21,94,99,.45)`.
- Glow-card border: `rgba(94,234,212,.28)` (weather) up to `.4` (selected row).
- Muted body inside dark cards: `#8A938F`; secondary metadata: `#646E6A`; tertiary labels: `#6E7873`.
- Severity amber `#FBBF24`, success `#34D399`, danger `#FB7185` — used for dots, meters, callout borders.

---

## 3. GlassCard — the three tiers, EXACT

Every card = fill + 1px border + the inner-highlight line (§0) + radius. Default `borderRadius: 20–22`.

### tier="raised" (default card)
```
background: linear-gradient(180deg, rgba(255,255,255,.05), rgba(255,255,255,.018))
border:     1px solid rgba(255,255,255,.08)
highlight:  inset top 1px rgba(255,255,255,.05)   → render as the gradient-line trick
```
A slightly stronger variant appears on the latest-scan strip: fill `rgba(255,255,255,.06) → .02`, border `rgba(255,255,255,.09)`, highlight `rgba(255,255,255,.06)`.

### tier="sunken" (inputs, search, empty-state wells)
```
background: #0B0F0E            (flat, NOT a gradient)
border:     1px solid rgba(255,255,255,.05–.07)
no glow, no highlight
```

### tier="glow" (ONE per screen — hero/active/selected)
```
background: linear-gradient(180deg, rgba(94,234,212,.12–.14), rgba(94,234,212,.03–.04))
border:     1px solid rgba(94,234,212,.28)  (.4 when it's a selected row)
glow:       0 14px 36px -14px rgba(45,212,191,.4)   → behind-view technique (§0)
highlight:  inset top 1px rgba(255,255,255,.1)
```

**Selected list row** (skin-type screen) is the glow tier at `borderRadius:18, padding:16 18`, plus the row's title flips to `#5EEAD4` and the radio becomes a filled jade check. Unselected rows are `raised` with title `#F2F5F4`, description `#8A938F`, and a `1.5px solid rgba(255,255,255,.18)` empty ring.

---

## 4. GlowButton (primary CTA) — EXACT
```
height: 56 · borderRadius: 28
background: linear-gradient(120deg, #5EEAD4, #2DD4BF)
glow:  0 12px 34px -8px rgba(45,212,191,.5–.6)   → behind-view (§0)
label: Inter 600 · 16 · color #04211C
```
Optional sheen sweep: a 60px-wide `linear-gradient(90deg, transparent, rgba(255,255,255,.4), transparent)` translating across via `g-sheen 4s` (Reanimated `translateX(-120% → 220%)`).

Secondary button: `background rgba(255,255,255,.05) · border 1px rgba(255,255,255,.14) · label #5EEAD4`.

---

## 5. ProgressRing / score ring — EXACT (never a printed number)
- Reveal ring: SVG `180×180`, `r=76`, `stroke-width=11`, track `rgba(255,255,255,.07)`, progress `#34D399` (via `scoreColor`), `stroke-linecap:round`, rotated `-90°`, `drop-shadow(0 0 8px rgba(52,211,153,.5))`.
- **Fill animation:** `stroke-dashoffset` from circumference→target over **1.7s `cubic-bezier(.22,1,.36,1)` with .35s delay** (this is `motion.easing` already in the theme). In RN use `react-native-svg` `Circle` + Reanimated `useAnimatedProps` on `strokeDashoffset`.
- **Number counts up in lockstep:** Fraunces 700 · 56px · `#F2F5F4`, animating 0→score over the same 1.7s. Use a Reanimated `useDerivedValue` + `ReText`, or `runOnJS` setState on each frame. Never show the final number statically.
- Inline strip ring: `76–78px`, `r=32–33`, `stroke-width=7`, Fraunces 700 24–25px centered.

---

## 6. Smaller components — EXACT
- **Chip / pill:** `padding: 7px 14px · borderRadius: 20 · font 12.5`. Selected = `background rgba(94,234,212,.9) · color #04211C · weight 600`. Unselected = `background rgba(255,255,255,.04) · border 1px rgba(255,255,255,.1) · color #8A938F`.
- **Severity tag:** `Moderate · 52` → `color #FBBF24 · background rgba(251,191,36,.12) · border 1px rgba(251,191,36,.3) · padding 3px 9px · radius 14`. Confidence tag → neutral `rgba(255,255,255,.05)` fill, `#8A938F`.
- **Severity meter bar:** `height 4 · radius 3 · track rgba(255,255,255,.08)`, fill `linear-gradient(90deg, #0F766E, <severityColor>)`, width = `severity%`.
- **Tab bar:** floating, `left/right:22 · bottom:24 · height:60 · radius:30`, `background rgba(12,15,19,.82)` **over a `BlurView`**, `border 1px rgba(255,255,255,.08)`, `0 16px 40px -12px rgba(0,0,0,.7)`. Active icon sits in a `40px` circle `rgba(94,234,212,.16)`, stroke `#5EEAD4`; inactive stroke `#646E6A`, width `1.8`.
- **Status bar time:** Inter 600 · 14 · `#F2F5F4` (mockup only — RN uses the real status bar).
- **Section eyebrow:** `11px · letter-spacing 1.8 · uppercase · weight 600 · #646E6A`.
- **Hero scan card:** `radius 24 · padding 22 · background linear-gradient(150deg, #0F766E, #0A2E2A) · border 1px rgba(94,234,212,.25)`, with a blurred `rgba(94,234,212,.25)` blob top-right. Icon well `46px · radius 14 · rgba(0,0,0,.28)`.

---

## 7. Typography — EXACT (a wrong font silently kills the editorial feel)
- **Display/headline:** `Fraunces` — verify it loads with **optical sizing** (`opsz 9..144`) and the weights `400/500/600/700`. Headlines use **600** (`Fraunces_600SemiBold`) at `26–52px` with **negative letter-spacing** (`-.3` to `-1px`). The `-1px` tracking is doing real work — don't drop it.
- **Body:** `Inter` 400/500/600/700. Body copy `13.5–15px`, line-height `1.4–1.5`, color `#C4CBC7` (`textBody`).
- If headlines look generic, Fraunces fell back to system serif — check the font actually registered before blaming layout.

---

## 8. Motion — EXACT keyframes (port to Reanimated, same timings)
| Token | Reference keyframe | Use |
|---|---|---|
| Glowi ease | `cubic-bezier(.22,1,.36,1)` | every entrance/settle (already `motion.easing`) |
| `g-ringdash` | dashoffset fill, **1.7s, .35s delay** | score ring |
| `gscore-count` | 0→target integer, same 1.7s | score number |
| `g-aurora` | `translate(0,0)→(6%,4%) scale 1.12`, **18s** loop | aurora blobs |
| `g-beam` | `top 4%→92%`, fade in 12% / out 88%, **2.6s** | scan beam sweep |
| `g-pulse` | opacity `.35↔1`, **1.6s** | live dots, reveal glow |
| `g-pop` | `translateY(8px) scale(.94) → 0/1`, **.5s** staggered | scan callouts |
| `g-meshpulse` | opacity `.22↔.5`, **3.4s** | face mesh |
| `g-blip` | `scale .4→1.8, opacity .9→0`, **3s** | onboarding orb rings |
| `g-typing` | 3 dots, `translateY(-3px)` 30% phase | Coach typing |
| `g-sheen` | `translateX(-120%→220%)`, **4s** | button sheen |
| Stagger | **70ms** between siblings | list/card entrances (`motion.stagger`) |

---

## 9. How to use this file (paste into the Claude Code prompt)

> Before building any component, open `COMPONENT_FIDELITY.md` and **transcribe the exact values**
> for that component — fills, borders, radii, gradient stops, shadow offsets, font sizes, and the
> animation timings. Do not approximate or re-derive them. For each of the five effects in §0
> (backdrop blur, inner-highlight, glow shadow, gradient text, aurora blur), use the specified RN
> technique — a flat `rgba()` fill is NOT an acceptable substitute for any of them.
>
> Build §0 + the GlassCard/GlowButton/ProgressRing primitives FIRST. Then run the app, screenshot
> each primitive in the simulator, put it next to the matching frame in
> `references/Glowi Redesign.dc.html`, and iterate until they match before building any screen.

**The single highest-leverage habit:** after each phase, screenshot the simulator and paste it
back to Claude Code beside the reference image with "match this." A blind agent can't see that the
glass went flat; a screenshot makes it self-correct in one round.
