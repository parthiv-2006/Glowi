import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

/** Centralized query keys so invalidations stay consistent. */
export const qk = {
  concerns: ['concerns'] as const,
  concern: (slug: string) => ['concern', slug] as const,
  productsForConcern: (slug: string) => ['products', 'concern', slug] as const,
  products: (slugs: string[]) => ['products', 'by-slug', ...slugs] as const,
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
};
