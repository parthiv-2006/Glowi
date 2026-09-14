import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { ProductCard } from '@/components/ProductCard';
import type { Product } from '@/lib/types';

function product(partial: Partial<Product> = {}): Product {
  return {
    id: 'p1',
    slug: 'test-product',
    brand: 'TestBrand',
    name: 'Test Product',
    category: 'serum',
    description: '',
    key_ingredients: [],
    price_usd: 20,
    image_url: null,
    retailer_links: [],
    skin_types: [],
    am_pm: 'both',
    step_order: 1,
    ...partial,
  };
}

describe('ProductCard wishlist toggle', () => {
  it('renders no heart when onToggleSave is not given', () => {
    render(<ProductCard product={product()} />);
    expect(screen.queryByLabelText('Save to wishlist')).toBeNull();
    expect(screen.queryByLabelText('Remove from wishlist')).toBeNull();
  });

  it('shows the unfilled heart with the save label when not saved', () => {
    render(<ProductCard product={product()} saved={false} onToggleSave={jest.fn()} />);
    const heart = screen.getByLabelText('Save to wishlist');
    expect(heart.props.accessibilityState.selected).toBe(false);
  });

  it('shows the filled heart with the remove label when saved', () => {
    render(<ProductCard product={product()} saved onToggleSave={jest.fn()} />);
    const heart = screen.getByLabelText('Remove from wishlist');
    expect(heart.props.accessibilityState.selected).toBe(true);
  });

  it('calls onToggleSave when the heart is pressed', () => {
    const onToggleSave = jest.fn();
    render(<ProductCard product={product()} saved={false} onToggleSave={onToggleSave} />);
    fireEvent.press(screen.getByLabelText('Save to wishlist'));
    expect(onToggleSave).toHaveBeenCalledTimes(1);
  });
});
