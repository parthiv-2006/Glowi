/**
 * Wishlist filters the already-cached catalog by wishlisted product id, so
 * the states worth pinning are the usual loading -> error -> empty -> data
 * precedence plus that the filter actually narrows to the saved ids.
 */
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { screen, waitFor } from '@testing-library/react-native';

import WishlistScreen from '@/app/wishlist';
import { renderWithProviders } from '@/test/render';
import { resetSupabaseMock, setResponder, type QueryResult } from '@/test/supabaseMock';
import { useAuth } from '@/stores/auth';
import type { Product } from '@/lib/types';

jest.mock('@/lib/supabase', () => jest.requireActual('@/test/supabaseMock'));
jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn(), push: jest.fn() }) }));

function product(partial: Partial<Product>): Product {
  return {
    id: 'p1',
    slug: 'test-product',
    brand: 'TestBrand',
    name: 'Test Product',
    category: 'serum',
    description: '',
    key_ingredients: [],
    price_usd: 20,
    image_url: null,
    retailer_links: [],
    skin_types: [],
    am_pm: 'both',
    step_order: 1,
    ...partial,
  };
}

const serum = product({ id: 'p1', name: 'Niacinamide Serum' });
const cleanser = product({ id: 'p2', name: 'Gentle Cleanser' });

function serve(tables: Record<string, QueryResult>) {
  setResponder((call) => tables[call.table] ?? { data: [], error: null });
}

const ok = (data: unknown): QueryResult => ({ data, error: null });
const fails: QueryResult = { data: null, error: { message: 'network request failed' } };

beforeEach(() => {
  resetSupabaseMock();
  useAuth.setState({ session: { user: { id: 'user-1' } } as never, profile: null });
});

describe('wishlist screen', () => {
  it('shows the error state when the wishlist fetch fails', async () => {
    serve({ product_wishlist: fails, products: ok([serum, cleanser]) });
    renderWithProviders(<WishlistScreen />);
    await waitFor(() => {
      expect(screen.getByText("Couldn't load your wishlist")).toBeTruthy();
    });
  });

  it('shows the error state when the catalog fetch fails', async () => {
    serve({ product_wishlist: ok([{ product_id: 'p1' }]), products: fails });
    renderWithProviders(<WishlistScreen />);
    await waitFor(() => {
      expect(screen.getByText("Couldn't load your wishlist")).toBeTruthy();
    });
  });

  it('shows the empty state when nothing is wishlisted', async () => {
    serve({ product_wishlist: ok([]), products: ok([serum, cleanser]) });
    renderWithProviders(<WishlistScreen />);
    await waitFor(() => {
      expect(screen.getByText('Nothing saved yet')).toBeTruthy();
    });
  });

  it('shows only the wishlisted products, filtered from the full catalog', async () => {
    serve({ product_wishlist: ok([{ product_id: 'p1' }]), products: ok([serum, cleanser]) });
    renderWithProviders(<WishlistScreen />);
    await waitFor(() => {
      expect(screen.getByText('Niacinamide Serum')).toBeTruthy();
    });
    expect(screen.queryByText('Gentle Cleanser')).toBeNull();
  });
});
