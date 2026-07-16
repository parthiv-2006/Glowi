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
  AIDelta,
  ConflictReport,
  GlowReport,
  GlowReportContent,
  LifestyleLog,
  ProductCategory,
  ProductComparison,
  ProductIdentification,
  ReactionLog,
  Scan,
  ScanConcern,
  ShelfItem,
  SkinForecast,
  SkinType,
} from '../types';
import type {
  AIProvider,
  AnalyzeScanInput,
  ChatInput,
  ChatResult,
  CompareProductsInput,
  CompareScanInput,
  ExtractResult,
  GlowReportInput,
  IdentifyProductInput,
  ReplenishmentCopyInput,
  SkinForecastInput,
} from './types';
import { DEFAULT_LOCATION, deriveForecast, synthesizeEnvironment } from './forecast';
import { CORRELATION_CAVEAT, correlateScanTrends } from '../correlation';
import { milestoneCrossedInWeek } from '../milestones';

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

const DAY_MS = 86_400_000;
function addDaysIso(iso: string, days: number): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

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

    const resolvedLabel = input.locationLabel ?? DEFAULT_LOCATION.label;
    if (!input.refresh) {
      const { data: existing } = await supabase
        .from('skin_forecasts')
        .select('*')
        .eq('forecast_date', today)
        .eq('location_label', resolvedLabel)
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
    const coords =
      typeof input.latitude === 'number' && typeof input.longitude === 'number'
        ? { latitude: input.latitude, longitude: input.longitude }
        : undefined;
    const env = synthesizeEnvironment(new Date(), coords);
    const { headline, summary, guidance } = deriveForecast(env, {
      skinType: (latestScan?.skin_type_estimate as SkinType | null) ?? null,
      topConcern: concerns[0]?.display_name ?? null,
      owned,
    });

    const row = {
      user_id: userId,
      forecast_date: today,
      location_label: resolvedLabel,
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

  async checkConflicts(): Promise<ConflictReport> {
    await requireUserId();
    await wait(1200 + Math.random() * 800);
    return {
      checkedAt: new Date().toISOString(),
      conflicts: [
        {
          severity: 'caution',
          ingredients: ['salicylic acid', 'retinol'],
          products: ["Paula's Choice 2% BHA Liquid Exfoliant", 'Differin Gel'],
          reason:
            'Both are exfoliants that increase cell turnover. Layering them nightly raises irritation risk significantly, especially on sensitive or barrier-compromised skin.',
          citation:
            'Kligman AM et al., J Am Acad Dermatol, 1984; Draelos ZD, Cosmetic Dermatology, 2010.',
          recommendation:
            'Use salicylic acid in the AM routine and retinol PM-only, or alternate nights.',
        },
        {
          severity: 'time_of_day',
          ingredients: ['retinol'],
          products: ['Differin Gel'],
          reason:
            'Retinoids degrade under UV exposure and increase photosensitivity, reducing both efficacy and safety if applied in the morning without high SPF.',
          citation: 'Mukherjee S et al., Clin Interv Aging, 2006.',
          recommendation: 'Apply Differin Gel at night only. Follow with SPF ≥ 30 every morning.',
        },
      ],
    };
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

  async compareScans({ scanIdBefore, scanIdAfter }: CompareScanInput): Promise<AIDelta> {
    await wait(1400 + Math.random() * 800);

    // Deterministic scenario selection keyed by the two scan IDs so the same
    // pair always returns the same mock without any network call.
    let h = 0;
    for (const ch of scanIdBefore + scanIdAfter) h = (h * 31 + ch.charCodeAt(0)) | 0;
    const scenario = Math.abs(h) % 3;

    const MOCK_DELTAS: AIDelta[] = [
      {
        headline: 'Redness visibly reduced since your last scan.',
        overall_narrative:
          'Skin tone looks calmer and more even compared to the earlier photo. Redness around the cheeks and nose has noticeably decreased, and the surface texture appears smoother overall.',
        changes: [
          {
            slug: 'redness-rosacea',
            display_name: 'Facial redness',
            direction: 'improved',
            magnitude: 35,
            observation: 'Cheek and nose redness is less pronounced; skin tone is more uniform.',
          },
          {
            slug: 'dullness',
            display_name: 'Surface dullness',
            direction: 'improved',
            magnitude: 20,
            observation:
              'Light reflects more evenly, suggesting improved hydration or exfoliation.',
          },
        ],
        caveat: null,
      },
      {
        headline: 'No significant change detected this week.',
        overall_narrative:
          'The two photos look very similar. Skin texture and tone are consistent between scans with no clear positive or negative trend visible.',
        changes: [
          {
            slug: null,
            display_name: 'Overall skin condition',
            direction: 'unchanged',
            magnitude: 5,
            observation: 'No meaningful visual difference between the before and after photos.',
          },
        ],
        caveat:
          'Lighting conditions appear slightly different between photos, which may mask subtle changes.',
      },
      {
        headline: 'Mild increase in congestion around the nose.',
        overall_narrative:
          'Some additional congestion is visible in the nose area compared to the earlier scan. Other zones appear stable with no major changes.',
        changes: [
          {
            slug: 'blackheads-congestion',
            display_name: 'Nose congestion',
            direction: 'worsened',
            magnitude: 20,
            observation: 'A few additional open comedones visible around the nose creases.',
          },
          {
            slug: 'acne',
            display_name: 'Breakout activity',
            direction: 'unchanged',
            magnitude: 8,
            observation: 'Chin area looks similar to the previous scan — no new active lesions.',
          },
        ],
        caveat: null,
      },
    ];

    return MOCK_DELTAS[scenario];
  },

  async compareProducts({
    imageABase64,
    imageBBase64,
  }: CompareProductsInput): Promise<ProductComparison> {
    await requireUserId();
    await wait(1800 + Math.random() * 900);

    // Deterministic pair keyed by the image payloads so a repeat comparison in
    // a demo returns the same verdict without any network call.
    const idx = (imageABase64.length + imageBBase64.length) % MOCK_IDENTIFICATIONS.length;
    const a = MOCK_IDENTIFICATIONS[idx];
    const b = MOCK_IDENTIFICATIONS[(idx + 1) % MOCK_IDENTIFICATIONS.length];
    const toIdent = (p: (typeof MOCK_IDENTIFICATIONS)[number]): ProductIdentification => ({
      ...p,
      not_product: false,
      reject_reason: null,
      confidence: 0.9,
    });

    // Ground the mock in real user data, mirroring the live prompt inputs.
    const { data: latestScan } = await supabase
      .from('scans')
      .select('concerns')
      .eq('status', 'complete')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    const topConcern = ((latestScan?.concerns ?? []) as ScanConcern[])[0]?.display_name ?? null;

    return {
      verdict: 'a',
      product_a: toIdent(a),
      product_b: toIdent(b),
      rationale: `${a.brand} ${a.name} is the better fit${
        topConcern ? ` for your ${topConcern.toLowerCase()}` : ''
      }: its ${a.key_ingredients[0] ?? 'formula'} targets what your last scan actually flagged, while ${b.brand} ${b.name} overlaps with what you already own.`,
      considerations: [
        `${b.brand} ${b.name} duplicates a category already on your shelf.`,
        'Neither product contains anything from your reaction log.',
        'Prices are close — pick on fit, not cost.',
      ],
    };
  },

  async glowReport({ weekStart }: GlowReportInput): Promise<GlowReport> {
    const userId = await requireUserId();

    // Cache parity with live: one immutable report per week; reload hits it.
    const { data: cached } = await supabase
      .from('glow_reports')
      .select('*')
      .eq('week_start', weekStart)
      .maybeSingle();
    if (cached) return cached as GlowReport;

    await wait(900 + Math.random() * 700);

    const weekEnd = addDaysIso(weekStart, 7); // exclusive
    const lastDay = addDaysIso(weekStart, 6); // inclusive
    const streakLookback = addDaysIso(weekStart, -30);
    const lifestyleLookback = addDaysIso(weekStart, -60);

    const [
      scansInWindow,
      lastBefore,
      allScans,
      checkinsWindow,
      checkinsStreak,
      shelfAdds,
      reactions,
      shelfActive,
      allReactions,
      lifestyle,
    ] = await Promise.all([
      supabase
        .from('scans')
        .select('skin_score, created_at')
        .eq('status', 'complete')
        .gte('created_at', weekStart)
        .lt('created_at', weekEnd)
        .order('created_at', { ascending: true }),
      supabase
        .from('scans')
        .select('skin_score')
        .eq('status', 'complete')
        .lt('created_at', weekStart)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('scans')
        .select('created_at, skin_score, concerns, status')
        .eq('status', 'complete')
        .order('created_at', { ascending: true }),
      supabase
        .from('routine_checkins')
        .select('checkin_date')
        .gte('checkin_date', weekStart)
        .lt('checkin_date', weekEnd),
      supabase
        .from('routine_checkins')
        .select('checkin_date')
        .gte('checkin_date', streakLookback)
        .lte('checkin_date', lastDay),
      supabase
        .from('shelf_items')
        .select('name, brand, created_at')
        .gte('created_at', weekStart)
        .lt('created_at', weekEnd),
      supabase
        .from('reaction_logs')
        .select('product_name, reacted_on')
        .gte('reacted_on', weekStart)
        .lt('reacted_on', weekEnd),
      supabase
        .from('shelf_items')
        .select('created_at, name, key_ingredients')
        .eq('status', 'active'),
      supabase.from('reaction_logs').select('reacted_on, product_name, key_ingredients'),
      supabase
        .from('lifestyle_logs')
        .select('log_date, sleep_quality, stress_level, diet_dairy, diet_sugar, diet_alcohol')
        .gte('log_date', lifestyleLookback)
        .lte('log_date', lastDay),
    ]);

    const windowScans = scansInWindow.data ?? [];
    const endScore = windowScans.length ? windowScans[windowScans.length - 1].skin_score : null;
    const baseScore =
      lastBefore.data?.skin_score ?? (windowScans.length >= 2 ? windowScans[0].skin_score : null);
    const scoreDelta = endScore != null && baseScore != null ? endScore - baseScore : null;

    const checkins = Math.min(checkinsWindow.data?.length ?? 0, 14);
    const streakDates = new Set((checkinsStreak.data ?? []).map((c) => c.checkin_date as string));
    let streakDays = 0;
    let cursor = lastDay;
    while (streakDates.has(cursor)) {
      streakDays += 1;
      cursor = addDaysIso(cursor, -1);
    }

    const insights = correlateScanTrends(
      (allScans.data ?? []) as Scan[],
      (shelfActive.data ?? []) as ShelfItem[],
      (allReactions.data ?? []) as ReactionLog[],
      (lifestyle.data ?? []) as LifestyleLog[],
    );
    const improved = insights.find((i) => i.direction === 'improved');
    const worsened = insights.find((i) => i.direction === 'worsened');
    const added = shelfAdds.data ?? [];
    const reacted = reactions.data ?? [];

    // Deterministic prose from the real facts — no network AI call.
    let headline: string;
    if (windowScans.length === 0) headline = 'A quiet week for scans — your habits kept going';
    else if (scoreDelta != null && scoreDelta > 0)
      headline = `Your skin climbed ${scoreDelta} points this week`;
    else if (scoreDelta != null && scoreDelta < 0) headline = 'A small dip — here’s what to steady';
    else headline = 'A steady week — your barrier thanks you';

    let scoreNote: string;
    if (windowScans.length === 0)
      scoreNote =
        'No scans this week, so there’s no movement to read yet. A weekly scan is what turns these reports into a real trend line.';
    else if (scoreDelta != null)
      scoreNote = `Your skin score went from ${baseScore} to ${endScore} — ${
        scoreDelta > 0 ? 'up' : scoreDelta < 0 ? 'down' : 'flat'
      } ${Math.abs(scoreDelta)} point${Math.abs(scoreDelta) === 1 ? '' : 's'} across ${
        windowScans.length
      } scan${windowScans.length === 1 ? '' : 's'} this week.`;
    else
      scoreNote =
        'You logged a scan this week — one more next week and I can start showing you real movement.';

    const wins: string[] = [];
    if (checkins > 0) wins.push(`Logged ${checkins} of 14 routine slots — consistency compounds.`);
    const milestone = milestoneCrossedInWeek(streakDays);
    if (milestone)
      wins.push(`Milestone unlocked: a ${milestone}-day check-in streak. That’s a habit now. 🏅`);
    else if (streakDays >= 2)
      wins.push(`You’re on a ${streakDays}-day check-in streak — keep it lit.`);
    if (improved) wins.push(`${improved.headline} ${CORRELATION_CAVEAT}`);
    if (added.length)
      wins.push(
        `Added ${added.map((a) => [a.brand, a.name].filter(Boolean).join(' ')).join(', ')} to your shelf — a fresh lever to track.`,
      );
    if (wins.length === 0) wins.push('You showed up this week — that’s the hardest part.');

    const watchouts: string[] = [];
    if (reacted.length)
      watchouts.push(
        `You logged a reaction to ${reacted
          .map((r) => r.product_name)
          .join(', ')} — I’ll keep those ingredients out of recommendations.`,
      );
    if (worsened) watchouts.push(`${worsened.headline} ${CORRELATION_CAVEAT}`);
    if (checkins < 4 && watchouts.length < 2)
      watchouts.push(
        'Routine check-ins were light this week — even a two-tap log keeps the streak alive.',
      );

    let nextWeekFocus: string;
    if (windowScans.length === 0)
      nextWeekFocus = 'Run one scan this week so next week’s report can show real movement.';
    else if (streakDays < 3)
      nextWeekFocus =
        'Aim for a daily check-in — small, repeatable, and it feeds every insight here.';
    else if (scoreDelta != null && scoreDelta < 0)
      nextWeekFocus = 'Hold your routine steady and re-scan in 7 days to confirm the trend.';
    else nextWeekFocus = 'Keep the routine consistent and layer SPF every morning.';

    const content: GlowReportContent = {
      headline,
      score_note: scoreNote,
      wins: wins.slice(0, 3),
      watchouts: watchouts.slice(0, 2),
      next_week_focus: nextWeekFocus,
      stats: {
        scans: windowScans.length,
        checkins,
        checkin_possible: 14,
        streak_days: streakDays,
      },
    };

    const { data, error } = await supabase
      .from('glow_reports')
      .insert({ user_id: userId, week_start: weekStart, content })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as GlowReport;
  },

  async replenishmentCopy({
    triggerItemId,
    productIds,
  }: ReplenishmentCopyInput): Promise<Record<string, string>> {
    await requireUserId();
    // Same cap as the replenishment-copy edge function's MAX_CANDIDATES —
    // must stay in lockstep so live and mock never disagree on how many
    // candidates get a line, regardless of what the caller passes in.
    const ids = [...new Set(productIds)].slice(0, 3);
    if (!ids.length) return {};

    // Deterministic, zero-network copy from the same catalog data the live
    // function would use — no randomness, so a demo replay looks consistent.
    const [{ data: triggerItem }, { data: candidates }] = await Promise.all([
      supabase.from('shelf_items').select('name, brand').eq('id', triggerItemId).maybeSingle(),
      supabase.from('products').select('id, brand, name, key_ingredients').in('id', ids),
    ]);
    const triggerLabel =
      [triggerItem?.brand, triggerItem?.name].filter(Boolean).join(' ') || 'what you have now';

    const copy: Record<string, string> = {};
    for (const product of candidates ?? []) {
      const lead = (product.key_ingredients as string[] | null)?.[0];
      copy[product.id] = lead
        ? `${product.brand} ${product.name} brings ${lead} to the table — a solid step up from ${triggerLabel}.`
        : `${product.brand} ${product.name} is a clean swap for ${triggerLabel}.`;
    }
    return copy;
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
