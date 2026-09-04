/**
 * A thin fixed bar showing how far through an article the reader has
 * scrolled. Takes a shared value rather than a plain number — the article
 * screen already tracks scroll position on the UI thread (the same
 * `scrollY` its parallax hero uses), and re-deriving that into JS state on
 * every frame just to pass a number down would reintroduce the re-render
 * cost the worklet was written to avoid.
 */
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

import { palette, radii } from '@/theme';

const BAR_HEIGHT = 3;

export function ReadingProgressBar({ progress }: { progress: SharedValue<number> }) {
  const fillStyle = useAnimatedStyle(() => ({
    width: `${Math.round(progress.value * 100)}%`,
  }));

  return (
    <View
      style={styles.track}
      accessibilityRole="progressbar"
      accessibilityLabel="Reading progress"
    >
      <Animated.View style={[styles.fill, fillStyle]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: BAR_HEIGHT,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: radii.full,
    overflow: 'hidden',
  },
  fill: {
    height: BAR_HEIGHT,
    backgroundColor: palette.accentBright,
    borderRadius: radii.full,
  },
});
