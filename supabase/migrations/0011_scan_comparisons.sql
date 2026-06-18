create table public.scan_comparisons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  scan_id_before uuid not null references public.scans(id) on delete cascade,
  scan_id_after  uuid not null references public.scans(id) on delete cascade,
  -- Validated AIDelta JSON from the compare-scans edge function.
  -- Shape: { headline, changes: [{slug, display_name, direction, magnitude, observation}], overall_narrative, caveat }
  ai_delta jsonb not null default '{}',
  created_at timestamptz not null default now(),
  unique (user_id, scan_id_before, scan_id_after)
);

create index scan_comparisons_user_after_idx
  on public.scan_comparisons (user_id, scan_id_after desc);

-- RLS: owners only. Single for-all policy matches the project convention
-- (see 0002_rls_policies.sql — every user-owned table uses this shape).
alter table public.scan_comparisons enable row level security;

create policy "scan_comparisons_crud_own" on public.scan_comparisons
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
