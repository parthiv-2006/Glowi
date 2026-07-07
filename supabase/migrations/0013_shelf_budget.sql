-- Budget / cost-per-use: what the user paid for each shelf item.
-- Optional — priced items power the shelf-value, quarterly-spend, and
-- cost-per-use computations; unpriced items are simply excluded.
ALTER TABLE shelf_items
  ADD COLUMN price_usd numeric(8,2) CHECK (price_usd IS NULL OR price_usd >= 0);
