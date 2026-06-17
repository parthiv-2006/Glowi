# Glowi Design Principles

This is the **system**, not just a screen list. Follow it for every screen — including ones never mocked up. If you can internalize these ten principles plus the component recipes, you can design any new Glowi surface and it will look native.

The aesthetic in one line: **clinical luxe** — near-black depths, frosted-glass surfaces lit from above, a single jade glow accent, editorial serif headlines, and motion that explains rather than decorates.

---

## 0. Tokens (extend `src/theme/index.ts`)

The current palette is good. The redesign **adds depth + contrast tokens**. Add these; keep everything else.

```ts
// ADD to palette
textBody: '#C4CBC7',        // primary reading copy — brighter than textSecondary.
                            // Body paragraphs, card descriptions, chat text use THIS, not textSecondary.

// Surface tiers (the #1 fix — see Principle 1)
surfaceSunken:   '#0B0F0E',                 // recessed wells, inputs, empty-state interiors
surfaceRaised:   'rgba(255,255,255,0.055)', // default card fill (pair with the highlight+shadow below)
surfaceGlow:     'rgba(94,234,212,0.13)',   // hero/active cards (pair with jade border + glow shadow)
```

Existing tokens you will use constantly (do not change):
`bg #07090B` · `bgElevated #0C0F13` · `accent #2DD4BF` · `accentBright #5EEAD4` · `accentDeep #0F766E` · `accentDim rgba(45,212,191,.14)` · `text #F2F5F4` · `textSecondary #9BA6A2` · `textTertiary #646E6A` · `textOnAccent #04211C` · `success #34D399` · `warning #FBBF24` · `danger #FB7185`.

Fonts: **Fraunces** (`display`/`displayBold` = Fraunces 600/700) for emotional/editorial type; **Inter** (400/500/600/700) for UI. Spacing = 4pt scale (`spacing(n) = n*4`). Radii: `sm 10 · md 16 · lg 22 · xl 28 · full 999`. Motion: `fast 160 · base 280 · slow 460`, ease `cubic-bezier(0.22, 1, 0.36, 1)`, stagger `70ms`.

---

## 1. Depth: three surface tiers, never one flat plane
The original app's biggest tell was that **every card was the same `rgba(255,255,255,0.05)` with a hairline border** on near-black. Everything read as one plane. Fix: every surface declares a tier.

- **Sunken** — `surfaceSunken (#0B0F0E)`, border `rgba(255,255,255,.06)`. For wells: inputs, search bars, empty-state interiors, segmented-control tracks.
- **Raised (default card)** — fill = a subtle top-down gradient `linear-gradient(180deg, rgba(255,255,255,.06), rgba(255,255,255,.02))`, border `rgba(255,255,255,.09)`, **inner top highlight** `inset 0 1px 0 rgba(255,255,255,.06)`. This top highlight is what makes it feel lit from above — never skip it.
- **Glow (hero/active)** — fill `linear-gradient(180deg, rgba(94,234,212,.14), rgba(94,234,212,.03))`, border `rgba(94,234,212,.28)`, shadow `0 14px 36px -14px rgba(45,212,191,.4)` + the inner top highlight. Reserve for the one most important thing on a screen (Skin Weather, the scan CTA, the active selection, the guest upgrade card).

**Rule of thumb:** one Glow element per screen, max. Everything else is Raised or Sunken. Bake these three tiers into `GlassCard` as a `tier="sunken" | "raised" | "glow"` prop (replacing the current `emphasized`/`glow` booleans).

## 2. Contrast: kill the muddy grey
Low-contrast grey-on-black was the "cheap" tell. The hierarchy is now:
- **`text #F2F5F4`** — headings, titles, key numbers.
- **`textBody #C4CBC7`** — body copy, card descriptions, chat messages, anything you actually read. (This is the new default for `AppText variant="body"` and most `subheading` usage.)
- **`textSecondary #9BA6A2`** — genuinely secondary metadata only.
- **`textTertiary #646E6A`** — overlines, captions-of-captions, inactive icons.

If a paragraph feels washed out, it's using `textSecondary` where it should use `textBody`.

## 3. Editorial rhythm, not a tile grid
Uniform stacks of identical cards = generic dashboard. Instead:
- **One hero per screen.** A full-bleed gradient panel or a Glow card that owns the top (e.g. the scan CTA, the Skin Weather card). Everything below is calmer.
- **Vary sizes deliberately.** A big hero, then a wide strip (score + summary), then a 2-up action grid. Rhythm = big → medium → small.
- **Fraunces for emotion, Inter for function.** Screen titles, the scan verdict one-liner, article headlines, score numbers → Fraunces. Buttons, labels, metadata, body → Inter. A single Fraunces line per screen often carries the whole feeling — use it on the thing that matters.
- **Asymmetry is fine.** Avatar to one side of a greeting, a number ring beside a paragraph. Don't center everything.

## 4. Motion has a job
One ambient layer + purposeful reveals. Never decorative jitter.
- **Ambient:** exactly one slow jade aurora behind dark screens (`AuroraBackground`, ~14–18s drift). Nothing else loops ambiently except the mascot's gentle breath/float.
- **Reveal order:** stagger sibling entrances by `70ms` (`Stagger`) so the eye reads top-to-bottom: forecast → scan → results.
- **Earn numbers:** scores, severities, streaks **count up** while their ring/bar fills (`base`–`slow` duration, the Glowi ease). A printed number feels cheap; a computed one feels analyzed.
- **Touch:** spring-scale on press (`PressableScale`), soft glow on active. Tactile, never bouncy/cartoonish.
- **Easing:** always `cubic-bezier(0.22, 1, 0.36, 1)` (fast start, long settle).

## 5. Empty states are promises, not voids
Every empty/guest/first-run state must offer momentum:
- A **living element** (the mascot, a pinging orb, a breathing aurora) — never dead center-space.
- A **one-line promise** in Fraunces + a **concrete next action** (a button, or tappable starter prompts).
- Example: Coach-empty shows the mascot + two starter questions; Home no-scans shows the mascot + "your first scan unlocks…". Design the empty state with the same care as the full one.

## 6. The mascot is the brand's presence
Glowi (the jade sphere) appears wherever the app "speaks" or celebrates. Use the `GlowiAvatar` component (see `MASCOT_AND_LOGO.md`) with a `state` prop:
- `idle` — splash, onboarding, home, Coach identity, empty states.
- `thinking` — Coach is generating (pairs with typing dots).
- `scanning` — during analysis.
- `celebrating` — score reveal, streak milestones, goal completion.
Never draw a one-off mascot; always reuse the component so expression + shading stay consistent.

## 7. Color is meaning — don't invent
- **Jade (`accent`/`accentBright`)** = affordance, brand, "you can act here." Primary buttons, active tabs/chips, links, the mascot.
- **Semantic data** = `success`/`warning`/`danger` for severity, scores, trends, stock/expiry. Use the existing helpers `scoreColor`, `severityColor`, `toneColor`.
- **Category tinting** = the named `gradients` (jade/amber/rose/violet/ocean/ember/moss/slate) for article covers, product card avatars (`brandGradient(brand)`), concern icons. This is the only place rich non-jade color appears.
- Never introduce a new hue. If you need a tint, pull from `gradients` or derive in `oklch` from the jade.

## 8. Iconography
Line icons (Ionicons `*-outline`), consistent stroke ~1.8–1.9. Active = `accentBright`; inactive = `textTertiary`. Icons live in small tinted tiles (`accentDim`, radius `sm`–`md`) when they label a row/card. The bottom tab bar is a **floating glass pill** (not a full-width bar): `rgba(12,15,19,.82)` + blur, hairline border, the active tab a jade-dim circle.

## 9. Spacing, shape, density
- 4pt scale; screen horizontal padding `spacing(5)`–`spacing(6)` (20–24).
- Cards `radii.lg` (22); heroes/frames `radii.xl` (28); pills/chips/buttons `radii.full`.
- Comfortable density: generous line-height (body 1.45–1.55), real breathing room between sections (`spacing(4)`–`spacing(8)`). Don't cram.
- Touch targets ≥ 44px.

## 10. Copy voice
Warm, expert, plain-spoken — like the mascot. Short Fraunces headlines ("Let's look at your skin", "Your skin looks fundamentally healthy"). No hype, no emoji except a sparing celebratory one (🔥 streaks). Every concern/result reads as guidance, not diagnosis (the medical disclaimer stays on results surfaces).

---

## Designing a screen that was never mocked up
Follow this recipe and it will look like Glowi:

1. **Background:** `bg #07090B`. Add `AuroraBackground` only on marquee/empty screens (not data-dense lists).
2. **Header:** an `overline` (uppercase, `textTertiary`, letter-spacing 1.8) + a Fraunces **title** in `text`. Optionally the mascot or an avatar to one side.
3. **Pick the hero:** the single most important element → make it the **Glow** tier (or a full-bleed gradient panel). Everything else is Raised/Sunken.
4. **Body:** stack Raised cards with rhythm (big → medium → small). Use a 2-up grid for peer actions. Reading copy in `textBody`.
5. **Numbers:** any metric gets a ring or bar that fills + counts up, colored by its semantic helper.
6. **Motion:** wrap the section in `Stagger`; spring-scale every pressable; reveal on mount.
7. **Empty variant:** design it now — mascot + promise + action.
8. **Bottom:** floating glass tab pill if it's a tab; a glowing primary `GlowButton` pinned bottom if it's a flow step.
9. **Check the tells:** no flat single-plane cards? body copy not muddy grey? exactly one Glow element? Fraunces on the emotional line? motion has a job? If yes — it's Glowi.

---

## Component recipes (exact)

**Primary button (`GlowButton`)** — `radii.full`, fill `linear-gradient(120deg,#5EEAD4,#2DD4BF)`, label Inter 600 `#04211C`, shadow `0 12px 34px -8px rgba(45,212,191,.6)`. Ghost variant: `surface` fill + `borderStrong` border, label `accentBright`.

**Card (`GlassCard` Raised)** — see Principle 1. Padding `spacing(4)`, radius `lg`.

**Score ring** — circular track `rgba(255,255,255,.07–.08)` width 7–11; progress stroke = `scoreColor(score)`, round cap, `drop-shadow` glow; center = Fraunces 700 number (counts up) + tiny `textTertiary` label. Animate dash-offset + number together over `slow`.

**Concern card** — top **severity meter** (3–4px track, fill width = severity%, gradient `accentDeep → warning`), Fraunces/Inter-600 title, badge row (`severityLabel · NN/100` tinted by `severityColor`, plus `NN% confidence` in a neutral chip), 2-line observation in `textBody`, footer "View details ›" in `accentBright`.

**Product card** — left brand avatar tile (rounded `md`, `brandGradient(brand)`, 2-letter monogram), brand overline + Inter-600 name, category chip + price, italic one-line "why" in `textBody` above a hairline divider.

**Chip / segmented control** — chips `radii.full`; selected = jade fill + `textOnAccent`; unselected = `surface` + `border` + `textSecondary`. Segmented control sits in a **Sunken** track; active segment = jade gradient.

**Toggle (on)** — jade gradient track + white thumb + `0 0 14px rgba(94,234,212,.45)` glow.

**Chat bubbles** — user: jade gradient, `textOnAccent`, radius `18 18 4 18`, right-aligned. Coach: Raised glass, `#E6EAE8`, radius `18 18 18 4`, left-aligned, preceded by a small `GlowiAvatar`. Typing = three jade dots staggered + a `thinking` mascot.

**Tab bar** — floating glass pill (Principle 8).

**The scan (signature)** — over the captured photo / a dark face field: a triangulated **face-mapping mesh** (jade lines, pulsing nodes), corner reticles, a **sweeping beam** (jade gradient + glow), **detected zones ping** with callout pills (`name · NN`, tinted by severity), then the **reveal**: `celebrating` mascot + score ring fills while number counts up + a Fraunces verdict line. Build on the existing `ScanTheater` (Skia) + Reanimated.
