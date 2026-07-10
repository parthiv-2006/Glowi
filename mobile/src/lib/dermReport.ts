/**
 * Derm-visit export — renders the user's skin history (scans, routine,
 * reactions, shelf) into print-ready HTML for expo-print's HTML→PDF path.
 * Pure string building, no I/O: every user-sourced string is HTML-escaped at
 * the boundary, and the layout uses only inline print CSS so the PDF renders
 * identically on both platforms. The screen wiring lives in the Profile tab.
 */
import type { Profile, ReactionLog, Routine, RoutineStep, Scan, ShelfItem } from './types';

export interface DermReportInput {
  profile: Pick<Profile, 'display_name' | 'skin_type' | 'goals'> | null;
  scans: Scan[];
  routines: (Routine & { steps: RoutineStep[] })[];
  reactions: ReactionLog[];
  shelfItems: ShelfItem[];
  /** Injectable for deterministic tests. */
  today?: Date;
}

/** Scans shown in the history table — enough for a consult, bounded for print. */
export const MAX_REPORT_SCANS = 12;

const FREQUENCY_LABEL: Record<RoutineStep['frequency'], string> = {
  daily: 'daily',
  'every-other-day': 'every other day',
  '2-3x-week': '2–3× a week',
  weekly: 'weekly',
};

/** Escapes a user-sourced string for safe HTML interpolation. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? escapeHtml(iso)
    : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function titleCase(s: string): string {
  return s.replace(/[_-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function section(title: string, body: string): string {
  return `<section><h2>${title}</h2>${body}</section>`;
}

function scanRows(scans: Scan[]): string {
  return scans
    .map((s) => {
      const concerns = s.concerns
        .map((c) => `${escapeHtml(c.display_name)} (${c.severity}/100)`)
        .join(', ');
      return `<tr>
        <td>${fmtDate(s.created_at)}</td>
        <td>${s.skin_score ?? '—'}</td>
        <td>${concerns || '—'}</td>
        <td>${s.summary ? escapeHtml(s.summary) : '—'}</td>
      </tr>`;
    })
    .join('');
}

function routineBlock(routines: (Routine & { steps: RoutineStep[] })[]): string {
  if (routines.length === 0) return '<p class="empty">No routine on file.</p>';
  return routines
    .map((r) => {
      const steps = [...r.steps]
        .sort((a, b) => a.position - b.position)
        .map((step) => {
          const name = step.product?.name ?? step.custom_name ?? 'Product';
          const brand = step.product?.brand ? `${escapeHtml(step.product.brand)} ` : '';
          return `<li>${brand}${escapeHtml(name)} — ${escapeHtml(step.instruction)} <em>(${FREQUENCY_LABEL[step.frequency]})</em></li>`;
        })
        .join('');
      return `<h3>${r.period === 'am' ? 'Morning (AM)' : 'Evening (PM)'}</h3><ol>${steps || '<li>No steps.</li>'}</ol>`;
    })
    .join('');
}

function reactionRows(reactions: ReactionLog[]): string {
  return reactions
    .map(
      (r) => `<tr>
        <td>${fmtDate(r.reacted_on)}</td>
        <td>${r.brand ? `${escapeHtml(r.brand)} ` : ''}${escapeHtml(r.product_name)}</td>
        <td>${escapeHtml(r.severity)}</td>
        <td>${r.symptoms.map(escapeHtml).join(', ') || '—'}</td>
        <td>${r.key_ingredients.map(escapeHtml).join(', ') || '—'}</td>
      </tr>`,
    )
    .join('');
}

function shelfRows(items: ShelfItem[]): string {
  return items
    .map(
      (i) => `<tr>
        <td>${i.brand ? `${escapeHtml(i.brand)} ` : ''}${escapeHtml(i.name)}</td>
        <td>${i.category ? escapeHtml(titleCase(i.category)) : '—'}</td>
        <td>${i.key_ingredients.map(escapeHtml).join(', ') || '—'}</td>
        <td>${i.opened_at ? fmtDate(i.opened_at) : '—'}</td>
      </tr>`,
    )
    .join('');
}

/**
 * The full printable document. Scans render newest-first (capped at
 * MAX_REPORT_SCANS); only completed scans appear. Sections with no data state
 * that plainly rather than disappearing, so the derm sees what wasn't tracked.
 */
export function buildDermReportHtml(input: DermReportInput): string {
  const today = input.today ?? new Date();
  const name = input.profile?.display_name ? escapeHtml(input.profile.display_name) : 'Glowi user';
  const skinType = input.profile?.skin_type
    ? escapeHtml(titleCase(input.profile.skin_type))
    : 'Not set';
  const goals = input.profile?.goals?.length
    ? input.profile.goals.map((g) => escapeHtml(titleCase(g))).join(', ')
    : 'Not set';

  const completedScans = input.scans
    .filter((s) => s.status === 'complete')
    .slice()
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
    .slice(0, MAX_REPORT_SCANS);

  const activeShelf = input.shelfItems.filter((i) => i.status === 'active');

  const scansBody =
    completedScans.length === 0
      ? '<p class="empty">No completed scans on file.</p>'
      : `<table><thead><tr><th>Date</th><th>Score</th><th>Concerns (severity)</th><th>Summary</th></tr></thead><tbody>${scanRows(completedScans)}</tbody></table>`;

  const reactionsBody =
    input.reactions.length === 0
      ? '<p class="empty">No product reactions logged.</p>'
      : `<table><thead><tr><th>Date</th><th>Product</th><th>Severity</th><th>Symptoms</th><th>Ingredients at log time</th></tr></thead><tbody>${reactionRows(input.reactions)}</tbody></table>`;

  const shelfBody =
    activeShelf.length === 0
      ? '<p class="empty">No products on the shelf.</p>'
      : `<table><thead><tr><th>Product</th><th>Category</th><th>Key ingredients</th><th>Opened</th></tr></thead><tbody>${shelfRows(activeShelf)}</tbody></table>`;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  body { font-family: -apple-system, 'Segoe UI', Roboto, sans-serif; color: #1d1d1f; margin: 32px; font-size: 12px; }
  h1 { font-size: 20px; margin: 0 0 2px; }
  h2 { font-size: 14px; margin: 24px 0 8px; border-bottom: 1px solid #d8d3cc; padding-bottom: 4px; }
  h3 { font-size: 12px; margin: 12px 0 4px; }
  p.meta { color: #6e6a64; margin: 0 0 4px; }
  p.empty { color: #6e6a64; font-style: italic; }
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: left; padding: 5px 8px; border-bottom: 1px solid #eceae6; vertical-align: top; }
  th { color: #6e6a64; font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 0.4px; }
  ol { margin: 4px 0 12px 18px; padding: 0; }
  li { margin-bottom: 3px; }
  footer { margin-top: 28px; color: #6e6a64; font-size: 10px; border-top: 1px solid #d8d3cc; padding-top: 8px; }
</style>
</head>
<body>
  <h1>Skin summary — ${name}</h1>
  <p class="meta">Prepared with Glowi on ${fmtDate(today.toISOString())} for a dermatology consult.</p>
  <p class="meta">Self-reported skin type: ${skinType} · Goals: ${goals}</p>
  ${section('Scan history', scansBody)}
  ${section('Current routine', routineBlock(input.routines))}
  ${section('Product reactions', reactionsBody)}
  ${section('Products in use', shelfBody)}
  <footer>
    Skin scores and concern severities are AI estimates from smartphone photos, not clinical
    measurements. This summary is informational and is not a medical record or diagnosis.
  </footer>
</body>
</html>`;
}
