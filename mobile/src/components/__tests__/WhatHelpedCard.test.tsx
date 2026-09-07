import { describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';

import { WhatHelpedCard } from '@/components/WhatHelpedCard';
import type { ConcernHelp } from '@/lib/concernHistory';

describe('WhatHelpedCard', () => {
  it('renders nothing when there are no helps', () => {
    const { toJSON } = render(<WhatHelpedCard helps={[]} />);
    expect(toJSON()).toBeNull();
  });

  it('renders each help with its label and point delta', () => {
    const helps: ConcernHelp[] = [
      { label: 'Added Niacinamide Serum', delta: -12, date: '2026-06-15' },
      { label: 'Reaction to Retinol Cream', delta: -4, date: '2026-05-01' },
    ];
    render(<WhatHelpedCard helps={helps} />);
    expect(screen.getByText('Added Niacinamide Serum')).toBeTruthy();
    expect(screen.getByText('12 pts')).toBeTruthy();
    expect(screen.getByText('Reaction to Retinol Cream')).toBeTruthy();
    expect(screen.getByText('4 pts')).toBeTruthy();
  });

  it('shows the magnitude of a negative delta, not a negative number', () => {
    const helps: ConcernHelp[] = [{ label: 'Added Azelaic Acid', delta: -20, date: '2026-06-01' }];
    render(<WhatHelpedCard helps={helps} />);
    expect(screen.queryByText('-20 pts')).toBeNull();
    expect(screen.getByText('20 pts')).toBeTruthy();
  });
});
