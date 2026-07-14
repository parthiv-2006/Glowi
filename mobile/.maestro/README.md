# E2E flows (Maestro)

Four happy paths, run against a **mock-mode dev build**. That is the whole point of
the AI seam (ADR-0003): the flows exercise the real app — real Supabase auth, real
Postgres writes, real RLS — while every Claude call is answered by the deterministic
offline twin in `src/lib/ai/mock.ts`. So the suite costs zero Anthropic tokens, and a
scan returns the same score every time instead of whatever the model felt like today.

## Status: written, not yet executed

⚠️ **These flows have never been run.** They are authored from the app's real
accessibility labels and copy, but Maestro drives a *device*, and the build that would
run them does not exist yet: `expo-network` and `@sentry/react-native` are native
modules added after the last EAS build. The first person to run these should expect to
fix selectors, and should treat that as the flows earning their keep rather than as a
defect. Do not mark E5 done until they have gone green on a real device at least once.

## Prerequisites

1. **Maestro** — `curl -Ls "https://get.maestro.mobile.dev" | bash` (macOS/Linux) or
   see https://docs.maestro.dev/getting-started/installing-maestro.
2. **A mock-mode dev build on a running emulator/simulator or device:**

   ```bash
   cd mobile
   # EXPO_PUBLIC_AI_MODE=mock must be baked into the build — it is read at bundle time.
   EXPO_PUBLIC_AI_MODE=mock npx eas build --profile development --platform android --local
   adb install <the .apk>
   ```

   Or, faster, run a dev client against a mock-mode Metro: `EXPO_PUBLIC_AI_MODE=mock npx expo start --dev-client`.

   ⚠️ Do **not** run these against a production/preview build. D1 self-heals
   `aiMode` to `live` whenever `!__DEV__`, so a release build ignores the mock flag
   entirely and every flow would spend real tokens.

## Running

```bash
cd mobile
maestro test .maestro/                      # everything
maestro test .maestro/01-guest-scan.yaml    # one flow
maestro test --format junit --output ../maestro-report.xml .maestro/
```

Each flow calls `clearState` first, so they are order-independent and each starts from
a fresh install. They create a **real guest account** per run against the live Supabase
project (guest creation is free and unauthenticated-cheap); A6's cleanup job reaps them
after 90 days of inactivity.

## The flows

| File | Covers |
|---|---|
| `01-guest-scan.yaml` | fresh install → guest → onboarding → mock scan → results |
| `02-guest-upgrade.yaml` | guest with data → upgrade to an account → **the data is still there** (B1's whole point) |
| `03-daily-checkin.yaml` | tap-to-upsert check-in → collapses to the logged summary |
| `04-chat.yaml` | coach send in mock mode → a reply comes back |

`02` is the one that matters most: it is the regression test for the P0 bug where
upgrading a guest silently abandoned every scan, chat, and shelf item they had.

## CI

`.github/workflows/e2e.yml` runs these on manual dispatch only. Device-lab E2E on every
push buys little and costs a lot of minutes; the release checklist in `docs/RELEASE.md`
is where this suite is expected to be green.
