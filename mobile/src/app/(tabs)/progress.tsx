import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import {
  AppText,
  Badge,
  EmptyState,
  GlassCard,
  GlowButton,
  PressableScale,
  ProgressRing,
  Screen,
  SectionHeader,
  Skeleton,
  Stagger,
} from '@/components/ui';
import { ScoreTrend } from '@/components/ScoreTrend';
import { useCheckIn, useRecentCheckins, useRoutines, useScans } from '@/lib/hooks';
import { haptics } from '@/lib/haptics';
import { checkedInToday, computeStreak, lastNDays } from '@/lib/streak';
import { getScanImageUrl } from '@/lib/api';
import { palette, radii, scoreColor, spacing } from '@/theme';
import type { Scan } from '@/lib/types';

// ─── helpers ───────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ─── before/after image state ───────────────────────────────────────────────

interface BeforeAfterUrls {
  before: string | null;
  after: string | null;
}

// ─── streak celebration ──────────────────────────────────────────────────────

function useCelebration() {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  const celebrate = useCallback(() => {
    scale.value = withSequence(
      withSpring(1.18, { damping: 8, stiffness: 240 }),
      withSpring(0.95, { damping: 12, stiffness: 220 }),
      withSpring(1, { damping: 14, stiffness: 200 }),
    );
    opacity.value = withSequence(
      withTiming(1, { duration: 60 }),
      withTiming(0.7, { duration: 120 }),
      withTiming(1, { duration: 200 }),
    );
  }, [scale, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return { celebrate, animatedStyle };
}

// ─── activity grid ───────────────────────────────────────────────────────────

function ActivityGrid({ days, checkinSet }: { days: string[]; checkinSet: Set<string> }) {
  return (
    <View style={styles.gridWrap}>
      {days.map((day) => (
        <View
          key={day}
          style={[
            styles.gridCell,
            checkinSet.has(day) ? styles.gridCellActive : styles.gridCellDim,
          ]}
        />
      ))}
    </View>
  );
}

// ─── scan row ────────────────────────────────────────────────────────────────

function ScanRow({ scan, onPress }: { scan: Scan; onPress: () => void }) {
  const score = scan.skin_score ?? 0;
  return (
    <PressableScale onPress={onPress} style={styles.scanRowWrap}>
      <GlassCard style={styles.scanRow}>
        <ProgressRing
          value={score}
          size={52}
          strokeWidth={5}
          color={scoreColor(score)}
          delay={0}
        />
        <View style={styles.scanRowBody}>
          <AppText variant="overline">{formatDate(scan.created_at)}</AppText>
          <AppText variant="subheading" numberOfLines={2} style={styles.scanRowSummary}>
            {scan.summary ?? 'Scan complete.'}
          </AppText>
        </View>
        {scan.concerns.length > 0 && (
          <Badge
            label={`${scan.concerns.length} concern${scan.concerns.length !== 1 ? 's' : ''}`}
            color={palette.accent}
          />
        )}
        <Ionicons name="chevron-forward" size={16} color={palette.textTertiary} />
      </GlassCard>
    </PressableScale>
  );
}

// ─── placeholder tile ────────────────────────────────────────────────────────

function PlaceholderTile({ score, label }: { score: number | null; label: string }) {
  return (
    <View style={styles.imageTile}>
      <View style={styles.imagePlaceholder}>
        <ProgressRing
          value={score ?? 0}
          size={56}
          strokeWidth={5}
          color={scoreColor(score ?? 0)}
        />
      </View>
      <AppText variant="caption" style={styles.imageLabel}>{label}</AppText>
      <AppText variant="overline" color={scoreColor(score ?? 0)}>
        {score != null ? `Score ${score}` : '—'}
      </AppText>
    </View>
  );
}

// ─── main screen ─────────────────────────────────────────────────────────────

export default function ProgressScreen() {
  const router = useRouter();
  const { data: scans = [], isLoading: scansLoading } = useScans();
  const { data: routines = [] } = useRoutines();
  const { data: checkins = [] } = useRecentCheckins();
  const checkIn = useCheckIn();

  const { celebrate, animatedStyle: celebAnim } = useCelebration();
  const justCheckedIn = useRef(false);

  // Derive unique checkin dates
  const dates = useMemo(
    () => [...new Set(checkins.map((c) => c.checkin_date))],
    [checkins],
  );
  const checkinSet = useMemo(() => new Set(dates), [dates]);

  const streak = computeStreak(dates);
  const alreadyCheckedIn = checkedInToday(dates);
  const gridDays = lastNDays(30);

  // Completed scans oldest → newest
  const completedScans = useMemo(
    () =>
      scans
        .filter((s) => s.status === 'complete')
        .slice()
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
    [scans],
  );

  // Before / after: oldest and newest with image_path
  const scansWithImage = useMemo(
    () => completedScans.filter((s) => s.image_path),
    [completedScans],
  );
  const beforeScan = scansWithImage[0] ?? null;
  const afterScan = scansWithImage.length > 1 ? scansWithImage[scansWithImage.length - 1] : null;

  const [baUrls, setBaUrls] = useState<BeforeAfterUrls>({ before: null, after: null });

  useEffect(() => {
    let cancelled = false;
    async function fetchUrls() {
      const [b, a] = await Promise.all([
        beforeScan?.image_path ? getScanImageUrl(beforeScan.image_path) : Promise.resolve(null),
        afterScan?.image_path ? getScanImageUrl(afterScan.image_path) : Promise.resolve(null),
      ]);
      if (!cancelled) setBaUrls({ before: b, after: a });
    }
    if (beforeScan || afterScan) void fetchUrls();
    return () => { cancelled = true; };
  }, [beforeScan?.id, afterScan?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Score delta
  const scoreDelta = useMemo(() => {
    if (completedScans.length < 2) return null;
    const prev = completedScans[completedScans.length - 2].skin_score;
    const curr = completedScans[completedScans.length - 1].skin_score;
    if (prev == null || curr == null) return null;
    return curr - prev;
  }, [completedScans]);

  // Check-in handler
  const handleCheckIn = () => {
    if (!routines.length) {
      router.push('/routine');
      return;
    }
    haptics.press();
    // Check in for all routines
    routines.forEach((r) => checkIn.mutate(r.id));
    justCheckedIn.current = true;
  };

  // Celebrate once data reflects check-in
  useEffect(() => {
    if (justCheckedIn.current && alreadyCheckedIn) {
      haptics.success();
      celebrate();
      justCheckedIn.current = false;
    }
  }, [alreadyCheckedIn, celebrate]);

  // ── loading ──
  if (scansLoading) {
    return (
      <Screen bottomInset={spacing(20)}>
        <Animated.View entering={FadeIn.duration(300)}>
          <AppText variant="overline">Your journey</AppText>
          <AppText variant="display" style={styles.headerTitle}>Progress</AppText>
        </Animated.View>
        <View style={styles.gap5}>
          <Skeleton width="100%" height={140} />
          <View style={styles.gap3}>
            <Skeleton width="60%" height={20} />
            <Skeleton width="100%" height={120} />
          </View>
          <Skeleton width="100%" height={80} />
          <Skeleton width="100%" height={80} />
        </View>
      </Screen>
    );
  }

  // ── zero scans ──
  if (!scansLoading && completedScans.length === 0) {
    return (
      <Screen bottomInset={spacing(20)}>
        <Animated.View entering={FadeIn.duration(300)}>
          <AppText variant="overline">Your journey</AppText>
          <AppText variant="display" style={styles.headerTitle}>Progress</AppText>
        </Animated.View>
        <EmptyState
          icon="analytics-outline"
          title="No history yet"
          body="Complete your first scan to start tracking your skin's journey."
          actionLabel="Run your first scan"
          onAction={() => router.push('/scan')}
        />
      </Screen>
    );
  }

  // ── main render ──
  return (
    <Screen bottomInset={spacing(20)}>
      {/* 1. Header */}
      <Stagger delay={0}>
        <Animated.View entering={FadeIn.duration(300)}>
          <AppText variant="overline">Your journey</AppText>
          <AppText variant="display" style={styles.headerTitle}>Progress</AppText>
          <AppText variant="subheading" style={styles.headerSub}>
            Track your streak, score, and skin evolution.
          </AppText>
        </Animated.View>

        {/* 2. Streak card */}
        <GlassCard glow style={styles.section}>
          <View style={styles.streakTopRow}>
            <Animated.View style={[styles.streakCount, celebAnim]}>
              <Ionicons name="flame" size={28} color={palette.warning} />
              <AppText variant="display" style={styles.streakNumber}>
                {streak}
              </AppText>
            </Animated.View>
            <View style={styles.streakMeta}>
              <AppText variant="heading">day streak</AppText>
              <AppText variant="caption" color={palette.textSecondary}>
                Keep it going — consistency is everything.
              </AppText>
            </View>
          </View>

          <ActivityGrid days={gridDays} checkinSet={checkinSet} />

          <View style={styles.checkInWrap}>
            {alreadyCheckedIn ? (
              <View style={styles.checkedInRow}>
                <Ionicons name="checkmark-circle" size={20} color={palette.success} />
                <AppText variant="subheading" color={palette.success}>
                  Checked in today
                </AppText>
              </View>
            ) : (
              <GlowButton
                label="Check in for today"
                onPress={handleCheckIn}
                loading={checkIn.isPending}
                icon={<Ionicons name="sunny-outline" size={16} color={palette.textOnAccent} />}
              />
            )}
          </View>
        </GlassCard>

        {/* 3. Score trend */}
        {completedScans.length >= 2 && (
          <GlassCard style={styles.section}>
            <View style={styles.trendHeader}>
              <SectionHeader overline="Over time" title="Score trend" />
              {scoreDelta != null && (
                <View style={styles.deltaWrap}>
                  <Ionicons
                    name={scoreDelta >= 0 ? 'trending-up-outline' : 'trending-down-outline'}
                    size={18}
                    color={scoreDelta >= 0 ? palette.success : palette.warning}
                  />
                  <AppText
                    variant="heading"
                    color={scoreDelta >= 0 ? palette.success : palette.warning}
                    style={styles.deltaText}
                  >
                    {scoreDelta >= 0 ? '+' : ''}{scoreDelta} since last scan
                  </AppText>
                </View>
              )}
            </View>
            <ScoreTrend scans={completedScans} />
          </GlassCard>
        )}

        {/* 4. Before / after */}
        {scansWithImage.length >= 2 && beforeScan && afterScan && (
          <GlassCard style={styles.section}>
            <SectionHeader
              overline="Transformation"
              title="Before & after"
            />
            <AppText variant="caption" color={palette.textTertiary} style={styles.sinceCaption}>
              Since {formatShortDate(beforeScan.created_at)}
            </AppText>
            <View style={styles.baRow}>
              {/* Before */}
              {baUrls.before ? (
                <View style={styles.imageTile}>
                  <Image
                    source={{ uri: baUrls.before }}
                    style={styles.baImage}
                    contentFit="cover"
                  />
                  <AppText variant="caption" style={styles.imageLabel}>
                    {formatShortDate(beforeScan.created_at)}
                  </AppText>
                  <AppText variant="overline" color={scoreColor(beforeScan.skin_score ?? 0)}>
                    Score {beforeScan.skin_score ?? '—'}
                  </AppText>
                </View>
              ) : (
                <PlaceholderTile
                  score={beforeScan.skin_score}
                  label={formatShortDate(beforeScan.created_at)}
                />
              )}

              {/* Divider arrow */}
              <View style={styles.baArrow}>
                <Ionicons name="arrow-forward" size={22} color={palette.accentBright} />
              </View>

              {/* After */}
              {baUrls.after ? (
                <View style={styles.imageTile}>
                  <Image
                    source={{ uri: baUrls.after }}
                    style={styles.baImage}
                    contentFit="cover"
                  />
                  <AppText variant="caption" style={styles.imageLabel}>
                    {formatShortDate(afterScan.created_at)}
                  </AppText>
                  <AppText variant="overline" color={scoreColor(afterScan.skin_score ?? 0)}>
                    Score {afterScan.skin_score ?? '—'}
                  </AppText>
                </View>
              ) : (
                <PlaceholderTile
                  score={afterScan.skin_score}
                  label={formatShortDate(afterScan.created_at)}
                />
              )}
            </View>
          </GlassCard>
        )}

        {/* If only one scan has image, still show it with the placeholder pattern */}
        {scansWithImage.length === 1 && beforeScan && completedScans.length >= 2 && (
          <GlassCard style={styles.section}>
            <SectionHeader overline="Transformation" title="Before & after" />
            <AppText variant="caption" color={palette.textTertiary} style={styles.sinceCaption}>
              Add a photo to your next scan to compare
            </AppText>
          </GlassCard>
        )}

        {/* 5. Scan history timeline */}
        <View style={styles.section}>
          <SectionHeader overline="History" title="All scans" />
          <Stagger delay={80} interval={60}>
            {[...completedScans].reverse().map((scan) => (
              <ScanRow
                key={scan.id}
                scan={scan}
                onPress={() => {
                  haptics.tap();
                  router.push(`/results/${scan.id}`);
                }}
              />
            ))}
          </Stagger>
        </View>
      </Stagger>
    </Screen>
  );
}

// ─── styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  headerTitle: { marginTop: spacing(1) },
  headerSub: { marginTop: spacing(2) },
  section: { marginTop: spacing(6) },
  gap5: { gap: spacing(5), marginTop: spacing(6) },
  gap3: { gap: spacing(3) },

  // Streak card
  streakTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(4),
    marginBottom: spacing(4),
  },
  streakCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2),
  },
  streakNumber: { fontSize: 42, lineHeight: 48, color: palette.warning },
  streakMeta: { flex: 1, gap: spacing(1) },

  // Activity grid (30 cells)
  gridWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing(1),
    marginBottom: spacing(4),
  },
  gridCell: {
    width: 20,
    height: 20,
    borderRadius: radii.sm,
  },
  gridCellActive: { backgroundColor: palette.accent },
  gridCellDim: { backgroundColor: palette.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: palette.border },

  // Check-in
  checkInWrap: { marginTop: spacing(1) },
  checkedInRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2),
    justifyContent: 'center',
    paddingVertical: spacing(3),
  },

  // Trend
  trendHeader: { marginBottom: 0 },
  deltaWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(1.5),
    marginBottom: spacing(3),
  },
  deltaText: { fontSize: 15 },

  // Before / after
  sinceCaption: { marginTop: -spacing(2), marginBottom: spacing(3) },
  baRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
  },
  imageTile: {
    flex: 1,
    alignItems: 'center',
    gap: spacing(1.5),
  },
  baImage: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: radii.md,
    backgroundColor: palette.surfaceStrong,
  },
  imagePlaceholder: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: radii.md,
    backgroundColor: palette.surfaceStrong,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
  },
  imageLabel: { textAlign: 'center' },
  baArrow: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: spacing(6),
  },

  // Scan rows
  scanRowWrap: { marginBottom: spacing(3) },
  scanRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
    paddingVertical: spacing(3),
  },
  scanRowBody: { flex: 1, gap: spacing(1) },
  scanRowSummary: { fontSize: 13, lineHeight: 18 },
});
