/**
 * extract-memories — the write path of Glowi's memory system.
 *
 * Input:  { sessionId }
 * Effect: reads conversation turns that haven't been mined yet, asks a light
 *         model for structured memory operations (add / update / supersede),
 *         applies them, and refreshes the session summary so the next chat
 *         starts with context. Idempotent per turn via memory_extracted_until.
 * Output: { extracted, summaryUpdated }
 */
import { serve, json, HttpError } from '../_shared/http.ts';
import { serviceClient, requireUser } from '../_shared/supabase.ts';
import { callClaude, extractJson, MODELS } from '../_shared/anthropic.ts';
import { embed } from '../_shared/embeddings.ts';
import { enforceRateLimit } from '../_shared/ratelimit.ts';

const RATE_LIMIT = { max: 30, windowSeconds: 86_400 };

interface ExtractBody {
  sessionId?: string;
}

interface MemoryOp {
  op: 'add' | 'update' | 'supersede';
  id?: string;
  type: 'profile_fact' | 'preference' | 'event' | 'gotcha' | 'goal';
  content: string;
  importance: number;
}

interface ExtractResult {
  memories: MemoryOp[];
  session_summary: string;
}

const VALID_TYPES = new Set(['profile_fact', 'preference', 'event', 'gotcha', 'goal']);

serve(async (req) => {
  const { user } = await requireUser(req);
  const { sessionId } = ((await req.json().catch(() => ({}))) as ExtractBody) ?? {};
  if (!sessionId) throw new HttpError(400, 'sessionId is required');

  const svc = serviceClient();

  const { data: session } = await svc
    .from('chat_sessions')
    .select('id, memory_extracted_until')
    .eq('id', sessionId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!session) throw new HttpError(404, 'Session not found');

  const { data: messages } = await svc
    .from('chat_messages')
    .select('role, content')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });
  const all = messages ?? [];
  const fresh = all.slice(session.memory_extracted_until);
  if (fresh.length < 2) {
    return json({ extracted: 0, summaryUpdated: false });
  }

  // After the nothing-new early return, so idempotent re-calls stay free.
  await enforceRateLimit(svc, `extract-memories:${user.id}`, RATE_LIMIT.max, RATE_LIMIT.windowSeconds);

  const { data: existing } = await svc
    .from('ai_memories')
    .select('id, type, content, importance')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .order('updated_at', { ascending: false })
    .limit(40);

  const existingBlock = (existing ?? [])
    .map((m) => `${m.id} | ${m.type} | imp ${m.importance} | ${m.content}`)
    .join('\n');
  const transcript = fresh
    .map((m) => `${m.role === 'user' ? 'USER' : 'ASSISTANT'}: ${m.content}`)
    .join('\n');

  const system = `You maintain the long-term memory of a skincare assistant. From the new conversation turns, extract durable facts worth remembering across sessions. Return STRICT JSON only.

WORTH REMEMBERING: stable user facts (skin type, age range, climate, budget), preferences (textures, brands, routine complexity), significant events (started retinol, big flare-up), goals, and especially GOTCHAS — allergies, ingredients/products that caused bad reactions, medical constraints (pregnancy, prescriptions).

NOT worth remembering: small talk, one-off questions answered in full, anything already covered by an existing memory (update it instead), assistant opinions.

EXISTING MEMORIES (id | type | importance | content):
${existingBlock || '(none)'}

Return:
{
  "memories": [
    {"op":"add","type":"profile_fact|preference|event|gotcha|goal","content":"<concise standalone sentence>","importance":<1-5>},
    {"op":"update","id":"<existing id>","type":"...","content":"<refined sentence>","importance":<1-5>},
    {"op":"supersede","id":"<existing id>","type":"...","content":"<replacement sentence>","importance":<1-5>}
  ],
  "session_summary": "<2-3 sentences: what was discussed, what was decided/recommended, any open thread>"
}

Rules: gotchas get importance 5. Use "update" to refine an existing memory, "supersede" when a fact changed (old one is archived, new one created). 0-5 memory ops typical; empty array is a valid answer. Importance: 5=safety-critical, 4=shapes most advice, 3=useful, 2=nice to know, 1=marginal.`;

  let result: ExtractResult;
  try {
    const raw = await callClaude({
      model: MODELS.light,
      system,
      maxTokens: 1200,
      temperature: 0.1,
      messages: [{ role: 'user', content: `NEW TURNS:\n${transcript}` }],
    });
    result = extractJson<ExtractResult>(raw);
  } catch (err) {
    console.error('Memory extraction failed:', err);
    // Non-fatal: chat works without extraction; next session retries these turns.
    return json({ extracted: 0, summaryUpdated: false });
  }

  const existingIds = new Set((existing ?? []).map((m) => m.id));
  let applied = 0;

  for (const op of (result.memories ?? []).slice(0, 8)) {
    if (!op || !VALID_TYPES.has(op.type) || typeof op.content !== 'string' || !op.content.trim()) {
      continue;
    }
    const content = op.content.trim().slice(0, 400);
    const importance = Math.min(5, Math.max(1, Math.round(Number(op.importance) || 3)));
    // Embed at write time so semantic retrieval (ADR-0016) sees the memory
    // immediately; a null embedding is legal and self-heals on the read path.
    const vector = await embed(content);
    const embedding = vector ? JSON.stringify(vector) : null;

    if (op.op === 'add') {
      const { error } = await svc.from('ai_memories').insert({
        user_id: user.id,
        type: op.type,
        content,
        importance,
        source: 'chat',
        source_ref: sessionId,
        embedding,
      });
      if (!error) applied++;
    } else if ((op.op === 'update' || op.op === 'supersede') && op.id && existingIds.has(op.id)) {
      if (op.op === 'update') {
        const { error } = await svc
          .from('ai_memories')
          .update({ content, importance, type: op.type, embedding })
          .eq('id', op.id)
          .eq('user_id', user.id);
        if (!error) applied++;
      } else {
        const [{ error: archiveErr }, { error: insertErr }] = await Promise.all([
          svc
            .from('ai_memories')
            .update({ status: 'superseded' })
            .eq('id', op.id)
            .eq('user_id', user.id),
          svc.from('ai_memories').insert({
            user_id: user.id,
            type: op.type,
            content,
            importance,
            source: 'chat',
            source_ref: sessionId,
            embedding,
          }),
        ]);
        if (!archiveErr && !insertErr) applied++;
      }
    }
  }

  const summary =
    typeof result.session_summary === 'string' ? result.session_summary.trim().slice(0, 600) : '';
  await svc
    .from('chat_sessions')
    .update({
      memory_extracted_until: all.length,
      ...(summary ? { summary } : {}),
    })
    .eq('id', sessionId);

  return json({ extracted: applied, summaryUpdated: Boolean(summary) });
});
