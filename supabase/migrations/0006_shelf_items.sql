-- Glowi · 0006_shelf_items
-- "The Shelf" — a living inventory of the products a user actually owns.
-- Powers expiry/low-stock intelligence, routes Skin Weather through what they
-- own, and makes the coach cabinet-aware.

create table public.shelf_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Linked to the catalog when recognized; null for items we only read off a label.
  product_id uuid references public.products(id) on delete set null,
  name text not null,
  brand text,
  category text check (category in (
    'cleanser','exfoliant','toner','serum','moisturizer','spf',
    'treatment','mask','eye-cream','supplement'
  )),
  -- Product photo, stored under {user_id}/shelf/{item}.jpg in scan-images.
  image_path text,
  size_label text,
  -- When the user opened it — drives period-after-opening (PAO) expiry.
  opened_at date,
  shelf_life_months int check (shelf_life_months between 1 and 60),
  -- Rough percentage left, 0–100.
  amount_remaining int not null default 100 check (amount_remaining between 0 and 100),
  times_used int not null default 0,
  last_used_at date,
  status text not null default 'active' check (status in ('active','finished','archived')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index shelf_items_user_idx
  on public.shelf_items (user_id, status, created_at desc);

-- RLS: users touch only their own shelf (same shape as other user-owned tables).
alter table public.shelf_items enable row level security;
create policy "shelf_items_crud_own" on public.shelf_items
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create trigger shelf_items_set_updated_at
  before update on public.shelf_items
  for each row execute function public.set_updated_at();
