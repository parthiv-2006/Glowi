/**
 * conflictGraph — turns an ingredient {@link ConflictReport} into a small,
 * deterministic node/edge graph the {@link ConflictGraph} component can draw.
 * Nodes are the user's shelf products (deduped by name); edges are the pairwise
 * interactions between the products a single conflict names. Pure, I/O-free —
 * unit-tested in `lib/__tests__/conflictGraph.test.ts`.
 *
 * Degradation contract: this is never the source of truth. Zero-product
 * conflicts are excluded from the graph but stay visible as cards; a product
 * named two different ways becomes two nodes (accepted — the cards are ground
 * truth). The graph is a visual index over the cards, nothing more.
 */
import type { ConflictReport, ConflictSeverity } from './types';

export interface ConflictNode {
  /** Normalized (trim + lowercase) product name — identity and sort key. */
  id: string;
  /** First-seen original casing, for display. */
  label: string;
  /** Circle-layout position, 0–1 in both axes. */
  x: number;
  y: number;
  /** Conflict indices (into `report.conflicts`) this product is part of, ascending. */
  conflictIndices: number[];
  /** Severities of the single-product conflicts that flagged this product alone. */
  selfSeverities: ConflictSeverity[];
}

export interface ConflictEdge {
  /** Node id, always ordered `from` < `to` alphabetically. */
  from: string;
  to: string;
  severity: ConflictSeverity;
  conflictIndex: number;
  /** 0 for a pair's first edge; increments for duplicate same-pair edges (drives the bow). */
  parallelIndex: number;
}

export interface ConflictGraphModel {
  nodes: ConflictNode[];
  edges: ConflictEdge[];
  /** Conflicts naming no products — kept out of the graph, still shown as cards. */
  excludedConflictIndices: number[];
}

/** Draw priority: time_of_day underneath, avoid on top. Also ranks self-ring "worst". */
const DRAW_RANK: Record<ConflictSeverity, number> = {
  time_of_day: 0,
  caution: 1,
  avoid: 2,
};

const normalizeName = (name: string): string => name.trim().toLowerCase().replace(/\s+/g, ' ');

/** Clip a product name to fit inside a node label, ellipsizing when it overflows. */
export function truncateLabel(name: string, max = 12): string {
  if (name.length <= max) return name;
  return `${name.slice(0, max - 1).trimEnd()}…`;
}

export function buildConflictGraph(report: ConflictReport): ConflictGraphModel {
  interface Draft {
    id: string;
    label: string;
    conflictIndices: number[];
    selfSeverities: ConflictSeverity[];
  }
  const drafts = new Map<string, Draft>();
  const excludedConflictIndices: number[] = [];
  const rawEdges: Omit<ConflictEdge, 'parallelIndex'>[] = [];

  report.conflicts.forEach((conflict, conflictIndex) => {
    // Dedup this conflict's products by normalized name; first casing seen wins.
    const ids: string[] = [];
    for (const product of conflict.products) {
      const id = normalizeName(product);
      if (id.length === 0) continue;
      if (!drafts.has(id)) {
        drafts.set(id, { id, label: product.trim(), conflictIndices: [], selfSeverities: [] });
      }
      if (!ids.includes(id)) ids.push(id);
    }

    if (ids.length === 0) {
      excludedConflictIndices.push(conflictIndex);
      return;
    }

    for (const id of ids) drafts.get(id)!.conflictIndices.push(conflictIndex);

    if (ids.length === 1) {
      drafts.get(ids[0])!.selfSeverities.push(conflict.severity);
      return;
    }

    // Pairwise edges over the conflict's products, ordered from < to.
    const sorted = [...ids].sort();
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        rawEdges.push({
          from: sorted[i],
          to: sorted[j],
          severity: conflict.severity,
          conflictIndex,
        });
      }
    }
  });

  // Deterministic circle layout: alphabetical, first node pinned to the top (−90°).
  const ids = [...drafts.keys()].sort();
  const n = ids.length;
  const nodes: ConflictNode[] = ids.map((id, i) => {
    const draft = drafts.get(id)!;
    const theta = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    return {
      id,
      label: draft.label,
      x: 0.5 + 0.4 * Math.cos(theta),
      y: 0.5 + 0.4 * Math.sin(theta),
      conflictIndices: draft.conflictIndices,
      selfSeverities: draft.selfSeverities,
    };
  });

  // parallelIndex per pair, assigned in encounter (conflict) order.
  const seenPairs = new Map<string, number>();
  const edges: ConflictEdge[] = rawEdges.map((edge) => {
    const key = `${edge.from}|${edge.to}`;
    const parallelIndex = seenPairs.get(key) ?? 0;
    seenPairs.set(key, parallelIndex + 1);
    return { ...edge, parallelIndex };
  });

  // Draw order (fully tie-broken so the result is deterministic regardless of sort stability):
  // time_of_day first, avoid last (drawn on top).
  edges.sort(
    (a, b) =>
      DRAW_RANK[a.severity] - DRAW_RANK[b.severity] ||
      a.conflictIndex - b.conflictIndex ||
      (a.from < b.from ? -1 : a.from > b.from ? 1 : 0) ||
      (a.to < b.to ? -1 : a.to > b.to ? 1 : 0) ||
      a.parallelIndex - b.parallelIndex,
  );

  return { nodes, edges, excludedConflictIndices };
}
