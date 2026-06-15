# ADR 0002: Pre-Confirmed User Creation via Edge Function

- Status: Accepted
- Date: 2026-06-12

## Context

New Supabase projects ship with email confirmation enabled by default and anonymous authentication disabled. This creates friction for Glowi's onboarding:

- **Email signup** would require users to confirm their email before signing in, adding friction and reducing demo conversion
- **Guest mode** (for frictionless demos) needs unauthenticated users, which is disabled
- **Client-side workaround** doesn't exist: `supabase.auth.signUp()` respects the dashboard configuration and cannot bypass email confirmation

The Supabase dashboard configuration can drift or change without warning, creating unpredictable behavior.

## Decision

Create an `auth-signup` edge function that:

- Uses the **Supabase admin API** (not the client API) to create users with `email_confirm: true`
- Accepts `mode: 'guest' | 'email'`:
  - **Guest mode**: generates a random guest email (`guest-{UUID}@guest.glowi.app`) and a long random password, stores no email, returns the credentials
  - **Email mode**: validates the email and password, creates a pre-confirmed user
- Returns the credentials to the client, which immediately signs in with them
- Requires a valid anon API key (same as the public signup endpoint) but has `verify_jwt` disabled since it's pre-authentication

The client caches guest credentials in SecureStore so they persist across app restarts and can later upgrade to email signup.

## Consequences

**Advantages:**

- Signup works regardless of dashboard email confirmation configuration and survives config drift
- Guests get a seamless demo experience with zero friction
- Pre-confirmed users skip email blockers entirely (works for both modes)
- Credentials are validated on the server (email format, password length)
- Same admin API creates both paths; upgrade from guest to email is a separate flow

**Tradeoffs:**

- One privileged function that must be carefully scoped and monitored
- Guest credentials are high-entropy random UUIDs; deliberately not mnemonic (security over convenience)
- Password reset/confirmation email flows are deferred to a later phase
- The admin API key in the edge function is a sensitive secret; rotate on schedule

**Security Considerations:**

- The function runs without `verify_jwt`, so it's protected only by the anon API key requirement and rate-limiting. **Rate-limiting is enforced in-function**: each request is counted per caller IP via the `check_rate_limit` Postgres function (migration `0007`), capped at 10 attempts/hour, failing open if the limiter itself errors so an infra hiccup can't lock users out.
- The admin-API error message is never returned to the client — failures surface as generic copy and the real error is logged server-side — so account enumeration and internals don't leak.
- Scope the edge function's admin key to a minimal Postgres role (create users only, no data access)
- Monitor for abuse (e.g., rapid guest account creation from a single IP)

**Guest credentials are returned in plaintext, by design.** The guest password is a 64-hex-char cryptographically random value the client must hold to (a) sign in immediately and (b) silently restore the guest across app restarts (`auth.ts` caches it in `expo-secure-store`). It is therefore returned in the response body — accepted because: transport is HTTPS-only, the value is high-entropy and single-account, and it is stored in the OS keystore at rest, never in plain `AsyncStorage`. Returning a server-minted session instead would break offline restore (refresh tokens expire) and is deferred with the password-reset work.

