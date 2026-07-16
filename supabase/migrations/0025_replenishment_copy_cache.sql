-- Cache for the AI replenishment "why this over that" one-liner (F1). Keyed
-- by the triggered shelf item + the suggested catalog product, so the same
-- pairing never re-pays a Claude call across repeat visits to the Replenish
-- screen. Rows are immutable — a changed suggestion is a new pair, not an
-- update — matching scan_comparisons (0011).
create table public.replenishment_copy (
  user_id uuid not null references auth.users(id) on delete cascade,
  trigger_item_id uuid not null references public.shelf_items(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  copy text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, trigger_item_id, product_id)
);

create index replenishment_copy_user_trigger_idx
  on public.replenishment_copy (user_id, trigger_item_id);

-- RLS: owners only. Single for-all policy matches the project convention
-- (see 0002_rls_policies.sql — every user-owned table uses this shape).
-- Written by the edge function's service client (bypasses RLS), but the
-- policy exists so any future client-side read is still scoped correctly.
alter table public.replenishment_copy enable row level security;

create policy "replenishment_copy_crud_own" on public.replenishment_copy
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
