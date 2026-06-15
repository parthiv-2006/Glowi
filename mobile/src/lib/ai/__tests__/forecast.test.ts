import { describe, expect, it } from '@jest/globals';

import {
  aqiLevel,
  deriveForecast,
  humidityLevel,
  pollenLevel,
  swingLevel,
  synthesizeEnvironment,
  uvLevel,
} from '../forecast';
import type { ForecastEnvironment } from '../../types';

describe('synthesizeEnvironment', () => {
  it('is deterministic for a given date', () => {
    const a = synthesizeEnvironment(new Date('2026-06-14T09:00:00Z'));
    const b = synthesizeEnvironment(new Date('2026-06-14T22:00:00Z'));
    expect(a).toEqual(b);
  });

  it('produces in-range readings', () => {
    for (let d = 0; d < 10; d++) {
      const env = synthesizeEnvironment(new Date(2026, 0, 1 + d));
      expect(env.humidity).toBeGreaterThanOrEqual(0);
      expect(env.humidity).toBeLessThanOrEqual(100);
      expect(env.uv_index).toBeGreaterThanOrEqual(0);
      expect(env.air_quality_index).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('level helpers', () => {
  it('classifies UV bands', () => {
    expect(uvLevel(1).tone).toBe('good');
    expect(uvLevel(4).tone).toBe('moderate');
    expect(uvLevel(9).tone).toBe('high');
  });

  it('flags dry air and good air quality', () => {
    expect(humidityLevel(20).tone).toBe('high');
    expect(humidityLevel(50).tone).toBe('good');
    expect(aqiLevel(30).tone).toBe('good');
    expect(aqiLevel(150).tone).toBe('high');
    expect(swingLevel(3).tone).toBe('good');
    expect(swingLevel(14).tone).toBe('high');
    expect(pollenLevel('very-high').tone).toBe('high');
  });
});

describe('deriveForecast', () => {
  const dryHotSunny: ForecastEnvironment = {
    uv_index: 9,
    humidity: 28,
    temp_c: 26,
    temp_swing_c: 12,
    air_quality_index: 38,
    pollen_level: 'low',
    condition: 'Clear',
  };

  it('recommends SPF under high UV and a richer moisturizer in dry air', () => {
    const f = deriveForecast(dryHotSunny, { skinType: 'dry', topConcern: 'Dehydration' });
    expect(f.headline.toLowerCase()).toContain('high uv');
    const kinds = f.guidance.map((g) => g.kind);
    expect(kinds).toContain('add'); // SPF
    expect(kinds).toContain('swap'); // richer moisturizer
    expect(f.guidance.length).toBeGreaterThanOrEqual(1);
    expect(f.guidance.length).toBeLessThanOrEqual(4);
  });

  it('goes lighter for oily skin in humid heat', () => {
    const humid: ForecastEnvironment = {
      uv_index: 6,
      humidity: 82,
      temp_c: 29,
      temp_swing_c: 5,
      air_quality_index: 64,
      pollen_level: 'moderate',
      condition: 'Humid',
    };
    const f = deriveForecast(humid, { skinType: 'oily', topConcern: null });
    expect(f.summary.toLowerCase()).toContain('oil');
    expect(f.guidance.some((g) => g.kind === 'swap')).toBe(true);
  });

  it('falls back to maintain when conditions are gentle', () => {
    const mild: ForecastEnvironment = {
      uv_index: 3,
      humidity: 55,
      temp_c: 19,
      temp_swing_c: 6,
      air_quality_index: 30,
      pollen_level: 'low',
      condition: 'Partly cloudy',
    };
    const f = deriveForecast(mild, { skinType: 'normal', topConcern: null });
    expect(f.guidance.some((g) => g.kind === 'maintain')).toBe(true);
  });
});
