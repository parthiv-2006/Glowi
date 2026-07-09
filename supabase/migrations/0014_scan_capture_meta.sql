-- Guided scan capture metadata (WS4). Records the client capture context for a
-- scan so later features can weight trends by photo consistency: whether the
-- alignment overlay was used, which overlay version, and the post-capture
-- lighting read. Null for legacy scans and library uploads (which have no
-- guided-capture context).
--
-- RLS is unchanged: this is a nullable column on the already user-owned `scans`
-- table, covered by its existing crud_own policies.
ALTER TABLE public.scans ADD COLUMN capture_meta jsonb;

COMMENT ON COLUMN public.scans.capture_meta IS
  'Client capture context: {guided, overlay_version, mean_luminance, verdict}. Null for legacy/library scans.';
