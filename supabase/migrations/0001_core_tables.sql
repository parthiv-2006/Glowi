-- Glowi · 0001_core_tables
-- Catalog tables (read-only to clients) and user-owned tables.

-- ─────────────────────────── Catalog ───────────────────────────

create table public.concerns (
  slug text primary key,
  name text not null,
  blurb text not null,
  icon text not null default 'sparkles',
  severity_descriptors jsonb not null default '[]',
  created_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  brand text not null,
  name text not null,
  category text not null check (category in (
    'cleanser','exfoliant','toner','serum','moisturizer','spf',
    'treatment','mask','eye-cream','supplement'
  )),
  description text not null,
  key_ingredients text[] not null default '{}',
  price_usd numeric(8,2),
  image_url text,
  -- [{ "retailer": "Amazon", "url": "https://..." }]
  retailer_links jsonb not null default '[]',
  skin_types text[] not null default '{}',
  am_pm text not null default 'both' check (am_pm in ('am','pm','both')),
  -- canonical position within a routine (cleanser=10 … spf=90)
  step_order int not null default 50,
  created_at timestamptz not null default now()
);

create table public.product_concerns (
  product_id uuid not null references public.products(id) on delete cascade,
  concern_slug text not null references public.concerns(slug) on delete cascade,
  relevance int not null default 3 check (relevance between 1 and 5),
  rationale text,
  primary key (product_id, concern_slug)
);

create table public.nutrition_guides (
  concern_slug text primary key references public.concerns(slug) on delete cascade,
  overview text not null,
  -- [{ "food": "...", "why": "...", "nutrients": ["zinc"] }]
  foods jsonb not null default '[]',
  -- [{ "nutrient": "...", "evidence": "...", "dose_note": "..." }]
  nutrients jsonb not null default '[]',
  -- [{ "item": "...", "why": "..." }]
  avoid jsonb not null default '[]',
  -- [{ "label": "...", "source": "...", "url": "https://..." }]
  citations jsonb not null default '[]'
);

create table public.tips (
  id uuid primary key default gen_random_uuid(),
  concern_slug text not null references public.concerns(slug) on delete cascade,
  title text not null,
  body text not null,
  category text not null default 'habit'
    check (category in ('habit','application','environment','myth'))
);

create table public.articles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  category text not null,
  read_minutes int not null default 4,
  hero_gradient text not null default 'jade',
  excerpt text not null,
  body_md text not null,
  citations jsonb not null default '[]',
  published_at timestamptz not null default now()
);

-- ─────────────────────────── User-owned ───────────────────────────

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  is_guest boolean not null default false,
  skin_type text check (skin_type in ('normal','dry','oily','combination','sensitive')),
  goals text[] not null default '{}',
  onboarded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.scans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  image_path text,
  status text not null default 'pending'
    check (status in ('pending','analyzing','complete','failed')),
  skin_score int check (skin_score between 0 and 100),
  skin_type_estimate text,
  summary text,
  -- validated AnalyzeSkinResult.concerns (see docs/ARCHITECTURE.md)
  concerns jsonb not null default '[]',
  raw_model_output jsonb,
  area text,
  notes text,
  created_at timestamptz not null default now()
);

create table public.chat_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'New conversation',
  summary text,
  -- incremented after each extract-memories run so we never re-extract old turns
  memory_extracted_until int not null default 0,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.chat_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null,
  -- product ids surfaced as inline recommendation cards
  product_refs jsonb not null default '[]',
  created_at timestamptz not null default now()
);

create table public.ai_memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('profile_fact','preference','event','gotcha','goal')),
  content text not null,
  importance int not null default 3 check (importance between 1 and 5),
  source text not null default 'chat' check (source in ('chat','scan','onboarding','system')),
  source_ref uuid,
  status text not null default 'active' check (status in ('active','superseded')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_accessed_at timestamptz not null default now()
);

create table public.routines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  period text not null check (period in ('am','pm')),
  generated_from_scan uuid references public.scans(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, period)
);

create table public.routine_steps (
  id uuid primary key default gen_random_uuid(),
  routine_id uuid not null references public.routines(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  position int not null,
  product_id uuid references public.products(id) on delete set null,
  custom_name text,
  instruction text not null default '',
  frequency text not null default 'daily'
    check (frequency in ('daily','every-other-day','2-3x-week','weekly'))
);

create table public.routine_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  routine_id uuid not null references public.routines(id) on delete cascade,
  checkin_date date not null default current_date,
  created_at timestamptz not null default now(),
  unique (user_id, routine_id, checkin_date)
);

create table public.reminder_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  am_time text not null default '08:00',
  pm_time text not null default '21:00',
  enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

-- ─────────────────────────── Indexes ───────────────────────────

create index scans_user_created_idx on public.scans (user_id, created_at desc);
create index chat_sessions_user_idx on public.chat_sessions (user_id, last_message_at desc);
create index chat_messages_session_idx on public.chat_messages (session_id, created_at);
create index ai_memories_user_rank_idx
  on public.ai_memories (user_id, status, importance desc, last_accessed_at desc);
create index product_concerns_concern_idx
  on public.product_concerns (concern_slug, relevance desc);
create index tips_concern_idx on public.tips (concern_slug);
create index routine_steps_routine_idx on public.routine_steps (routine_id, position);
create index routine_checkins_user_date_idx
  on public.routine_checkins (user_id, checkin_date desc);
