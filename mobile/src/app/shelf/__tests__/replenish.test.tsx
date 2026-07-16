/**
 * Replenish is a good stand-in for every query route in the app, because it
 * reads two independent queries and has all four states. The bug D2 fixed lived
 * exactly here: nothing branched on `isError`, so a failed shelf fetch fell
 * through to the empty state and told a user with a full shelf that nothing
 * needed replacing. The precedence — loading → error → empty → data — is the
 * contract, and an offline user being told a comfortable lie is the regression.
 */
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { screen, waitFor } from '@testing-library/react-native';

import ReplenishScreen from '@/app/shelf/replenish';
import { renderWithProviders } from '@/test/render';
import { resetSupabaseMock, setResponder, type QueryResult } from '@/test/supabaseMock';
import { useAuth } from '@/stores/auth';
import type { Product, ShelfItem } from '@/lib/types';

jest.mock('@/lib/supabase', () => jest.requireActual('@/test/supabaseMock'));
jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn(), push: jest.fn() }) }));

/** An item that is out of stock — a replenishment trigger by any reading. */
const emptyBottle: ShelfItem = {
  id: 'shelf-1',
  product_id: null,
  name: 'Vitamin C Serum',
  brand: 'Acme',
  category: 'serum',
  key_ingredients: [],
  image_path: null,
  size_label: null,
  opened_at: null,
  shelf_life_months: null,
  amount_remaining: 0,
  times_used: 40,
  last_used_at: null,
  status: 'active',
  notes: null,
  price_usd: null,
  created_at: '2026-06-01',
  updated_at: '2026-07-01',
};

const stockedBottle: ShelfItem = {
  ...emptyBottle,
  id: 'shelf-2',
  name: 'Niacinamide Serum',
  amount_remaining: 90,
};

/** Serves each table its own result, so one query can fail while others succeed. */
function serve(tables: Record<string, QueryResult>) {
  setResponder((call) => tables[call.table] ?? { data: [], error: null });
}

const ok = (data: unknown): QueryResult => ({ data, error: null });
const fails: QueryResult = { data: null, error: { message: 'network request failed' } };

beforeEach(() => {
  resetSupabaseMock();
  useAuth.setState({ session: { user: { id: 'user-1' } } as never, profile: null });
});

describe('replenish screen', () => {
  it('shows the error state — not the empty state — when the shelf fetch fails', async () => {
    serve({ shelf_items: fails, products: ok([]) });

    renderWithProviders(<ReplenishScreen />);

    await waitFor(() => {
      expect(screen.getByText("Couldn't load what to get next")).toBeTruthy();
    });
    // The regression: "nothing needs replacing" is a claim about the user's
    // shelf, and a fetch that failed knows nothing about their shelf.
    expect(screen.queryByText('Nothing needs replacing')).toBeNull();
  });

  it('shows the error state when the catalog fetch fails, even with a healthy shelf', async () => {
    serve({ shelf_items: ok([emptyBottle]), products: fails });

    renderWithProviders(<ReplenishScreen />);

    await waitFor(() => {
      expect(screen.getByText("Couldn't load what to get next")).toBeTruthy();
    });
  });

  it('shows the empty state when the shelf genuinely needs nothing', async () => {
    serve({ shelf_items: ok([stockedBottle]), products: ok([]) });

    renderWithProviders(<ReplenishScreen />);

    await waitFor(() => {
      expect(screen.getByText('Nothing needs replacing')).toBeTruthy();
    });
  });

  it('groups a triggered item under its reason', async () => {
    serve({ shelf_items: ok([emptyBottle, stockedBottle]), products: ok([]) });

    renderWithProviders(<ReplenishScreen />);

    await waitFor(() => {
      expect(screen.getByText('Vitamin C Serum')).toBeTruthy();
    });
    expect(screen.getByText('Out of stock')).toBeTruthy();
    // The stocked item is not a trigger and must not appear.
    expect(screen.queryByText('Nothing needs replacing')).toBeNull();
    // No catalog match, so the coach fallback is offered rather than a dead end.
    expect(screen.getByText('Ask your coach what to get')).toBeTruthy();
  });

  it('replaces the deterministic rationale with the AI coach line once it resolves (F1)', async () => {
    const replacement: Product = {
      id: 'prod-1',
      slug: 'niacinamide-serum',
      brand: 'The Ordinary',
      name: 'Niacinamide Serum',
      category: 'serum',
      description: '',
      key_ingredients: ['niacinamide'],
      price_usd: 10,
      image_url: null,
      retailer_links: [],
      skin_types: [],
      am_pm: 'both',
      step_order: 1,
    };
    // useShelfItems (the list) must resolve before ReplenishGroup mounts and
    // fires the mock's own shelf_items lookup (a single row, via
    // .maybeSingle()) — the generic table-keyed responder can't tell those
    // two queries apart by shape, so give the list on the first call and the
    // single row matching real .maybeSingle() shape on every call after.
    let shelfCalls = 0;
    setResponder((call) => {
      if (call.table === 'shelf_items') {
        shelfCalls += 1;
        return shelfCalls === 1 ? ok([emptyBottle]) : ok(emptyBottle);
      }
      if (call.table === 'products') return ok([replacement]);
      return { data: [], error: null };
    });

    renderWithProviders(<ReplenishScreen />);

    // The mock AI provider resolves with a coach-voiced line that replaces
    // the deterministic composeWhy rationale, not sit alongside it — this
    // asserts the full line, including the trigger-item label half.
    await waitFor(() => {
      expect(
        screen.getByText(
          'The Ordinary Niacinamide Serum brings niacinamide to the table — a solid step up from Acme Vitamin C Serum.',
        ),
      ).toBeTruthy();
    });
    expect(screen.queryByText('Same category as what you already own')).toBeNull();
  });
});
