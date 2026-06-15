-- Glowi · 0008_drop_raw_model_output
-- analyze-skin no longer persists the unvalidated raw model output: every
-- field the app needs is extracted and bounds-checked into typed columns, and
-- the raw blob was never read back. Drop it to minimize stored data.

alter table public.scans drop column if exists raw_model_output;
