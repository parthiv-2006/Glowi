/**
 * RoutineTimeline is pure over its props, so it renders without providers.
 * The guarantees worth pinning: the summary node announces step count + total
 * wait (+ warning count when present), each node's wait is spoken per-step,
 * and the strip disappears cleanly under two steps.
 */
import { describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';

import { RoutineTimeline } from '@/components/RoutineTimeline';
import type { Product, RoutineStep } from '@/lib/types';

function product(partial: Partial<Product>): Product {
  return {
    id: 'p1',
    slug: 'test',
    brand: 'Test',
    name: 'Product',
    category: 'serum',
    description: '',
    key_ingredients: [],
    price_usd: null,
    image_url: null,
    retailer_links: [],
    skin_types: [],
    am_pm: 'both',
    step_order: 0,
    ...partial,
  };
}

function step(partial: Partial<RoutineStep> & { product?: Product | null }): RoutineStep {
  return {
    id: 's1',
    routine_id: 'r1',
    position: 0,
    product_id: 'p1',
    custom_name: null,
    instruction: '',
    frequency: 'daily',
    product: null,
    ...partial,
  };
}

const vitaminC = step({
  id: 'vc',
  product: product({ id: 'vc', name: 'Vitamin C Suspension', key_ingredients: ['ascorbic acid'] }),
});
const moisturizer = step({ id: 'm', product: product({ id: 'm', category: 'moisturizer' }) });
const spf = step({ id: 'spf', product: product({ id: 'spf', category: 'spf' }) });

describe('RoutineTimeline', () => {
  it('summarizes step count and total wait', () => {
    render(<RoutineTimeline steps={[vitaminC, moisturizer, spf]} period="pm" />);
    const summary = screen.getByRole('summary');
    expect(summary.props.accessibilityLabel).toBe(
      'Evening routine: 3 steps, 15 minutes total wait',
    );
  });

  it('appends the warning count to the summary when present', () => {
    render(<RoutineTimeline steps={[vitaminC, moisturizer, spf]} period="am" warningsCount={2} />);
    const summary = screen.getByRole('summary');
    expect(summary.props.accessibilityLabel).toBe(
      'Morning routine: 3 steps, 15 minutes total wait, 2 sequence warnings listed below',
    );
  });

  it('omits the warning clause when there are no warnings', () => {
    render(<RoutineTimeline steps={[vitaminC, moisturizer]} period="am" warningsCount={0} />);
    const summary = screen.getByRole('summary');
    expect(summary.props.accessibilityLabel).not.toContain('warning');
  });

  it('labels each node with its wait before the next step', () => {
    render(<RoutineTimeline steps={[vitaminC, moisturizer, spf]} period="pm" />);
    expect(
      screen.getByLabelText(
        'Step 1: Vitamin C Suspension, Serum. Wait 10 minutes before the next step.',
      ),
    ).toBeTruthy();
    expect(
      screen.getByLabelText('Step 2: Product, Moisturizer. Wait 5 minutes before the next step.'),
    ).toBeTruthy();
    expect(screen.getByLabelText('Step 3: Product, SPF')).toBeTruthy();
  });

  it('renders nothing under two steps', () => {
    const { toJSON } = render(<RoutineTimeline steps={[moisturizer]} period="am" />);
    expect(toJSON()).toBeNull();
  });
});
