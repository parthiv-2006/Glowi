import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { AuroraBackground } from '@/components/AuroraBackground';
import { GlowiAvatar } from '@/components/GlowiAvatar';
import { AppText } from '@/components/ui';
import { palette, spacing } from '@/theme';

/**
 * The in-app splash moment shown while fonts/auth are initializing, after
 * the native splash hides. Mascot + wordmark (jade i-dot) + tagline + a
 * thin shimmer loading bar over a breathing aurora. See MASCOT_AND_LOGO.md.
 */
export function SplashView() {
  const shimmer = useSharedValue(0);

  useEffect(() => {
    shimmer.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 900, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
    );
  }, [shimmer]);

  const fillStyle = useAnimatedStyle(() => ({
    opacity: 0.4 + shimmer.value * 0.6,
  }));

  return (
    <View style={styles.root}>
      <AuroraBackground intensity={0.6} />
      <View style={styles.content}>
        <GlowiAvatar state="idle" size={132} />
        <View style={styles.wordmarkRow}>
          <AppText variant="display" style={styles.wordmark}>
            Glow
          </AppText>
          <View style={styles.iWrap}>
            <View style={styles.iStem} />
            <View style={styles.iDot} />
          </View>
        </View>
        <AppText variant="subheading" style={styles.tagline}>
          Skincare, tuned to you.
        </AppText>
        <View style={styles.track}>
          <Animated.View style={[styles.fill, fillStyle]} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.bg },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing(5),
  },
  wordmarkRow: { flexDirection: 'row', alignItems: 'flex-start' },
  wordmark: { fontSize: 36, letterSpacing: -1 },
  iWrap: { alignItems: 'center', marginLeft: 1 },
  iDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: palette.accentBright,
    boxShadow: '0px 0px 6px rgba(94,234,212,0.9)',
    marginBottom: 3,
  },
  iStem: { width: 4, height: 24, borderRadius: 2, backgroundColor: palette.text },
  tagline: { marginTop: -spacing(3) },
  track: {
    width: 120,
    height: 3,
    borderRadius: 2,
    backgroundColor: palette.surfaceStrong,
    overflow: 'hidden',
    marginTop: spacing(2),
  },
  fill: { flex: 1, backgroundColor: palette.accentBright },
});
