-- Lifestyle Diary — the user's 10-second daily check-in (sleep, stress, water,
-- diet flags, optional cycle phase). Feeds the correlation engine as sustained
-- streaks ("your breakouts track your low-sleep weeks") and the coach's memory
-- context. One row per user per day; unanswered levels stay NULL (≠ zero).
CREATE TABLE lifestyle_logs (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  log_date       date        NOT NULL DEFAULT current_date,
  -- 3-level self-report scales, 0 (poor/low) – 2 (good/high). NULL = not answered.
  sleep_quality  smallint    CHECK (sleep_quality BETWEEN 0 AND 2),
  stress_level   smallint    CHECK (stress_level BETWEEN 0 AND 2),
  water_level    smallint    CHECK (water_level BETWEEN 0 AND 2),
  -- Diet flags default false — an untoggled chip means "not today", not "unknown".
  diet_dairy     boolean     NOT NULL DEFAULT false,
  diet_sugar     boolean     NOT NULL DEFAULT false,
  diet_alcohol   boolean     NOT NULL DEFAULT false,
  cycle_phase    text        CHECK (cycle_phase IN ('menstrual', 'follicular', 'ovulation', 'luteal')),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, log_date)
);

COMMENT ON COLUMN lifestyle_logs.cycle_phase IS
  'Optional menstrual-cycle phase. Opt-in and OFF by default in the client '
  '(Profile → Track cycle phase); the column is reserved either way. Deletable with the row.';

ALTER TABLE lifestyle_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY crud_own ON lifestyle_logs
  FOR ALL USING (user_id = auth.uid());

CREATE INDEX lifestyle_logs_user_idx
  ON lifestyle_logs (user_id, log_date DESC);

CREATE TRIGGER lifestyle_logs_set_updated_at
  BEFORE UPDATE ON public.lifestyle_logs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
