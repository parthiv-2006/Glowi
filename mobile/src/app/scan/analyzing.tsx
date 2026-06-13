import { useCallback, useEffect, useRef, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { ScanTheater } from '@/components/scan/ScanTheater';
import { AppText, GlowButton } from '@/components/ui';
import { getAIProvider } from '@/lib/ai';
import { attachScanImage, createScan } from '@/lib/api';
import { haptics } from '@/lib/haptics';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/stores/auth';
import { motion, palette, radii, spacing } from '@/theme';

const STAGES = [
  'Calibrating sensors',
  'Mapping surface zones',
  'Analyzing texture & tone',
  'Cross-referencing dermatological patterns',
  'Compiling your protocol',
];
const STAGE_MS = 1300;
const MIN_THEATER_MS = STAGES.length * STAGE_MS;

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function uploadImage(userId: string, scanId: string, uri: string): Promise<string> {
  const path = `${userId}/${scanId}.jpg`;
  const arrayBuffer = await fetch(uri).then((r) => r.arrayBuffer());
  const { error } = await supabase.storage
    .from('scan-images')
    .upload(path, arrayBuffer, { contentType: 'image/jpeg', upsert: true });
  if (error) throw new Error(error.message);
  return path;
}

export default function Analyzing() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { uri, area, notes } = useLocalSearchParams<{ uri: string; area?: string; notes?: string }>();
  const userId = useAuth((s) => s.session?.user.id);

  const [stage, setStage] = useState(0);
  const [frame, setFrame] = useState({ width: 0, height: 0 });
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  const pulse = useSharedValue(0.5);
  const pulseStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  const run = useCallback(async () => {
    if (!userId || !uri) {
      setError('Something went wrong starting the scan.');
      return;
    }
    try {
      const scan = await createScan(userId, { area: area || undefined, notes: notes || undefined });
      const path = await uploadImage(userId, scan.id, uri);
      await attachScanImage(scan.id, path);

      const [result] = await Promise.all([
        getAIProvider().analyzeScan({ scanId: scan.id }),
        wait(MIN_THEATER_MS),
      ]);

      if (result.status === 'failed') {
        setError(result.summary ?? 'Analysis could not complete. Try a clearer, well-lit photo.');
        haptics.error();
        return;
      }
      setDone(true);
      haptics.success();
      await wait(650);
      router.replace(`/results/${scan.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Analysis failed. Please try again.');
      haptics.error();
    }
  }, [userId, uri, area, notes, router]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    pulse.value = withRepeat(withSequence(withTiming(1, { duration: 900 }), withTiming(0.4, { duration: 900 })), -1);
    void run();
  }, [run, pulse]);

  // Stage ticker.
  useEffect(() => {
    if (error || done) return;
    if (stage >= STAGES.length - 1) return;
    const id = setTimeout(() => {
      setStage((s) => Math.min(STAGES.length - 1, s + 1));
      haptics.tick();
    }, STAGE_MS);
    return () => clearTimeout(id);
  }, [stage, error, done]);

  const progress = done ? 1 : (stage + 1) / STAGES.length;

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing(6), paddingBottom: insets.bottom + spacing(6) }]}>
      <View style={styles.header}>
        <View style={styles.markDot} />
        <AppText variant="overline" color={palette.accentBright}>
          Glowi analysis
        </AppText>
      </View>

      <View style={styles.stageWrap}>
        <View
          style={styles.frame}
          onLayout={(e) => setFrame({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
        >
          {uri ? <Image source={{ uri }} style={styles.photo} resizeMode="cover" /> : null}
          <View style={styles.scrim} />
          {frame.width > 0 ? (
            <View style={StyleSheet.absoluteFill}>
              <ScanTheater width={frame.width} height={frame.height} active={!done && !error} />
            </View>
          ) : null}
        </View>
      </View>

      {error ? (
        <Animated.View entering={FadeIn} style={styles.errorBox}>
          <Ionicons name="alert-circle-outline" size={30} color={palette.warning} />
          <AppText variant="heading" style={styles.center}>
            We couldn&apos;t read that one
          </AppText>
          <AppText variant="subheading" style={styles.center}>
            {error}
          </AppText>
          <GlowButton label="Try again" onPress={() => router.replace('/scan')} style={styles.retry} />
        </Animated.View>
      ) : (
        <View style={styles.statusArea}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
          </View>
          {done ? (
            <Animated.View entering={FadeIn} style={styles.statusRow}>
              <Ionicons name="checkmark-circle" size={20} color={palette.accentBright} />
              <AppText variant="heading" color={palette.accentBright}>
                Analysis complete
              </AppText>
            </Animated.View>
          ) : (
            <Animated.View key={stage} entering={FadeIn.duration(motion.base)} exiting={FadeOut.duration(120)}>
              <Animated.View style={[styles.statusRow, pulseStyle]}>
                <View style={styles.spinnerDot} />
                <AppText variant="heading">{STAGES[stage]}…</AppText>
              </Animated.View>
            </Animated.View>
          )}
          <AppText variant="caption" style={styles.reassure}>
            Your photo is private and analyzed only for your results.
          </AppText>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.bg, paddingHorizontal: spacing(6), justifyContent: 'space-between' },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing(2), justifyContent: 'center' },
  markDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: palette.accentBright,
    shadowColor: palette.accentBright,
    shadowOpacity: 0.9,
    shadowRadius: 8,
  },
  stageWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  frame: {
    width: '88%',
    aspectRatio: 4 / 5,
    borderRadius: radii.xl,
    overflow: 'hidden',
    backgroundColor: palette.bgElevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.borderStrong,
  },
  photo: { width: '100%', height: '100%' },
  scrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(7,9,11,0.35)',
  },
  statusArea: { alignItems: 'center', gap: spacing(3) },
  progressTrack: {
    width: '70%',
    height: 3,
    borderRadius: 2,
    backgroundColor: palette.surfaceStrong,
    overflow: 'hidden',
  },
  progressFill: { height: 3, borderRadius: 2, backgroundColor: palette.accentBright },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(2.5) },
  spinnerDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: palette.accent },
  reassure: { textAlign: 'center' },
  errorBox: { alignItems: 'center', gap: spacing(3), paddingHorizontal: spacing(4) },
  center: { textAlign: 'center' },
  retry: { marginTop: spacing(2), alignSelf: 'stretch' },
});
