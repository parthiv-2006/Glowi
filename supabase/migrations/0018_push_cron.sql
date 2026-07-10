-- Server-triggered push dispatch — the project's first scheduled jobs.
-- pg_cron fires inside Postgres; pg_net makes the HTTP call to the
-- push-dispatch edge function. The function is NOT user-JWT-verified (there is
-- no user in a cron tick); it authenticates the caller via the x-push-secret
-- header, whose value lives in Vault under 'push_dispatch_secret' (inserted
-- operationally — never committed) and is mirrored as the function's
-- PUSH_DISPATCH_SECRET secret. See docs/adr/0015-server-push-notifications.md.
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Monday 13:00 UTC — "your Glow Report is ready". Generation stays lazy: the
-- report is still created on first open with one Claude call; the push is only
-- the doorbell, so lapsed users cost nothing until they return.
SELECT cron.schedule(
  'glowi-push-glow-report',
  '0 13 * * 1',
  $$
  SELECT net.http_post(
    url := 'https://rfuuznnbctfyqttslrbv.supabase.co/functions/v1/push-dispatch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-push-secret',
      (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'push_dispatch_secret')
    ),
    body := '{"kind": "glow_report"}'::jsonb
  );
  $$
);

-- Wednesday 17:00 UTC — nudge users whose last completed scan is 14+ days old.
-- The weekly cadence doubles as dedup: at most one nudge per week, no per-user
-- send log needed.
SELECT cron.schedule(
  'glowi-push-scan-nudge',
  '0 17 * * 3',
  $$
  SELECT net.http_post(
    url := 'https://rfuuznnbctfyqttslrbv.supabase.co/functions/v1/push-dispatch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-push-secret',
      (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'push_dispatch_secret')
    ),
    body := '{"kind": "scan_nudge"}'::jsonb
  );
  $$
);
