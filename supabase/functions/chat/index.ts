/**
 * chat — memory-aware skincare assistant.
 *
 * Input:  { sessionId, message }
 * Effect: persists the user message, assembles cross-session memory context
 *         plus the product catalog, generates a reply, persists it (with any
 *         inline product recommendations), and touches used memories.
 * Output: { message, productRefs }
 */
import { serve, json, HttpError } from '../_shared/http.ts';
import { serviceClient, requireUser } from '../_shared/supabase.ts';
import { callClaude, MODELS } from '../_shared/anthropic.ts';
import { assembleMemoryContext, touchMemories } from '../_shared/memory.ts';

interface ChatBody {
  sessionId?: string;
  message?: string;
}

const HISTORY_LIMIT = 20;
const PRODUCTS_RE = /<products>\s*(\[[\s\S]*?\])\s*<\/products>/;

serve(async (req) => {
  const { user } = await requireUser(req);
  const body = ((await req.json().catch(() => ({}))) as ChatBody) ?? {};
  const sessionId = body.sessionId;
  const message = body.message?.trim();
  if (!sessionId) throw new HttpError(400, 'sessionId is required');
  if (!message) throw new HttpError(400, 'message is required');
  if (message.length > 4000) throw new HttpError(400, 'Message too long');

  const svc = serviceClient();

  const { data: session } = await svc
    .from('chat_sessions')
    .select('id, user_id, title')
    .eq('id', sessionId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!session) throw new HttpError(404, 'Session not found');

  await svc.from('chat_messages').insert({
    session_id: sessionId,
    user_id: user.id,
    role: 'user',
    content: message,
  });

  const [memory, historyRes, catalogRes] = await Promise.all([
    assembleMemoryContext(svc, user.id, { excludeSessionId: sessionId }),
    svc
      .from('chat_messages')
      .select('role, content')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false })
      .limit(HISTORY_LIMIT),
    svc
      .from('products')
      .select('slug, brand, name, category, price_usd, product_concerns(concern_slug)')
      .order('brand'),
  ]);

  const catalog = (catalogRes.data ?? [])
    .map((p) => {
      const concerns = (p.product_concerns ?? [])
        .map((m: { concern_slug: string }) => m.concern_slug)
        .join(',');
      return `${p.slug} | ${p.brand} ${p.name} | ${p.category} | $${p.price_usd} | ${concerns}`;
    })
    .join('\n');

  const system = `You are Glowi, a warm, evidence-minded skincare assistant inside the Glowi app.

PERSONALITY: knowledgeable friend, not a salesperson. Concise (2-5 short paragraphs max), concrete, never preachy. Use plain language; explain mechanisms briefly when helpful.

SAFETY:
- You are not a doctor; never diagnose. For severe/painful/spreading conditions, suspicious moles, or anything infected-looking, recommend a dermatologist plainly.
- Respect every SAFETY NOTE in the user context absolutely (allergies, bad reactions).
- Pregnancy/breastfeeding: no retinoids; recommend confirming actives with their OB.

USER CONTEXT (assembled from Glowi's memory system — treat as ground truth about this user):
${memory.block}

PRODUCT RECOMMENDATIONS:
- You may recommend products ONLY from the catalog below (these have vetted retailer links in-app).
- When you recommend products, append ONE block at the very end of your reply:
<products>["slug-one","slug-two"]</products>
- Maximum 3 slugs, only when genuinely relevant. Mention the products naturally in your text too (brand + name). Never invent slugs.

CATALOG (slug | product | category | price | concern tags):
${catalog}`;

  const history = (historyRes.data ?? [])
    .reverse()
    .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));
  // Anthropic requires the conversation to open with a user turn; truncation
  // at HISTORY_LIMIT can leave an assistant message first.
  while (history.length && history[0].role === 'assistant') history.shift();

  const raw = await callClaude({
    model: MODELS.primary,
    system,
    maxTokens: 1024,
    temperature: 0.7,
    messages: history.length ? history : [{ role: 'user', content: message }],
  });

  // Parse optional product block out of the visible reply.
  let productRefs: string[] = [];
  const reply = raw
    .replace(PRODUCTS_RE, (_, group: string) => {
      try {
        const slugs = JSON.parse(group);
        if (Array.isArray(slugs)) {
          productRefs = slugs.filter((s) => typeof s === 'string').slice(0, 3);
        }
      } catch {
        // Malformed block — drop it silently; the prose reply stands alone.
      }
      return '';
    })
    .trim();

  if (productRefs.length) {
    // Validate against the real catalog before persisting.
    const { data: valid } = await svc.from('products').select('slug').in('slug', productRefs);
    const validSet = new Set((valid ?? []).map((p) => p.slug));
    productRefs = productRefs.filter((s) => validSet.has(s));
  }

  await Promise.all([
    svc.from('chat_messages').insert({
      session_id: sessionId,
      user_id: user.id,
      role: 'assistant',
      content: reply,
      product_refs: productRefs,
    }),
    svc
      .from('chat_sessions')
      .update({
        last_message_at: new Date().toISOString(),
        ...(session.title === 'New conversation'
          ? { title: message.slice(0, 48) + (message.length > 48 ? '…' : '') }
          : {}),
      })
      .eq('id', sessionId),
    touchMemories(svc, memory.usedMemoryIds),
  ]);

  return json({ message: reply, productRefs });
});
