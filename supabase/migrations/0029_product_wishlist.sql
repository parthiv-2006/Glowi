-- Product wishlist ("save for later" on a catalog product, distinct from The
-- Shelf which tracks products the user already owns). Presence of a row is
-- the fact — no notes, ordering, or folders, same minimal shape as
-- learn_favorites.
create table public.product_wishlist (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, product_id)
);

create index product_wishlist_user_idx
  on public.product_wishlist (user_id);

-- Covering index for the product_id FK (0022's convention — avoid the
-- advisor-flagged-FK pattern that 0025/0026 had to follow up separately).
create index product_wishlist_product_idx
  on public.product_wishlist (product_id);

-- RLS: owners only, initplan-optimized per 0022's convention.
alter table public.product_wishlist enable row level security;

create policy "product_wishlist_crud_own" on public.product_wishlist
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
