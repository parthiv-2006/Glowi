/**
 * Dupe Finder is another query-route with the loading -> error -> empty ->
 * data precedence (see the replenish screen test for why that order is the
 * contract, not a style choice), plus its own not-found branch when the
 * shelf item id in the route no longer matches anything on the shelf.
 */
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { screen, waitFor } from '@testing-library/react-native';

import DupeFinderScreen from '@/app/shelf/dupes/[id]';
import { renderWithProviders } from '@/test/render';
import { resetSupabaseMock, setResponder, type QueryResult } from '@/test/supabaseMock';
import { useAuth } from '@/stores/auth';
import type { Product, ShelfItem } from '@/lib/types';

jest.mock('@/lib/supabase', () => jest.requireActual('@/test/supabaseMock'));
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), replace: jest.fn(), push: jest.fn() }),
  useLocalSearchParams: () => ({ id: 'shelf-1' }),
}));

const serum: ShelfItem = {
  id: 'shelf-1',
  product_id: null,
  name: 'Vitamin C Serum',
  brand: 'Acme',
  category: 'serum',
  key_ingredients: ['Niacinamide'],
  image_path: null,
  size_label: null,
  opened_at: null,
  shelf_life_months: null,
  amount_remaining: 80,
  times_used: 10,
  last_used_at: null,
  status: 'active',
  notes: null,
  price_usd: 30,
  created_at: '2026-06-01',
  updated_at: '2026-07-01',
};

const cheaperDupe: Product = {
  id: 'prod-1',
  slug: 'niacinamide-serum',
  brand: 'The Ordinary',
  name: 'Niacinamide Serum',
  category: 'serum',
  description: '',
  key_ingredients: ['Niacinamide'],
  price_usd: 10,
  image_url: null,
  retailer_links: [],
  skin_types: [],
  am_pm: 'both',
  step_order: 1,
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

describe('dupe finder screen', () => {
  it('shows the error state — not the empty state — when the shelf fetch fails', async () => {
    serve({ shelf_items: fails, products: ok([]), reaction_logs: ok([]) });

    renderWithProviders(<DupeFinderScreen />);

    await waitFor(() => {
      expect(screen.getByText("Couldn't load dupes")).toBeTruthy();
    });
    expect(screen.queryByText('No cheaper dupe yet')).toBeNull();
  });

  it('shows the error state when the catalog fetch fails, even with a healthy shelf', async () => {
    serve({ shelf_items: ok([serum]), products: fails, reaction_logs: ok([]) });

    renderWithProviders(<DupeFinderScreen />);

    await waitFor(() => {
      expect(screen.getByText("Couldn't load dupes")).toBeTruthy();
    });
  });

  it('shows the not-found state when the route id matches nothing on the shelf', async () => {
    serve({ shelf_items: ok([]), products: ok([]), reaction_logs: ok([]) });

    renderWithProviders(<DupeFinderScreen />);

    await waitFor(() => {
      expect(screen.getByText('Item not found')).toBeTruthy();
    });
  });

  it('shows the empty state when nothing in the catalog is a cheaper dupe', async () => {
    serve({ shelf_items: ok([serum]), products: ok([]), reaction_logs: ok([]) });

    renderWithProviders(<DupeFinderScreen />);

    await waitFor(() => {
      expect(screen.getByText('No cheaper dupe yet')).toBeTruthy();
    });
  });

  it('renders a ranked, cheaper dupe with its savings rationale', async () => {
    serve({ shelf_items: ok([serum]), products: ok([cheaperDupe]), reaction_logs: ok([]) });

    renderWithProviders(<DupeFinderScreen />);

    await waitFor(() => {
      expect(screen.getByText('Niacinamide Serum')).toBeTruthy();
    });
    expect(screen.getByText('Shares niacinamide · saves $20.00')).toBeTruthy();
    expect(screen.queryByText('No cheaper dupe yet')).toBeNull();
  });
});
