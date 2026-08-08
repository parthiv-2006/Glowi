/** react-query hooks over the data access layer in api.ts. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/stores/auth';
import { useSettings } from '@/stores/settings';
import { getAIProvider } from './ai';
import * as api from './api';
import { qk } from './query';
import type { LifestyleLog } from './types';

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
/** The full product catalog — static seed data, so it's cached long. */
export function useCatalogProducts() {
  return useQuery({
    queryKey: qk.catalogProducts,
    queryFn: api.getCatalogProducts,
    staleTime: 24 * 60 * 60_000,
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

/** Slugs of the current user's bookmarked articles. */
export function useLearnFavorites() {
  return useQuery({ queryKey: qk.learnFavorites, queryFn: api.getLearnFavoriteSlugs });
}

/** Bookmark/unbookmark an article with an optimistic toggle and rollback on failure. */
export function useToggleLearnFavorite() {
  const qc = useQueryClient();
  const userId = useAuth((s) => s.session?.user.id);
  return useMutation({
    mutationFn: ({ slug, favorited }: { slug: string; favorited: boolean }) =>
      favorited ? api.removeLearnFavorite(slug) : api.addLearnFavorite(userId!, slug),
    onMutate: async ({ slug, favorited }) => {
      await qc.cancelQueries({ queryKey: qk.learnFavorites });
      const snapshot = qc.getQueryData<string[]>(qk.learnFavorites);
      qc.setQueryData<string[]>(qk.learnFavorites, (prev = []) =>
        favorited ? prev.filter((s) => s !== slug) : [...prev, slug],
      );
      return { snapshot };
    },
    onError: (_err, _vars, ctx) => {
      qc.setQueryData(qk.learnFavorites, ctx?.snapshot);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: qk.learnFavorites }),
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
  const userId = useAuth((s) => s.session?.user.id);
  const locationLabel = useSettings((s) => s.locationLabel);
  const locationCoords = useSettings((s) => s.locationCoords);
  return useQuery({
    queryKey: qk.forecast(today, locationLabel ?? undefined),
    queryFn: () =>
      getAIProvider().skinForecast(
        locationCoords
          ? { ...locationCoords, locationLabel: locationLabel ?? undefined }
          : undefined,
      ),
    // Never fetch without a session — the Home tab can mount for a frame during
    // the auth-gate redirect on a cold load, which otherwise fires an
    // unauthenticated forecast call (401).
    enabled: !!userId,
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

// ─────────────── Reaction Log ───────────────

export function useReactionLogs() {
  return useQuery({ queryKey: qk.reactions, queryFn: api.getReactionLogs });
}

export function useAddReactionLog() {
  const qc = useQueryClient();
  const userId = useAuth((s) => s.session?.user.id);
  return useMutation({
    mutationFn: (input: api.ReactionLogInput) => api.addReactionLog(userId!, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.reactions });
      // The log writes a gotcha memory in the same call.
      qc.invalidateQueries({ queryKey: qk.memories });
    },
  });
}

export function useDeleteReactionLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.deleteReactionLog,
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.reactions }),
  });
}

// ─────────────── Lifestyle Diary ───────────────

/** Merge a check-in patch into the cached list — updates the matching day's row or inserts it. */
function mergeLifestyleLog(list: LifestyleLog[], patch: api.LifestyleLogInput): LifestyleLog[] {
  const now = new Date().toISOString();
  const base: LifestyleLog = list.find((l) => l.log_date === patch.log_date) ?? {
    id: `optimistic-${patch.log_date}`,
    log_date: patch.log_date,
    sleep_quality: null,
    stress_level: null,
    water_level: null,
    diet_dairy: false,
    diet_sugar: false,
    diet_alcohol: false,
    cycle_phase: null,
    created_at: now,
    updated_at: now,
  };
  const merged: LifestyleLog = { ...base, ...patch, updated_at: now };
  return [merged, ...list.filter((l) => l.log_date !== patch.log_date)].sort((a, b) =>
    a.log_date < b.log_date ? 1 : -1,
  );
}

/** Lifestyle check-ins from the last `days` days — 30 covers the streak window and the card. */
export function useLifestyleLogs(days = 30) {
  return useQuery({
    queryKey: [...qk.lifestyleLogs, days],
    queryFn: () =>
      api.getLifestyleLogs(new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10)),
  });
}

/** Upsert a day's check-in with an optimistic merge across every mounted window. */
export function useUpsertLifestyleLog() {
  const qc = useQueryClient();
  const userId = useAuth((s) => s.session?.user.id);
  return useMutation({
    mutationFn: (log: api.LifestyleLogInput) => api.upsertLifestyleLog(userId!, log),
    onMutate: async (log) => {
      await qc.cancelQueries({ queryKey: qk.lifestyleLogs });
      const snapshot = qc.getQueriesData<LifestyleLog[]>({ queryKey: qk.lifestyleLogs });
      qc.setQueriesData<LifestyleLog[]>({ queryKey: qk.lifestyleLogs }, (prev) =>
        prev ? mergeLifestyleLog(prev, log) : prev,
      );
      return { snapshot };
    },
    onError: (_err, _log, ctx) => {
      ctx?.snapshot.forEach(([key, data]) => qc.setQueryData(key, data));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: qk.lifestyleLogs }),
  });
}

/**
 * The Weekly Glow Report for a completed week. The active AIProvider
 * generates-or-returns it and caches it forever server-side (reports are
 * immutable), so this is held indefinitely once fetched.
 */
export function useGlowReport(weekStart: string) {
  return useQuery({
    queryKey: qk.glowReport(weekStart),
    queryFn: () => getAIProvider().glowReport({ weekStart }),
    enabled: !!weekStart,
    staleTime: Infinity,
  });
}

/**
 * Past Glow Reports, newest first — a plain read over the immutable
 * `glow_reports` cache (no generation, so it never costs a token). Default
 * staleTime keeps it fresh after a new week's report is generated.
 */
export function useGlowReports(limit = 12) {
  return useQuery({
    queryKey: [...qk.glowReports, limit],
    queryFn: () => api.listGlowReports(limit),
  });
}

export function useScanComparison(scanIdBefore: string | null, scanIdAfter: string | null) {
  return useQuery({
    queryKey: qk.comparison(scanIdBefore ?? '', scanIdAfter ?? ''),
    queryFn: () =>
      getAIProvider().compareScans({ scanIdBefore: scanIdBefore!, scanIdAfter: scanIdAfter! }),
    enabled: !!scanIdBefore && !!scanIdAfter,
    staleTime: Infinity,
  });
}

/**
 * Coach-voiced "why this over that" line per candidate product for a
 * triggered shelf item (F1). Cached server-side per (shelf item, product)
 * pair, so this hook's own Infinity staleTime never re-pays a Claude call —
 * missing keys in the result just mean the caller keeps its deterministic
 * rationale for that candidate.
 */
export function useReplenishmentCopy(triggerItemId: string | null, productIds: string[]) {
  return useQuery({
    queryKey: qk.replenishmentCopy(triggerItemId ?? '', productIds),
    queryFn: () => getAIProvider().replenishmentCopy({ triggerItemId: triggerItemId!, productIds }),
    enabled: !!triggerItemId && productIds.length > 0,
    staleTime: Infinity,
  });
}
