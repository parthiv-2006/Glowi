import { AppState, Platform, type AppStateStatus } from 'react-native';
import { focusManager, QueryClient } from '@tanstack/react-query';

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

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      retry: 1,
      // Now meaningful, thanks to the AppState wiring above.
      refetchOnWindowFocus: true,
      // NOTE: `onlineManager` is still unwired — React Query believes the device is
      // always online, so queries fail rather than pausing, and there is no automatic
      // refetch the moment connectivity returns. Wiring it needs a connectivity source
      // (@react-native-community/netinfo or expo-network), which is a native module and
      // therefore a new EAS build. Deferred to an owner decision; see docs/RELEASE.md.
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
