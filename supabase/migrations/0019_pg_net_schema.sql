-- Lint fix (extension_in_public): pg_net does not support SET SCHEMA, so
-- recreate it anchored in `extensions`. Its API objects live in the dedicated
-- `net` schema either way, and the cron jobs reference net.http_post only at
-- run time, so nothing depends on the extension object across the drop.
DROP EXTENSION pg_net;
CREATE EXTENSION pg_net WITH SCHEMA extensions;
