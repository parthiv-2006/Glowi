/**
 * The Learn list's bookmark toggle is a one-tap optimistic write, the same
 * shape as the check-in card: worth guarding that the tap paints before the
 * server answers, and that a failed write puts the bookmark back rather than
 * lying about what actually persisted.
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

import LearnScreen from '@/app/(tabs)/learn';
import { calls, resetSupabaseMock, setResponder, type QueryResult } from '@/test/supabaseMock';
import { renderWithProviders } from '@/test/render';
import { useAuth } from '@/stores/auth';
import type { Article } from '@/lib/types';

jest.mock('@/lib/supabase', () => jest.requireActual('@/test/supabaseMock'));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), back: jest.fn() }) }));

const article: Article = {
  id: 'article-1',
  slug: 'niacinamide-101',
  title: 'Niacinamide 101',
  category: 'Ingredients',
  read_minutes: 4,
  hero_gradient: 'sage',
  excerpt: 'What it does and who it is for.',
  body_md: '',
  citations: [],
  published_at: '2026-07-01T00:00:00.000Z',
};

const ok = (data: unknown): QueryResult => ({ data, error: null });

beforeEach(() => {
  resetSupabaseMock();
  useAuth.setState({ session: { user: { id: 'user-1' } } as never });
});

afterEach(() => {
  useAuth.setState({ session: null });
});

describe('Learn list bookmark toggle', () => {
  it('paints the bookmark filled before the server answers, and upserts it', async () => {
    // Hold the write open: whatever the icon shows while this is unresolved
    // is the optimistic toggle and nothing else.
    let settleUpsert: (result: QueryResult) => void = () => {};
    setResponder((call) => {
      if (call.table === 'learn_favorites' && call.op === 'upsert')
        return new Promise<QueryResult>((resolve) => (settleUpsert = resolve));
      if (call.table === 'articles') return ok([article]);
      if (call.table === 'learn_favorites') return ok([]);
      return { data: [], error: null };
    });

    renderWithProviders(<LearnScreen />);

    await waitFor(() => {
      expect(screen.getByText('Niacinamide 101')).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(screen.getByLabelText('Save for later'));
    });

    expect(screen.getByLabelText('Remove bookmark').props.accessibilityState.selected).toBe(true);

    const upsert = calls.find((c) => c.table === 'learn_favorites' && c.op === 'upsert');
    expect(upsert?.payload).toMatchObject({ user_id: 'user-1', article_slug: 'niacinamide-101' });

    await act(async () => {
      settleUpsert(ok([{ id: 'fav-1' }]));
    });
  });

  it('rolls the bookmark back to unsaved when the write fails', async () => {
    setResponder((call) => {
      if (call.table === 'articles') return ok([article]);
      if (call.table === 'learn_favorites' && call.op === 'upsert')
        return { data: null, error: { message: 'network down' } };
      if (call.table === 'learn_favorites') return ok([]);
      return { data: [], error: null };
    });

    renderWithProviders(<LearnScreen />);

    await waitFor(() => {
      expect(screen.getByLabelText('Save for later')).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(screen.getByLabelText('Save for later'));
    });

    await waitFor(() => {
      expect(screen.getByLabelText('Save for later').props.accessibilityState.selected).toBe(false);
    });
  });
});
