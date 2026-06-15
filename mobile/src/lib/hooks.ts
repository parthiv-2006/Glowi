/** react-query hooks over the data access layer in api.ts. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/stores/auth';
import { getAIProvider } from './ai';
import * as api from './api';
import { qk } from './query';

export function useConcerns() {
  return useQuery({ queryKey: qk.concerns, queryFn: api.getConcerns });
}
export function useConcern(slug: string) {
  return useQuery({
    queryKey: qk.concern(slug),
    queryFn: () => api.getConcern(slug),
    enabled: !!slug,
  });
}
export function useProductsForConcern(slug: string) {
  return useQuery({
    queryKey: qk.productsForConcern(slug),
    queryFn: () => api.getProductsForConcern(slug),
    enabled: !!slug,
  });
}
export function useProductsBySlug(slugs: string[]) {
  return useQuery({
    queryKey: qk.products(slugs),
    queryFn: () => api.getProductsBySlug(slugs),
    enabled: slugs.length > 0,
  });
}
export function useNutritionGuide(slug: string) {
  return useQuery({
    queryKey: qk.nutrition(slug),
    queryFn: () => api.getNutritionGuide(slug),
    enabled: !!slug,
  });
}
export function useTips(slug: string) {
  return useQuery({ queryKey: qk.tips(slug), queryFn: () => api.getTips(slug), enabled: !!slug });
}
export function useArticles() {
  return useQuery({ queryKey: qk.articles, queryFn: api.getArticles });
}
export function useArticle(slug: string) {
  return useQuery({
    queryKey: qk.article(slug),
    queryFn: () => api.getArticle(slug),
    enabled: !!slug,
  });
}

export function useScans() {
  return useQuery({ queryKey: qk.scans, queryFn: api.getScans });
}
export function useScan(id: string) {
  return useQuery({ queryKey: qk.scan(id), queryFn: () => api.getScan(id), enabled: !!id });
}

export function useSessions() {
  return useQuery({ queryKey: qk.sessions, queryFn: api.getSessions });
}
export function useMessages(sessionId: string) {
  return useQuery({
    queryKey: qk.messages(sessionId),
    queryFn: () => api.getMessages(sessionId),
    enabled: !!sessionId,
  });
}

export function useMemories() {
  return useQuery({ queryKey: qk.memories, queryFn: api.getMemories });
}
export function useDeleteMemory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.deleteMemory,
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.memories }),
  });
}

export function useRoutines() {
  return useQuery({ queryKey: qk.routines, queryFn: api.getRoutines });
}

/** Check-ins from the last 60 days — enough for the streak + grid. */
export function useRecentCheckins() {
  return useQuery({
    queryKey: qk.checkins,
    // `since` is computed in the queryFn (not during render) to stay pure.
    queryFn: () =>
      api.getCheckins(new Date(Date.now() - 60 * 86_400_000).toISOString().slice(0, 10)),
  });
}

export function useCheckIn() {
  const qc = useQueryClient();
  const userId = useAuth((s) => s.session?.user.id);
  return useMutation({
    mutationFn: (routineId: string) => api.checkInRoutine(userId!, routineId),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.checkins }),
  });
}

/**
 * Today's Skin Weather forecast. The active AIProvider generates-or-returns it
 * (idempotent per day), so this is cached for the rest of the day.
 */
export function useSkinForecast() {
  const today = new Date().toISOString().slice(0, 10);
  return useQuery({
    queryKey: qk.forecast(today),
    queryFn: () => getAIProvider().skinForecast(),
    staleTime: 6 * 60 * 60_000,
  });
}

// ─────────────── Shelf ───────────────

export function useShelfItems() {
  return useQuery({ queryKey: qk.shelf, queryFn: api.getShelfItems });
}

export function useAddShelfItem() {
  const qc = useQueryClient();
  const userId = useAuth((s) => s.session?.user.id);
  return useMutation({
    mutationFn: (input: api.ShelfItemInput & { name: string }) => api.addShelfItem(userId!, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.shelf });
      // The forecast routes through owned products — refresh it next open.
      qc.invalidateQueries({ queryKey: ['skin-forecast'] });
    },
  });
}

export function useUpdateShelfItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: api.ShelfItemInput }) =>
      api.updateShelfItem(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.shelf }),
  });
}

export function useDeleteShelfItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.deleteShelfItem,
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.shelf }),
  });
}

export function useMarkShelfItemUsed() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.markShelfItemUsed,
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.shelf }),
  });
}
