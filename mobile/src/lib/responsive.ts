import { useWindowDimensions } from 'react-native';

export const TABLET_BREAKPOINT = 600;
export const CONTENT_MAX_WIDTH = 560;

/** Returns screen-adaptive layout values derived from the current window width. */
export function useResponsive() {
  const { width } = useWindowDimensions();
  const isTablet = width >= TABLET_BREAKPOINT;
  // Phone: 26px each side per design spec. Tablet: center a 560px column.
  const hPadding = isTablet ? Math.round((width - CONTENT_MAX_WIDTH) / 2) : 26;
  return { width, isTablet, hPadding };
}
