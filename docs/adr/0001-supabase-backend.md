# ADR 0001: Supabase as the Backend Platform

- Status: Accepted
- Date: 2026-06-12

## Context

Glowi needs a backend to power:

- **Authentication**: email and guest sign-in
- **Relational catalog**: products, concerns, nutrition guides, articles (read-only to clients)
- **Per-user data**: skin scans with images, chat sessions with AI memories, routines with checkins
- **Server-side AI**: Claude vision analysis and skincare chat must run on the server to keep the Anthropic API key out of the app bundle
- **Constraints**: demo-now/launch-later phase, solo developer, minimal operational burden, free tier available

## Decision

Use a single Supabase project (PostgreSQL + Supabase Auth + Storage + Edge Functions) as the complete backend:

- **Postgres** stores all catalog and user-owned data with Row Level Security (RLS) enforced at the database layer
- **Supabase Auth** handles email confirmation and JWT tokens (with email confirmation disabled in favor of edge function pre-confirmation)
- **Storage** (`scan-images` bucket) stores private scan photos, downloadable only by the owning user's edge function
- **Edge Functions** (Deno) run the AI workloads (`auth-signup`, `analyze-skin`, `chat`, `extract-memories`) with access to the Anthropic API key in secret environment variables
- **API** is accessed from the client via the Supabase JS SDK (auto-authenticated with JWT) for reads/writes scoped by RLS

The Anthropic API key lives only in edge function secrets and never ships in the app bundle.

## Consequences

**Advantages:**

- Single integrated platform: no glue code between auth, database, and serverless
- RLS enforces per-user isolation at the database layer (not in application logic)
- Edge functions are close to the database (low latency for vision analysis)
- Free tier (500MB storage, 2M requests/month) fits the demo phase; scales to production on paid tiers
- Supabase CLI and migrations as code enable local development and version control

**Tradeoffs:**

- Coupling to Postgres/Supabase: vendor lock-in if requirements change radically
- RLS is the security boundary: must be tested and audited carefully
- Edge functions are in TypeScript/Deno: less ecosystem than Node.js
- No built-in multi-region deployment; single region per project (acceptable for demo)

**Testing Requirements:**

- Verify RLS policies block unauthorized reads/writes
- Test edge functions with invalid/missing JWTs and invalid user IDs
- Verify the Anthropic key is never logged or leaked in function output

