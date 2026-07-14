/**
 * The check-in card has no save button: every tap is an immediate upsert with
 * an optimistic merge. That makes two things worth guarding — the tap has to
 * paint instantly (or the habit feels broken), and a failed write has to put
 * the old value back rather than leave a lie on screen showing a level that
 * was never stored.
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

import { DailyCheckinCard } from '@/components/DailyCheckinCard';
import { calls, resetSupabaseMock, setResponder, type QueryResult } from '@/test/supabaseMock';
import { renderWithProviders } from '@/test/render';
import { qk } from '@/lib/query';
import { useAuth } from '@/stores/auth';
import type { LifestyleLog } from '@/lib/types';

jest.mock('@/lib/supabase', () => jest.requireActual('@/test/supabaseMock'));
// The health seam reaches for HealthKit/Health Connect, which do not exist under
// Jest. It already returns null on any failure — this just keeps it quiet and
// keeps the auto-fill suggestion out of tests that are not about it.
jest.mock('@/lib/health', () => ({ getLastNightSleepHours: jest.fn(async () => null) }));

const TODAY = new Date().toISOString().slice(0, 10);

function log(patch: Partial<LifestyleLog> = {}): LifestyleLog {
  return {
    id: 'log-1',
    log_date: TODAY,
    sleep_quality: null,
    stress_level: null,
    water_level: null,
    diet_dairy: false,
    diet_sugar: false,
    diet_alcohol: false,
    cycle_phase: null,
    created_at: `${TODAY}T08:00:00.000Z`,
    updated_at: `${TODAY}T08:00:00.000Z`,
    ...patch,
  };
}

beforeEach(() => {
  resetSupabaseMock();
  // The upsert reads the user id straight from the session.
  useAuth.setState({ session: { user: { id: 'user-1' } } as never });
});

afterEach(() => {
  useAuth.setState({ session: null });
});

describe('DailyCheckinCard', () => {
  it('paints the tapped level before the server answers, and upserts it', async () => {
    // Hold the write open: whatever the card shows while this is unresolved is
    // the optimistic merge and nothing else.
    let settleUpsert: (result: QueryResult) => void = () => {};
    setResponder((call) => {
      if (call.op === 'upsert')
        return new Promise<QueryResult>((resolve) => (settleUpsert = resolve));
      return { data: [], error: null };
    });

    const { queryClient } = renderWithProviders(<DailyCheckinCard />);

    // The optimistic merge patches the cached list, so it needs that list to
    // exist — before the first read lands there is nothing to merge into.
    await waitFor(() => {
      expect(queryClient.getQueriesData({ queryKey: qk.lifestyleLogs })[0]?.[1]).toBeDefined();
    });

    await act(async () => {
      fireEvent.press(screen.getByLabelText('Sleep: Great'));
    });

    expect(screen.getByLabelText('Sleep: Great').props.accessibilityState.selected).toBe(true);

    const upsert = calls.find((c) => c.table === 'lifestyle_logs' && c.op === 'upsert');
    expect(upsert?.payload).toMatchObject({
      user_id: 'user-1',
      log_date: TODAY,
      sleep_quality: 2,
    });

    await act(async () => {
      settleUpsert({ data: log({ sleep_quality: 2 }), error: null });
    });
  });

  it('rolls the optimistic merge back when the write fails', async () => {
    // Serve an existing "Okay" answer on read, then fail the write: the card must
    // return to Okay, not sit there showing the Great the server never accepted.
    setResponder((call) =>
      call.op === 'upsert'
        ? { data: null, error: { message: 'network down' } }
        : { data: [log({ sleep_quality: 1 })], error: null },
    );

    renderWithProviders(<DailyCheckinCard />);

    await waitFor(() => {
      expect(screen.getByLabelText('Sleep: Okay').props.accessibilityState.selected).toBe(true);
    });

    await act(async () => {
      fireEvent.press(screen.getByLabelText('Sleep: Great'));
    });

    await waitFor(() => {
      expect(screen.getByLabelText('Sleep: Okay').props.accessibilityState.selected).toBe(true);
    });
    expect(screen.getByLabelText('Sleep: Great').props.accessibilityState.selected).toBe(false);
  });

  it('collapses to a summary once all three scales are answered', async () => {
    setResponder((call) =>
      call.op === 'upsert'
        ? { data: null, error: null }
        : {
            data: [log({ sleep_quality: 2, stress_level: 0, water_level: 2, diet_sugar: true })],
            error: null,
          },
    );

    renderWithProviders(<DailyCheckinCard />);

    await waitFor(() => {
      expect(screen.getByText('Logged for today')).toBeTruthy();
    });
    expect(screen.getByText('Slept great · Low stress · Well hydrated · sugar')).toBeTruthy();
  });
});
