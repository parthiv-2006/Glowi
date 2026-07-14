/**
 * Renders a component inside the providers the app actually gives it.
 *
 * A fresh QueryClient per test keeps caches from leaking between them, and
 * `retry: false` makes a failure path fail on the first attempt instead of
 * making the test wait out React Query's backoff. `networkMode: 'always'`
 * mirrors `lib/query.ts` deliberately: under the default 'online', a query in
 * a Jest environment with no navigator can pause and report neither loading
 * nor error, which is the precise failure mode D2 removed from the app — the
 * tests must exercise the same mode the app ships.
 */
import type { ReactElement, ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { render, type RenderResult } from '@testing-library/react-native';

/** Metrics for the fake safe-area frame; without them insets read as undefined. */
const SAFE_AREA = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity, networkMode: 'always' },
      mutations: { retry: false, networkMode: 'always' },
    },
  });
}

export interface RenderWithProvidersResult extends RenderResult {
  queryClient: QueryClient;
}

export function renderWithProviders(
  ui: ReactElement,
  queryClient: QueryClient = createTestQueryClient(),
): RenderWithProvidersResult {
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <SafeAreaProvider initialMetrics={SAFE_AREA}>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </SafeAreaProvider>
    );
  }

  return { ...render(ui, { wrapper: Wrapper }), queryClient };
}
