import { describe, expect, it } from '@jest/globals';

import {
  DEFAULT_PAO_MONTHS,
  effectiveShelfLifeMonths,
  expiryLabel,
  expiryStatus,
  stockStatus,
  summarizeShelf,
} from '../shelf';
import type { ShelfItem } from '../types';

const TODAY = new Date('2026-06-14T12:00:00');

function item(partial: Partial<ShelfItem>): ShelfItem {
  return {
    id: 'x',
    product_id: null,
    name: 'Test',
    brand: null,
    category: null,
    image_path: null,
    size_label: null,
    opened_at: null,
    shelf_life_months: null,
    amount_remaining: 100,
    times_used: 0,
    last_used_at: null,
    status: 'active',
    notes: null,
    created_at: '2026-06-01',
    updated_at: '2026-06-01',
    ...partial,
  };
}

describe('effectiveShelfLifeMonths', () => {
  it('prefers an explicit value', () => {
    expect(effectiveShelfLifeMonths({ shelf_life_months: 3, category: 'moisturizer' })).toBe(3);
  });
  it('falls back to the category default', () => {
    expect(effectiveShelfLifeMonths({ shelf_life_months: null, category: 'serum' })).toBe(
      DEFAULT_PAO_MONTHS.serum,
    );
  });
  it('falls back to 12 when nothing is known', () => {
    expect(effectiveShelfLifeMonths({ shelf_life_months: null, category: null })).toBe(12);
  });
});

describe('expiryStatus', () => {
  it('is sealed before opening', () => {
    expect(expiryStatus(item({ opened_at: null }), TODAY).kind).toBe('sealed');
  });
  it('is fresh well within shelf life', () => {
    const e = expiryStatus(item({ opened_at: '2026-06-01', shelf_life_months: 12 }), TODAY);
    expect(e.kind).toBe('fresh');
    expect(e.daysLeft).toBeGreaterThan(14);
  });
  it('warns when within two weeks of PAO', () => {
    const e = expiryStatus(item({ opened_at: '2026-05-25', shelf_life_months: 1 }), TODAY);
    expect(e.kind).toBe('expiring');
    expect(e.daysLeft).toBeLessThanOrEqual(14);
    expect(e.daysLeft).toBeGreaterThanOrEqual(0);
  });
  it('is expired past PAO', () => {
    const e = expiryStatus(item({ opened_at: '2026-04-01', shelf_life_months: 1 }), TODAY);
    expect(e.kind).toBe('expired');
    expect(e.daysLeft).toBeLessThan(0);
  });
});

describe('stockStatus', () => {
  it('classifies levels', () => {
    expect(stockStatus(100)).toBe('ok');
    expect(stockStatus(21)).toBe('ok');
    expect(stockStatus(20)).toBe('low');
    expect(stockStatus(1)).toBe('low');
    expect(stockStatus(0)).toBe('out');
  });
});

describe('summarizeShelf', () => {
  it('counts attention items', () => {
    const items = [
      item({ id: 'a', opened_at: '2026-06-01', shelf_life_months: 12, amount_remaining: 80 }), // fresh, ok
      item({ id: 'b', opened_at: '2026-05-25', shelf_life_months: 1, amount_remaining: 50 }), // expiring
      item({ id: 'c', opened_at: '2026-04-01', shelf_life_months: 1, amount_remaining: 10 }), // expired + low
    ];
    const s = summarizeShelf(items, TODAY);
    expect(s.total).toBe(3);
    expect(s.expiring).toBe(1);
    expect(s.expired).toBe(1);
    expect(s.low).toBe(1);
  });
});

describe('expiryLabel', () => {
  it('reads naturally', () => {
    expect(expiryLabel({ kind: 'sealed', daysLeft: null, expiresOn: null })).toBe('Unopened');
    expect(expiryLabel({ kind: 'fresh', daysLeft: 200, expiresOn: '2027-01-01' })).toBe('Fresh');
    expect(expiryLabel({ kind: 'expiring', daysLeft: 0, expiresOn: '2026-06-14' })).toBe(
      'Expires today',
    );
    expect(expiryLabel({ kind: 'expiring', daysLeft: 1, expiresOn: '2026-06-15' })).toBe(
      'Expires tomorrow',
    );
    expect(expiryLabel({ kind: 'expired', daysLeft: -1, expiresOn: '2026-06-13' })).toBe(
      'Expired yesterday',
    );
  });
});
