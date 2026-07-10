import { describe, expect, it } from '@jest/globals';

import { buildDermReportHtml, escapeHtml, MAX_REPORT_SCANS } from '../dermReport';
import type { DermReportInput } from '../dermReport';
import type { ReactionLog, Scan } from '../types';

function scan(partial: Partial<Scan>): Scan {
  return {
    id: 's1',
    user_id: 'u1',
    image_path: null,
    status: 'complete',
    skin_score: 70,
    skin_type_estimate: null,
    summary: null,
    concerns: [],
    area: null,
    notes: null,
    capture_meta: null,
    created_at: '2026-06-01T12:00:00Z',
    ...partial,
  };
}

function input(partial: Partial<DermReportInput>): DermReportInput {
  return {
    profile: { display_name: 'Ada', skin_type: 'combination', goals: ['clear_skin'] },
    scans: [],
    routines: [],
    reactions: [],
    shelfItems: [],
    today: new Date('2026-07-10T12:00:00Z'),
    ...partial,
  };
}

describe('escapeHtml', () => {
  it('escapes markup-significant characters', () => {
    expect(escapeHtml(`<script>alert("x&y'")</script>`)).toBe(
      '&lt;script&gt;alert(&quot;x&amp;y&#39;&quot;)&lt;/script&gt;',
    );
  });
});

describe('buildDermReportHtml', () => {
  it('renders profile facts and honest empty sections', () => {
    const html = buildDermReportHtml(input({}));
    expect(html).toContain('Skin summary — Ada');
    expect(html).toContain('Combination');
    expect(html).toContain('Clear Skin');
    expect(html).toContain('No completed scans on file.');
    expect(html).toContain('No routine on file.');
    expect(html).toContain('No product reactions logged.');
    expect(html).toContain('No products on the shelf.');
  });

  it('lists completed scans newest-first with concerns and skips pending ones', () => {
    const html = buildDermReportHtml(
      input({
        scans: [
          scan({
            id: 'old',
            created_at: '2026-06-01T12:00:00Z',
            skin_score: 60,
            concerns: [
              {
                concern_slug: 'acne',
                display_name: 'Breakouts',
                severity: 40,
                confidence: 0.9,
                areas: [],
                observations: '',
                caution: null,
              },
            ],
          }),
          scan({ id: 'new', created_at: '2026-07-01T12:00:00Z', skin_score: 72 }),
          scan({ id: 'pending', status: 'pending', created_at: '2026-07-05T12:00:00Z' }),
        ],
      }),
    );
    expect(html).toContain('Breakouts (40/100)');
    expect(html.indexOf('Jul 1, 2026')).toBeLessThan(html.indexOf('Jun 1, 2026'));
    expect(html).not.toContain('Jul 5, 2026'); // pending scan excluded
  });

  it('caps the scan table at MAX_REPORT_SCANS', () => {
    const many = Array.from({ length: MAX_REPORT_SCANS + 5 }, (_, i) =>
      scan({
        id: `s${i}`,
        created_at: `2026-05-${String((i % 28) + 1).padStart(2, '0')}T12:00:00Z`,
      }),
    );
    const html = buildDermReportHtml(input({ scans: many }));
    expect((html.match(/<tr>\s*<td>/g) ?? []).length).toBe(MAX_REPORT_SCANS);
  });

  it('escapes user-sourced strings end to end', () => {
    const html = buildDermReportHtml(
      input({
        reactions: [
          {
            id: 'r1',
            shelf_item_id: null,
            product_name: '<img src=x onerror=alert(1)>',
            brand: null,
            key_ingredients: ['a&b'],
            reacted_on: '2026-06-10',
            symptoms: ['Redness'],
            severity: 'moderate',
            notes: null,
            created_at: '2026-06-10',
            updated_at: '2026-06-10',
          } as ReactionLog,
        ],
      }),
    );
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).toContain('a&amp;b');
  });

  it('orders routine steps by position with frequency labels', () => {
    const html = buildDermReportHtml(
      input({
        routines: [
          {
            id: 'am',
            period: 'am',
            generated_from_scan: null,
            updated_at: '2026-07-01',
            steps: [
              {
                id: 'st2',
                routine_id: 'am',
                position: 2,
                product_id: null,
                custom_name: 'SPF 50',
                instruction: 'Finish with sunscreen',
                frequency: 'daily',
              },
              {
                id: 'st1',
                routine_id: 'am',
                position: 1,
                product_id: null,
                custom_name: 'Gentle Cleanser',
                instruction: 'Massage and rinse',
                frequency: '2-3x-week',
              },
            ],
          },
        ],
      }),
    );
    expect(html).toContain('Morning (AM)');
    expect(html.indexOf('Gentle Cleanser')).toBeLessThan(html.indexOf('SPF 50'));
    expect(html).toContain('2–3× a week');
  });
});
