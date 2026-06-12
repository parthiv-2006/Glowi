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

serve(async (req) => {
  const body = (await req.json().catch(() => null)) as SignupBody | null;
  if (!body || (body.mode !== 'guest' && body.mode !== 'email')) {
    throw new HttpError(400, 'mode must be "guest" or "email"');
  }

  const svc = serviceClient();

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
    if (error) throw new HttpError(500, `Could not create guest: ${error.message}`);
    return json({ email, password });
  }

  const email = body.email?.trim().toLowerCase() ?? '';
  const password = body.password ?? '';
  if (!EMAIL_RE.test(email)) throw new HttpError(400, 'Invalid email address');
  if (password.length < 8) throw new HttpError(400, 'Password must be at least 8 characters');

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
    throw new HttpError(exists ? 409 : 500, exists ? 'Account already exists' : error.message);
  }
  return json({ email });
});
