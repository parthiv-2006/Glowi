# UI Fidelity Audit — feat/design-refactor

Goal: audit every screen against the Claude design mockups (rendered reference HTML) and fix drift.
Verification: Expo web build (localhost:8082) screenshotted with Playwright vs reference frames
captured to repo root as `ref-*.png` (gitignored).

## Reference frames captured
00 splash (skipped — animated) · 01 onboarding-welcome · 02 skin-type · home-empty · home-populated
· 05 scan-capture · 06 analyzing (skipped — animated) · 07 reveal · 08 results · 09 concern
· 10 coach-empty · 11 coach-convo · 12 progress · 13 learn · 14 profile

## Audit status (mocked screens)
- [ ] onboarding (welcome + skin-type)
- [ ] home (empty + populated)
- [ ] scan capture
- [ ] scan analyzing / reveal
- [ ] results list
- [ ] concern detail
- [ ] coach (empty + conversation)
- [ ] progress
- [ ] learn
- [ ] profile

## Unmocked screens (recipe + check-the-tells)
- [ ] (auth) welcome/sign-in/sign-up · forecast · memory · routine · shelf/* · article · upgrade

## Findings & fixes

Verified every screen on the Expo web build vs the rendered reference frames.
The clinical-luxe redesign was already implemented to high fidelity (from this same
handoff); only two screens had real drift.

### Fixed
- **Onboarding welcome** (`onboarding.tsx`): replaced placeholder dashed "viewfinder"
  circle with the living `GlowiAvatar` + two expanding ping rings (§5/§6); reordered to
  title → subtitle → mascot panel → promise list; left-aligned the headline/subtitle to
  match the reference. — committed.
- **Concern card** (`results/[scanId].tsx`): swapped the left-border severity accent for
  the recipe's top severity-meter bar (track + accentDeep→severity gradient, width =
  severity%) and moved the observation copy to `textBody`. — committed.

### Audited, on-spec (no change)
onboarding skin-type · home empty + populated · scan capture · reveal hero · concern
detail · coach empty + conversation · progress empty + single-scan · learn · profile ·
forecast · memory · routine · shelf empty · article · upgrade · welcome.
(sign-in shares the auth-family layout; redirects to home while authed as guest.)

### Data-gated, not visual drift
- Progress 8-week trend chart + "concerns trending down" needs ≥2 scans (ScoreTrend /
  ConcernTrendSparkline already built and merged in PR5).
- Reveal verdict "key phrase in jade" depends on the AI marking a phrase; the verdict is
  already Fraunces. Left as-is (would require an AI response-shape change).

### Quality gate (feat/design-refactor)
typecheck 0 · lint 0 · jest 33/33 · prettier clean.
