import { AppState, Platform, type AppStateStatus } from 'react-native';
import { focusManager, onlineManager, QueryClient } from '@tanstack/react-query';
import * as Network from 'expo-network';

/**
 * React Query detects "focus" with a browser `visibilitychange` listener, which
 * does not exist in React Native — so its focus tracking is inert here and
 * `refetchOnWindowFocus` was a setting that did nothing either way. Feed it
 * AppState instead, and the app refreshes stale data when the user comes back to
 * it: the ordinary way a phone recovers from a spell of no signal.
 *
 * Bounded by `staleTime` below, so returning to the app inside a minute is free.
 */
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (status: AppStateStatus) => {
    focusManager.setFocused(status === 'active');
  });
}

/**
 * `isInternetReachable` is the honest signal — a phone attached to a captive-portal
 * Wi-Fi is "connected" but can't reach us. It is not always populated, though, and
 * an absent value must not read as offline: guessing offline pauses every query and
 * strands a user who is in fact fine. So only an explicit `false` counts against a
 * connection that reports itself present.
 */
function isOnline(state: Network.NetworkState): boolean {
  return state.isConnected === true && state.isInternetReachable !== false;
}

/**
 * Connectivity, likewise, is a browser API that React Query cannot find on native:
 * left alone, `onlineManager` assumes the device is permanently online, so queries
 * fail instead of pausing and nothing refetches the moment signal returns. Feeding it
 * expo-network buys both behaviours — offline mutations queue, and reconnecting
 * refreshes what went stale while the user was in the tunnel.
 *
 * Web keeps React Query's own `online`/`offline` window events, which work there.
 */
if (Platform.OS !== 'web') {
  onlineManager.setEventListener((setOnline) => {
    // The listener only fires on *change*, so seed it with the state at startup —
    // otherwise an app launched offline believes it is online until the radio flips.
    void Network.getNetworkStateAsync()
      .then((state) => setOnline(isOnline(state)))
      .catch(() => {});
    const sub = Network.addNetworkStateListener((state) => setOnline(isOnline(state)));
    return () => sub.remove();
  });
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      retry: 1,
      // Both now meaningful, thanks to the AppState and expo-network wiring above.
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      /**
       * `networkMode: 'always'` is a deliberate choice, not the default.
       *
       * React Query's default ('online') *pauses* a query when the device is offline:
       * it never fetches, so the query sits at `isPending` with `isFetching: false`.
       * Every route here branches loading → error → empty → data on `isLoading` /
       * `isError`, and a paused query is neither — it would fall through to the empty
       * state and tell an offline user with a full shelf that their shelf is empty.
       * That is precisely the lie D2 removed, and pausing would reintroduce it on
       * every route at once.
       *
       * Pausing would only earn its keep alongside an offline-aware UI on ~15 routes
       * and a persisted mutation queue (without persistence a paused mutation dies
       * with the process anyway). Neither exists, so we let fetches fire and fail,
       * which lands the user on the designed `ErrorState` — "check your connection,
       * try again" — the honest thing to show.
       *
       * What the connectivity signal buys us is `refetchOnReconnect`: the moment
       * signal returns, the stale screen heals itself instead of waiting for the user
       * to find the retry button.
       */
      networkMode: 'always',
    },
    mutations: {
      // Same reasoning: a mutation must fail loudly into the screen's existing error
      // handling (chat send restores the draft, check-in rolls back) rather than
      // silently queue in memory and vanish when the app is killed.
      networkMode: 'always',
    },
  },
});

/** Centralized query keys so invalidations stay consistent. */
export const qk = {
  concerns: ['concerns'] as const,
  concern: (slug: string) => ['concern', slug] as const,
  productsForConcern: (slug: string) => ['products', 'concern', slug] as const,
  products: (slugs: string[]) => ['products', 'by-slug', ...slugs] as const,
  catalogProducts: ['products', 'catalog'] as const,
  nutrition: (slug: string) => ['nutrition', slug] as const,
  tips: (slug: string) => ['tips', slug] as const,
  articles: ['articles'] as const,
  article: (slug: string) => ['article', slug] as const,
  scans: ['scans'] as const,
  scan: (id: string) => ['scan', id] as const,
  sessions: ['chat-sessions'] as const,
  messages: (sessionId: string) => ['chat-messages', sessionId] as const,
  memories: ['ai-memories'] as const,
  routines: ['routines'] as const,
  checkins: ['routine-checkins'] as const,
  reminders: ['reminders'] as const,
  forecast: (date: string, location?: string) =>
    ['skin-forecast', date, location ?? 'default'] as const,
  shelf: ['shelf-items'] as const,
  reactions: ['reaction-logs'] as const,
  lifestyleLogs: ['lifestyle-logs'] as const,
  conflictReport: ['conflict-report'] as const,
  comparison: (beforeId: string, afterId: string) =>
    ['scan-comparison', beforeId, afterId] as const,
  glowReport: (weekStart: string) => ['glow-report', weekStart] as const,
  glowReports: ['glow-reports'] as const,
};
