/**
 * glow-report — Glowi's Weekly Glow Report.
 *
 * Input:  { week_start } — the Monday (ISO) of a completed week; the client
 *         passes the most recent completed week.
 * Effect: returns the cached report for that week if one exists; otherwise
 *         gathers the week's real data (scan movement, routine adherence, shelf
 *         adds, reactions, environment, lifestyle-aware correlations), asks
 *         Claude for the report's prose, validates the shape field-by-field,
 *         and inserts one immutable row. Idempotent per user per week — a cache
 *         hit costs zero Claude tokens.
 * Output: { report } — the glow_reports row.
 *
 * Every number in the report is computed server-side from the user's data; the
 * model only writes prose. It never sees or invents a statistic.
 */
import { serve, json, HttpError } from '../_shared/http.ts';
import { serviceClient, requireUser } from '../_shared/supabase.ts';
import { callClaude, extractJson, MODELS } from '../_shared/anthropic.ts';
import { enforceRateLimit } from '../_shared/ratelimit.ts';

const RATE_LIMIT = { max: 5, windowSeconds: 86_400 };
import {
  correlateScanTrends,
  CORRELATION_CAVEAT,
  type CorrelationLifestyleLog,
  type CorrelationReactionLog,
  type CorrelationScan,
  type CorrelationShelfItem,
} from '../_shared/correlation.ts';
import { milestoneCrossedInWeek } from '../_shared/milestones.ts';

interface ReportBody {
  week_start?: string;
}

/** The prose fields Claude writes — stats are computed, never modeled. */
interface ModelResult {
  headline: string;
  score_note: string;
  wins: string[];
  watchouts: string[];
  next_week_focus: string;
}

interface ReportStats {
  scans: number;
  checkins: number;
  checkin_possible: number;
  streak_days: number;
}

const DAY_MS = 86_400_000;
/** AM + PM slots across 7 days — the adherence denominator. */
const CHECKIN_POSSIBLE = 14;
/** Reports older than this are out of range — keeps the window bounded. */
const MAX_WEEKS_PAST = 8;
/** UV index at or above this reads as a "high-UV day". */
const HIGH_UV = 6;
/** US AQI above this reads as a "poor-air day". */
const HIGH_AQI = 100;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function addDaysIso(iso: string, days: number): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

/** Consecutive check-in days ending on `endIso`, walking backwards. */
function streakEndingAt(dates: Set<string>, endIso: string): number {
  let streak = 0;
  let cursor = endIso;
  while (dates.has(cursor)) {
    streak += 1;
    cursor = addDaysIso(cursor, -1);
  }
  return streak;
}

/** Short plain-language recap of the week's environment for the prompt. */
function summarizeEnvironment(rows: { environment: Record<string, unknown> | null }[]): string {
  if (rows.length === 0) return '';
  let highUv = 0;
  let poorAir = 0;
  for (const r of rows) {
    const env = r.environment ?? {};
    if (Number(env.uv_index) >= HIGH_UV) highUv += 1;
    if (Number(env.air_quality_index) > HIGH_AQI) poorAir += 1;
  }
  const parts: string[] = [];
  if (highUv) parts.push(`${highUv} high-UV day${highUv === 1 ? '' : 's'}`);
  if (poorAir) parts.push(`${poorAir} poor-air day${poorAir === 1 ? '' : 's'}`);
  return parts.length ? parts.join(', ') : 'mild, unremarkable conditions';
}

serve(async (req) => {
  const { user } = await requireUser(req);
  const body = ((await req.json().catch(() => ({}))) as ReportBody) ?? {};
  const weekStart = String(body.week_start ?? '').trim();

  // ── Validate the requested week (shape → Monday → not future → not too old).
  if (!DATE_RE.test(weekStart) || Number.isNaN(Date.parse(`${weekStart}T00:00:00Z`))) {
    throw new HttpError(400, 'week_start must be an ISO date (yyyy-mm-dd).');
  }
  const weekStartMs = Date.parse(`${weekStart}T00:00:00Z`);
  if (new Date(weekStartMs).getUTCDay() !== 1) {
    throw new HttpError(400, 'week_start must be a Monday.');
  }
  const nowMs = Date.now();
  if (weekStartMs > nowMs) {
    throw new HttpError(400, 'week_start is in the future.');
  }
  if (nowMs - weekStartMs > MAX_WEEKS_PAST * 7 * DAY_MS) {
    throw new HttpError(400, `week_start is more than ${MAX_WEEKS_PAST} weeks past.`);
  }

  const svc = serviceClient();

  // ── Cache: one immutable report per user per week.
  const { data: existing } = await svc
    .from('glow_reports')
    .select('*')
    .eq('user_id', user.id)
    .eq('week_start', weekStart)
    .maybeSingle();
  if (existing) return json({ report: existing });

  // After the cache check: re-opening an existing report stays free.
  await enforceRateLimit(svc, `glow-report:${user.id}`, RATE_LIMIT.max, RATE_LIMIT.windowSeconds);

  const weekEnd = addDaysIso(weekStart, 7); // exclusive upper bound
  const lastDay = addDaysIso(weekStart, 6); // inclusive last day of the week
  const streakLookback = addDaysIso(weekStart, -30);
  const lifestyleLookback = addDaysIso(weekStart, -60);

  const [
    scansInWindowRes,
    lastScanBeforeRes,
    allScansRes,
    checkinsWindowRes,
    checkinsStreakRes,
    shelfAddsRes,
    reactionsWindowRes,
    forecastsRes,
    correlationShelfRes,
    correlationReactionsRes,
    lifestyleRes,
  ] = await Promise.all([
    svc
      .from('scans')
      .select('skin_score, created_at')
      .eq('user_id', user.id)
      .eq('status', 'complete')
      .gte('created_at', weekStart)
      .lt('created_at', weekEnd)
      .order('created_at', { ascending: true }),
    svc
      .from('scans')
      .select('skin_score, created_at')
      .eq('user_id', user.id)
      .eq('status', 'complete')
      .lt('created_at', weekStart)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    svc
      .from('scans')
      .select('created_at, skin_score, concerns, status')
      .eq('user_id', user.id)
      .eq('status', 'complete')
      .order('created_at', { ascending: true }),
    svc
      .from('routine_checkins')
      .select('checkin_date')
      .eq('user_id', user.id)
      .gte('checkin_date', weekStart)
      .lt('checkin_date', weekEnd),
    svc
      .from('routine_checkins')
      .select('checkin_date')
      .eq('user_id', user.id)
      .gte('checkin_date', streakLookback)
      .lte('checkin_date', lastDay),
    svc
      .from('shelf_items')
      .select('name, brand, created_at')
      .eq('user_id', user.id)
      .gte('created_at', weekStart)
      .lt('created_at', weekEnd),
    svc
      .from('reaction_logs')
      .select('product_name, reacted_on')
      .eq('user_id', user.id)
      .gte('reacted_on', weekStart)
      .lt('reacted_on', weekEnd),
    svc
      .from('skin_forecasts')
      .select('environment, forecast_date')
      .eq('user_id', user.id)
      .gte('forecast_date', weekStart)
      .lt('forecast_date', weekEnd),
    svc
      .from('shelf_items')
      .select('created_at, name, key_ingredients')
      .eq('user_id', user.id)
      .eq('status', 'active'),
    svc
      .from('reaction_logs')
      .select('reacted_on, product_name, key_ingredients')
      .eq('user_id', user.id),
    svc
      .from('lifestyle_logs')
      .select(
        'log_date, sleep_quality, stress_level, diet_dairy, diet_sugar, diet_alcohol, cycle_phase',
      )
      .eq('user_id', user.id)
      .gte('log_date', lifestyleLookback)
      .lte('log_date', lastDay),
  ]);

  const scansInWindow = scansInWindowRes.data ?? [];
  const lastScanBefore = lastScanBeforeRes.data;

  // ── Score movement — measured, never modeled.
  const endScore = scansInWindow.length ? scansInWindow[scansInWindow.length - 1].skin_score : null;
  const baseScore =
    lastScanBefore?.skin_score ?? (scansInWindow.length >= 2 ? scansInWindow[0].skin_score : null);
  const scoreDelta =
    endScore != null && baseScore != null ? (endScore as number) - (baseScore as number) : null;

  // ── Adherence + streak.
  const checkinCount = checkinsWindowRes.data?.length ?? 0;
  const streakDates = new Set((checkinsStreakRes.data ?? []).map((c) => c.checkin_date as string));
  const streakDays = streakEndingAt(streakDates, lastDay);

  const stats: ReportStats = {
    scans: scansInWindow.length,
    checkins: Math.min(checkinCount, CHECKIN_POSSIBLE),
    checkin_possible: CHECKIN_POSSIBLE,
    streak_days: streakDays,
  };

  // ── Lifestyle-aware correlations across the whole scan history.
  const insights = correlateScanTrends(
    (allScansRes.data ?? []) as CorrelationScan[],
    (correlationShelfRes.data ?? []) as CorrelationShelfItem[],
    (correlationReactionsRes.data ?? []) as CorrelationReactionLog[],
    (lifestyleRes.data ?? []) as CorrelationLifestyleLog[],
  );

  const shelfAdds = shelfAddsRes.data ?? [];
  const reactions = reactionsWindowRes.data ?? [];

  // ── Assemble the grounded facts the model may draw from. It writes prose
  //    only; it never invents a number and must not mention data absent here.
  const facts: string[] = [];
  if (scansInWindow.length === 0) {
    facts.push('Scans this week: none. Do NOT invent skin movement — be honest and encouraging.');
  } else {
    facts.push(`Scans this week: ${scansInWindow.length}.`);
    if (scoreDelta != null) {
      const dir = scoreDelta > 0 ? 'up' : scoreDelta < 0 ? 'down' : 'flat';
      facts.push(
        `Skin score moved ${dir} ${Math.abs(scoreDelta)} points (from ${baseScore} to ${endScore}).`,
      );
    } else {
      facts.push('Skin score movement: not enough scans to compare — say so honestly.');
    }
  }
  facts.push(`Routine adherence: ${stats.checkins} of ${CHECKIN_POSSIBLE} AM/PM slots logged.`);
  facts.push(`Current check-in streak: ${streakDays} day${streakDays === 1 ? '' : 's'}.`);
  const milestone = milestoneCrossedInWeek(streakDays);
  if (milestone) {
    facts.push(
      `Streak milestone crossed this week: ${milestone} days — celebrate it as a win.`,
    );
  }
  if (shelfAdds.length) {
    facts.push(
      `Products added to their shelf this week: ${shelfAdds
        .map((s) => [s.brand, s.name].filter(Boolean).join(' '))
        .join(', ')}.`,
    );
  }
  if (reactions.length) {
    facts.push(
      `Reactions logged this week: ${reactions.map((r) => r.product_name).join(', ')} — treat as a watch-out.`,
    );
  }
  const envSummary = summarizeEnvironment(forecastsRes.data ?? []);
  if (envSummary) facts.push(`Environment this week: ${envSummary}.`);
  if (insights.length) {
    facts.push('Correlations measured from their scan history (correlations, not proof):');
    for (const insight of insights) {
      facts.push(`  • ${insight.event.label}: ${insight.headline}`);
    }
  }

  const system = `You are Glowi's Weekly Glow Report writer. Once a week you write one user a short, warm, honest recap of their skincare week: what moved, what worked, and one thing to focus on next. Return STRICT JSON only — no prose outside it, no markdown fences.

Write ONLY from the facts below. Never invent a number, a scan, a product, or movement that isn't stated. If there were no scans this week, write an honest, encouraging report about consistency and habits instead of skin change — never fabricate progress. When you cite a correlation, you MUST include this caveat verbatim somewhere in that sentence or the watchouts: "${CORRELATION_CAVEAT}". Be specific, kind, and calibrated — this is a moment the user looks forward to, not a scold.

THIS WEEK'S FACTS (ground truth — every claim must trace to one of these):
${facts.map((f) => `- ${f}`).join('\n')}

Return this exact shape:
{
  "headline": "<<=64 chars, the week's one-line story, warm and specific>",
  "score_note": "<1-2 sentences on skin-score movement, grounded in the delta above — or honest about having no scans to compare>",
  "wins": ["<1 to 3 short wins, each grounded in a real datum above (adherence, a streak, a correlation, a shelf add)>"],
  "watchouts": ["<0 to 2 gentle watch-outs — reactions, a slipping streak, a negative correlation; omit if nothing warrants one>"],
  "next_week_focus": "<one concrete, doable focus for next week>"
}

Rules: wins has 1-3 items; watchouts has 0-2 (use [] when none). Keep every string tight. Never scold; never over-promise.`;

  let result: ModelResult;
  try {
    const raw = await callClaude({
      model: MODELS.primary,
      system,
      maxTokens: 700,
      temperature: 0.4,
      messages: [{ role: 'user', content: 'Write my Glow Report for this week.' }],
    });
    result = extractJson<ModelResult>(raw);
  } catch (err) {
    console.error('Glow report generation failed:', err);
    throw new HttpError(502, 'Could not generate this week’s report. Please try again.');
  }

  // ── Boundary validation — reject a malformed report, never patch it.
  const headline = String(result.headline ?? '').trim();
  const scoreNote = String(result.score_note ?? '').trim();
  const nextWeekFocus = String(result.next_week_focus ?? '').trim();
  const wins = (Array.isArray(result.wins) ? result.wins : [])
    .filter((w): w is string => typeof w === 'string' && w.trim().length > 0)
    .map((w) => w.trim().slice(0, 200))
    .slice(0, 3);
  const watchouts = (Array.isArray(result.watchouts) ? result.watchouts : [])
    .filter((w): w is string => typeof w === 'string' && w.trim().length > 0)
    .map((w) => w.trim().slice(0, 200))
    .slice(0, 2);

  if (!headline || !scoreNote || !nextWeekFocus || wins.length === 0) {
    throw new HttpError(502, 'Model returned an incomplete report.');
  }

  const content = {
    headline: headline.slice(0, 120),
    score_note: scoreNote.slice(0, 400),
    wins,
    watchouts,
    next_week_focus: nextWeekFocus.slice(0, 240),
    stats,
  };

  const { data, error } = await svc
    .from('glow_reports')
    .insert({ user_id: user.id, week_start: weekStart, content })
    .select()
    .single();
  if (error) throw new HttpError(500, error.message);

  return json({ report: data });
});
