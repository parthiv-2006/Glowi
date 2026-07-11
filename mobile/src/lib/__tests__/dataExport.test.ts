import { describe, expect, it } from '@jest/globals';

import { assembleExport, EXPORT_README } from '../dataExport';

const META = { userId: 'user-1', exportedAt: '2026-07-11T12:00:00.000Z' };

describe('assembleExport', () => {
  it('keys every table and preserves rows verbatim', () => {
    const tables = {
      scans: [{ id: 's1', skin_score: 72 }],
      shelf_items: [
        { id: 'i1', name: 'Serum' },
        { id: 'i2', name: 'SPF' },
      ],
      lifestyle_logs: [],
    };
    const out = assembleExport(tables, META);
    expect(Object.keys(out.tables)).toEqual(['scans', 'shelf_items', 'lifestyle_logs']);
    expect(out.tables.scans).toEqual([{ id: 's1', skin_score: 72 }]);
    expect(out.tables.shelf_items).toHaveLength(2);
    expect(out.tables.lifestyle_logs).toEqual([]);
  });

  it('stamps meta and the readme', () => {
    const out = assembleExport({}, META);
    expect(out.user_id).toBe('user-1');
    expect(out.exported_at).toBe('2026-07-11T12:00:00.000Z');
    expect(out.readme).toBe(EXPORT_README);
  });

  it('strips opaque embedding vectors but keeps the memory text', () => {
    const out = assembleExport(
      {
        ai_memories: [
          { id: 'm1', content: 'Allergic to lanolin', embedding: '[0.1,0.2]', importance: 5 },
          { id: 'm2', content: 'Prefers fragrance-free', embedding: null },
        ],
      },
      META,
    );
    expect(out.tables.ai_memories[0]).toEqual({
      id: 'm1',
      content: 'Allergic to lanolin',
      importance: 5,
    });
    expect(out.tables.ai_memories[1]).toEqual({ id: 'm2', content: 'Prefers fragrance-free' });
  });

  it('is serializable as-is (the file written to the share sheet)', () => {
    const out = assembleExport({ scans: [{ id: 's1' }] }, META);
    const roundTripped = JSON.parse(JSON.stringify(out));
    expect(roundTripped).toEqual(out);
  });
});
