-- Glowi · 0007_rate_limit
-- Server-side rate limiting for pre-auth endpoints (auth-signup has verify_jwt
-- off, so it is the one function reachable with only the public anon key).
-- Edge functions are stateless, so we keep a small append-only event log and
-- count recent hits per bucket. Only the service role touches this table;
-- check_rate_limit is SECURITY DEFINER so the function — not the caller — owns
-- the rows, and the table denies everyone else by default via RLS.

create table public.rate_limit_events (
  id bigint generated always as identity primary key,
  bucket text not null,
  created_at timestamptz not null default now()
);

create index rate_limit_events_bucket_idx
  on public.rate_limit_events (bucket, created_at desc);

alter table public.rate_limit_events enable row level security;
-- No policies: deny by default. The service role bypasses RLS, and the
-- SECURITY DEFINER function below is the only intended reader/writer.

-- Records one hit for p_bucket and returns true if it is still under p_max
-- within the trailing p_window_seconds. Opportunistically prunes events older
-- than a day so the table stays small without a separate cron job.
create or replace function public.check_rate_limit(
  p_bucket text,
  p_max int,
  p_window_seconds int
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  hits int;
begin
  delete from rate_limit_events where created_at < now() - interval '1 day';

  select count(*) into hits
  from rate_limit_events
  where bucket = p_bucket
    and created_at > now() - make_interval(secs => p_window_seconds);

  if hits >= p_max then
    return false;
  end if;

  insert into rate_limit_events (bucket) values (p_bucket);
  return true;
end;
$$;

-- Only the service role (used by edge functions) may invoke this.
revoke all on function public.check_rate_limit(text, int, int)
  from public, anon, authenticated;
grant execute on function public.check_rate_limit(text, int, int) to service_role;
