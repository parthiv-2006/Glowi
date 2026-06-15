/**
 * auth-signup — creates pre-confirmed users via the admin API.
 *
 * Why this exists (see docs/adr/0002): new Supabase projects ship with email
 * confirmation enabled and anonymous sign-ins disabled. Routing signup through
 * the admin API with email_confirm=true makes both email signup and guest mode
 * work regardless of dashboard auth configuration. The client signs in with
 * the returned credentials immediately afterwards.
 *
 * verify_jwt is OFF (pre-auth endpoint); the platform still requires a valid
 * anon apikey header, same as Supabase's own signup endpoint.
 */
import { serve, json, HttpError } from '../_shared/http.ts';
import { serviceClient } from '../_shared/supabase.ts';

interface SignupBody {
  mode: 'guest' | 'email';
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
  if (!body || (body.mode !== 'guest' && body.mode !== 'email')) {
    throw new HttpError(400, 'mode must be "guest" or "email"');
  }

  const svc = serviceClient();

  // Rate limit by IP — this endpoint is reachable with only the public anon
  // key, so it is the one path an attacker can hit to mass-create accounts.
  // Fail open (log only) if the limiter itself errors, to avoid locking out
  // legitimate users on an infra hiccup.
  const { data: allowed, error: rlErr } = await svc.rpc('check_rate_limit', {
    p_bucket: `signup:${clientIp(req)}`,
    p_max: 10,
    p_window_seconds: 3600,
  });
  if (rlErr) console.error('Rate limit check failed:', rlErr);
  else if (allowed === false) {
    throw new HttpError(429, 'Too many sign-up attempts. Please try again later.');
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
