/**
 * GDPR data export (portability) — assembles every user-owned row into one
 * JSON document, keyed by table. Pure assembly lives in assembleExport
 * (unit-tested); fetchExportTables is the thin I/O wrapper over api.ts.
 * Zero AI calls. Photos are referenced by storage path, not bundled —
 * signed URLs expire, which would make a bundled link misleading.
 */
export const EXPORT_README =
  'This file contains all data Glowi holds for your account, keyed by table. ' +
  'Photos are referenced by their storage paths (image_path fields) and can be ' +
  'viewed in the app; image files are not bundled because download links expire. ' +
  'AI memory embeddings (opaque numeric vectors) are omitted — the memory text ' +
  'itself is included in ai_memories.';

export interface GlowiExport {
  readme: string;
  exported_at: string;
  user_id: string;
  tables: Record<string, Record<string, unknown>[]>;
}

/** Drops opaque columns (pgvector embeddings) that carry no user meaning. */
function stripOpaque(row: Record<string, unknown>): Record<string, unknown> {
  if (!('embedding' in row)) return row;
  const { embedding: _embedding, ...rest } = row;
  return rest;
}

/** Pure: shape the fetched rows into the final export document. */
export function assembleExport(
  tables: Record<string, Record<string, unknown>[]>,
  meta: { userId: string; exportedAt: string },
): GlowiExport {
  return {
    readme: EXPORT_README,
    exported_at: meta.exportedAt,
    user_id: meta.userId,
    tables: Object.fromEntries(
      Object.entries(tables).map(([table, rows]) => [table, rows.map(stripOpaque)]),
    ),
  };
}

/** Fetches every user-owned table (RLS scopes each query to the caller). */
export async function fetchExportTables(): Promise<Record<string, Record<string, unknown>[]>> {
  // Lazy import: api.ts pulls in the supabase client (native storage deps),
  // which must not load when jest imports this module for the pure tests.
  const api = await import('./api');
  const [
    scans,
    sessions,
    routines,
    shelfItems,
    reactionLogs,
    glowReports,
    memories,
    lifestyleLogs,
    checkins,
    chatMessages,
    forecasts,
    comparisons,
    conflictReports,
    reminderSettings,
    pushTokens,
  ] = await Promise.all([
    api.getScans(),
    api.getSessions(),
    api.getRoutines(),
    api.getShelfItems(),
    api.getReactionLogs(),
    api.listGlowReports(1000),
    api.getExportRows('ai_memories'),
    api.getExportRows('lifestyle_logs'),
    api.getExportRows('routine_checkins'),
    api.getExportRows('chat_messages'),
    api.getExportRows('skin_forecasts'),
    api.getExportRows('scan_comparisons'),
    api.getExportRows('conflict_reports'),
    api.getExportRows('reminder_settings'),
    api.getExportRows('push_tokens'),
  ]);

  return {
    scans: scans as unknown as Record<string, unknown>[],
    chat_sessions: sessions as unknown as Record<string, unknown>[],
    chat_messages: chatMessages,
    ai_memories: memories,
    routines: routines as unknown as Record<string, unknown>[],
    routine_checkins: checkins,
    shelf_items: shelfItems as unknown as Record<string, unknown>[],
    reaction_logs: reactionLogs as unknown as Record<string, unknown>[],
    lifestyle_logs: lifestyleLogs,
    glow_reports: glowReports as unknown as Record<string, unknown>[],
    skin_forecasts: forecasts,
    scan_comparisons: comparisons,
    conflict_reports: conflictReports,
    reminder_settings: reminderSettings,
    push_tokens: pushTokens,
  };
}
