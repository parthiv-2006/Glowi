-- Glowi · 0022_rls_initplan_and_fk_indexes
-- Performance-only rewrite flagged by the Supabase advisors (2026-07-11):
--
-- 1. auth_rls_initplan — every user-table policy called auth.uid() directly,
--    which Postgres re-evaluates per row. Wrapping it as (select auth.uid())
--    lets the planner run it once per query (InitPlan). Each policy below is
--    recreated with its exact original command, roles, and predicate shape —
--    only the auth.uid() call form changes.
--
-- 2. unindexed_foreign_keys — nine FKs had no covering index, making the
--    owning-side lookups (and FK cascade checks on delete) sequential scans.
--
-- The `crud_own` policies on the five newer tables (conflict_reports,
-- reaction_logs, lifestyle_logs, glow_reports, push_tokens) were created
-- without an explicit `to` clause (role `public`) and without `with check`;
-- both are preserved as-is — for ALL policies Postgres applies `using` as the
-- implicit write check, and anon is still excluded because auth.uid() is null.

-- ── profiles (per-command policies from 0002) ───────────────────────────────
drop policy profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

drop policy profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles
  for insert to authenticated
  with check (id = (select auth.uid()));

drop policy profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- ── crud_own, ALL to authenticated, using + with check ──────────────────────
drop policy scans_crud_own on public.scans;
create policy scans_crud_own on public.scans
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy chat_sessions_crud_own on public.chat_sessions;
create policy chat_sessions_crud_own on public.chat_sessions
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy chat_messages_crud_own on public.chat_messages;
create policy chat_messages_crud_own on public.chat_messages
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy ai_memories_crud_own on public.ai_memories;
create policy ai_memories_crud_own on public.ai_memories
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy routines_crud_own on public.routines;
create policy routines_crud_own on public.routines
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy routine_steps_crud_own on public.routine_steps;
create policy routine_steps_crud_own on public.routine_steps
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy routine_checkins_crud_own on public.routine_checkins;
create policy routine_checkins_crud_own on public.routine_checkins
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy reminder_settings_crud_own on public.reminder_settings;
create policy reminder_settings_crud_own on public.reminder_settings
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy skin_forecasts_crud_own on public.skin_forecasts;
create policy skin_forecasts_crud_own on public.skin_forecasts
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy shelf_items_crud_own on public.shelf_items;
create policy shelf_items_crud_own on public.shelf_items
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy scan_comparisons_crud_own on public.scan_comparisons;
create policy scan_comparisons_crud_own on public.scan_comparisons
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ── crud_own, ALL to public (implicit), using only ──────────────────────────
drop policy crud_own on public.conflict_reports;
create policy crud_own on public.conflict_reports
  for all
  using (user_id = (select auth.uid()));

drop policy crud_own on public.reaction_logs;
create policy crud_own on public.reaction_logs
  for all
  using (user_id = (select auth.uid()));

drop policy crud_own on public.lifestyle_logs;
create policy crud_own on public.lifestyle_logs
  for all
  using (user_id = (select auth.uid()));

drop policy crud_own on public.glow_reports;
create policy crud_own on public.glow_reports
  for all
  using (user_id = (select auth.uid()));

drop policy crud_own on public.push_tokens;
create policy crud_own on public.push_tokens
  for all
  using (user_id = (select auth.uid()));

-- ── covering indexes for the nine advisor-flagged foreign keys ──────────────
create index chat_messages_user_id_idx on public.chat_messages (user_id);
create index reaction_logs_shelf_item_id_idx on public.reaction_logs (shelf_item_id);
create index routine_checkins_routine_id_idx on public.routine_checkins (routine_id);
create index routine_steps_product_id_idx on public.routine_steps (product_id);
create index routine_steps_user_id_idx on public.routine_steps (user_id);
create index routines_generated_from_scan_idx on public.routines (generated_from_scan);
create index scan_comparisons_scan_id_before_idx on public.scan_comparisons (scan_id_before);
create index scan_comparisons_scan_id_after_idx on public.scan_comparisons (scan_id_after);
create index shelf_items_product_id_idx on public.shelf_items (product_id);
