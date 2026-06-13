import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';

import { AuroraBackground } from '@/components/AuroraBackground';
import { AppText, GlowButton, PressableScale } from '@/components/ui';
import { haptics } from '@/lib/haptics';
import { useAuth } from '@/stores/auth';
import { motion, palette, spacing } from '@/theme';

export default function Welcome() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const continueAsGuest = useAuth((s) => s.continueAsGuest);
  const [loading, setLoading] = useState(false);

  async function onGuest() {
    setLoading(true);
    try {
      haptics.press();
      await continueAsGuest();
    } catch {
      setLoading(false);
    }
  }

  return (
    <View style={styles.root}>
      <AuroraBackground />
      <View style={[styles.content, { paddingTop: insets.top + spacing(14), paddingBottom: insets.bottom + spacing(6) }]}>
        <Animated.View entering={FadeInDown.duration(motion.slow)}>
          <View style={styles.markRow}>
            <View style={styles.dot} />
            <AppText variant="overline" color={palette.accentBright}>
              Glowi
            </AppText>
          </View>
        </Animated.View>

        <View style={styles.hero}>
          <Animated.View entering={FadeInUp.delay(120).duration(motion.slow)}>
            <AppText variant="display" style={styles.title}>
              Understand your skin,{'\n'}
              <AppText variant="display" color={palette.accentBright}>
                scientifically.
              </AppText>
            </AppText>
          </Animated.View>
          <Animated.View entering={FadeInUp.delay(260).duration(motion.slow)}>
            <AppText variant="subheading" style={styles.sub}>
              Scan a concern, get an AI read on what&apos;s going on, and a clear plan — the right
              products, the nutrition behind them, and routines that fit you.
            </AppText>
          </Animated.View>
        </View>

        <Animated.View entering={FadeIn.delay(440).duration(motion.slow)} style={styles.actions}>
          <GlowButton label="Create account" onPress={() => router.push('/(auth)/sign-up')} />
          <GlowButton
            label={loading ? 'Setting up…' : 'Continue as guest'}
            variant="ghost"
            loading={loading}
            onPress={onGuest}
          />
          <PressableScale onPress={() => router.push('/(auth)/sign-in')} style={styles.signin}>
            <AppText variant="subheading">
              Already have an account? <AppText color={palette.accentBright}>Sign in</AppText>
            </AppText>
          </PressableScale>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.bg },
  content: { flex: 1, paddingHorizontal: spacing(6), justifyContent: 'space-between' },
  markRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(2) },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: palette.accentBright,
    shadowColor: palette.accentBright,
    shadowOpacity: 0.8,
    shadowRadius: 8,
  },
  hero: { gap: spacing(4) },
  title: { fontSize: 40, lineHeight: 46 },
  sub: { fontSize: 16, lineHeight: 24, maxWidth: 340 },
  actions: { gap: spacing(3) },
  signin: { alignSelf: 'center', paddingVertical: spacing(2) },
});
