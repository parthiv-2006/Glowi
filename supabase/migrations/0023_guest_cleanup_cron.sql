-- Glowi · 0023_guest_cleanup_cron
-- Monthly sweep of abandoned guest accounts. Every "Continue as guest" tap
-- creates a permanent auth user with a private storage prefix; signing out
-- orphans it forever, so accounts with no activity for 90 days are removed by
-- the cleanup-guests edge function (capped per run; see
-- docs/adr/0018-abandoned-guest-cleanup.md). Same auth pattern as the push
-- cron (0018): pg_cron + pg_net with the Vault-held shared secret.

SELECT cron.schedule(
  'glowi-cleanup-guests',
  '0 4 1 * *', -- 04:00 UTC on the 1st of each month
  $$
  SELECT net.http_post(
    url := 'https://rfuuznnbctfyqttslrbv.supabase.co/functions/v1/cleanup-guests',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-push-secret',
      (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'push_dispatch_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
