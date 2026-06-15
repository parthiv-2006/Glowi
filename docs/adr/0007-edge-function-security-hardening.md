# ADR 0007: Edge-Function Security Hardening

- Status: Accepted
- Date: 2026-06-15

## Context

A full security review of the backend (edge functions, RLS, storage, AI seam)
confirmed the core invariants hold — the Anthropic key stays in edge-function
secrets, every user table has RLS, the image bucket is private and per-user — but
surfaced a set of boundary and abuse-resistance gaps worth closing before a wider
launch. The findings clustered around four themes: abuse of the one pre-auth
endpoint, untrusted input reaching AI prompts and an upstream URL, error/output
hygiene, and data minimization.

## Decision

Implement the fixes at the layer that owns each boundary, preferring the smallest
change that closes the gap:

1. **Rate limiting (`auth-signup`).** `auth-signup` runs with `verify_jwt` off and
   is reachable with only the public anon key, making it the natural target for mass
   account creation. Edge functions are stateless, so the limiter lives in Postgres:
   a `check_rate_limit(p_bucket, p_max, p_window_seconds)` `SECURITY DEFINER`
   function over an RLS-locked `rate_limit_events` table (migration `0007`). The
   function owns its rows, `EXECUTE` is granted only to `service_role`, and the
   function counts recent hits per caller IP (10/hour) and fails **open** on its own
   error so an infra hiccup can't lock users out.

2. **Untrusted input at boundaries.**
   - `analyze-skin` wraps the user-supplied `scan.area`/`scan.notes` in
     `<area>`/`<notes>` delimiters, caps their length, and adds a system rule that
     tagged content is data — closing a prompt-injection path.
   - `skin-forecast` validates `latitude`/`longitude` as finite numbers in real
     coordinate ranges before building the Open-Meteo URL.
   - `analyze-skin` and `identify-product` validate image **magic bytes**
     (`_shared/images.ts`) rather than trusting a client content type, rejecting
     non-images and pinning the `media_type` forwarded to the vision API.

3. **Error and output hygiene.**
   - `auth-signup` no longer returns raw admin-API error messages; failures surface
     as generic copy and the real error is logged server-side.
   - `_shared/anthropic.ts` no longer folds the upstream response body into the
     thrown error (it can echo request content); the body is logged server-side and a
     generic `Anthropic API error (status)` is thrown.

4. **CORS allowlist.** `_shared/http.ts` replaces the static `Access-Control-Allow-Origin: *`
   with an optional `GLOWI_ALLOWED_ORIGINS` allowlist; `serve()` resolves the origin
   per request and stamps CORS (with `Vary: Origin`) onto every response. With no
   allowlist set it still returns `*`, so native clients — which ignore CORS — are
   unaffected.

5. **Data minimization.** `analyze-skin` stops persisting the unvalidated
   `raw_model_output`; the column is dropped (migration `0008`). Every field the app
   uses is already extracted into typed, bounds-checked columns.

## Consequences

**Advantages**

- The one anonymously-reachable endpoint is abuse-resistant without a third-party
  rate-limiter or dashboard dependency; the limiter is reusable for any future
  pre-auth path via a new bucket prefix.
- User free-text and coordinates can no longer steer an AI prompt or an upstream URL.
- Clients receive only generic error copy; internals and upstream bodies stay in logs.
- CORS can be tightened to specific browser origins per environment with one secret.

**Tradeoffs / Notes**

- `rate_limit_events` trips the `rls_enabled_no_policy` linter (INFO). This is
  **intentional** — deny-by-default with the `SECURITY DEFINER` function as the only
  writer. Do not add a policy.
- The limiter keys on `x-forwarded-for`; shared NATs share a bucket. The 10/hour cap
  is generous enough that this is acceptable for now.
- Guest credentials are still returned in plaintext by design — see
  [ADR-0002](0002-prefilled-auth-signup-function.md) for the rationale and mitigations.

## Deployment status

Applied to project `rfuuznnbctfyqttslrbv` on 2026-06-15: migrations `0007`/`0008`
applied; all six edge functions redeployed (they share `_shared/*`). `verify_jwt`
unchanged per function (`auth-signup` off, all others on). Guest signup smoke-tested
end-to-end (HTTP 200) and the limiter confirmed recording hits.

## Out of scope (pre-existing, tracked separately)

- `handle_new_user()` is an `anon`/`authenticated`-executable `SECURITY DEFINER`
  function (advisor warning) — a pre-existing trigger function also exposed via RPC.
- Supabase Auth "leaked password protection" is disabled (dashboard toggle).
