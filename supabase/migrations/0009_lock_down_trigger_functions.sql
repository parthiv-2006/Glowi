-- Glowi · 0009_lock_down_trigger_functions
-- handle_new_user / set_updated_at are trigger functions that live in the public
-- schema, so PostgREST also exposed them as RPCs (/rest/v1/rpc/...). handle_new_user
-- is SECURITY DEFINER, so a caller could invoke the profile-insert path directly
-- (flagged by the database linter). Triggers fire under the table owner regardless
-- of caller EXECUTE, so revoking EXECUTE removes the RPC surface without affecting
-- signup or the updated_at upkeep.

revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.set_updated_at() from public, anon, authenticated;
