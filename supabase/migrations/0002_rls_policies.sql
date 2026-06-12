-- Glowi · 0002_rls_policies
-- Row Level Security: users touch only their own rows; catalog is read-only.

-- ─────────────────────────── Catalog: authenticated read ───────────────────────────

alter table public.concerns enable row level security;
alter table public.products enable row level security;
alter table public.product_concerns enable row level security;
alter table public.nutrition_guides enable row level security;
alter table public.tips enable row level security;
alter table public.articles enable row level security;

create policy "catalog_read" on public.concerns
  for select to authenticated using (true);
create policy "catalog_read" on public.products
  for select to authenticated using (true);
create policy "catalog_read" on public.product_concerns
  for select to authenticated using (true);
create policy "catalog_read" on public.nutrition_guides
  for select to authenticated using (true);
create policy "catalog_read" on public.tips
  for select to authenticated using (true);
create policy "catalog_read" on public.articles
  for select to authenticated using (true);

-- ─────────────────────────── Profiles (pk = auth.uid()) ───────────────────────────

alter table public.profiles enable row level security;

create policy "profiles_select_own" on public.profiles
  for select to authenticated using (id = auth.uid());
create policy "profiles_insert_own" on public.profiles
  for insert to authenticated with check (id = auth.uid());
create policy "profiles_update_own" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- ─────────────────────────── User-owned tables ───────────────────────────
-- Identical shape: full CRUD scoped to auth.uid() = user_id.

alter table public.scans enable row level security;
create policy "scans_crud_own" on public.scans
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table public.chat_sessions enable row level security;
create policy "chat_sessions_crud_own" on public.chat_sessions
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table public.chat_messages enable row level security;
create policy "chat_messages_crud_own" on public.chat_messages
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table public.ai_memories enable row level security;
create policy "ai_memories_crud_own" on public.ai_memories
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table public.routines enable row level security;
create policy "routines_crud_own" on public.routines
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table public.routine_steps enable row level security;
create policy "routine_steps_crud_own" on public.routine_steps
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table public.routine_checkins enable row level security;
create policy "routine_checkins_crud_own" on public.routine_checkins
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table public.reminder_settings enable row level security;
create policy "reminder_settings_crud_own" on public.reminder_settings
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
