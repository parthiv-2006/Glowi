-- Reaction / Sensitivity Log — the user's record of products that reacted badly.
-- Each row also produces a high-importance 'gotcha' ai_memory at insert time
-- (client-side), so the coach and Skin Weather inherit it with no new AI plumbing.
CREATE TABLE reaction_logs (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Optional link back to the shelf item; the log outlives the product.
  shelf_item_id    uuid        REFERENCES shelf_items(id) ON DELETE SET NULL,
  product_name     text        NOT NULL,
  brand            text,
  -- Snapshot of the product's actives at log time — drives similar-formulation warnings.
  key_ingredients  text[]      NOT NULL DEFAULT '{}',
  reacted_on       date        NOT NULL DEFAULT current_date,
  symptoms         text[]      NOT NULL DEFAULT '{}',
  severity         text        NOT NULL CHECK (severity IN ('mild', 'moderate', 'severe')),
  notes            text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE reaction_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY crud_own ON reaction_logs
  FOR ALL USING (user_id = auth.uid());

CREATE INDEX reaction_logs_user_idx
  ON reaction_logs (user_id, reacted_on DESC);

CREATE TRIGGER reaction_logs_set_updated_at
  BEFORE UPDATE ON public.reaction_logs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
