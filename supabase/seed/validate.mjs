/**
 * Catalog seed linter (F4) — run `node supabase/seed/validate.mjs` from the
 * repo root before committing seed changes. Parses the INSERT tuples in
 * 0001/0002 and checks the invariants the app relies on, so non-engineers can
 * extend the catalog without breaking replenishment, conflicts, or the coach.
 * Exit code 1 on any error; warnings don't fail.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '../..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

const CATEGORIES = new Set([
  'cleanser',
  'exfoliant',
  'toner',
  'serum',
  'moisturizer',
  'spf',
  'treatment',
  'mask',
  'eye-cream',
  'supplement',
]);
const SKIN_TYPES = new Set(['normal', 'dry', 'oily', 'combination', 'sensitive']);
const AM_PM = new Set(['am', 'pm', 'both']);

const errors = [];
const warnings = [];

/** Splits a `values` section into top-level tuples, respecting '…' and (…) nesting.
 *  Stops at a top-level ';' or — for `from (values …)` subqueries entered mid-paren —
 *  when depth would go negative (the values block's own closing paren). */
function splitTuples(sql, fromIdx) {
  const tuples = [];
  let depth = 0;
  let inStr = false;
  let start = -1;
  for (let i = fromIdx; i < sql.length; i++) {
    const ch = sql[i];
    if (inStr) {
      if (ch === "'") {
        if (sql[i + 1] === "'") i++;
        else inStr = false;
      }
      continue;
    }
    if (ch === "'") inStr = true;
    else if (ch === '(') {
      if (depth === 0) start = i;
      depth++;
    } else if (ch === ')') {
      depth--;
      if (depth === 0) tuples.push(sql.slice(start + 1, i));
      if (depth < 0) break;
    } else if (ch === ';' && depth === 0) break;
  }
  return tuples;
}

/** Splits one tuple body into top-level comma-separated values. */
function splitValues(tuple) {
  const vals = [];
  let depth = 0;
  let inStr = false;
  let cur = '';
  for (let i = 0; i < tuple.length; i++) {
    const ch = tuple[i];
    if (inStr) {
      cur += ch;
      if (ch === "'") {
        if (tuple[i + 1] === "'") {
          cur += "'";
          i++;
        } else inStr = false;
      }
      continue;
    }
    if (ch === "'") {
      inStr = true;
      cur += ch;
    } else if (ch === '(' || ch === '[') {
      depth++;
      cur += ch;
    } else if (ch === ')' || ch === ']') {
      depth--;
      cur += ch;
    } else if (ch === ',' && depth === 0) {
      vals.push(cur.trim());
      cur = '';
    } else cur += ch;
  }
  if (cur.trim()) vals.push(cur.trim());
  return vals;
}

const unquote = (v) => v.replace(/^'/, '').replace(/'$/, '').replaceAll("''", "'");
// Accepts an optional cast suffix: empty arrays are written `array[]::text[]`.
const parseSqlArray = (v) => {
  const m = v.match(/^array\[([\s\S]*?)\](?:::\w+\[\])?$/i);
  if (!m) return null;
  return m[1].trim() === '' ? [] : splitValues(m[1]).map(unquote);
};

// ── Taxonomy: concern slugs from seed 0001 ───────────────────────────────────
const concernsSql = read('supabase/seed/0001_concerns_and_tips.sql');
const concernInsert = concernsSql.indexOf('insert into public.concerns');
const concernSlugs = new Set(
  splitTuples(concernsSql, concernInsert).map((t) => unquote(splitValues(t)[0])),
);
if (concernSlugs.size === 0) errors.push('could not parse any concern slugs from seed 0001');

// ── Ingredient → concern map keys from the mobile module (lockstep mirror) ──
const ingredientTs = read('mobile/src/lib/ingredientConcerns.ts');
const knownIngredients = new Set(
  [...ingredientTs.matchAll(/^\s*'([a-z0-9][^']*)':\s*\[/gm)].map((m) => m[1]),
);

// ── Products ─────────────────────────────────────────────────────────────────
const productsSql = read('supabase/seed/0002_products.sql');
const prodInsert = productsSql.indexOf('insert into public.products');
const prodTuples = splitTuples(productsSql, prodInsert).filter((t) => t.includes("'"));

const slugs = new Set();
for (const tuple of prodTuples) {
  const v = splitValues(tuple);
  if (v.length !== 11) {
    errors.push(`product tuple with ${v.length} values (expected 11): ${v[0] ?? '?'}`);
    continue;
  }
  const [slugQ, brandQ, nameQ, catQ, descQ, ingredients, price, links, skinTypes, amPm, step] = v;
  const slug = unquote(slugQ);
  const label = `${slug}`;

  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) errors.push(`${label}: slug is not kebab-case`);
  if (slugs.has(slug)) errors.push(`${label}: duplicate slug`);
  slugs.add(slug);
  if (!unquote(brandQ)) errors.push(`${label}: empty brand`);
  if (!unquote(nameQ)) errors.push(`${label}: empty name`);
  if (!CATEGORIES.has(unquote(catQ))) errors.push(`${label}: unknown category '${unquote(catQ)}'`);
  if (unquote(descQ).length < 20) warnings.push(`${label}: description shorter than 20 chars`);

  const ing = parseSqlArray(ingredients);
  if (!ing || ing.length === 0) errors.push(`${label}: key_ingredients missing or empty`);
  else if (knownIngredients.size && !ing.some((i) => knownIngredients.has(i.toLowerCase())))
    warnings.push(
      `${label}: no ingredient maps to a concern in ingredientConcerns.ts (correlation "why" lines won't fire)`,
    );

  const priceNum = Number(price);
  if (!Number.isFinite(priceNum) || priceNum <= 0 || priceNum > 500)
    errors.push(`${label}: price_usd ${price} outside (0, 500]`);

  try {
    const parsed = JSON.parse(unquote(links));
    if (!Array.isArray(parsed) || parsed.length === 0) throw new Error('empty');
    for (const l of parsed)
      if (!l.retailer || !/^https:\/\//.test(l.url ?? ''))
        errors.push(`${label}: retailer link missing retailer or non-https url`);
  } catch {
    errors.push(`${label}: retailer_links is not valid JSON`);
  }

  const st = parseSqlArray(skinTypes);
  const category = unquote(catQ);
  // Supplements apply to every skin type and use an empty array by convention.
  if (!st || !st.every((s) => SKIN_TYPES.has(s)))
    errors.push(`${label}: skin_types invalid (${skinTypes})`);
  else if (st.length === 0 && category !== 'supplement')
    errors.push(`${label}: skin_types empty (only supplements may omit them)`);
  if (!AM_PM.has(unquote(amPm))) errors.push(`${label}: am_pm '${unquote(amPm)}' invalid`);
  if (!Number.isInteger(Number(step))) errors.push(`${label}: step_order '${step}' not an int`);
}

// ── product_concerns mappings ────────────────────────────────────────────────
// Format: `insert … select … from (values ('product-slug','concern-slug',relevance,'rationale'), …) as m(…)`.
// Scan starts just inside `(values` so each row is a top-level tuple; rows are
// distinguished from column-alias lists by containing quoted strings.
const pcValues = productsSql.indexOf('(values', productsSql.indexOf('insert into public.product_concerns'));
if (pcValues === -1) {
  warnings.push('no product_concerns values block found in seed 0002');
} else {
  let mapped = 0;
  for (const tuple of splitTuples(productsSql, pcValues + '(values'.length)) {
    if (!tuple.includes("'")) continue;
    const v = splitValues(tuple);
    if (v.length < 2) continue;
    const productSlug = unquote(v[0]);
    const concernSlug = unquote(v[1]);
    if (!slugs.has(productSlug))
      errors.push(`product_concerns: unknown product slug '${productSlug}'`);
    if (!concernSlugs.has(concernSlug))
      errors.push(`product_concerns: unknown concern slug '${concernSlug}'`);
    const rel = Number(v[2]);
    if (!Number.isInteger(rel) || rel < 1 || rel > 5)
      errors.push(`product_concerns ${productSlug}→${concernSlug}: relevance '${v[2]}' outside 1–5`);
    mapped++;
  }
  if (mapped === 0) warnings.push('product_concerns values block parsed to zero rows');
  else console.log(`catalog: ${mapped} product→concern mappings`);
}

// ── Report ───────────────────────────────────────────────────────────────────
console.log(`catalog: ${slugs.size} products, ${concernSlugs.size} concerns`);
for (const w of warnings) console.warn(`WARN  ${w}`);
for (const e of errors) console.error(`ERROR ${e}`);
if (errors.length) {
  console.error(`\n${errors.length} error(s).`);
  process.exit(1);
}
console.log(`OK (${warnings.length} warning(s))`);
