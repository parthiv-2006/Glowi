/**
 * auth-signup — creates pre-confirmed users via the admin API.
 *
 * Why this exists (see docs/adr/0002): new Supabase projects ship with email
 * confirmation enabled and anonymous sign-ins disabled. Routing signup through
 * the admin API with email_confirm=true makes both email signup and guest mode
 * work regardless of dashboard auth configuration. The client signs in with
 * the returned credentials immediately afterwards.
 *
 * mode 'upgrade' converts the *calling* guest user in place (same user id, so
 * every RLS-owned row survives) — client-side updateUser({ email }) would
 * depend on a confirmation email reaching the new address, which ADR-0002
 * deliberately avoids. This mode requires a valid JWT despite verify_jwt
 * being off for the pre-auth modes.
 *
 * verify_jwt is OFF (pre-auth endpoint); the platform still requires a valid
 * anon apikey header, same as Supabase's own signup endpoint.
 */
import { serve, json, HttpError } from '../_shared/http.ts';
import { serviceClient, requireUser } from '../_shared/supabase.ts';

interface SignupBody {
  mode: 'guest' | 'email' | 'upgrade';
  email?: string;
  password?: string;
  displayName?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LEN = 254; // RFC 5321 maximum
const MAX_PASSWORD_LEN = 200;

/** Best-effort caller IP from the platform's forwarding header. */
function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for') ?? '';
  return fwd.split(',')[0].trim() || 'unknown';
}

serve(async (req) => {
  const body = (await req.json().catch(() => null)) as SignupBody | null;
  if (!body || (body.mode !== 'guest' && body.mode !== 'email' && body.mode !== 'upgrade')) {
    throw new HttpError(400, 'mode must be "guest", "email", or "upgrade"');
  }

  const svc = serviceClient();

  // Rate limit the pre-auth modes by IP — they are reachable with only the
  // public anon key, so they are the paths an attacker can hit to mass-create
  // accounts. Upgrades are JWT-gated and metered per user below instead, so a
  // guest behind a busy NAT is never blocked from converting their account.
  // Fail open (log only) if the limiter itself errors, to avoid locking out
  // legitimate users on an infra hiccup.
  if (body.mode !== 'upgrade') {
    const { data: allowed, error: rlErr } = await svc.rpc('check_rate_limit', {
      p_bucket: `signup:${clientIp(req)}`,
      p_max: 10,
      p_window_seconds: 3600,
    });
    if (rlErr) console.error('Rate limit check failed:', rlErr);
    else if (allowed === false) {
      throw new HttpError(429, 'Too many sign-up attempts. Please try again later.');
    }
  }

  if (body.mode === 'guest') {
    const id = crypto.randomUUID();
    const email = `guest-${id}@guest.glowi.app`;
    const password = crypto.randomUUID() + crypto.randomUUID();
    const { error } = await svc.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { is_guest: true, display_name: 'Guest' },
    });
    if (error) {
      console.error('Guest creation failed:', error);
      throw new HttpError(500, 'Could not create guest account');
    }
    return json({ email, password });
  }

  const email = body.email?.trim().toLowerCase() ?? '';
  const password = body.password ?? '';
  if (!EMAIL_RE.test(email) || email.length > MAX_EMAIL_LEN) {
    throw new HttpError(400, 'Invalid email address');
  }
  if (password.length < 8 || password.length > MAX_PASSWORD_LEN) {
    throw new HttpError(400, 'Password must be between 8 and 200 characters');
  }

  if (body.mode === 'upgrade') {
    // Convert the calling guest in place — same user id, all data survives.
    const { user } = await requireUser(req);
    if (user.user_metadata?.is_guest !== true) {
      throw new HttpError(400, 'Only guest accounts can be upgraded');
    }
    // Per-user budget: generous for real retries, a stop for scripted abuse.
    const { data: upAllowed, error: upErr } = await svc.rpc('check_rate_limit', {
      p_bucket: `upgrade:${user.id}`,
      p_max: 5,
      p_window_seconds: 3600,
    });
    if (upErr) console.error('Rate limit check failed:', upErr);
    else if (upAllowed === false) {
      throw new HttpError(429, 'Too many attempts. Please try again later.');
    }
    const displayName = body.displayName?.trim().slice(0, 60) || null;
    // Pre-check: the admin API 500s with an empty body on a duplicate email,
    // so availability is checked via the email_taken helper (migration 0024)
    // to surface a clean 409 instead.
    const { data: taken, error: takenErr } = await svc.rpc('email_taken', { p_email: email });
    if (takenErr) console.error('email_taken check failed:', takenErr);
    else if (taken === true) throw new HttpError(409, 'Account already exists');

    const { error } = await svc.auth.admin.updateUserById(user.id, {
      email,
      password,
      email_confirm: true,
      user_metadata: { is_guest: false, ...(displayName ? { display_name: displayName } : {}) },
    });
    if (error) {
      console.error('Guest upgrade failed:', JSON.stringify(error));
      throw new HttpError(500, 'Could not upgrade account');
    }
    // Flip the profile flag server-side so the app's guest checks and the
    // cleanup job (ADR-0018) both see a full account immediately.
    await svc
      .from('profiles')
      .update({ is_guest: false, ...(displayName ? { display_name: displayName } : {}) })
      .eq('id', user.id);
    return json({ email });
  }

  const { error } = await svc.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      is_guest: false,
      display_name: body.displayName?.trim().slice(0, 60) || null,
    },
  });
  if (error) {
    const exists = /already.*(registered|exists)/i.test(error.message);
    if (!exists) console.error('Email signup failed:', error);
    // Never surface the raw admin-API error to the client.
    throw new HttpError(exists ? 409 : 500, exists ? 'Account already exists' : 'Could not create account');
  }
  return json({ email });
});
