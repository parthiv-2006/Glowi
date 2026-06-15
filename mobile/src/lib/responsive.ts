import { useWindowDimensions } from 'react-native';

import { spacing } from '@/theme';

export const TABLET_BREAKPOINT = 600;
export const CONTENT_MAX_WIDTH = 560;

/** Returns screen-adaptive layout values derived from the current window width. */
export function useResponsive() {
  const { width } = useWindowDimensions();
  const isTablet = width >= TABLET_BREAKPOINT;
  // On phones: 20px each side. On tablet: center a 560px column symmetrically.
  const hPadding = isTablet ? Math.round((width - CONTENT_MAX_WIDTH) / 2) : spacing(5);
  return { width, isTablet, hPadding };
}
