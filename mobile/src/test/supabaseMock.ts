/**
 * A stand-in for `lib/supabase` that fakes the network, not the app.
 *
 * Component tests mock at this boundary on purpose. Mocking `hooks.ts` or
 * `api.ts` instead would stub out the exact code the bugs lived in — the
 * optimistic merge and its rollback, the loading → error → empty → data
 * precedence, the chat-send draft restore. Faking only the wire keeps React
 * Query, the mutation lifecycle, and every accessor in `api.ts` running for
 * real, so a test failing here means the app is actually broken.
 *
 * Usage — the factory pulls this module in itself, because Jest hoists `jest.mock`
 * above the imports and a factory may not close over one of them:
 *
 *   jest.mock('@/lib/supabase', () => jest.requireActual('@/test/supabaseMock'));
 *   import { resetSupabaseMock, setResponder } from '@/test/supabaseMock';
 *
 * Responders answer per query, so a test can serve a row list on read and fail
 * the write — which is how you prove a rollback.
 */

/** The verb a query ran, taken from the first PostgREST operator in the chain. */
export type PostgrestOp = 'select' | 'insert' | 'upsert' | 'update' | 'delete';

export interface QueryCall {
  table: string;
  op: PostgrestOp;
  /** The row(s) handed to insert/upsert/update; undefined for reads. */
  payload?: unknown;
}

export interface QueryResult {
  data: unknown;
  error: { message: string } | null;
}

export type Responder = (call: QueryCall) => QueryResult | Promise<QueryResult>;

const OPS = new Set<string>(['select', 'insert', 'upsert', 'update', 'delete']);

const EMPTY: Responder = () => ({ data: null, error: null });

let responder: Responder = EMPTY;

/** Every query the code under test issued, in order — assert against it. */
export const calls: QueryCall[] = [];

export function setResponder(next: Responder): void {
  responder = next;
}

export function resetSupabaseMock(): void {
  calls.length = 0;
  responder = EMPTY;
}

/**
 * A PostgREST builder that accepts any filter/modifier chain and resolves to
 * whatever the responder returns. It is a Proxy rather than a hand-written
 * surface so that adding `.contains()` or `.range()` to `api.ts` tomorrow does
 * not break these tests for a reason that has nothing to do with the app.
 */
function makeBuilder(table: string): PromiseLike<QueryResult> {
  const call: QueryCall = { table, op: 'select' };
  let opCaptured = false;

  // Each builder closes over its own proxy: `api.ts` fires queries in
  // `Promise.all`, so a shared handle would let two live chains overwrite
  // each other.
  const proxy: PromiseLike<QueryResult> = new Proxy({} as PromiseLike<QueryResult>, {
    get(_target, prop) {
      if (prop === 'then') {
        const settled = Promise.resolve().then(() => {
          calls.push(call);
          return responder(call);
        });
        return settled.then.bind(settled);
      }
      return (...args: unknown[]) => {
        // The first operator wins: `.upsert(row).select().single()` is an
        // upsert, and the trailing `.select()` is just its return shape.
        if (typeof prop === 'string' && OPS.has(prop) && !opCaptured) {
          call.op = prop as PostgrestOp;
          if (prop !== 'select') call.payload = args[0];
          opCaptured = true;
        }
        return proxy;
      };
    },
  });

  return proxy;
}

export const supabase = {
  from(table: string) {
    return makeBuilder(table);
  },
  rpc: async () => ({ data: null, error: null }),

  // Auth and storage are stubs, not spies: no component test drives them today, and
  // plain functions keep this module free of jest globals — it is imported by the
  // app's own `@/` graph, where `jest` is not a value that exists. A test that needs
  // to assert on one of these should spy on it there, where the types are available.
  auth: {
    getSession: async () => ({ data: { session: null }, error: null }),
    signInWithPassword: async () => ({ data: { session: null }, error: null }),
    signOut: async () => ({ error: null }),
    updateUser: async () => ({ data: { user: null }, error: null }),
    resetPasswordForEmail: async () => ({ data: {}, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
  },
  storage: {
    from: () => ({
      createSignedUrl: async () => ({ data: null, error: null }),
      upload: async () => ({ data: null, error: null }),
    }),
  },
};

export async function getSignedScanImageUrl(): Promise<string | null> {
  return null;
}
