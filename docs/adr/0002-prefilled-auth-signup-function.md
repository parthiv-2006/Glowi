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

- The function runs without `verify_jwt`, so it's protected only by the anon API key requirement and rate-limiting
- Scope the edge function's admin key to a minimal Postgres role (create users only, no data access)
- Log all signup requests (guest and email) for audit trails
- Monitor for abuse (e.g., rapid guest account creation from a single IP)

