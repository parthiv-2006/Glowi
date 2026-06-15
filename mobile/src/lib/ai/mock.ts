/**
 * Mock provider — a realistic on-device AI simulator.
 *
 * Makes the entire app work with zero network AI calls and zero API cost:
 * scans resolve to plausible, slowly-improving results (so Progress trends
 * look alive), chat answers from a keyword-matched script with real product
 * recommendations, and memory extraction runs a small heuristic so the
 * memory system is demonstrable offline. Persistence goes through the same
 * Supabase tables as live mode, so every downstream screen behaves
 * identically. See docs/adr/0003.
 */
import { supabase } from '../supabase';
import type {
  ProductCategory,
  ProductIdentification,
  Scan,
  ScanConcern,
  SkinForecast,
  SkinType,
} from '../types';
import type {
  AIProvider,
  AnalyzeScanInput,
  ChatInput,
  ChatResult,
  ExtractResult,
  IdentifyProductInput,
  SkinForecastInput,
} from './types';
import { DEFAULT_LOCATION, deriveForecast, synthesizeEnvironment } from './forecast';

/** Plausible label reads for offline Shelf demos — rotate per add. */
const MOCK_IDENTIFICATIONS: Omit<
  ProductIdentification,
  'not_product' | 'reject_reason' | 'confidence'
>[] = [
  {
    name: 'Moisturizing Cream',
    brand: 'CeraVe',
    category: 'moisturizer',
    key_ingredients: ['ceramides', 'hyaluronic acid'],
    shelf_life_months: 12,
    matched_slug: 'cerave-moisturizing-cream',
  },
  {
    name: 'UV Clear SPF 46',
    brand: 'EltaMD',
    category: 'spf',
    key_ingredients: ['zinc oxide', 'niacinamide'],
    shelf_life_months: 12,
    matched_slug: 'eltamd-uv-clear',
  },
  {
    name: '2% BHA Liquid Exfoliant',
    brand: "Paula's Choice",
    category: 'exfoliant',
    key_ingredients: ['salicylic acid'],
    shelf_life_months: 12,
    matched_slug: 'paulas-choice-2-bha',
  },
  {
    name: 'Hyaluronic Acid 2% + B5',
    brand: 'The Ordinary',
    category: 'serum',
    key_ingredients: ['hyaluronic acid', 'vitamin b5'],
    shelf_life_months: 6,
    matched_slug: 'to-hyaluronic',
  },
];

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Scan scenarios rotate by scan count; scores drift upward on repeat scans. */
const SCENARIOS: { summary: string; type: Scan['skin_type_estimate']; concerns: ScanConcern[] }[] =
  [
    {
      summary:
        'Your skin looks fundamentally healthy, with congestion concentrated around the nose and some mild breakout activity on the chin. The texture elsewhere reflects good hydration — targeted pore care and consistent cleansing should move things quickly.',
      type: 'combination',
      concerns: [
        {
          concern_slug: 'blackheads-congestion',
          display_name: 'Congestion around the nose',
          severity: 52,
          confidence: 0.91,
          areas: ['nose', 'inner cheeks'],
          observations:
            'Clustered open comedones across the nostril creases with mild surrounding texture.',
          caution: null,
        },
        {
          concern_slug: 'acne',
          display_name: 'Mild breakouts on the chin',
          severity: 38,
          confidence: 0.84,
          areas: ['chin'],
          observations: 'A few small inflamed papules along the chin line, no cystic involvement.',
          caution: null,
        },
        {
          concern_slug: 'enlarged-pores',
          display_name: 'Visible pores in the T-zone',
          severity: 41,
          confidence: 0.78,
          areas: ['nose', 'forehead'],
          observations: 'Pore visibility consistent with combination-type oil distribution.',
          caution: null,
        },
      ],
    },
    {
      summary:
        'Noticeable progress — congestion is clearing and inflammation is down. The main opportunities now are evening out tone where older breakouts left marks, and restoring glow with gentle exfoliation.',
      type: 'combination',
      concerns: [
        {
          concern_slug: 'hyperpigmentation',
          display_name: 'Post-breakout marks',
          severity: 44,
          confidence: 0.87,
          areas: ['chin', 'cheeks'],
          observations: 'Flat brownish macules where previous blemishes resolved — classic PIH.',
          caution: null,
        },
        {
          concern_slug: 'blackheads-congestion',
          display_name: 'Residual nose congestion',
          severity: 33,
          confidence: 0.88,
          areas: ['nose'],
          observations:
            'Markedly fewer comedones than typical baseline; mostly sebaceous filaments.',
          caution: null,
        },
        {
          concern_slug: 'dullness',
          display_name: 'Mild surface dullness',
          severity: 36,
          confidence: 0.74,
          areas: ['cheeks', 'forehead'],
          observations: 'Slightly uneven light reflection suggesting dead-cell buildup.',
          caution: null,
        },
      ],
    },
    {
      summary:
        'Strong, settled skin this scan. Tone is more even, congestion is minimal, and what remains is maintenance: hydration depth and protecting the progress with daily SPF.',
      type: 'normal',
      concerns: [
        {
          concern_slug: 'dryness',
          display_name: 'Mild dehydration on the cheeks',
          severity: 28,
          confidence: 0.8,
          areas: ['cheeks'],
          observations: 'Fine surface lines that read as dehydration rather than structural.',
          caution: null,
        },
        {
          concern_slug: 'hyperpigmentation',
          display_name: 'Fading post-breakout marks',
          severity: 26,
          confidence: 0.85,
          areas: ['chin'],
          observations: 'Previous marks visibly lighter; consistent with healthy turnover.',
          caution: null,
        },
      ],
    },
  ];

const BASE_SCORES = [68, 74, 81];

function pickScenario(scanIndex: number) {
  const i = Math.min(scanIndex, SCENARIOS.length - 1);
  return { scenario: SCENARIOS[i], score: BASE_SCORES[i] + (scanIndex % 3) };
}

/** Keyword-routed chat script with real seeded product slugs. */
const CHAT_SCRIPT: { match: RegExp; reply: string; products?: string[] }[] = [
  {
    match: /acne|breakout|pimple|zit/i,
    reply:
      "For active breakouts, the evidence points to a simple two-step attack: adapalene (Differin) at night to stop new clogs from forming, and a hydrocolloid patch on anything that's already surfaced — it flattens the spot overnight and stops you from picking.\n\nGive adapalene 8–12 weeks; the first month can look worse before it looks better, and that's expected adaptation, not failure. Keep the rest of your routine boring while it works.",
    products: ['differin-gel', 'mighty-patch'],
  },
  {
    match: /blackhead|congestion|clogged|pores?/i,
    reply:
      "Blackheads respond to one ingredient class above all: salicylic acid. It's oil-soluble, so it gets *inside* the pore and dissolves the blockage instead of just polishing the surface.\n\nPaula's Choice 2% BHA is the benchmark — start two nights a week and build to nightly. Expect 4–8 weeks for visible change. And skip the pore strips: satisfying for a day, irritating for a week.",
    products: ['paulas-choice-2-bha', 'to-niacinamide'],
  },
  {
    match: /dry|flak|tight|dehydrat/i,
    reply:
      'Tightness after cleansing usually means two things: your cleanser is too stripping, and your moisturizer needs a humectant layer underneath.\n\nTry this order tonight — cleanse with something non-foaming, apply hyaluronic acid on *damp* skin (that part matters; it needs water to pull in), then seal with a ceramide cream within a minute. Most people feel the difference by morning.',
    products: ['to-hyaluronic', 'cerave-moisturizing-cream'],
  },
  {
    match: /sunscreen|spf|sun\b/i,
    reply:
      "Daily SPF is the single highest-return product in skincare — the landmark Australian trial showed daily users had no detectable skin aging over 4.5 years.\n\nThe trick is finding one you don't resent wearing. For oily or breakout-prone skin, EltaMD UV Clear is the dermatologist favorite; if you want something invisible under makeup, Supergoop Unseen feels like a primer. A quarter-teaspoon for the face, every morning, even cloudy ones.",
    products: ['eltamd-uv-clear', 'supergoop-unseen'],
  },
  {
    match: /dark spot|hyperpig|mark|even.*tone|melasma/i,
    reply:
      "Dark spots are a patience game — pigment sits deep and turns over slowly. The proven stack: vitamin C in the morning (brightens + blocks new pigment), azelaic acid or alpha arbutin at night (tyrosinase inhibitors), and SPF every single day — without sunscreen the other two are bailing water with the drain open.\n\nJudge progress at 8–12 weeks with photos, not the mirror. The mirror lies daily; photos don't.",
    products: ['to-alpha-arbutin', 'good-molecules-discoloration'],
  },
  {
    match: /wrinkle|fine line|aging|anti.?age|retinol/i,
    reply:
      "Two products carry essentially all the anti-aging evidence: retinoids and sunscreen. Everything else is supporting cast.\n\nIf you're new to retinoids, start with a buffered retinol twice a week at night, moisturizer first, and add nights slowly. The INKEY List's version is a forgiving entry point. Expect real change at the 3–6 month mark — collagen remodeling is slow biology, and there's no shortcut through it.",
    products: ['inkey-retinol', 'lrp-anthelios-milk'],
  },
  {
    match: /red|rosacea|flush|sensitive|sting/i,
    reply:
      "Reactive, flush-prone skin wants two things: fewer variables and azelaic acid. It's one of the rare actives that's both effective on redness and genuinely gentle.\n\nStrip your routine to a fragrance-free cleanser, a ceramide moisturizer, and mineral SPF, then add azelaic acid at night once skin feels calm. Also worth tracking: heat, alcohol, and spicy food are the three most-reported flush triggers — two weeks of notes usually finds yours.",
    products: ['to-azelaic', 'lrp-toleriane-double-repair'],
  },
  {
    match: /routine|order|layer|steps?/i,
    reply:
      "The complete, evidence-supported routine is shorter than social media wants you to believe:\n\n**AM:** gentle cleanse → vitamin C (optional) → moisturizer → SPF\n**PM:** cleanse → your one workhorse active (retinoid *or* exfoliating acid, not both) → moisturizer\n\nThat's it. Four to five products. Add anything new one at a time, two weeks apart, so when something goes wrong you know exactly what did it. Consistency with a modest routine beats sporadic ambition every time.",
  },
  {
    match: /diet|food|eat|nutrition/i,
    reply:
      "The diet-skin links with real trial evidence: low-glycemic eating reduces acne (insulin drives oil production), omega-3s calm inflammatory lesions, and carotenoid-rich produce literally improves your skin tone within six weeks.\n\nThe practical version: swap refined carbs for whole-food versions, eat fatty fish twice a week, and keep colorful vegetables in most meals. Skin responds on a 8–12 week timescale — it's a quarter-long experiment, not a weekend one.",
  },
];

const FALLBACK_REPLY =
  "Happy to help with that. For context — I can analyze your scans, build routines around what they find, recommend specific products with links, and dig into the nutrition side of any skin concern.\n\nIf you want the fastest path: run a scan from the home screen and I'll have much more specific things to say about *your* skin.";

async function requireUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error('Not signed in');
  return data.user.id;
}

export const mockProvider: AIProvider = {
  mode: 'mock',

  async analyzeScan({ scanId }: AnalyzeScanInput): Promise<Scan> {
    const userId = await requireUserId();

    // Theater pacing: resolve after the scanning choreography has had its moment.
    await wait(5200 + Math.random() * 1200);

    const { count } = await supabase
      .from('scans')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'complete');
    const { scenario, score } = pickScenario(count ?? 0);

    const update = {
      status: 'complete' as const,
      skin_score: score,
      skin_type_estimate: scenario.type,
      summary: scenario.summary,
      concerns: scenario.concerns,
    };
    const { data, error } = await supabase
      .from('scans')
      .update(update)
      .eq('id', scanId)
      .select()
      .single();
    if (error) throw new Error(error.message);

    const top = scenario.concerns
      .slice(0, 3)
      .map((c) => `${c.display_name} (severity ${c.severity}/100)`)
      .join(', ');
    await supabase.from('ai_memories').insert({
      user_id: userId,
      type: 'event',
      content: `Skin scan on ${new Date().toDateString()}: overall score ${score}/100. Top concerns: ${top}.`,
      importance: 4,
      source: 'scan',
      source_ref: scanId,
    });

    return data as Scan;
  },

  async chat({ sessionId, message }: ChatInput): Promise<ChatResult> {
    const userId = await requireUserId();

    await supabase.from('chat_messages').insert({
      session_id: sessionId,
      user_id: userId,
      role: 'user',
      content: message,
    });

    await wait(1100 + Math.random() * 1300);

    const hit = CHAT_SCRIPT.find((s) => s.match.test(message));
    const reply = hit?.reply ?? FALLBACK_REPLY;
    const productRefs = hit?.products ?? [];

    await Promise.all([
      supabase.from('chat_messages').insert({
        session_id: sessionId,
        user_id: userId,
        role: 'assistant',
        content: reply,
        product_refs: productRefs,
      }),
      supabase
        .from('chat_sessions')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', sessionId),
    ]);

    // First user turn names the session, same heuristic as live.
    const { data: session } = await supabase
      .from('chat_sessions')
      .select('title')
      .eq('id', sessionId)
      .single();
    if (session?.title === 'New conversation') {
      await supabase
        .from('chat_sessions')
        .update({ title: message.slice(0, 48) + (message.length > 48 ? '…' : '') })
        .eq('id', sessionId);
    }

    return { message: reply, productRefs };
  },

  async skinForecast(input: SkinForecastInput = {}): Promise<SkinForecast> {
    const userId = await requireUserId();
    const today = new Date().toISOString().slice(0, 10);

    if (!input.refresh) {
      const { data: existing } = await supabase
        .from('skin_forecasts')
        .select('*')
        .eq('forecast_date', today)
        .maybeSingle();
      if (existing) return existing as SkinForecast;
    }

    await wait(700 + Math.random() * 600);

    // Personalize against the most recent completed scan, mirroring how the
    // live provider grounds the forecast in the memory system.
    const { data: latestScan } = await supabase
      .from('scans')
      .select('skin_type_estimate, concerns')
      .eq('status', 'complete')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // The forecast routes through what the user owns (The Shelf).
    const { data: shelf } = await supabase
      .from('shelf_items')
      .select('name, brand, category')
      .eq('status', 'active');
    const owned = (shelf ?? []).map((s) => ({
      category: s.category as ProductCategory | null,
      label: [s.brand, s.name].filter(Boolean).join(' ').trim() || (s.name as string),
    }));

    const concerns = (latestScan?.concerns ?? []) as ScanConcern[];
    const env = synthesizeEnvironment(new Date());
    const { headline, summary, guidance } = deriveForecast(env, {
      skinType: (latestScan?.skin_type_estimate as SkinType | null) ?? null,
      topConcern: concerns[0]?.display_name ?? null,
      owned,
    });

    const row = {
      user_id: userId,
      forecast_date: today,
      location_label: input.locationLabel ?? DEFAULT_LOCATION.label,
      environment: env,
      headline,
      summary,
      guidance,
    };
    const { data, error } = await supabase
      .from('skin_forecasts')
      .upsert(row, { onConflict: 'user_id,forecast_date' })
      .select()
      .single();
    if (error) throw new Error(error.message);

    return data as SkinForecast;
  },

  async identifyProduct(_input: IdentifyProductInput): Promise<ProductIdentification> {
    await requireUserId();
    await wait(1400 + Math.random() * 900);

    // Rotate through plausible products by current shelf size, so repeated adds
    // in a demo surface different items.
    const { count } = await supabase
      .from('shelf_items')
      .select('id', { count: 'exact', head: true });
    const pick = MOCK_IDENTIFICATIONS[(count ?? 0) % MOCK_IDENTIFICATIONS.length];

    return { ...pick, not_product: false, reject_reason: null, confidence: 0.92 };
  },

  async extractMemories(sessionId: string): Promise<ExtractResult> {
    const userId = await requireUserId();

    const { data: session } = await supabase
      .from('chat_sessions')
      .select('memory_extracted_until')
      .eq('id', sessionId)
      .single();
    const { data: messages } = await supabase
      .from('chat_messages')
      .select('role, content')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });
    const all = messages ?? [];
    const fresh = all.slice(session?.memory_extracted_until ?? 0);
    if (fresh.length < 2) return { extracted: 0, summaryUpdated: false };

    // Heuristic extraction — enough to demonstrate the memory system offline.
    const rules: {
      match: RegExp;
      build: (m: string) => { type: string; content: string; importance: number };
    }[] = [
      {
        match: /allergic to ([\w\s-]+)|(\b[\w-]+) (?:broke me out|made me break ?out|irritated)/i,
        build: (m) => ({
          type: 'gotcha',
          content: `User reported a bad reaction: "${m.trim().slice(0, 120)}"`,
          importance: 5,
        }),
      },
      {
        match: /my skin is (very |really )?(dry|oily|sensitive|combination|normal)/i,
        build: (m) => ({
          type: 'profile_fact',
          content: `User describes their skin as ${/dry|oily|sensitive|combination|normal/i.exec(m)?.[0].toLowerCase()}.`,
          importance: 4,
        }),
      },
      {
        match: /i (?:want|wish|hope|'m trying) to ([^.!?\n]{4,80})/i,
        build: (m) => ({
          type: 'goal',
          content: `Goal: ${/to ([^.!?\n]{4,80})/i.exec(m)?.[1]?.trim() ?? m.slice(0, 80)}.`,
          importance: 3,
        }),
      },
      {
        match: /i (?:use|started|bought|tried) ([^.!?\n]{3,80})/i,
        build: (m) => ({
          type: 'event',
          content: `Mentioned using/trying: ${/(?:use|started|bought|tried) ([^.!?\n]{3,80})/i.exec(m)?.[1]?.trim() ?? m.slice(0, 80)}.`,
          importance: 3,
        }),
      },
    ];

    let extracted = 0;
    for (const msg of fresh.filter((m) => m.role === 'user')) {
      for (const rule of rules) {
        const match = rule.match.exec(msg.content);
        if (match) {
          const memory = rule.build(msg.content);
          const { error } = await supabase.from('ai_memories').insert({
            user_id: userId,
            source: 'chat',
            source_ref: sessionId,
            ...memory,
          });
          if (!error) extracted++;
          break;
        }
      }
    }

    const topics = fresh
      .filter((m) => m.role === 'user')
      .map((m) => m.content.slice(0, 60))
      .slice(0, 2)
      .join('; ');
    const summary = `Discussed: ${topics || 'general skincare questions'}. ${
      extracted ? 'Noted new facts for memory.' : ''
    }`.trim();

    await supabase
      .from('chat_sessions')
      .update({ memory_extracted_until: all.length, summary })
      .eq('id', sessionId);

    return { extracted, summaryUpdated: true };
  },
};
