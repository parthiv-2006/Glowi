# Performance audit (E6)

**Run:** 2026-07-14 · **Scope:** what can be measured without a device.

The on-device half of E6 — frame cost of the aurora/Skia effects, real cold-start
timings, scroll jank on a mid-tier Android — is **not done and cannot be done yet**:
`expo-network` and `@sentry/react-native` are native modules added since the last EAS
build, so no current build exists to profile. That work is queued behind the next build.

What follows is what could be established from the source and the bundle, honestly
labelled: two things fixed, one thing measured, one real problem found and *not* fixed
because fixing it properly is a product decision, not a mechanical edit.

---

## Fixed

**An unused font face was blocking the splash screen.** `useFonts` in `_layout.tsx`
loaded ten faces, and the app holds the splash until every one of them resolves. One of
them — `SpaceMono_700Bold` — had no consumer anywhere in the codebase: `fonts.monoBold`
was declared in the theme and never read. Removed from both. Nine faces now, and the
tenth font file is no longer fetched, parsed, and waited on at every cold start for the
benefit of nothing.

The general rule this leaves behind: **every family in that `useFonts` call is on the
critical path to first paint.** Adding one is a cold-start cost; adding one nobody uses
is a cold-start cost with no upside.

## Measured

**Android JS bundle: 8.6 MB** of Hermes bytecode (`npx expo export --platform android`,
production minified). For a React Native app of this surface — 30-odd routes, Skia,
Reanimated, Supabase, Sentry — that is unremarkable and not currently worth attacking.
It is recorded here as the baseline: if a future dependency moves this materially, it
should be justified rather than absorbed.

## Not an issue (checked, no action)

**Remote-image caching.** The obvious `expo-image` win — `cachePolicy="memory-disk"` on
product and scan imagery — turns out not to apply. Product cards carry no images at all,
and the two remote-image surfaces (`BeforeAfterSlider`, `shelf/[id]`) load **signed
Supabase URLs that expire hourly**. A fresh signature is a fresh cache key, so a disk
cache would miss on every open while filling with garbage. Leaving it alone is correct;
the fix would be to make the URL stable (a public CDN path or a longer-lived signature),
which is a storage-security decision and not worth trading privacy for.

---

## Found, and deliberately left for a plan

**Every list route fetches the user's entire history and mounts all of it.** This is the
one real performance problem in the app, and it is structural.

`Screen` is a `ScrollView`, and these routes render their data with `.map()` inside it —
so every row is mounted at once, with no windowing:

| Route | List | Grows with |
|---|---|---|
| `(tabs)/chat.tsx` | chat sessions | every conversation ever started |
| `memory.tsx` | AI memories | every chat session (extraction writes more) |
| `reactions/index.tsx` | reaction logs | every logged reaction |
| `(tabs)/progress.tsx` | scan history | every scan |
| `report/index.tsx` | weekly reports | one per week, forever |
| `shelf/index.tsx` | shelf items | user's inventory (bounded in practice) |

And the queries behind them have **no `.limit()`** (`getScans`, `getSessions`,
`getMemories`, `getReactionLogs` in `lib/api.ts`), so the cost is paid twice: the client
downloads every row the user has ever created, then mounts a card for each one. A
committed user two years in opens the Coach tab and waits while several hundred sessions
are fetched, parsed, and rendered. `chat/[sessionId]` is the only list in the app that
uses a `FlatList`.

Today this is invisible — a new account has a handful of rows — which is exactly why it
is worth writing down before it is a support ticket.

**Why it isn't fixed in this batch.** The fix is not "swap `.map()` for `FlatList`". It
is a pagination design: what the page size is, whether old sessions are reachable at all
or simply archived, whether memories page or summarise, what the empty and end-of-list
states say. Those are product answers, and each route's scroll container has to be
restructured (header content becomes `ListHeaderComponent`) — six screens of layout
change that I cannot verify without a build to run them on. Doing it blind, unmeasured,
against no product decision, is precisely the speculative optimisation CLAUDE.md rules
out.

**Recommendation:** a small plan-first task after the next EAS build — cap the four
unbounded queries with an explicit `.limit()` (which alone removes the cliff, since you
cannot mount what you did not fetch), then virtualise `chat`, `memory`, and `reactions`,
with before/after frame numbers from a real mid-tier device. Sequence it with the
deferred on-device profiling above; they need the same build and the same afternoon.
