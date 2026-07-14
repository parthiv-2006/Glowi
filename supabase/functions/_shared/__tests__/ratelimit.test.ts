/**
 * The rate limiter is the cap on the product's largest financial exposure, so
 * it has to reject over-budget calls — but its fail-open posture matters just
 * as much: if the RPC itself errors, the limiter must let the call through
 * rather than brick every AI feature in the app. Both directions are asserted
 * here because getting either backwards is silently expensive.
 */
import { assertEquals, assertRejects } from '@std/assert';
import type { SupabaseClient } from '@supabase/supabase-js';
import { HttpError } from '../http.ts';
import { enforceRateLimit } from '../ratelimit.ts';

interface RpcCall {
  fn: string;
  args: Record<string, unknown>;
}

/** A service client stubbed down to the one RPC the limiter calls. */
function stubClient(result: { data: unknown; error: unknown }) {
  const rpcCalls: RpcCall[] = [];
  const client = {
    rpc(fn: string, args: Record<string, unknown>) {
      rpcCalls.push({ fn, args });
      return Promise.resolve(result);
    },
  } as unknown as SupabaseClient;
  return { client, rpcCalls };
}

Deno.test('enforceRateLimit: under budget resolves and passes the bucket through', async () => {
  const { client, rpcCalls } = stubClient({ data: true, error: null });

  await enforceRateLimit(client, 'chat:user-1', 40, 3600);

  assertEquals(rpcCalls.length, 1);
  assertEquals(rpcCalls[0].fn, 'check_rate_limit');
  assertEquals(rpcCalls[0].args, {
    p_bucket: 'chat:user-1',
    p_max: 40,
    p_window_seconds: 3600,
  });
});

Deno.test('enforceRateLimit: over budget throws a 429 with a friendly message', async () => {
  const { client } = stubClient({ data: false, error: null });

  const err = await assertRejects(
    () => enforceRateLimit(client, 'analyze-skin:user-1', 10, 86_400),
    HttpError,
  );
  assertEquals(err.status, 429);
  // The screens render this string verbatim — it must stay human.
  assertEquals(err.message, "You're doing that a lot — try again in a bit.");
});

Deno.test('enforceRateLimit: fails OPEN when the limiter itself errors', async () => {
  // A dead RPC must not take the product down with it. This deliberately trades
  // a burst of unmetered spend for availability; the console.error is the alarm.
  const { client } = stubClient({ data: null, error: { message: 'connection refused' } });

  await enforceRateLimit(client, 'chat:user-1', 40, 3600);
});

Deno.test('enforceRateLimit: only an explicit false is over budget', async () => {
  // The RPC returning null (or anything non-boolean) is an infra oddity, not a
  // verdict — treating it as "denied" would lock users out of a working app.
  const { client } = stubClient({ data: null, error: null });

  await enforceRateLimit(client, 'chat:user-1', 40, 3600);
});
