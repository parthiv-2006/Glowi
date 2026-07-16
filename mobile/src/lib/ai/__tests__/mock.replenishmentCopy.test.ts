/**
 * mock.replenishmentCopy is the offline twin of the replenishment-copy edge
 * function (F1) — it must return a line per candidate with zero network AI
 * calls, so a demo run looks the same whether AI mode is live or mock.
 */
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { mockProvider } from '@/lib/ai/mock';
import { resetSupabaseMock, setResponder, type QueryResult } from '@/test/supabaseMock';

jest.mock('@/lib/supabase', () => jest.requireActual('@/test/supabaseMock'));

function serve(tables: Record<string, QueryResult>) {
  setResponder((call) => tables[call.table] ?? { data: null, error: null });
}

const ok = (data: unknown): QueryResult => ({ data, error: null });

beforeEach(() => {
  resetSupabaseMock();
});

describe('mockProvider.replenishmentCopy', () => {
  it('returns no lines when no candidates are given', async () => {
    const result = await mockProvider.replenishmentCopy({
      triggerItemId: 'shelf-1',
      productIds: [],
    });
    expect(result).toEqual({});
  });

  it('generates one deterministic line per candidate, keyed by product id', async () => {
    serve({
      shelf_items: ok({ name: 'Old Foaming Cleanser', brand: 'GenericCo' }),
      products: ok([
        { id: 'p1', brand: 'CeraVe', name: 'Hydrating Cleanser', key_ingredients: ['ceramides'] },
        { id: 'p2', brand: 'The Ordinary', name: 'Niacinamide', key_ingredients: [] },
      ]),
    });

    const result = await mockProvider.replenishmentCopy({
      triggerItemId: 'shelf-1',
      productIds: ['p1', 'p2'],
    });

    expect(result.p1).toContain('ceramides');
    expect(result.p1).toContain('CeraVe Hydrating Cleanser');
    expect(result.p1).toContain('GenericCo Old Foaming Cleanser');
    // No key ingredient on record: falls back to the plain swap line rather
    // than claiming an ingredient that isn't there.
    expect(result.p2).toBe(
      'The Ordinary Niacinamide is a clean swap for GenericCo Old Foaming Cleanser.',
    );
  });

  it('is deterministic across repeat calls — no randomness, no network', async () => {
    serve({
      shelf_items: ok({ name: 'Old Serum', brand: 'Acme' }),
      products: ok([{ id: 'p1', brand: 'Acme', name: 'New Serum', key_ingredients: ['retinol'] }]),
    });

    const first = await mockProvider.replenishmentCopy({
      triggerItemId: 'shelf-1',
      productIds: ['p1'],
    });
    const second = await mockProvider.replenishmentCopy({
      triggerItemId: 'shelf-1',
      productIds: ['p1'],
    });
    expect(first).toEqual(second);
  });
});
