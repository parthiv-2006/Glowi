/**
 * FaceZoneMap is pure over its `concerns` prop, so it renders without providers.
 * The guarantees worth pinning: the map announces each zone with a severity word
 * (never colour alone), unmappable areas fall back to visible text, and the whole
 * thing disappears cleanly when nothing maps.
 */
import { describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';

import { FaceZoneMap } from '@/components/FaceZoneMap';
import type { ScanConcern } from '@/lib/types';

function concern(
  partial: Partial<ScanConcern> & { areas: string[]; severity: number },
): ScanConcern {
  return {
    concern_slug: 'test',
    display_name: 'Test concern',
    confidence: 0.9,
    observations: '',
    caution: null,
    ...partial,
  };
}

describe('FaceZoneMap', () => {
  it('labels the map with each zone and its severity word', () => {
    render(<FaceZoneMap concerns={[concern({ areas: ['forehead'], severity: 50 })]} />);
    const map = screen.getByRole('image');
    expect(map.props.accessibilityLabel).toContain('Forehead: Moderate');
  });

  it('surfaces unmappable areas as visible text', () => {
    render(<FaceZoneMap concerns={[concern({ areas: ['nose', 'neck'], severity: 40 })]} />);
    expect(screen.getByText('Also mentioned: neck')).toBeTruthy();
  });

  it('renders nothing when no area maps to a zone', () => {
    render(<FaceZoneMap concerns={[concern({ areas: ['neck'], severity: 40 })]} />);
    expect(screen.queryByRole('image')).toBeNull();
  });
});
