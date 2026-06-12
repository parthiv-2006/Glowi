-- Glowi · 0004_guest_flag
-- Guest accounts are created via the auth-signup edge function (admin API),
-- not anonymous auth, so is_anonymous stays false. Respect the metadata flag.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, is_guest, display_name)
  values (
    new.id,
    coalesce(new.is_anonymous, false)
      or coalesce((new.raw_user_meta_data ->> 'is_guest')::boolean, false),
    nullif(new.raw_user_meta_data ->> 'display_name', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
