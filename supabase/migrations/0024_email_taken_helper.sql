-- Glowi · 0024_email_taken_helper
-- auth.admin.updateUserById returns a bare 500 with an empty body when the
-- new email is already registered (observed against GoTrue in production), so
-- the guest-upgrade path in auth-signup cannot map that to a friendly 409 from
-- the error alone. This helper lets the function pre-check availability.
-- SECURITY DEFINER because auth.users is not PostgREST-exposed; execution is
-- service-role only, and it leaks nothing beyond a boolean the upgrade flow
-- must reveal anyway ("account already exists").

create or replace function public.email_taken(p_email text)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select exists (
    select 1 from auth.users
    where lower(email) = lower(p_email) and deleted_at is null
  );
$$;

revoke all on function public.email_taken(text) from public, anon, authenticated;
grant execute on function public.email_taken(text) to service_role;
