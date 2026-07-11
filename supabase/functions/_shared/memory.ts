/**
 * AI memory context assembly — the read path of Glowi's memory system.
 *
 * Every new chat (and scan interpretation) starts with durable context:
 * who the user is, what happened before, and safety-relevant gotchas.
 * See docs/MEMORY_SYSTEM.md for the full design.
 */
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import {
  correlateScanTrends,
  type CorrelationLifestyleLog,
  type CorrelationReactionLog,
  type CorrelationScan,
  type CorrelationShelfItem,
} from './correlation.ts';
import { concernsTargetedBy, normalizeIngredient } from './ingredientConcerns.ts';
import { embed } from './embeddings.ts';

const MAX_RANKED_MEMORIES = 12;

/** A ranked memory row — importance/recency and semantic paths share this shape. */
interface RankedMemory {
  id: string;
  type: string;
  content: string;
  importance: number;
}

/**
 * Cosine-nearest active memories for a query (the user's chat message), via
 * the match_memories RPC (ADR-0016). Self-heals rows that predate the
 * embedding column before ranking. Returns null whenever anything is missing
 * (no embedder, RPC absent, nothing embedded) so the caller falls back to
 * importance/recency ranking — semantic retrieval is an upgrade, never a
 * dependency.
 */
async function semanticMemories(
  svc: SupabaseClient,
  userId: string,
  queryText: string,
): Promise<RankedMemory[] | null> {
  const queryVec = await embed(queryText);
  if (!queryVec) return null;

  const { data: missing } = await svc
    .from('ai_memories')
    .select('id, content')
    .eq('user_id', userId)
    .eq('status', 'active')
    .neq('type', 'gotcha')
    .is('embedding', null)
    .limit(40);
  for (const row of missing ?? []) {
    const vec = await embed(row.content);
    if (vec) {
      await svc
        .from('ai_memories')
        .update({ embedding: JSON.stringify(vec) })
        .eq('id', row.id);
    }
  }

  const { data, error } = await svc.rpc('match_memories', {
    p_user_id: userId,
    p_query: JSON.stringify(queryVec),
    p_limit: MAX_RANKED_MEMORIES,
  });
  if (error) {
    console.error('match_memories failed:', error.message);
    return null;
  }
  return data?.length ? (data as RankedMemory[]) : null;
}

function capitalize(s: string): string {
  return s.length ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

/** Fetched lifestyle row — the correlation shape plus cycle phase (context only). */
type LifestyleRow = CorrelationLifestyleLog & { cycle_phase: string | null };

/** Bucket a 0–2 average into low/mid/high labels by thirds. */
function band(avg: number, labels: [string, string, string]): string {
  if (avg < 2 / 3) return labels[0];
  if (avg < 4 / 3) return labels[1];
  return labels[2];
}

/**
 * Compact two-week lifestyle recap for the coach — logged-day count, sleep/stress
 * tendencies, diet-flag frequencies, and the current cycle phase when present.
 * Returns '' when nothing was logged, so new users pay zero tokens.
 */
function summarizeLifestyle(logs: LifestyleRow[]): string {
  const n = logs.length;
  if (n === 0) return '';
  const avg = (vals: number[]) => vals.reduce((a, b) => a + b, 0) / vals.length;
  const answered = (pick: (l: LifestyleRow) => number | null) =>
    logs.map(pick).filter((v): v is number => v != null);

  const parts: string[] = [];
  const sleep = answered((l) => l.sleep_quality);
  if (sleep.length) parts.push(`sleep ${band(avg(sleep), ['mostly poor', 'mixed', 'mostly good'])}`);
  const stress = answered((l) => l.stress_level);
  if (stress.length)
    parts.push(`stress ${band(avg(stress), ['mostly low', 'moderate', 'mostly high'])}`);
  const dairy = logs.filter((l) => l.diet_dairy).length;
  if (dairy) parts.push(`dairy flagged ${dairy} of ${n} days`);
  const sugar = logs.filter((l) => l.diet_sugar).length;
  if (sugar) parts.push(`sugar flagged ${sugar} of ${n} days`);
  const alcohol = logs.filter((l) => l.diet_alcohol).length;
  if (alcohol) parts.push(`alcohol flagged ${alcohol} of ${n} days`);

  const cyclePhase = logs[0]?.cycle_phase; // logs are newest-first
  const cycle = cyclePhase ? ` Current cycle phase: ${cyclePhase}.` : '';
  const body = parts.length ? `: ${parts.join('; ')}` : '';
  return `LIFESTYLE (last 2 weeks, logged ${n} of 14 days)${body}.${cycle}`;
}

export interface MemoryContext {
  block: string;
  usedMemoryIds: string[];
}

export async function assembleMemoryContext(
  svc: SupabaseClient,
  userId: string,
  opts: { excludeSessionId?: string; queryText?: string } = {},
): Promise<MemoryContext> {
  const today = new Date().toISOString().slice(0, 10);
  const twoWeeksAgo = new Date(Date.now() - 14 * 86_400_000).toISOString().slice(0, 10);
  const [
    profileRes,
    gotchaRes,
    rankedRes,
    scanRes,
    sessionRes,
    forecastRes,
    shelfRes,
    correlationScansRes,
    correlationShelfRes,
    correlationReactionsRes,
    lifestyleRes,
  ] = await Promise.all([
    svc.from('profiles').select('display_name, skin_type, goals').eq('id', userId).maybeSingle(),
    // Gotchas (allergies, bad reactions) are safety-relevant: always included.
    svc
      .from('ai_memories')
      .select('id, content')
      .eq('user_id', userId)
      .eq('status', 'active')
      .eq('type', 'gotcha'),
    svc
      .from('ai_memories')
      .select('id, type, content, importance')
      .eq('user_id', userId)
      .eq('status', 'active')
      .neq('type', 'gotcha')
      .order('importance', { ascending: false })
      .order('last_accessed_at', { ascending: false })
      .limit(MAX_RANKED_MEMORIES),
    svc
      .from('scans')
      .select('skin_score, skin_type_estimate, summary, concerns, created_at')
      .eq('user_id', userId)
      .eq('status', 'complete')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    (() => {
      let q = svc
        .from('chat_sessions')
        .select('summary, last_message_at')
        .eq('user_id', userId)
        .not('summary', 'is', null)
        .order('last_message_at', { ascending: false })
        .limit(1);
      if (opts.excludeSessionId) q = q.neq('id', opts.excludeSessionId);
      return q.maybeSingle();
    })(),
    svc
      .from('skin_forecasts')
      .select('headline, summary, location_label')
      .eq('user_id', userId)
      .eq('forecast_date', today)
      .maybeSingle(),
    svc
      .from('shelf_items')
      .select('name, brand, category, amount_remaining')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(20),
    svc
      .from('scans')
      .select('created_at, skin_score, concerns, status')
      .eq('user_id', userId)
      .eq('status', 'complete')
      .order('created_at', { ascending: true }),
    svc
      .from('shelf_items')
      .select('created_at, name, key_ingredients')
      .eq('user_id', userId)
      .eq('status', 'active'),
    svc
      .from('reaction_logs')
      .select('reacted_on, product_name, key_ingredients')
      .eq('user_id', userId),
    svc
      .from('lifestyle_logs')
      .select(
        'log_date, sleep_quality, stress_level, diet_dairy, diet_sugar, diet_alcohol, cycle_phase',
      )
      .eq('user_id', userId)
      .gte('log_date', twoWeeksAgo)
      .order('log_date', { ascending: false }),
  ]);

  const lines: string[] = [];
  const usedMemoryIds: string[] = [];

  const profile = profileRes.data;
  if (profile) {
    const bits: string[] = [];
    if (profile.display_name) bits.push(`name: ${profile.display_name}`);
    if (profile.skin_type) bits.push(`self-reported skin type: ${profile.skin_type}`);
    if (profile.goals?.length) bits.push(`goals: ${profile.goals.join(', ')}`);
    if (bits.length) lines.push(`PROFILE — ${bits.join('; ')}`);
  }

  // Memory contents are model-extracted from user-typed text (ADR-0020):
  // cap each at assembly so a single stored memory can't dominate the prompt.
  const MAX_MEMORY_CHARS = 400;

  if (gotchaRes.data?.length) {
    lines.push('SAFETY NOTES (always respect these):');
    for (const m of gotchaRes.data) {
      lines.push(`  ⚠ ${String(m.content).slice(0, MAX_MEMORY_CHARS)}`);
      usedMemoryIds.push(m.id);
    }
  }

  // Semantic retrieval when there's a query to match against (chat); the
  // importance/recency list stays the ranking everywhere else and the
  // fallback whenever embeddings are unavailable.
  let ranked = (rankedRes.data ?? []) as RankedMemory[];
  let rankedLabel = 'most important first';
  if (opts.queryText) {
    const semantic = await semanticMemories(svc, userId, opts.queryText);
    if (semantic) {
      ranked = semantic;
      rankedLabel = 'most relevant to their message first';
    }
  }
  if (ranked.length) {
    lines.push(`WHAT YOU REMEMBER ABOUT THIS USER (${rankedLabel}):`);
    for (const m of ranked) {
      lines.push(`  • [${m.type}] ${String(m.content).slice(0, MAX_MEMORY_CHARS)}`);
      usedMemoryIds.push(m.id);
    }
  }

  const scan = scanRes.data;
  if (scan) {
    const concerns = Array.isArray(scan.concerns)
      ? scan.concerns
          .map((c: { display_name?: string; severity?: number }) =>
            c.display_name ? `${c.display_name} (${c.severity ?? '?'}/100)` : null,
          )
          .filter(Boolean)
          .join(', ')
      : '';
    lines.push(
      `LATEST SKIN SCAN (${new Date(scan.created_at).toDateString()}) — score ${scan.skin_score}/100` +
        (scan.skin_type_estimate ? `, est. type ${scan.skin_type_estimate}` : '') +
        (concerns ? `. Concerns: ${concerns}` : '') +
        (scan.summary ? `. Summary: ${scan.summary}` : ''),
    );
  }

  if (sessionRes.data?.summary) {
    lines.push(`LAST CONVERSATION SUMMARY: ${sessionRes.data.summary}`);
  }

  const forecast = forecastRes.data;
  if (forecast?.headline) {
    lines.push(
      `TODAY'S SKIN WEATHER (${forecast.location_label}) — ${forecast.headline}` +
        (forecast.summary ? `. ${forecast.summary}` : ''),
    );
  }

  if (shelfRes.data?.length) {
    const items = shelfRes.data
      .map(
        (s: {
          name: string;
          brand: string | null;
          category: string | null;
          amount_remaining: number;
        }) => {
          const label = [s.brand, s.name].filter(Boolean).join(' ');
          const low = s.amount_remaining <= 20 ? ', running low' : '';
          return `${label} (${s.category ?? 'product'}${low})`;
        },
      )
      .join('; ');
    lines.push(`PRODUCTS ON THEIR SHELF (recommend what they own): ${items}`);
  }

  const lifestyleLogs = (lifestyleRes.data ?? []) as LifestyleRow[];
  const lifestyleBlock = summarizeLifestyle(lifestyleLogs);
  if (lifestyleBlock) lines.push(lifestyleBlock);

  const insights = correlateScanTrends(
    (correlationScansRes.data ?? []) as CorrelationScan[],
    (correlationShelfRes.data ?? []) as CorrelationShelfItem[],
    (correlationReactionsRes.data ?? []) as CorrelationReactionLog[],
    lifestyleLogs,
  );
  if (insights.length > 0) {
    lines.push(
      'ROUTINE CORRELATIONS (measured from their scan history — correlations, not proof):',
    );
    for (const insight of insights) {
      const top = insight.concernDeltas[0];
      const matchedIngredient = top
        ? insight.event.key_ingredients.find((ing) => concernsTargetedBy([ing]).includes(top.slug))
        : undefined;
      const why =
        top && matchedIngredient
          ? ` ${capitalize(normalizeIngredient(matchedIngredient))} targets ${top.name.toLowerCase()}.`
          : '';
      lines.push(
        `  • ${insight.event.label} (${insight.event.date.slice(0, 10)}): ${insight.headline}${why}`,
      );
    }
    lines.push(
      '  ↳ Use these to explain what seems to be working or not; always keep the correlation caveat.',
    );
  }

  return {
    block: lines.length ? lines.join('\n') : 'No prior context — this is a new user.',
    usedMemoryIds,
  };
}

/** Bump last_accessed_at so recently used memories rank higher next time. */
export async function touchMemories(svc: SupabaseClient, ids: string[]): Promise<void> {
  if (!ids.length) return;
  await svc
    .from('ai_memories')
    .update({ last_accessed_at: new Date().toISOString() })
    .in('id', ids);
}
