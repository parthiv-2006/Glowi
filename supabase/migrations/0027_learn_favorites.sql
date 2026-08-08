-- Learn article bookmarks ("Save for later"). Presence of a row is the fact —
-- no read-tracking, ordering metadata, or folders; that's deliberately out of
-- scope for a one-tap bookmark.
create table public.learn_favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  article_slug text not null,
  created_at timestamptz not null default now(),
  unique (user_id, article_slug)
);

create index learn_favorites_user_idx
  on public.learn_favorites (user_id);

-- RLS: owners only, initplan-optimized per 0022's convention.
alter table public.learn_favorites enable row level security;

create policy "learn_favorites_crud_own" on public.learn_favorites
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
