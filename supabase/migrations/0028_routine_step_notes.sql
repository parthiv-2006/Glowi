-- Routine step notes: freeform per-step commentary the user attaches
-- independently of routine generation/editing (e.g. "switch to the gentle
-- cleanser while traveling"). Optional; existing rows default to null.
ALTER TABLE routine_steps
  ADD COLUMN note text;
