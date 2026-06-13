# Contributing to Glowi

Thank you for contributing to Glowi, an AI-powered skincare assistant built on React Native, Supabase, and Claude.

## Prerequisites

- **Node.js 20+** (check with `node --version`)
- **npm 10+** (comes with Node)
- **Expo CLI**: `npm install --global expo-cli` or use `npx expo`
- **Supabase project** (remote, or `supabase start` locally)
  - [Create one free](https://supabase.com/dashboard)
  - In `mobile/`, copy `.env.example` to `.env` and fill in `EXPO_PUBLIC_SUPABASE_URL`
    and `EXPO_PUBLIC_SUPABASE_ANON_KEY` (the publishable key)
- **Optional: Anthropic API key** (only for live AI mode)
  - Set it as an edge-function secret: `supabase secrets set ANTHROPIC_API_KEY=sk-ant-...`
  - It lives only in edge-function secrets and never ships in the app bundle
  - Not required for mock AI mode (the default — the whole app works offline)

## Repository Layout

```
glowi/
├── mobile/                    # React Native/Expo app (SDK 56)
│   ├── src/
│   │   ├── app/              # File-based routing (expo-router)
│   │   ├── lib/
│   │   │   ├── ai/           # AIProvider seam (live.ts, mock.ts)
│   │   │   ├── supabase.ts    # Supabase client
│   │   │   ├── types.ts       # Shared TypeScript interfaces
│   │   │   └── ...
│   │   ├── stores/           # Zustand stores (auth, settings)
│   │   ├── components/       # React Native components
│   │   └── theme/            # Design tokens and colors
│   ├── package.json
│   ├── tsconfig.json
│   └── app.json              # Expo config
│
├── supabase/
│   ├── migrations/           # SQL migrations (source of truth)
│   │   ├── 0001_core_tables.sql
│   │   ├── 0002_rls_policies.sql
│   │   ├── 0003_storage_and_triggers.sql
│   │   └── 0004_guest_flag.sql
│   ├── seed/                 # Seed data (concerns, products, nutrition)
│   │   ├── 0001_concerns_and_tips.sql
│   │   ├── 0002_products.sql
│   │   ├── 0003_nutrition.sql
│   │   └── 0004_articles.sql
│   ├── functions/            # Edge functions (Deno TypeScript)
│   │   ├── auth-signup/      # Guest/email signup (pre-confirmed)
│   │   ├── analyze-skin/     # Claude vision analysis
│   │   ├── chat/             # Memory-aware skincare assistant
│   │   ├── extract-memories/ # Memory consolidation
│   │   └── _shared/          # Shared utilities (http, supabase, anthropic)
│   └── config.toml           # Supabase config
│
├── docs/
│   ├── adr/                  # Architecture decision records
│   │   ├── 0001-supabase-backend.md
│   │   ├── 0002-prefilled-auth-signup-function.md
│   │   └── 0003-ai-provider-seam.md
│   └── ARCHITECTURE.md        # (planned)
│
└── CONTRIBUTING.md           # This file
```

## Local Setup

### 1. Clone and install dependencies

```bash
cd mobile
npm install
```

### 2. Configure environment

```bash
cp .env.example .env.local
```

Fill in:
```
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
EXPO_PUBLIC_AI_MODE=mock          # Start in mock mode (no API key needed)
```

### 3. Start the app

```bash
npx expo start
```

Choose your platform:
- Press `i` for iOS Simulator
- Press `a` for Android Emulator
- Press `w` for web
- Press `j` for Expo Go (scan QR code on phone)

### 4. (Optional) Set up local Supabase

If working with the database or edge functions:

```bash
cd supabase
supabase start
```

This starts a local Postgres + Supabase stack. Migrations and seed run automatically. Access:
- **Dashboard**: http://localhost:54323
- **API**: http://localhost:54321
- **PostgreSQL**: localhost:5432

## AI Mode: Mock vs. Live

The app supports two AI providers, toggled in settings:

### Mock Mode (Default for Development)

**What:** On-device simulator, realistic but deterministic.

- Scans resolve to staged scenarios with improving scores
- Chat answers are keyword-routed with real product recommendations
- Memory extraction uses regex heuristics
- Zero network calls, zero API cost

**Enable:** Set `EXPO_PUBLIC_AI_MODE=mock` or toggle in Profile → AI Engine.

### Live Mode

**What:** Claude edge functions analyze scans and drive chat.

- Requires deployed Supabase functions
- Requires Anthropic API key in edge function secrets
- Real vision analysis, real LLM-generated chat

**Enable:** Set `EXPO_PUBLIC_AI_MODE=live` and ensure edge functions are deployed.

**Deploy functions:**

```bash
supabase functions deploy analyze-skin --project-id=your-project-id
supabase functions deploy chat --project-id=your-project-id
supabase functions functions deploy extract-memories --project-id=your-project-id
supabase functions deploy auth-signup --project-id=your-project-id
```

Then set the Anthropic key:

```bash
supabase secrets set ANTHROPIC_API_KEY=sk-xxx --project-id=your-project-id
```

## Database Workflow

**Migrations are the source of truth.** Never manually edit the schema in the dashboard; write migrations instead.

### Adding a column

```bash
supabase migration new add_new_column
# Edit supabase/migrations/YYYYMMDDHHMMSS_add_new_column.sql
supabase db pull         # Test locally
supabase db push         # Apply to remote (if configured)
```

### Seeding data

Seed files in `supabase/seed/` populate the catalog (concerns, products, nutrition, articles). They're idempotent and run on every local reset.

To add a product:

1. Open `supabase/seed/0002_products.sql`
2. Insert a row with `id`, `slug`, `brand`, `name`, `category`, etc.
3. Restart local Supabase: `supabase stop && supabase start`
4. Verify in the dashboard

### Row Level Security

Every user table is protected by RLS policies:

```sql
-- Users can only read/write their own rows
create policy "scans_crud_own" on public.scans
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
```

**When testing:** Ensure your tests verify RLS blocks unauthorized access. Run queries as different users to confirm isolation.

## Quality Gates

All PRs must pass:

```bash
# Ensure no TypeScript errors
npm run typecheck

# Lint for style issues
npm run lint

# Run unit tests
npm test
```

CI runs these checks automatically. Fix any failures locally before pushing.

## Commit Conventions

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
type(scope): subject

body
```

Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`

Examples:

```
feat(ai): add memory extraction to live provider
fix(auth): prevent guest duplicate signup
docs: add CONTRIBUTING guide
test(mock-provider): add scenario rotation tests
```

**Make small, logically-grouped commits.** One concern per commit:

- ✅ `feat: add scan memory extraction` + `fix: validate RLS on chat messages`
- ❌ Giant 50-file commit mixing features and refactors

## Security Notes

- **Anthropic API key**: Never commits to the repo. Use edge function secrets only.
- **RLS is the boundary**: All user tables are protected by Postgres policies. Verify your changes don't bypass them.
- **Secrets in code**: If you accidentally commit a key, rotate it immediately and rewrite history.
- **Storage access**: Scan images are private; only the owner's edge function can download them.

## Debugging

### Edge functions not responding?

```bash
# Check local function logs
supabase functions serve

# Or, for remote:
supabase functions download analyze-skin --project-id=your-project-id
```

### RLS blocking your queries?

Enable RLS debugging in Supabase dashboard (Settings → Debug). Query logs show which policy denied access.

### Mock AI feels unrealistic?

Edit `mobile/src/lib/ai/mock.ts`:
- Adjust `SCENARIOS` for different scan outcomes
- Tweak `CHAT_SCRIPT` regex patterns to match more user intents
- Change timing in `wait()` calls to feel faster/slower

### Tests failing?

```bash
npm test -- --verbose
```

Mock mode is deterministic; if a test fails, check for:
- Hardcoded dates (use `Date.now()` or mock `Date`)
- Non-deterministic UUID generation (use seeded random in tests)
- AsyncStorage state bleeding between tests (clear before each)

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `EXPO_PUBLIC_*` vars not loaded | Restart Expo (`Ctrl+C`, `npx expo start`) |
| Supabase SDK errors about JWT | Check that your `.env.local` has correct URL and anon key |
| RLS 403 errors | Verify you're authenticated; check policies in dashboard |
| Edge function 500s | Check `supabase functions serve` logs for errors |
| Mock provider not working | Ensure `EXPO_PUBLIC_AI_MODE=mock` is set; restart app |
| `npm test` hangs | Kill node processes; `killall node` (or Task Manager on Windows) |

## Getting Help

- **Docs**: Read ADRs in `docs/adr/` for architectural context
- **Code comments**: Functions describe their contracts at the top
- **Supabase docs**: [docs.supabase.com](https://docs.supabase.com)
- **Expo docs**: [docs.expo.dev](https://docs.expo.dev)
- **Claude API**: [platform.openai.com](https://platform.anthropic.com/docs)

---

Happy building! We're grateful for your contributions to Glowi.
