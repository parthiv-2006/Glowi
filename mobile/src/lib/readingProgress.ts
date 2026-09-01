/**
 * Pure reading-progress math for the article reader's progress bar — how far
 * through the body the user has scrolled, as a 0–1 fraction. Free of I/O so
 * it is shared by the article screen and unit tests.
 */

/**
 * Fraction of the article read, clamped to [0, 1]. `contentHeight` is the
 * full scrollable content height and `layoutHeight` the visible viewport
 * height (from onContentSizeChange/onLayout). When the content doesn't
 * overflow the viewport — nothing to scroll — the article is fully "read"
 * the moment it renders.
 */
export function readingProgress(
  scrollY: number,
  contentHeight: number,
  layoutHeight: number,
): number {
  const scrollable = contentHeight - layoutHeight;
  if (scrollable <= 0) return 1;
  return Math.min(1, Math.max(0, scrollY / scrollable));
}
