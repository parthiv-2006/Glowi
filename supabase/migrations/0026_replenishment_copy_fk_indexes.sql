-- Covering indexes for the two FKs on replenishment_copy (0025) that the
-- composite (user_id, trigger_item_id) index doesn't cover on its own —
-- same fix as 0022 applied project-wide, just for a table added afterward.
create index replenishment_copy_trigger_item_id_idx
  on public.replenishment_copy (trigger_item_id);

create index replenishment_copy_product_id_idx
  on public.replenishment_copy (product_id);
