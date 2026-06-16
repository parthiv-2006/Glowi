-- Persist ingredients captured at label-scan time onto the shelf item itself.
-- Populated from the AI identifyProduct response when adding to the shelf.
ALTER TABLE shelf_items
  ADD COLUMN key_ingredients text[] NOT NULL DEFAULT '{}';

-- Cache the latest AI conflict analysis per user.
-- Invalidated implicitly: the edge function skips regeneration only when
-- max(shelf_items.updated_at) <= the most recent report's created_at.
CREATE TABLE conflict_reports (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  report      jsonb       NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE conflict_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY crud_own ON conflict_reports
  FOR ALL USING (user_id = auth.uid());

CREATE INDEX conflict_reports_user_idx
  ON conflict_reports (user_id, created_at DESC);
