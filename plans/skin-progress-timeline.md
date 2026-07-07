# Skin Progress Timeline — Construction Plan

**Objective:** Add a weekly scan habit loop to Glowi: a before/after image comparison, per-concern trend sparklines, an AI-generated change summary, and a weekly push notification nudge — all wired into the existing Progress tab.

**Why:** The scan + AI pipeline already exists. The retention loop does not. Users scan once, get advice, and have no intrinsic reason to return. This feature closes that loop.

**Trust constraint:** The AI comparison prompt must be calibrated to be honest rather than falsely optimistic. Overclaiming improvement is a trust-breaker.

**Architectural invariant:** The AI seam is sacred. Every new AI capability gets a method on `AIProvider` with parity between `live.ts` (edge function) and `mock.ts` (synthesized, offline, zero-token).

---

## Dependency Graph

```
PR1 (schema) → PR2 (edge fn) → PR3 (AI seam) → PR4 (components) → PR5 (progress screen)
                                                ↗ (parallel: PR4 notification work)
```

PRs 4 and 5 are serial after PR3. The weekly notification work in PR4 is independent of PRs 1–3 but is bundled with the component PR for logical grouping.

---

## PR 1 — `feat/scan-comparisons-schema`

### Context brief (cold-start)

Glowi is an Expo/React Native app backed by Supabase. Schema lives in `supabase/migrations/` (append-only numbered files). The last migration is `0010_ingredient_conflicts.sql`. RLS is enforced on every user-owned table — see `0002_rls_policies.sql` for the pattern. The `scans` table (defined in `0001_core_tables.sql`) is the FK target for the new table.

### Task list

1. Create `supabase/migrations/0011_scan_comparisons.sql`:
   ```sql
   create table public.scan_comparisons (
     id uuid primary key default gen_random_uuid(),
     user_id uuid not null references auth.users(id) on delete cascade,
     scan_id_before uuid not null references public.scans(id) on delete cascade,
     scan_id_after  uuid not null references public.scans(id) on delete cascade,
     -- Validated AIDelta JSON from the compare-scans edge function.
     -- Shape: { headline, changes: [{slug, display_name, direction, delta, observation}], overall_narrative }
     ai_delta jsonb not null default '{}',
     created_at timestamptz not null default now(),
     unique (user_id, scan_id_before, scan_id_after)
   );

   create index scan_comparisons_user_after_idx
     on public.scan_comparisons (user_id, scan_id_after desc);

   -- RLS: owners only. Single for-all policy matches the project convention
   -- (see 0002_rls_policies.sql — every user-owned table uses this shape).
   alter table public.scan_comparisons enable row level security;

   create policy "scan_comparisons_crud_own" on public.scan_comparisons
     for all to authenticated
     using (user_id = auth.uid()) with check (user_id = auth.uid());
   ```

2. The service role (used by edge functions) bypasses RLS — no extra policy needed for the edge function to write.

### Verification

```bash
# In Supabase Studio or via CLI:
supabase db diff --local   # should show the new table and policies
# Or apply to local:
supabase db reset
```

### Exit criteria

- Migration file exists and is syntactically valid SQL.
- Table, index, and two RLS policies are present.
- `supabase db reset` (local) applies cleanly with no errors.

### Rollback

Delete the migration file and run `supabase db reset`. The table has no dependents yet.

---

## PR 2 — `feat/compare-scans-fn`

### Context brief (cold-start)

Glowi's AI work lives in Deno edge functions under `supabase/functions/`. The `analyze-skin` function (at `supabase/functions/analyze-skin/index.ts`) is the canonical pattern: `requireUser` → validate input → download private image from `scan-images` bucket → call Claude vision → validate output → persist to DB. Shared helpers: `_shared/http.ts` (serve, json, HttpError), `_shared/supabase.ts` (serviceClient, requireUser), `_shared/anthropic.ts` (callClaude, extractJson, MODELS). Images live at `{user_id}/{scan_id}.jpg` in the `scan-images` bucket.

The `scan_comparisons` table was added in PR 1 — cache check goes there first (idempotent per pair).

### Task list

1. Create `supabase/functions/compare-scans/index.ts`:

   **Input:** `{ scanIdBefore: string, scanIdAfter: string }`

   **Algorithm:**
   - `requireUser(req)` — get user
   - Validate both IDs are present
   - Check `scan_comparisons` for existing row with `(user_id, scan_id_before, scan_id_after)` — if found, return cached `ai_delta` immediately
   - Fetch both scan rows from `scans` (verify `user_id` matches, `status = 'complete'`, `image_path` non-null for both)
   - Download both images from `scan-images` bucket using service client; sniff media type via `sniffImageMediaType`
   - Build base64 for each image
   - Fetch `concerns` catalog to get display names
   - Call Claude with a two-image message + structured system prompt (see below)
   - Validate + sanitize the returned `AIDelta` shape
   - Insert into `scan_comparisons`; return the delta

   **System prompt (calibrated for honesty):**
   ```
   You are Glowi's skin-change analysis engine. You are shown two photos of the same person's skin taken at different times — BEFORE (first image) and AFTER (second image).

   Return STRICT JSON only — no prose, no markdown fences.

   Rules:
   - Be rigorously honest. If you cannot see a meaningful difference, say so.
   - Do not assume improvement. Changes can be positive, negative, or neutral.
   - Only report changes you can visually substantiate. Confidence beats completeness.
   - Lighting, angle, and camera differences can mimic skin changes. Flag uncertainty when present.

   Return this exact shape:
   {
     "headline": "<1 sentence: the single most meaningful change, or 'No significant change detected'>",
     "overall_narrative": "<2-3 sentences summarising visible changes honestly>",
     "changes": [
       {
         "slug": "<concern_slug from the allowed list, or null if general>",
         "display_name": "<human-readable concern name>",
         "direction": <"improved" | "worsened" | "unchanged">,
         "magnitude": <0-100, where 0 = imperceptible, 100 = dramatic>,
         "observation": "<1 sentence: what you actually see that supports this>"
       }
     ],
     "caveat": "<null, or a sentence noting significant photo-quality differences that limit confidence>"
   }

   Report 1-5 changes. Most significant first.
   Allowed concern slugs: ${slugList}
   ```

   **Validation:** direction must be one of the three allowed values; magnitude clamped 0–100; slug must be in taxonomy or null; all strings length-capped.

   **Output:** `json({ delta: validatedDelta })`

### Verification

```bash
supabase functions serve compare-scans --env-file supabase/.env.local
# POST with two scan IDs from a seeded local DB and verify the JSON shape.
```

### Exit criteria

- Cache hit path returns immediately without calling Claude.
- Cache miss path calls Claude, persists to `scan_comparisons`, returns delta.
- Invalid inputs (missing IDs, wrong user, non-complete scans) return 4xx with descriptive messages.
- No `ANTHROPIC_API_KEY` or secrets in the function source — uses the `anthropic` client from `_shared/anthropic.ts`.

### Rollback

Delete `supabase/functions/compare-scans/`. The DB table from PR 1 remains but is empty and harmless.

---

## PR 3 — `feat/ai-seam-compare-scans`

### Context brief (cold-start)

Glowi's mobile app (Expo, strict TypeScript) talks to AI exclusively through the `AIProvider` interface defined in `mobile/src/lib/ai/types.ts`. Adding a new capability means: (1) new domain types in `mobile/src/lib/types.ts`, (2) new input/output types + method signature in `ai/types.ts`, (3) implementation in `ai/live.ts` (invoke the edge function), (4) mock implementation in `ai/mock.ts` (synthesized data, offline, zero tokens), (5) a react-query hook in `lib/hooks.ts`, (6) a query key entry in `lib/query.ts`. The `compare-scans` edge function is deployed from PR 2.

### Task list

1. **`mobile/src/lib/types.ts`** — add after `ConflictReport`:
   ```ts
   export type ChangeDirection = 'improved' | 'worsened' | 'unchanged';

   export interface ConcernChange {
     slug: string | null;
     display_name: string;
     direction: ChangeDirection;
     magnitude: number;
     observation: string;
   }

   export interface AIDelta {
     headline: string;
     overall_narrative: string;
     changes: ConcernChange[];
     caveat: string | null;
   }

   export interface ScanComparison {
     id: string;
     scan_id_before: string;
     scan_id_after: string;
     ai_delta: AIDelta;
     created_at: string;
   }
   ```

2. **`mobile/src/lib/ai/types.ts`** — add input type + method to `AIProvider`:
   ```ts
   export interface CompareScanInput {
     scanIdBefore: string;
     scanIdAfter: string;
   }
   ```
   Add to `AIProvider`:
   ```ts
   compareScans(input: CompareScanInput): Promise<AIDelta>;
   ```

3. **`mobile/src/lib/ai/live.ts`** — add:
   ```ts
   async compareScans({ scanIdBefore, scanIdAfter }: CompareScanInput): Promise<AIDelta> {
     const result = await invoke<{ delta: AIDelta }>('compare-scans', { scanIdBefore, scanIdAfter });
     return result.delta;
   },
   ```

4. **`mobile/src/lib/ai/mock.ts`** — add `compareScans` that returns a plausible synthesized delta. Rotate through 3 scenarios (improvement, plateau, minor worsening) keyed by hash of the two scan IDs so the same pair always returns the same mock. No network call.
   Example scenarios:
   - Improved: headline "Redness visibly reduced since your last scan", direction "improved" for redness concern, magnitude 35
   - Plateau: headline "No significant change detected this week", direction "unchanged", magnitude 5
   - Worsened: headline "Mild increase in congestion around the nose", direction "worsened", magnitude 20

5. **`mobile/src/lib/query.ts`** — add:
   ```ts
   comparison: (beforeId: string, afterId: string) =>
     ['scan-comparison', beforeId, afterId] as const,
   ```

6. **`mobile/src/lib/hooks.ts`** — add:
   ```ts
   export function useScanComparison(scanIdBefore: string | null, scanIdAfter: string | null) {
     return useQuery({
       queryKey: qk.comparison(scanIdBefore ?? '', scanIdAfter ?? ''),
       queryFn: () =>
         getAIProvider().compareScans({ scanIdBefore: scanIdBefore!, scanIdAfter: scanIdAfter! }),
       enabled: !!scanIdBefore && !!scanIdAfter,
       staleTime: Infinity, // AI result is cached server-side; won't change
     });
   }
   ```

### Verification

```bash
cd mobile
npm run typecheck   # must pass with zero errors
npm run lint
npm test
```

### Exit criteria

- `npm run typecheck` is green with zero errors.
- Mock `compareScans` is deterministic for the same inputs.
- `staleTime: Infinity` is set on the hook (server already caches; no reason to re-call).

### Rollback

Revert the four file changes. No DB or edge function impact.

---

## PR 4 — `feat/before-after-components`

### Context brief (cold-start)

Glowi uses a "clinical luxe" design system. UI primitives live in `mobile/src/components/ui/`. Feature components live in `mobile/src/components/`. The design system enforces GlassCard, palette tokens from `mobile/src/theme/index.ts`, and `spacing()` for all margins/gaps. Expo SDK v56 — read the docs at https://docs.expo.dev/versions/v56.0.0/. `react-native-reanimated` is available for animation. Push notifications are handled in `mobile/src/lib/notifications.ts` (existing file). Scan images are private; to render them in a `<Image>` the app must get a signed URL from Supabase Storage.

The `AIDelta` and `ScanComparison` types are available from PR 3.

### Task list

1. **`mobile/src/components/BeforeAfterSlider.tsx`**

   A side-by-side split-view component:
   - Props: `{ beforeUri: string; afterUri: string; beforeLabel: string; afterLabel: string }`
   - Render two `<Image>` views clipped to left/right halves of a fixed-height (260) container
   - Draggable vertical divider line (react-native-reanimated `useSharedValue` + `PanResponder` or `Gesture`) at 50% initial position
   - Label overlays ("Before" / "After") with `AppText variant="overline"` on each half
   - GlassCard wrapper
   - If either URI is null/loading, render a Skeleton at the same height

2. **`mobile/src/components/ConcernTrendSparkline.tsx`**

   Mini horizontal bar-per-scan for a single concern:
   - Props: `{ name: string; values: { date: string; severity: number }[] }` (up to 8 entries)
   - Render concern name left, then a row of small color-coded bars (height 24, width proportional to severity/100, color from `scoreColor()`)
   - Direction arrow at the right end (`Ionicons trending-up/trending-down/remove`)
   - No deps beyond existing design tokens

3. **`mobile/src/lib/notifications.ts`** — two changes:

   a. **Fix `scheduleRoutineReminders`**: The current implementation calls `cancelAllScheduledNotificationsAsync()`, which would wipe any weekly scan notification. Replace with identifier-based cancellation:
   - Schedule the AM notification with `identifier: 'glowi-routine-am'` and PM with `identifier: 'glowi-routine-pm'`.
   - Replace `cancelAllScheduledNotificationsAsync()` with:
     ```ts
     await Notifications.cancelScheduledNotificationAsync('glowi-routine-am').catch(() => {});
     await Notifications.cancelScheduledNotificationAsync('glowi-routine-pm').catch(() => {});
     ```
   - `cancelRoutineReminders` gets the same treatment (cancel by identifier, not all).

   b. **Add `scheduleWeeklyScanReminder()`**:
   - Cancel any existing weekly scan notification: `cancelScheduledNotificationAsync('glowi-weekly-scan').catch(() => {})`
   - Schedule with `identifier: 'glowi-weekly-scan'`, trigger `{ type: SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 7 * 24 * 60 * 60, repeats: true }`, title "Time for your weekly skin scan 📸", body "Track your progress — it only takes 30 seconds."
   - Gate behind `requestNotificationPermission()` — only schedule if permission is granted.
   - Call this from `mobile/src/app/scan/analyzing.tsx` after a successful scan.

4. **`mobile/src/lib/supabase.ts` or a new utility** — add `getSignedScanImageUrl(imagePath: string): Promise<string | null>`:
   - Calls `supabase.storage.from('scan-images').createSignedUrl(imagePath, 3600)`
   - Returns the signed URL or null on error
   - Keep it simple — no caching needed (component handles re-fetch on mount)

5. Update `mobile/src/components/ui/index.ts` to export `BeforeAfterSlider` and `ConcernTrendSparkline` if they belong in the design system barrel, or leave them as named imports from their files if they're too feature-specific. Prefer named imports since they're feature-specific.

### Verification

```bash
cd mobile
npm run typecheck
npm run lint
# Visual: run the kitchensink or a storybook-equivalent; or test in the app dev build
```

Check that:
- `BeforeAfterSlider` renders two images with a draggable divider
- `ConcernTrendSparkline` renders bars for an array of `{date, severity}` values
- `scheduleWeeklyScanReminder` does not throw when permissions are denied

### Exit criteria

- `npm run typecheck` green.
- Both components accept typed props with no `any`.
- Weekly notification is scheduled only when permission is granted.
- Signed URL helper returns `null` gracefully on storage error.

### Rollback

Delete the two new component files and revert `notifications.ts` and `supabase.ts` changes.

---

## PR 5 — `feat/progress-timeline-ui`

### Context brief (cold-start)

`mobile/src/app/(tabs)/progress.tsx` already renders: a score trend chart (`ScoreTrend`), streak + scan-count stats, a "concerns trending down" list, and a full scan history. It uses `useScans()` and `useRecentCheckins()`. The existing design follows the clinical luxe system with `GlassCard`, `Stagger`, `Screen`, `AppText`, `SectionHeader`, etc. from `mobile/src/components/ui/`.

From PRs 3 and 4:
- `useScanComparison(beforeId, afterId)` returns `{ data: AIDelta, isLoading }`.
- `BeforeAfterSlider` renders two signed image URLs side-by-side.
- `ConcernTrendSparkline` renders per-concern severity history.
- `getSignedScanImageUrl(imagePath)` returns a signed URL for a private scan image.
- `scheduleWeeklyScanReminder()` is in `notifications.ts`.

### Task list

1. **`mobile/src/app/(tabs)/progress.tsx`** — add three new sections inside the existing `Stagger` (after the score chart):

   **A. Before/After comparison** (only when `completedScans.length >= 2`):
   - Use `useScanComparison(oldest.id, latest.id)` — always compare the chronologically-first scan to the most recent (gives maximum visible change over the user's history; a "week-over-week" variant can be a future iteration)
   - While loading: `Skeleton` at height 300
   - When loaded: render `BeforeAfterSlider` with signed URLs for both scan images; below it render the `ai_delta.headline` in `AppText variant="subheading"` and `ai_delta.overall_narrative` in `AppText variant="body"`.
   - Below the narrative, if `ai_delta.changes.length > 0`, list each change with a color-coded `direction` badge (green improved / red worsened / gray unchanged) + `observation` text
   - Section header: "Before & After"

   **B. Per-concern trend** (only when `completedScans.length >= 2`):
   - Derive: for each unique `concern_slug` seen across all `completedScans`, collect `{ date: scan.created_at, severity }` across up to 8 most-recent scans
   - Render one `ConcernTrendSparkline` per concern (max 5 concerns by peak severity)
   - Section header: "Concern trends"

   **C. Weekly scan nudge banner** (only when latest scan is > 6 days old):
   - `GlassCard` with a subtle accent border, Glowi avatar in `idle` state, "Ready for your weekly scan?" copy, and a `GlowButton` → `router.push('/scan')`
   - Dismiss is ephemeral (local `useState`) — it reappears next session until the user scans again

2. **`mobile/src/app/scan/analyzing.tsx`** — call `scheduleWeeklyScanReminder()` after successful scan completion (already the screen where the user lands post-analysis). Import from `@/lib/notifications`.

3. **Types**: Fetch signed URLs for before/after images with `useEffect` + `useState` inside the Before/After section (or a thin wrapper hook `useSignedUrl(imagePath)`). Keep it local to avoid polluting global state.

### Verification

```bash
cd mobile
npm run typecheck
npm run lint
npm test
```

Visual check (dev build or Expo Go):
- Progress tab with 0 scans: empty state unchanged ✓
- Progress tab with 1 scan: no before/after section, no trends, nudge banner appears ✓
- Progress tab with 2+ scans: all three new sections visible, AI delta loads (spinner → content) ✓
- Tapping "Ready for your weekly scan?" navigates to `/scan` ✓
- No console errors on mount or after delta loads ✓

### Exit criteria

- `npm run typecheck` + `npm run lint` + `npm test` all green.
- Weekly nudge banner only visible when `daysSinceLastScan > 6`.
- `useScanComparison` is not called when `completedScans.length < 2` (guard in render prevents the hook from being enabled).
- Mock mode (offline): AI delta loads a synthesized scenario without any network call.
- No `any` types introduced.

### Rollback

Revert `progress.tsx` and `analyzing.tsx` changes. All upstream PRs remain intact and harmless.

---

## Invariants (verified after every PR)

1. `npm run typecheck` passes with zero errors.
2. `npm run lint` passes.
3. `npm test` passes.
4. Mock mode works end-to-end with zero AI tokens.
5. No `ANTHROPIC_API_KEY` or secrets appear in mobile source code.
6. Scan images are always fetched via signed URL — never exposed as public storage.
7. `scan_comparisons` RLS permits only the owning user to read or insert.

---

## Future iterations (out of scope for this plan)

- Week-over-week comparison (most-recent pair) as an alternative to first-vs-latest.
- Photo quality scoring — warn if lighting is too different between before/after to trust the comparison.
- Export / share the before/after card as a PNG.
- Per-concern weekly email digest.
