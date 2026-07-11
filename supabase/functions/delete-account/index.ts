/**
 * delete-account — permanent erasure of the calling user's account.
 *
 * Required by Apple App Store Guideline 5.1.1(v) (in-app account deletion)
 * and GDPR/CCPA erasure. Authenticated with the caller's real JWT — this is
 * a user action, not a cron job. Works identically for guests; it is their
 * only erasure path. See docs/adr/0019-account-deletion.md.
 *
 * Order matters: storage objects are deleted first (bucket objects have no FK
 * and Supabase blocks direct SQL deletes on storage tables), then
 * auth.admin.deleteUser cascades every DB row — all 17 user tables reference
 * auth.users on delete cascade (verified against pg_constraint).
 */
import { serve, json, HttpError } from '../_shared/http.ts';
import { serviceClient, requireUser } from '../_shared/supabase.ts';

const LIST_PAGE = 1000;

serve(async (req) => {
  const { user } = await requireUser(req);
  const svc = serviceClient();

  // Drain the user's storage prefix in pages; abort (retryable) on any failure
  // so photos are never orphaned by a half-completed deletion.
  for (;;) {
    const { data: objects, error: listErr } = await svc.storage
      .from('scan-images')
      .list(user.id, { limit: LIST_PAGE });
    if (listErr) {
      console.error(`delete-account: storage list failed for ${user.id}:`, listErr);
      throw new HttpError(500, 'Could not delete account data — please try again.');
    }
    if (!objects?.length) break;
    const paths = objects.map((o) => `${user.id}/${o.name}`);
    const { error: rmErr } = await svc.storage.from('scan-images').remove(paths);
    if (rmErr) {
      console.error(`delete-account: storage removal failed for ${user.id}:`, rmErr);
      throw new HttpError(500, 'Could not delete account data — please try again.');
    }
    if (objects.length < LIST_PAGE) break;
  }

  const { error } = await svc.auth.admin.deleteUser(user.id);
  if (error) {
    console.error(`delete-account: auth deletion failed for ${user.id}:`, JSON.stringify(error));
    throw new HttpError(500, 'Could not delete account — please try again.');
  }

  return json({ deleted: true });
});
