/**
 * cleanup-guests — deletes abandoned guest accounts and their private photos.
 *
 * Called monthly by pg_cron + pg_net (migration 0023), authenticated exactly
 * like push-dispatch: the x-push-secret header against PUSH_DISPATCH_SECRET
 * (same secret, same Vault entry — one cron identity, not a second secret).
 * See docs/adr/0018-abandoned-guest-cleanup.md.
 *
 * A guest is "abandoned" when profiles.is_guest is true and nothing about the
 * account has moved for RETENTION_DAYS: profiles.updated_at is the cheap,
 * index-friendly prefilter, then recent scans / chat messages / lifestyle
 * logs rescue anyone whose profile row alone looks stale. Each run is capped
 * so a large backlog drains gradually over successive months.
 *
 * Storage is deleted before the auth user: FK cascades from auth.users clear
 * every DB row (verified against pg_constraint — all 17 user tables cascade),
 * but bucket objects are not FK-linked and would orphan otherwise. If storage
 * removal fails the user is skipped and retried next run.
 *
 * Body: { "dryRun": true } reports what would be deleted without touching
 * anything — always run it first against production.
 */
import { serve, json, HttpError, timingSafeEqual } from '../_shared/http.ts';
import { serviceClient } from '../_shared/supabase.ts';

const RETENTION_DAYS = 90;
const MAX_DELETIONS_PER_RUN = 50;

interface CleanupBody {
  dryRun?: boolean;
}

serve(async (req) => {
  const secret = Deno.env.get('PUSH_DISPATCH_SECRET');
  const provided = req.headers.get('x-push-secret') ?? '';
  if (!secret || !(await timingSafeEqual(provided, secret))) {
    throw new HttpError(401, 'Unauthorized');
  }

  const body = ((await req.json().catch(() => ({}))) as CleanupBody) ?? {};
  const dryRun = body.dryRun === true;

  const svc = serviceClient();
  const cutoffIso = new Date(Date.now() - RETENTION_DAYS * 86_400_000).toISOString();
  const cutoffDate = cutoffIso.slice(0, 10);

  // Cheap prefilter: guest profiles that haven't been touched in the window.
  // Fetch double the cap so activity rescues below don't starve a full run.
  const { data: stale, error } = await svc
    .from('profiles')
    .select('id, updated_at')
    .eq('is_guest', true)
    .lt('updated_at', cutoffIso)
    .order('updated_at', { ascending: true })
    .limit(MAX_DELETIONS_PER_RUN * 2);
  if (error) throw new HttpError(500, error.message);
  if (!stale?.length) return json({ dryRun, count: 0, deleted: [] });

  const ids = stale.map((p) => p.id);
  // Rescue anyone with recent activity the profile row doesn't reflect.
  const [scansRes, chatsRes, logsRes] = await Promise.all([
    svc.from('scans').select('user_id').in('user_id', ids).gte('created_at', cutoffIso),
    svc.from('chat_messages').select('user_id').in('user_id', ids).gte('created_at', cutoffIso),
    svc.from('lifestyle_logs').select('user_id').in('user_id', ids).gte('log_date', cutoffDate),
  ]);
  const active = new Set<string>([
    ...(scansRes.data ?? []).map((r) => r.user_id as string),
    ...(chatsRes.data ?? []).map((r) => r.user_id as string),
    ...(logsRes.data ?? []).map((r) => r.user_id as string),
  ]);
  const targets = ids.filter((id) => !active.has(id)).slice(0, MAX_DELETIONS_PER_RUN);

  if (dryRun) return json({ dryRun: true, count: targets.length, deleted: targets });

  const deleted: string[] = [];
  for (const id of targets) {
    const { data: objects } = await svc.storage.from('scan-images').list(id, { limit: 1000 });
    if (objects?.length) {
      const paths = objects.map((o) => `${id}/${o.name}`);
      const { error: rmErr } = await svc.storage.from('scan-images').remove(paths);
      if (rmErr) {
        console.error(`cleanup-guests: storage removal failed for ${id} — skipping user:`, rmErr);
        continue; // Retry next run rather than orphaning photos.
      }
    }
    const { error: delErr } = await svc.auth.admin.deleteUser(id);
    if (delErr) {
      console.error(`cleanup-guests: auth deletion failed for ${id}:`, delErr);
      continue;
    }
    deleted.push(id);
  }

  return json({ dryRun: false, count: deleted.length, deleted });
});
