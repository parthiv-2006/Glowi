# Extending the product catalog

The curated catalog is the ceiling on Smart Replenishment, In-Store Compare, and coach
product recommendations — the AI may only recommend slugs that exist here. This guide
lets anyone widen it safely without touching app code.

## Where things live

| File | Contents |
|---|---|
| `supabase/seed/0001_concerns_and_tips.sql` | Concern taxonomy (slugs the whole app validates against) + tips |
| `supabase/seed/0002_products.sql` | Products + product→concern mappings |
| `supabase/seed/0003_nutrition.sql` / `0004_articles.sql` | Nutrition guides and Learn articles |
| `mobile/src/lib/ingredientConcerns.ts` (+ its `supabase/functions/_shared/` mirror) | Ingredient → concern targeting map used for correlation "why" lines |

## Adding a product

Append one tuple to the `insert into public.products` list in `0002_products.sql`:

```sql
('brand-product-slug','Brand','Product Name','serum',
 'One or two honest sentences a shopper would actually find useful.',
 array['niacinamide','zinc'],19.99,
 '[{"retailer":"Amazon","url":"https://www.amazon.com/s?k=brand+product"}]',
 array['oily','combination'],'both',30),
```

Rules the validator enforces (`node supabase/seed/validate.mjs` from the repo root):

- **slug** — kebab-case, unique, stable forever (chat history references it).
- **category** — one of: cleanser, exfoliant, toner, serum, moisturizer, spf, treatment,
  mask, eye-cream, supplement.
- **key_ingredients** — lowercase names, at least one. Use the exact spellings from
  `ingredientConcerns.ts` where possible (that's what powers "niacinamide targets
  redness"-style explanations); the validator warns when nothing matches.
- **price_usd** — realistic retail, 0–500.
- **retailer_links** — JSON array of `{retailer, url}`; https **search** URLs (they never
  404), not product-page deep links.
- **skin_types** — subset of normal/dry/oily/combination/sensitive.
- **am_pm** — am, pm, or both. **step_order** — 10 cleanser, 20 exfoliant/toner,
  30 serum, 40 moisturizer, 50 spf (match neighbors in the file).

Then map it to concerns in the `product_concerns` insert further down — every product
should serve at least one concern, using only slugs from seed 0001.

## Adding a concern (rare)

New taxonomy entries in 0001 ripple everywhere (scan analysis validates against them,
tips/nutrition key on them). Add the concern, tips, and a nutrition guide together, and
consider whether `ingredientConcerns.ts` (both copies — it's a lockstep mirror) should
target it.

## Shipping it

1. `node supabase/seed/validate.mjs` → must end `OK`.
2. Apply to the project: run the changed seed file's SQL against production (seeds are
   idempotent — they delete-and-reinsert the catalog tables).
3. Commit the seed change; no app release is needed — clients read the catalog live.
