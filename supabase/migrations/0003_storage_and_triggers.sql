-- Glowi · 0003_storage_and_triggers
-- Private scan-image bucket, profile auto-creation, updated_at upkeep.

-- ─────────────────────────── updated_at trigger ───────────────────────────

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger ai_memories_set_updated_at
  before update on public.ai_memories
  for each row execute function public.set_updated_at();

create trigger routines_set_updated_at
  before update on public.routines
  for each row execute function public.set_updated_at();

create trigger reminder_settings_set_updated_at
  before update on public.reminder_settings
  for each row execute function public.set_updated_at();

-- ─────────────────────────── Profile on signup ───────────────────────────
-- security definer: runs as owner so it can insert past RLS during auth flow.

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
    coalesce(new.is_anonymous, false),
    nullif(new.raw_user_meta_data ->> 'display_name', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─────────────────────────── Storage: scan-images ───────────────────────────
-- Private bucket; objects live under {user_id}/{scan_id}.jpg.

insert into storage.buckets (id, name, public)
values ('scan-images', 'scan-images', false)
on conflict (id) do nothing;

create policy "scan_images_select_own" on storage.objects
  for select to authenticated
  using (bucket_id = 'scan-images' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "scan_images_insert_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'scan-images' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "scan_images_delete_own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'scan-images' and (storage.foldername(name))[1] = auth.uid()::text);
