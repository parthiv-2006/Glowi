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
  type CorrelationReactionLog,
  type CorrelationScan,
  type CorrelationShelfItem,
} from './correlation.ts';
import { concernsTargetedBy, normalizeIngredient } from './ingredientConcerns.ts';

const MAX_RANKED_MEMORIES = 12;

function capitalize(s: string): string {
  return s.length ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

export interface MemoryContext {
  block: string;
  usedMemoryIds: string[];
}

export async function assembleMemoryContext(
  svc: SupabaseClient,
  userId: string,
  opts: { excludeSessionId?: string } = {},
): Promise<MemoryContext> {
  const today = new Date().toISOString().slice(0, 10);
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

  if (gotchaRes.data?.length) {
    lines.push('SAFETY NOTES (always respect these):');
    for (const m of gotchaRes.data) {
      lines.push(`  ⚠ ${m.content}`);
      usedMemoryIds.push(m.id);
    }
  }

  if (rankedRes.data?.length) {
    lines.push('WHAT YOU REMEMBER ABOUT THIS USER (most important first):');
    for (const m of rankedRes.data) {
      lines.push(`  • [${m.type}] ${m.content}`);
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

  const insights = correlateScanTrends(
    (correlationScansRes.data ?? []) as CorrelationScan[],
    (correlationShelfRes.data ?? []) as CorrelationShelfItem[],
    (correlationReactionsRes.data ?? []) as CorrelationReactionLog[],
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
