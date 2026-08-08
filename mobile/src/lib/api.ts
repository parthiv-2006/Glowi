/**
 * Data access layer — thin typed wrappers over Supabase queries.
 * Feature screens consume these via the react-query hooks in hooks.ts;
 * nothing in the UI talks to the `supabase` client directly.
 */
import { reactionMemoryContent } from './reactions';
import { supabase } from './supabase';
import type {
  Article,
  CaptureMeta,
  ChatMessage,
  ChatSession,
  Concern,
  AiMemory,
  GlowReport,
  LifestyleLog,
  NutritionGuide,
  Product,
  ProductForConcern,
  ReactionLog,
  Routine,
  RoutineCheckin,
  RoutineStep,
  Scan,
  ShelfItem,
  Tip,
} from './types';

function unwrap<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

// ─────────────── Catalog ───────────────

export async function getConcerns(): Promise<Concern[]> {
  return unwrap(await supabase.from('concerns').select('*').order('name'));
}

export async function getConcern(slug: string): Promise<Concern> {
  return unwrap(await supabase.from('concerns').select('*').eq('slug', slug).single());
}

export async function getProductsForConcern(slug: string): Promise<ProductForConcern[]> {
  const rows = unwrap(
    await supabase
      .from('product_concerns')
      .select('relevance, rationale, products(*)')
      .eq('concern_slug', slug)
      .order('relevance', { ascending: false }),
  ) as unknown as { relevance: number; rationale: string | null; products: Product }[];
  return rows
    .filter((r) => r.products)
    .map((r) => ({ ...r.products, relevance: r.relevance, rationale: r.rationale }));
}

export async function getProductsBySlug(slugs: string[]): Promise<Product[]> {
  if (!slugs.length) return [];
  return unwrap(await supabase.from('products').select('*').in('slug', slugs));
}

/** The full catalog — a small curated seed set, so no pagination is needed. */
export async function getCatalogProducts(): Promise<Product[]> {
  return unwrap(await supabase.from('products').select('*').order('brand').order('name'));
}

export async function getNutritionGuide(slug: string): Promise<NutritionGuide | null> {
  return unwrap(
    await supabase.from('nutrition_guides').select('*').eq('concern_slug', slug).maybeSingle(),
  );
}

export async function getTips(slug: string): Promise<Tip[]> {
  return unwrap(await supabase.from('tips').select('*').eq('concern_slug', slug));
}

export async function getArticles(): Promise<Article[]> {
  return unwrap(
    await supabase
      .from('articles')
      .select('id, slug, title, category, read_minutes, hero_gradient, excerpt, published_at')
      .order('published_at', { ascending: false }),
  ) as unknown as Article[];
}

export async function getArticle(slug: string): Promise<Article> {
  return unwrap(await supabase.from('articles').select('*').eq('slug', slug).single());
}

// ─────────────── Learn Favorites ───────────────

/** Slugs of every article the current user has bookmarked — presence is the fact. */
export async function getLearnFavoriteSlugs(): Promise<string[]> {
  const rows = unwrap(
    await supabase.from('learn_favorites').select('article_slug'),
  ) as { article_slug: string }[];
  return rows.map((r) => r.article_slug);
}

export async function addLearnFavorite(userId: string, slug: string): Promise<void> {
  const { error } = await supabase
    .from('learn_favorites')
    .upsert(
      { user_id: userId, article_slug: slug },
      { onConflict: 'user_id,article_slug', ignoreDuplicates: true },
    );
  if (error) throw new Error(error.message);
}

export async function removeLearnFavorite(slug: string): Promise<void> {
  const { error } = await supabase.from('learn_favorites').delete().eq('article_slug', slug);
  if (error) throw new Error(error.message);
}

// ─────────────── Scans ───────────────

export async function getScans(): Promise<Scan[]> {
  return unwrap(await supabase.from('scans').select('*').order('created_at', { ascending: false }));
}

export async function getScan(id: string): Promise<Scan> {
  return unwrap(await supabase.from('scans').select('*').eq('id', id).single());
}

export async function createScan(
  userId: string,
  input: { area?: string; notes?: string; captureMeta?: CaptureMeta | null },
): Promise<Scan> {
  return unwrap(
    await supabase
      .from('scans')
      .insert({
        user_id: userId,
        status: 'pending',
        area: input.area,
        notes: input.notes,
        capture_meta: input.captureMeta ?? null,
      })
      .select()
      .single(),
  );
}

export async function attachScanImage(id: string, imagePath: string): Promise<void> {
  unwrap(await supabase.from('scans').update({ image_path: imagePath }).eq('id', id).select());
}

export async function deleteScan(id: string): Promise<void> {
  const { error } = await supabase.from('scans').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

/** Signed URL for a private scan image (1h). */
export async function getScanImageUrl(imagePath: string): Promise<string | null> {
  const { data } = await supabase.storage.from('scan-images').createSignedUrl(imagePath, 3600);
  return data?.signedUrl ?? null;
}

// ─────────────── Chat ───────────────

export async function getSessions(): Promise<ChatSession[]> {
  return unwrap(
    await supabase
      .from('chat_sessions')
      .select('id, title, summary, last_message_at, created_at')
      .order('last_message_at', { ascending: false }),
  );
}

export async function createSession(userId: string): Promise<ChatSession> {
  return unwrap(await supabase.from('chat_sessions').insert({ user_id: userId }).select().single());
}

export async function getMessages(sessionId: string): Promise<ChatMessage[]> {
  return unwrap(
    await supabase
      .from('chat_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true }),
  );
}

export async function deleteSession(id: string): Promise<void> {
  const { error } = await supabase.from('chat_sessions').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// ─────────────── Memories ───────────────

export async function getMemories(): Promise<AiMemory[]> {
  return unwrap(
    await supabase
      .from('ai_memories')
      .select('id, type, content, importance, source, created_at, updated_at')
      .eq('status', 'active')
      .order('importance', { ascending: false })
      .order('updated_at', { ascending: false }),
  );
}

export async function addMemory(
  userId: string,
  m: { type: AiMemory['type']; content: string; importance: number; source?: AiMemory['source'] },
): Promise<void> {
  unwrap(
    await supabase
      .from('ai_memories')
      .insert({ user_id: userId, source: m.source ?? 'onboarding', ...m })
      .select(),
  );
}

export async function deleteMemory(id: string): Promise<void> {
  const { error } = await supabase.from('ai_memories').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// ─────────────── Routines ───────────────

export async function getRoutines(): Promise<(Routine & { steps: RoutineStep[] })[]> {
  const routines = unwrap(await supabase.from('routines').select('*')) as Routine[];
  const withSteps = await Promise.all(
    routines.map(async (r) => {
      const steps = unwrap(
        await supabase
          .from('routine_steps')
          .select('*, product:products(*)')
          .eq('routine_id', r.id)
          .order('position'),
      ) as RoutineStep[];
      return { ...r, steps };
    }),
  );
  return withSteps.sort((a) => (a.period === 'am' ? -1 : 1));
}

export async function saveRoutine(
  userId: string,
  period: 'am' | 'pm',
  scanId: string | null,
  steps: Omit<RoutineStep, 'id' | 'routine_id' | 'product'>[],
): Promise<void> {
  const routine = unwrap(
    await supabase
      .from('routines')
      .upsert(
        { user_id: userId, period, generated_from_scan: scanId },
        { onConflict: 'user_id,period' },
      )
      .select()
      .single(),
  ) as Routine;
  await supabase.from('routine_steps').delete().eq('routine_id', routine.id);
  if (steps.length) {
    unwrap(
      await supabase
        .from('routine_steps')
        .insert(steps.map((s) => ({ ...s, routine_id: routine.id, user_id: userId })))
        .select(),
    );
  }
}

export async function getCheckins(sinceISO: string): Promise<RoutineCheckin[]> {
  return unwrap(
    await supabase
      .from('routine_checkins')
      .select('id, routine_id, checkin_date')
      .gte('checkin_date', sinceISO)
      .order('checkin_date', { ascending: false }),
  );
}

export async function checkInRoutine(userId: string, routineId: string): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const { error } = await supabase
    .from('routine_checkins')
    .upsert(
      { user_id: userId, routine_id: routineId, checkin_date: today },
      { onConflict: 'user_id,routine_id,checkin_date' },
    );
  if (error) throw new Error(error.message);
}

// ─────────────── Shelf (product inventory) ───────────────

/** Editable fields when creating or updating a shelf item. */
export type ShelfItemInput = Partial<
  Pick<
    ShelfItem,
    | 'product_id'
    | 'name'
    | 'brand'
    | 'category'
    | 'key_ingredients'
    | 'image_path'
    | 'size_label'
    | 'opened_at'
    | 'shelf_life_months'
    | 'amount_remaining'
    | 'status'
    | 'notes'
    | 'price_usd'
  >
>;

const SHELF_COLS =
  'id, product_id, name, brand, category, key_ingredients, image_path, size_label, opened_at, shelf_life_months, amount_remaining, times_used, last_used_at, status, notes, price_usd, created_at, updated_at';

export async function getShelfItems(): Promise<ShelfItem[]> {
  return unwrap(
    await supabase
      .from('shelf_items')
      .select(SHELF_COLS)
      .neq('status', 'archived')
      .order('created_at', { ascending: false }),
  );
}

export async function addShelfItem(
  userId: string,
  input: ShelfItemInput & { name: string },
): Promise<ShelfItem> {
  return unwrap(
    await supabase
      .from('shelf_items')
      .insert({ user_id: userId, ...input })
      .select(SHELF_COLS)
      .single(),
  );
}

export async function updateShelfItem(id: string, patch: ShelfItemInput): Promise<ShelfItem> {
  return unwrap(
    await supabase.from('shelf_items').update(patch).eq('id', id).select(SHELF_COLS).single(),
  );
}

export async function deleteShelfItem(id: string): Promise<void> {
  const { error } = await supabase.from('shelf_items').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

/** Logs a use: bumps the counter + date and nudges the remaining amount down. */
export async function markShelfItemUsed(id: string): Promise<ShelfItem> {
  const current = unwrap(
    await supabase.from('shelf_items').select('amount_remaining, times_used').eq('id', id).single(),
  ) as Pick<ShelfItem, 'amount_remaining' | 'times_used'>;
  return unwrap(
    await supabase
      .from('shelf_items')
      .update({
        times_used: current.times_used + 1,
        last_used_at: new Date().toISOString().slice(0, 10),
        amount_remaining: Math.max(0, current.amount_remaining - 2),
      })
      .eq('id', id)
      .select(SHELF_COLS)
      .single(),
  );
}

/** Uploads a product photo to the private bucket under {user}/shelf/{item}.jpg. */
export async function uploadShelfImage(
  userId: string,
  itemId: string,
  uri: string,
): Promise<string> {
  const path = `${userId}/shelf/${itemId}.jpg`;
  const arrayBuffer = await fetch(uri).then((r) => r.arrayBuffer());
  const { error } = await supabase.storage
    .from('scan-images')
    .upload(path, arrayBuffer, { contentType: 'image/jpeg', upsert: true });
  if (error) throw new Error(error.message);
  return path;
}

/** Signed URL for a private product image (1h). */
export async function getShelfImageUrl(imagePath: string): Promise<string | null> {
  const { data } = await supabase.storage.from('scan-images').createSignedUrl(imagePath, 3600);
  return data?.signedUrl ?? null;
}

// ─────────────── Reaction Log ───────────────

/** Editable fields when logging a reaction. */
export type ReactionLogInput = Pick<
  ReactionLog,
  'product_name' | 'reacted_on' | 'symptoms' | 'severity'
> &
  Partial<Pick<ReactionLog, 'shelf_item_id' | 'brand' | 'key_ingredients' | 'notes'>>;

export async function getReactionLogs(): Promise<ReactionLog[]> {
  return unwrap(
    await supabase
      .from('reaction_logs')
      .select('*')
      .order('reacted_on', { ascending: false })
      .order('created_at', { ascending: false }),
  );
}

/**
 * Logs a reaction and writes the matching 'gotcha' memory in the same call,
 * so the coach and Skin Weather inherit the constraint immediately.
 */
export async function addReactionLog(
  userId: string,
  input: ReactionLogInput,
): Promise<ReactionLog> {
  const log = unwrap(
    await supabase
      .from('reaction_logs')
      .insert({ user_id: userId, ...input })
      .select()
      .single(),
  ) as ReactionLog;
  await supabase.from('ai_memories').insert({
    user_id: userId,
    type: 'gotcha',
    content: reactionMemoryContent(log),
    importance: 5,
    source: 'system',
    source_ref: log.id,
  });
  return log;
}

export async function deleteReactionLog(id: string): Promise<void> {
  const { error } = await supabase.from('reaction_logs').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// ─────────────── Lifestyle Diary ───────────────

const LIFESTYLE_COLS =
  'id, log_date, sleep_quality, stress_level, water_level, diet_dairy, diet_sugar, diet_alcohol, cycle_phase, created_at, updated_at';

/** A day's check-in write — always carries the target date plus the fields to set. */
export type LifestyleLogInput = Pick<LifestyleLog, 'log_date'> &
  Partial<
    Pick<
      LifestyleLog,
      | 'sleep_quality'
      | 'stress_level'
      | 'water_level'
      | 'diet_dairy'
      | 'diet_sugar'
      | 'diet_alcohol'
      | 'cycle_phase'
    >
  >;

export async function getLifestyleLogs(sinceISO: string): Promise<LifestyleLog[]> {
  return unwrap(
    await supabase
      .from('lifestyle_logs')
      .select(LIFESTYLE_COLS)
      .gte('log_date', sinceISO)
      .order('log_date', { ascending: false }),
  );
}

/** Insert-or-replace a day's row, keyed on (user_id, log_date). */
export async function upsertLifestyleLog(
  userId: string,
  log: LifestyleLogInput,
): Promise<LifestyleLog> {
  return unwrap(
    await supabase
      .from('lifestyle_logs')
      .upsert({ user_id: userId, ...log }, { onConflict: 'user_id,log_date' })
      .select(LIFESTYLE_COLS)
      .single(),
  );
}

// ─────────────── Push tokens ───────────────

/** Registers or refreshes this device's Expo push token (unique on token). */
export async function upsertPushToken(
  userId: string,
  token: string,
  platform: 'ios' | 'android',
): Promise<void> {
  const { error } = await supabase
    .from('push_tokens')
    .upsert({ user_id: userId, token, platform }, { onConflict: 'token' });
  if (error) throw new Error(error.message);
}

// ─────────────── Data export (raw rows, RLS-scoped) ───────────────

/**
 * Raw own-rows reads for the GDPR data export (lib/dataExport.ts). Returned
 * untyped on purpose: the export ships the stored shape verbatim rather than
 * the app's view of it.
 */
export async function getExportRows(
  table:
    | 'skin_forecasts'
    | 'scan_comparisons'
    | 'conflict_reports'
    | 'reminder_settings'
    | 'push_tokens'
    | 'ai_memories'
    | 'lifestyle_logs'
    | 'routine_checkins'
    | 'chat_messages',
): Promise<Record<string, unknown>[]> {
  return unwrap(await supabase.from(table).select('*'));
}

// ─────────────── Weekly Glow Reports ───────────────

/**
 * Past Glow Reports, newest week first. Reads the immutable `glow_reports`
 * cache directly — generation stays with the AIProvider (`useGlowReport`);
 * this only lists what already exists.
 */
export async function listGlowReports(limit = 12): Promise<GlowReport[]> {
  return unwrap(
    await supabase
      .from('glow_reports')
      .select('id, week_start, content, created_at')
      .order('week_start', { ascending: false })
      .limit(limit),
  );
}
