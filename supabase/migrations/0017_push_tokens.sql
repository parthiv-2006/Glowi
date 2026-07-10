-- Expo push tokens — one row per device token, so server-triggered
-- notifications ("your Glow Report is ready", lapsed-scan nudges) can reach a
-- user whose app is closed. Registered by the client after sign-in; refreshed
-- by upsert on the token; pruned by push-dispatch when Expo reports
-- DeviceNotRegistered.
CREATE TABLE push_tokens (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token       text        NOT NULL UNIQUE,
  platform    text        NOT NULL CHECK (platform IN ('ios', 'android')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY crud_own ON push_tokens
  FOR ALL USING (user_id = auth.uid());

CREATE INDEX push_tokens_user_idx ON push_tokens (user_id);

CREATE TRIGGER push_tokens_set_updated_at
  BEFORE UPDATE ON public.push_tokens
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
