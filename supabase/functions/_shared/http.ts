/** Shared HTTP helpers: CORS, JSON responses, error envelope. */

// Optional comma-separated origin allowlist (e.g. the Expo web origin). When
// unset we fall back to '*' — native mobile clients ignore CORS entirely, so
// this only matters for browser callers, and an empty allowlist must not break
// them. When set, only listed origins are reflected back.
const ALLOWED_ORIGINS = (Deno.env.get('GLOWI_ALLOWED_ORIGINS') ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const BASE_CORS_HEADERS = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/** Resolves the Access-Control-Allow-Origin for a given request. */
function allowOrigin(req: Request): string {
  if (ALLOWED_ORIGINS.length === 0) return '*';
  const origin = req.headers.get('Origin') ?? '';
  return ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
}

/** Full CORS header set for a request, including the resolved origin. */
function corsHeaders(req: Request): Record<string, string> {
  return {
    ...BASE_CORS_HEADERS,
    'Access-Control-Allow-Origin': allowOrigin(req),
    Vary: 'Origin',
  };
}

/**
 * Constant-time string equality for shared-secret headers. Hashing both sides
 * first makes the byte comparison fixed-length, so neither the loop count nor
 * early exit can leak anything about the secret's length or content.
 */
export async function timingSafeEqual(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder();
  const [da, db] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(a)),
    crypto.subtle.digest('SHA-256', enc.encode(b)),
  ]);
  const va = new Uint8Array(da);
  const vb = new Uint8Array(db);
  let diff = 0;
  for (let i = 0; i < va.length; i++) diff |= va[i] ^ vb[i];
  return diff === 0;
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function json(body: unknown, status = 200): Response {
  // Origin/Vary are applied per-request by serve() on the way out.
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...BASE_CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

/**
 * Wraps a handler with OPTIONS preflight, JSON error envelope, and logging.
 * The resolved CORS headers are stamped onto every response (including errors).
 */
export function serve(handler: (req: Request) => Promise<Response>) {
  Deno.serve(async (req: Request) => {
    const cors = corsHeaders(req);
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: cors });
    }
    let res: Response;
    try {
      res = await handler(req);
    } catch (err) {
      if (err instanceof HttpError) {
        res = json({ error: err.message }, err.status);
      } else {
        console.error('Unhandled error:', err);
        res = json({ error: 'Internal error' }, 500);
      }
    }
    for (const [key, value] of Object.entries(cors)) res.headers.set(key, value);
    return res;
  });
}
