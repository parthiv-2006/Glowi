/**
 * Per-user rate limiting for the AI edge functions.
 *
 * Reuses the check_rate_limit RPC from migration 0007 (SECURITY DEFINER,
 * executable by the service role only) — one append-only event log, counted
 * per bucket over a trailing window, self-pruning after a day.
 *
 * Posture mirrors auth-signup: fail open when the limiter itself errors, so
 * an infra hiccup never bricks the product — but log loudly so it is visible
 * in function logs.
 *
 * Cached endpoints (check-conflicts, compare-scans, glow-report,
 * skin-forecast) must call this *after* their cache check so cache hits stay
 * free; the budget only meters real Claude calls.
 */
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { HttpError } from './http.ts';

export async function enforceRateLimit(
  svc: SupabaseClient,
  bucket: string,
  max: number,
  windowSeconds: number,
): Promise<void> {
  const { data: allowed, error } = await svc.rpc('check_rate_limit', {
    p_bucket: bucket,
    p_max: max,
    p_window_seconds: windowSeconds,
  });
  if (error) {
    console.error(`Rate limit check failed for bucket ${bucket} — failing open:`, error);
    return;
  }
  if (allowed === false) {
    throw new HttpError(429, "You're doing that a lot — try again in a bit.");
  }
}
