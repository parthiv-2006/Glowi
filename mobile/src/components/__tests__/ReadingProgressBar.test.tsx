/**
 * ReadingProgressBar takes a shared value rather than a prop number, so a
 * tiny host component supplies one the way the article screen would.
 */
import { describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';
import { useSharedValue } from 'react-native-reanimated';

import { ReadingProgressBar } from '@/components/ReadingProgressBar';

function Host({ initial }: { initial: number }) {
  const progress = useSharedValue(initial);
  return <ReadingProgressBar progress={progress} />;
}

describe('ReadingProgressBar', () => {
  it('renders with the progressbar accessibility contract', () => {
    render(<Host initial={0.4} />);
    const bar = screen.getByLabelText('Reading progress');
    expect(bar.props.accessibilityRole).toBe('progressbar');
  });

  it('renders at zero progress without crashing', () => {
    expect(() => render(<Host initial={0} />)).not.toThrow();
  });

  it('renders at full progress without crashing', () => {
    expect(() => render(<Host initial={1} />)).not.toThrow();
  });
});
