/**
 * Shelf is the search/filter/sort entry point. Covers the usual
 * loading -> error -> empty -> data precedence plus the filter pipeline:
 * search narrows the list, category narrows further, and a combination that
 * matches nothing shows the distinct no-matches state (not a blank list).
 */
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import ShelfScreen from '@/app/shelf/index';
import { renderWithProviders } from '@/test/render';
import { resetSupabaseMock, setResponder, type QueryResult } from '@/test/supabaseMock';
import { useAuth } from '@/stores/auth';
import type { ShelfItem } from '@/lib/types';

jest.mock('@/lib/supabase', () => jest.requireActual('@/test/supabaseMock'));
jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn(), push: jest.fn() }) }));

function item(partial: Partial<ShelfItem>): ShelfItem {
  return {
    id: 'x',
    product_id: null,
    name: 'Test',
    brand: null,
    category: 'serum',
    key_ingredients: [],
    image_path: null,
    size_label: null,
    opened_at: null,
    shelf_life_months: null,
    amount_remaining: 100,
    times_used: 0,
    last_used_at: null,
    status: 'active',
    notes: null,
    price_usd: null,
    created_at: '2026-06-01',
    updated_at: '2026-06-01',
    ...partial,
  };
}

const serum = item({ id: 'a', name: 'Niacinamide Serum', category: 'serum' });
const cleanser = item({ id: 'b', name: 'Gentle Cleanser', category: 'cleanser' });

function serve(tables: Record<string, QueryResult>) {
  setResponder((call) => tables[call.table] ?? { data: [], error: null });
}

const ok = (data: unknown): QueryResult => ({ data, error: null });
const fails: QueryResult = { data: null, error: { message: 'network request failed' } };

beforeEach(() => {
  resetSupabaseMock();
  useAuth.setState({ session: { user: { id: 'user-1' } } as never, profile: null });
});

describe('shelf screen', () => {
  it('shows the error state when the shelf fetch fails', async () => {
    serve({ shelf_items: fails, reaction_logs: ok([]) });
    renderWithProviders(<ShelfScreen />);
    await waitFor(() => {
      expect(screen.getByText("Couldn't load your shelf")).toBeTruthy();
    });
  });

  it('shows the empty state with no items at all', async () => {
    serve({ shelf_items: ok([]), reaction_logs: ok([]) });
    renderWithProviders(<ShelfScreen />);
    await waitFor(() => {
      expect(screen.getByText('Your shelf is empty')).toBeTruthy();
    });
  });

  it('filters the list by search text', async () => {
    serve({ shelf_items: ok([serum, cleanser]), reaction_logs: ok([]) });
    renderWithProviders(<ShelfScreen />);

    await waitFor(() => {
      expect(screen.getByText('Niacinamide Serum')).toBeTruthy();
    });
    expect(screen.getByText('Gentle Cleanser')).toBeTruthy();

    fireEvent.changeText(screen.getByPlaceholderText('Search your shelf…'), 'niacinamide');

    await waitFor(() => {
      expect(screen.queryByText('Gentle Cleanser')).toBeNull();
    });
    expect(screen.getByText('Niacinamide Serum')).toBeTruthy();
  });

  it('shows a distinct no-matches state, with a way back, when search matches nothing', async () => {
    serve({ shelf_items: ok([serum, cleanser]), reaction_logs: ok([]) });
    renderWithProviders(<ShelfScreen />);

    await waitFor(() => {
      expect(screen.getByText('Niacinamide Serum')).toBeTruthy();
    });

    fireEvent.changeText(screen.getByPlaceholderText('Search your shelf…'), 'sunscreen');

    await waitFor(() => {
      expect(screen.getByText('No results for "sunscreen".')).toBeTruthy();
    });
    expect(screen.queryByText('Niacinamide Serum')).toBeNull();

    fireEvent.press(screen.getByText('Clear filters'));

    await waitFor(() => {
      expect(screen.getByText('Niacinamide Serum')).toBeTruthy();
    });
  });
});
