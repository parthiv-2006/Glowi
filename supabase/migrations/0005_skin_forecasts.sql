-- Glowi · 0005_skin_forecasts
-- "Skin Weather" — one personalized environmental forecast per user per day.
-- Cross-references local weather (UV, humidity, temp swing, air quality, pollen)
-- with the user's documented skin history to produce proactive routine guidance.

create table public.skin_forecasts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  forecast_date date not null default current_date,
  location_label text not null default '',
  -- ForecastEnvironment: { uv_index, humidity, temp_c, temp_swing_c,
  --                        air_quality_index, pollen_level, condition }
  environment jsonb not null default '{}',
  headline text not null default '',
  summary text not null default '',
  -- [{ "kind": "add"|"swap"|"skip"|"maintain", "text": "..." }]
  guidance jsonb not null default '[]',
  created_at timestamptz not null default now(),
  -- one forecast per day; regeneration upserts the same row
  unique (user_id, forecast_date)
);

create index skin_forecasts_user_date_idx
  on public.skin_forecasts (user_id, forecast_date desc);

-- RLS: users touch only their own forecasts (same shape as other user-owned tables).
alter table public.skin_forecasts enable row level security;
create policy "skin_forecasts_crud_own" on public.skin_forecasts
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
