# Screens

Each screen below was designed in `references/Glowi Redesign.dc.html`. Map each to its file in `src/app/`. Recreate faithfully; apply `DESIGN_PRINCIPLES.md` for anything unspecified. States noted as **empty** (first-run/guest/no-data) and **populated**.

---

## Onboarding — `src/app/onboarding.tsx`
**Welcome step (fixed).** The old screen had a large dead gap between the subtitle and the button. Replace it with momentum:
- Progress pips (active = wide jade), Fraunces title "Hi {name}." (name in italic jade), `textBody` subtitle.
- A **living mascot** (`GlowiAvatar idle`, ~96px) inside a soft rounded panel with two expanding ping rings behind it.
- A **three-beat promise** list (icon tile + line): "Scan your skin in seconds" / "A coach that remembers you" / "Watch your progress over time."
- Primary `GlowButton` "Let's go" pinned bottom, with a slow diagonal sheen sweep.

**Skin-type step.** Option cards with real selection hierarchy: the selected card is **Glow** tier (jade gradient fill, jade border, glow shadow, title in `accentBright`, filled check); the rest are **Raised** with an empty ring. Continue button pinned bottom over a fade.

## Home / Dashboard — `src/app/(tabs)/index.tsx`
**Populated:** overline greeting + Fraunces name + user avatar (top-right). Condensed Skin-Weather **Glow** strip (icon + condition + one-line guidance + chevron). A **latest-scan strip**: score ring (filled, count-up) beside a Fraunces summary + two color-dotted concern lines. A **2-up quick-action grid** (Coach / Routine / Progress / Learn), Raised tiles with jade icon + label. Floating glass tab bar (Home active).
**Empty (first run):** full Skin-Weather Glow card (headline + 3 stat columns UV/Humidity/Air with tone dots), full-bleed **scan hero** (jade gradient panel, scan icon tile, Fraunces "Start a skin scan", arrow), and an inviting "No scans yet" card (mascot + promise). Never a bare list.

## Scan — capture → analyze → reveal — `src/app/scan/*`, `src/components/scan/ScanTheater.tsx`
**Capture (`scan/index.tsx`):** close (X) + "New scan" overline; Fraunces "Let's look at your skin" + `textBody` sub. A 4:5 dashed-jade frame with a scan-icon tile and a two-button pair (**Take photo** = jade, **Upload** = ghost). A Sunken tip card. "Area (optional)" chips (selected = jade). Primary "Analyze my skin" pinned bottom (disabled until a photo exists).
**Analyzing (`scan/analyzing.tsx` + `ScanTheater`):** the signature moment. Over the photo: triangulated face mesh (jade lines, pulsing nodes), corner reticles, a sweeping beam, and **detected-zone callout pills** that pop in over the relevant nodes (`Congestion · 52`, `Breakouts · 38` = warning; `Hydration · good` = success). Header = pulsing dot + "Glowi analysis". Footer = progress bar + a `scanning` mascot beside the live stage text ("Cross-referencing patterns…") + "N zones mapped · analyzed only for your results".
**Reveal (`results/[scanId].tsx` hero):** `celebrating` mascot above a large score **ring that fills while the number counts up to the score**, a "Combination skin" chip, a Fraunces verdict one-liner (key phrase in jade), a 3-up stat row (concerns / +Δ vs last / confidence), and a primary "See what we found" button.

## Results list — `src/app/results/[scanId].tsx`
Compact hero (small filled ring + chip + short Fraunces summary) so the fold shows findings. "What we found" (Fraunces) then **concern cards** (see recipe): severity meter on top, title, `severity · NN` + `confidence` badges, 2-line observation in `textBody`, "View details ›". CTAs: "Build my routine" (primary) + "Ask the coach" (ghost). Disclaimer in `textTertiary`.

## Concern detail — `src/app/concern/[scanId]/[slug].tsx`
Header: category icon tile (tinted to severity) + Fraunces concern name + short description, with a small severity ring (count-up). **Tabbed** segmented control in a Sunken track: **Products / Nutrition / Tips** (active = jade gradient). Products tab = **product cards** (brand-tinted avatar, name, category chip + price, italic "why" line).

## Coach — `src/app/(tabs)/chat.tsx`, `src/app/chat/[sessionId].tsx`
**Empty:** Fraunces "Coach" + sub, primary "New conversation", a "What Glowi remembers" Raised row, then an inviting empty block: a pinging **mascot** + Fraunces "Ask me anything" + two tappable starter prompts.
**Populated thread:** header = back + small `GlowiAvatar idle` + "Glowi Coach" + a green "Knows your last scan" status. Bubbles per recipe (user jade right; coach glass left, mascot beside). **Suggestion chips** under coach replies. **Typing** = small mascot + three staggered jade dots. Input = Sunken pill with a jade circular send button.

## Progress — `src/app/(tabs)/progress.tsx`
**Populated:** overline "Your journey" + Fraunces "Progress". A **trend card** (8-week skin-score line chart with jade-green area fill + a pulsing end node + "▲ +12"). A 2-up: **streak** (Glow-ish jade card, big Fraunces number + "day streak 🔥") and **scans logged**. A "Concerns trending down" card with per-concern bars (`52 → 38`) filling in `success → accentBright`.
**Empty:** mascot + "Complete your first scan to start tracking" + a "Run your first scan" button. (Point users to the populated experience.)

## Learn — `src/app/(tabs)/learn.tsx`, `src/app/article/[slug].tsx`
Editorial feed: Fraunces "Learn" + sub, a Sunken **search** field, category chips (active = jade). A **featured** card (gradient cover with a category overline + read-time pill, Fraunces headline, `textBody` dek). Then compact **list rows** (64px gradient thumbnail with category tag + Fraunces title + "N min read · Category"). Category color = the named `gradients`. Floating tab bar (Learn active).

## Profile — `src/app/(tabs)/profile.tsx`
Avatar (initial or user) + Fraunces name + account line. **Guest upgrade** = a **Glow** card ("Save your progress" + primary "Create account"). "Glowi's memory" Raised row. **AI engine** card with a Sunken segmented control (Demo / Live AI). **Routine reminders** card with a glowing on-toggle. Floating tab bar (Profile active).

## Brand surfaces — splash + app icon
**Splash:** centered `GlowiAvatar idle` (~132px) over a breathing aurora, the Fraunces "Glowi" wordmark (the *i*'s dot is a jade glow), tagline "Skincare, tuned to you.", and a thin shimmer loading bar. **App icon:** the mascot on a deep-jade radial tile, rounded `28`+. See `MASCOT_AND_LOGO.md`.
