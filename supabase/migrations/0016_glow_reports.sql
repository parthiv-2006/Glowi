-- Weekly Glow Report — once a week Glowi writes the user a short report of what
-- moved, what worked, and what to focus on next. One immutable row per user per
-- completed week (Monday-anchored, ISO). Generation is lazy and client-triggered
-- on app open — there is no server cron on this project (see ADR-0014) — and the
-- edge function caches on (user_id, week_start): a cache hit returns without
-- calling Claude. `content` holds the validated GlowReportContent JSON.
CREATE TABLE glow_reports (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Monday (ISO) of the completed week this report covers.
  week_start  date        NOT NULL,
  -- GlowReportContent: { headline, score_note, wins[], watchouts[],
  --                      next_week_focus, stats{...} } — validated server-side.
  content     jsonb       NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, week_start)
);

ALTER TABLE glow_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY crud_own ON glow_reports
  FOR ALL USING (user_id = auth.uid());

CREATE INDEX glow_reports_user_idx
  ON glow_reports (user_id, week_start DESC);
