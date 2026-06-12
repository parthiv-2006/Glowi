/**
 * AI memory context assembly — the read path of Glowi's memory system.
 *
 * Every new chat (and scan interpretation) starts with durable context:
 * who the user is, what happened before, and safety-relevant gotchas.
 * See docs/MEMORY_SYSTEM.md for the full design.
 */
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

const MAX_RANKED_MEMORIES = 12;

export interface MemoryContext {
  block: string;
  usedMemoryIds: string[];
}

export async function assembleMemoryContext(
  svc: SupabaseClient,
  userId: string,
  opts: { excludeSessionId?: string } = {},
): Promise<MemoryContext> {
  const [profileRes, gotchaRes, rankedRes, scanRes, sessionRes] = await Promise.all([
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
