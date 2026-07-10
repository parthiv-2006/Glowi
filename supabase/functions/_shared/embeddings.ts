/**
 * gte-small embeddings via the edge runtime's built-in model (Supabase.ai) —
 * 384-dim, normalized, no external provider or key. Returns null on any
 * failure so callers degrade to non-semantic ranking instead of erroring.
 */

interface AiSession {
  run(input: string, opts: { mean_pool: boolean; normalize: boolean }): Promise<unknown>;
}

// Injected by the Supabase edge runtime; not part of Deno's own globals.
declare const Supabase: { ai: { Session: new (model: string) => AiSession } };

export const EMBEDDING_DIM = 384;

let session: AiSession | null = null;

export async function embed(text: string): Promise<number[] | null> {
  try {
    session ??= new Supabase.ai.Session('gte-small');
    const out = await session.run(text.slice(0, 2000), { mean_pool: true, normalize: true });
    const vec = Array.isArray(out) ? (out as number[]) : null;
    return vec && vec.length === EMBEDDING_DIM ? vec : null;
  } catch (err) {
    console.error('Embedding failed:', err);
    return null;
  }
}
