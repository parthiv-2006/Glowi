import { useCallback, useEffect, useRef, useState } from 'react';
import { Image, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { LinearGradient } from 'expo-linear-gradient';

import { GlowiAvatar } from '@/components/GlowiAvatar';
import { ScanTheater, type ScanZone } from '@/components/scan/ScanTheater';
import { AppText, GlowButton } from '@/components/ui';
import { getAIProvider } from '@/lib/ai';
import { attachScanImage, createScan } from '@/lib/api';
import { haptics } from '@/lib/haptics';
import { scheduleWeeklyScanReminder } from '@/lib/notifications';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/stores/auth';
import { motion, palette, radii, spacing } from '@/theme';

const STAGES = [
  'Calibrating sensors',
  'Mapping surface zones',
  'Analyzing texture & tone',
  'Cross-referencing patterns',
  'Compiling your protocol',
];
const STAGE_MS = 1300;
const MIN_THEATER_MS = STAGES.length * STAGE_MS;

// Illustrative detected-zone callouts — purely a sensory cue during the
// cinematic sweep; the real findings render on the results screen.
const ZONES: ScanZone[] = [
  { label: 'Congestion · 52', severity: 52, x: 0.66, y: 0.3, delay: 0 },
  { label: 'Breakouts · 38', severity: 38, x: 0.26, y: 0.52, delay: 1100 },
  { label: 'Hydration · good', severity: 12, x: 0.62, y: 0.72, delay: 2400 },
];

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
  const { uri, area, notes } = useLocalSearchParams<{
    uri: string;
    area?: string;
    notes?: string;
  }>();
  const userId = useAuth((s) => s.session?.user.id);

  const [stage, setStage] = useState(0);
  const [frame, setFrame] = useState({ width: 0, height: 0 });
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  const { height: screenH } = useWindowDimensions();

  const pulse = useSharedValue(0.5);
  const pulseStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  // Full-screen X-ray sweep — synced with the ScanTheater beam timing.
  const sweep = useSharedValue(0);
  const sweepY = useDerivedValue(() => sweep.value * screenH);
  const sweepOpacity = useDerivedValue(() => {
    const edge = Math.min(sweep.value, 1 - sweep.value) * 8;
    return Math.min(1, edge);
  });
  const screenTintStyle = useAnimatedStyle(() => ({ height: sweepY.value }));
  const screenUnscannedStyle = useAnimatedStyle(() => ({
    top: sweepY.value + 2,
    opacity: sweepOpacity.value * 0.35,
  }));
  const sweepGlowStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: Math.max(0, sweepY.value - 70) }],
    opacity: sweepOpacity.value * 0.85,
  }));
  const sweepLineStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: sweepY.value }],
    opacity: sweepOpacity.value,
  }));

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
      // Schedule/reset the weekly scan reminder so it fires 7 days from now.
      void scheduleWeeklyScanReminder();
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
    pulse.value = withRepeat(
      withSequence(withTiming(1, { duration: 900 }), withTiming(0.4, { duration: 900 })),
      -1,
    );
    sweep.value = withRepeat(
      withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.ease) }),
      -1,
      false,
    );
    void run();
  }, [run, pulse, sweep]);

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
    <View
      style={[
        styles.root,
        { paddingTop: insets.top + spacing(6), paddingBottom: insets.bottom + spacing(6) },
      ]}
    >
      <View style={styles.header}>
        <View style={styles.markDot} />
        <AppText variant="overline" color={palette.accentBright}>
          Glowi analysis
        </AppText>
      </View>

      <View style={styles.stageWrap}>
        <View
          style={styles.frame}
          onLayout={(e) =>
            setFrame({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })
          }
        >
          {uri ? <Image source={{ uri }} style={styles.photo} resizeMode="cover" /> : null}
          <View style={styles.scrim} />
          {frame.width > 0 ? (
            <View style={StyleSheet.absoluteFill}>
              <ScanTheater
                width={frame.width}
                height={frame.height}
                active={!done && !error}
                zones={done || error ? [] : ZONES}
              />
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
          <GlowButton
            label="Try again"
            onPress={() => router.replace('/scan')}
            style={styles.retry}
          />
        </Animated.View>
      ) : (
        <View style={styles.statusArea}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
          </View>
          {done ? (
            <Animated.View entering={FadeIn} style={styles.statusRow}>
              <GlowiAvatar state="celebrating" size={28} />
              <AppText variant="heading" color={palette.accentBright}>
                Analysis complete
              </AppText>
            </Animated.View>
          ) : (
            <Animated.View
              key={stage}
              entering={FadeIn.duration(motion.base)}
              exiting={FadeOut.duration(120)}
            >
              <Animated.View style={[styles.statusRow, pulseStyle]}>
                <GlowiAvatar state="scanning" size={28} />
                <AppText variant="heading">{STAGES[stage]}…</AppText>
              </Animated.View>
            </Animated.View>
          )}
          <AppText variant="caption" style={styles.reassure}>
            {ZONES.length} zones mapped · analyzed only for your results.
          </AppText>
        </View>
      )}

      {/* Full-screen X-ray sweep — last child so it renders above photo frame */}
      {!done && !error ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {/* Teal tint fills the scanned region from top */}
          <Animated.View style={[styles.screenTint, screenTintStyle]} />
          {/* Dark wash over unscanned region below the line */}
          <Animated.View style={[styles.screenUnscanned, screenUnscannedStyle]} />
          {/* Glow halo around the scan line */}
          <Animated.View style={[styles.screenGlow, sweepGlowStyle]}>
            <LinearGradient
              colors={['rgba(94,234,212,0)', 'rgba(94,234,212,0.22)', 'rgba(94,234,212,0.10)', 'rgba(94,234,212,0)']}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
          {/* The scan line itself */}
          <Animated.View style={[styles.screenLine, sweepLineStyle]} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: palette.bg,
    paddingHorizontal: spacing(6),
    justifyContent: 'space-between',
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing(2), justifyContent: 'center' },
  markDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: palette.accentBright,
    boxShadow: '0px 0px 8px rgba(94,234,212,0.9)',
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
  screenTint: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(45,212,191,0.14)',
  },
  screenUnscanned: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(7,9,11,0.45)',
  },
  screenGlow: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 140,
  },
  screenLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: palette.accentBright,
    boxShadow: '0px 0px 18px rgba(94,234,212,0.95), 0px 0px 40px rgba(94,234,212,0.5)',
  },
  errorBox: { alignItems: 'center', gap: spacing(3), paddingHorizontal: spacing(4) },
  center: { textAlign: 'center' },
  retry: { marginTop: spacing(2), alignSelf: 'stretch' },
});
