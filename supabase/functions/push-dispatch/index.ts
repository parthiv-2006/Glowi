/**
 * push-dispatch — sends server-triggered Expo push notifications.
 *
 * Called on a schedule by pg_cron + pg_net (migration 0018), not by users, so
 * verify_jwt is OFF and the caller authenticates with the x-push-secret header
 * against the PUSH_DISPATCH_SECRET function secret (same value lives in Vault
 * for the cron job). See docs/adr/0015-server-push-notifications.md.
 *
 * Kinds:
 *  - glow_report: Monday "your Glow Report is ready" to every registered
 *    device. Generation stays lazy — the report is created on first open.
 *  - scan_nudge: devices of users whose most recent completed scan is
 *    SCAN_NUDGE_DAYS+ old. Users who never scanned are left alone.
 *
 * Sends via Expo's push API in batches; any DeviceNotRegistered token is
 * deleted so push_tokens self-prunes.
 */
import { serve, json, HttpError, timingSafeEqual } from '../_shared/http.ts';
import { serviceClient } from '../_shared/supabase.ts';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
/** Expo's documented max messages per request. */
const BATCH_SIZE = 100;
/** A user counts as lapsed after this many days without a completed scan. */
const SCAN_NUDGE_DAYS = 14;

interface DispatchBody {
  kind?: string;
}

interface TokenRow {
  user_id: string;
  token: string;
}

interface ExpoTicket {
  status: 'ok' | 'error';
  message?: string;
  details?: { error?: string };
}

serve(async (req) => {
  const secret = Deno.env.get('PUSH_DISPATCH_SECRET');
  const provided = req.headers.get('x-push-secret') ?? '';
  if (!secret || !(await timingSafeEqual(provided, secret))) {
    throw new HttpError(401, 'Unauthorized');
  }

  const body = ((await req.json().catch(() => ({}))) as DispatchBody) ?? {};
  const kind = String(body.kind ?? '');
  if (kind !== 'glow_report' && kind !== 'scan_nudge') {
    throw new HttpError(400, 'kind must be glow_report or scan_nudge.');
  }

  const svc = serviceClient();
  const { data: tokenRows, error } = await svc.from('push_tokens').select('user_id, token');
  if (error) throw new HttpError(500, error.message);
  const tokens = (tokenRows ?? []) as TokenRow[];
  if (tokens.length === 0) return json({ kind, sent: 0, pruned: 0 });

  let recipients: TokenRow[];
  let content: { title: string; body: string; url: string };

  if (kind === 'glow_report') {
    recipients = tokens;
    content = {
      title: 'Your Glow Report is ready ✨',
      body: 'See what moved this week — and your focus for the next.',
      url: '/report',
    };
  } else {
    // Lapsed = has scanned before, but not within the window.
    const userIds = [...new Set(tokens.map((t) => t.user_id))];
    const cutoff = new Date(Date.now() - SCAN_NUDGE_DAYS * 86_400_000).toISOString();
    const [recentRes, everRes] = await Promise.all([
      svc
        .from('scans')
        .select('user_id')
        .eq('status', 'complete')
        .gte('created_at', cutoff)
        .in('user_id', userIds),
      svc.from('scans').select('user_id').eq('status', 'complete').in('user_id', userIds),
    ]);
    const recent = new Set((recentRes.data ?? []).map((r) => r.user_id as string));
    const ever = new Set((everRes.data ?? []).map((r) => r.user_id as string));
    recipients = tokens.filter((t) => ever.has(t.user_id) && !recent.has(t.user_id));
    content = {
      title: 'Time for a fresh scan 📸',
      body: `It's been ${SCAN_NUDGE_DAYS}+ days — 30 seconds keeps your trend line honest.`,
      url: '/scan',
    };
  }

  if (recipients.length === 0) return json({ kind, sent: 0, pruned: 0 });

  const messages = recipients.map((r) => ({
    to: r.token,
    title: content.title,
    body: content.body,
    data: { url: content.url },
  }));

  let sent = 0;
  const dead: string[] = [];
  for (let i = 0; i < messages.length; i += BATCH_SIZE) {
    const batch = messages.slice(i, i + BATCH_SIZE);
    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(batch),
    });
    if (!res.ok) {
      console.error(`Expo push API ${res.status}:`, (await res.text()).slice(0, 500));
      continue; // Skip this batch; a partial dispatch beats a failed one.
    }
    const { data: tickets } = (await res.json()) as { data?: ExpoTicket[] };
    (tickets ?? []).forEach((ticket, idx) => {
      if (ticket.status === 'ok') {
        sent += 1;
      } else if (ticket.details?.error === 'DeviceNotRegistered') {
        dead.push(batch[idx].to);
      } else {
        console.error('Expo push ticket error:', ticket.message ?? ticket.details?.error);
      }
    });
  }

  if (dead.length > 0) {
    await svc.from('push_tokens').delete().in('token', dead);
  }

  return json({ kind, sent, pruned: dead.length });
});
