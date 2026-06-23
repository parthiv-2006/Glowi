import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn } from 'react-native-reanimated';

import {
  AppText,
  Badge,
  GlassCard,
  GlowButton,
  PressableScale,
  ProgressRing,
  Screen,
  SectionHeader,
  Skeleton,
  Stagger,
} from '@/components/ui';
import { BeforeAfterSlider } from '@/components/BeforeAfterSlider';
import { ConcernTrendSparkline } from '@/components/ConcernTrendSparkline';
import { GlowiAvatar } from '@/components/GlowiAvatar';
import { ScoreTrend } from '@/components/ScoreTrend';
import { useRecentCheckins, useScans, useScanComparison } from '@/lib/hooks';
import { haptics } from '@/lib/haptics';
import { computeStreak } from '@/lib/streak';
import { getSignedScanImageUrl } from '@/lib/supabase';
import { palette, scoreColor, spacing } from '@/theme';
import type { ChangeDirection, Scan } from '@/lib/types';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/** Fetches a 1-hour signed URL for a private scan image. */
function useSignedUrl(imagePath: string | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!imagePath) return;
    let cancelled = false;
    getSignedScanImageUrl(imagePath).then((u) => {
      if (!cancelled) setUrl(u);
    });
    return () => {
      cancelled = true;
    };
  }, [imagePath]);

  return url;
}

function directionColor(direction: ChangeDirection): string {
  switch (direction) {
    case 'improved':
      return palette.success;
    case 'worsened':
      return palette.danger;
    default:
      return palette.textSecondary;
  }
}

function ScanRow({ scan, onPress }: { scan: Scan; onPress: () => void }) {
  const score = scan.skin_score ?? 0;
  return (
    <PressableScale onPress={onPress} style={styles.scanRowWrap}>
      <GlassCard style={styles.scanRow}>
        <ProgressRing value={score} size={52} strokeWidth={5} color={scoreColor(score)} delay={0} />
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

export default function ProgressScreen() {
  const router = useRouter();
  const { data: scans = [], isLoading: scansLoading } = useScans();
  const { data: checkins = [] } = useRecentCheckins();

  const dates = useMemo(() => [...new Set(checkins.map((c) => c.checkin_date))], [checkins]);
  const streak = computeStreak(dates);

  const completedScans = useMemo(
    () =>
      scans
        .filter((s) => s.status === 'complete')
        .slice()
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
    [scans],
  );

  const scoreDelta = useMemo(() => {
    if (completedScans.length < 2) return null;
    const prev = completedScans[completedScans.length - 2].skin_score;
    const curr = completedScans[completedScans.length - 1].skin_score;
    if (prev == null || curr == null) return null;
    return curr - prev;
  }, [completedScans]);

  const trendingDown = useMemo(() => {
    if (completedScans.length < 2) return [];
    const prev = completedScans[completedScans.length - 2];
    const curr = completedScans[completedScans.length - 1];
    return curr.concerns.flatMap((c) => {
      const prevC = prev.concerns.find((p) => p.concern_slug === c.concern_slug);
      if (!prevC || c.severity >= prevC.severity) return [];
      return [{ name: c.display_name, from: prevC.severity, to: c.severity }];
    });
  }, [completedScans]);

  // Oldest vs. latest — used for before/after comparison and concern trends.
  const oldestScan = completedScans.length >= 2 ? completedScans[0] : null;
  const latestScan = completedScans.length >= 2 ? completedScans[completedScans.length - 1] : null;

  // AI delta between the first and most recent scan. staleTime: Infinity in the
  // hook because scan_comparisons caches the result server-side forever.
  const { data: aiDelta, isLoading: deltaLoading } = useScanComparison(
    oldestScan?.id ?? null,
    latestScan?.id ?? null,
  );

  // Signed URLs for the private scan images (1-hour expiry, re-fetched on mount).
  const beforeUrl = useSignedUrl(oldestScan?.image_path);
  const afterUrl = useSignedUrl(latestScan?.image_path);

  // Per-concern severity history across the most recent 8 scans.
  const concernTrends = useMemo(() => {
    if (completedScans.length < 2) return [];
    const recent = completedScans.slice(-8);
    const slugMap = new Map<
      string,
      { name: string; values: { date: string; severity: number }[] }
    >();
    for (const scan of recent) {
      for (const c of scan.concerns) {
        if (!slugMap.has(c.concern_slug)) {
          slugMap.set(c.concern_slug, { name: c.display_name, values: [] });
        }
        slugMap.get(c.concern_slug)!.values.push({ date: scan.created_at, severity: c.severity });
      }
    }
    return [...slugMap.values()]
      .sort(
        (a, b) =>
          Math.max(...b.values.map((v) => v.severity)) -
          Math.max(...a.values.map((v) => v.severity)),
      )
      .slice(0, 5);
  }, [completedScans]);

  // Weekly nudge: shown when the most recent scan is more than 6 days old.
  const daysSinceLastScan = useMemo(() => {
    if (completedScans.length === 0) return Infinity;
    const latest = completedScans[completedScans.length - 1];
    return (Date.now() - new Date(latest.created_at).getTime()) / 86_400_000;
  }, [completedScans]);
  const [nudgeDismissed, setNudgeDismissed] = useState(false);
  const showNudge = daysSinceLastScan > 6 && !nudgeDismissed;

  if (scansLoading) {
    return (
      <Screen bottomInset={spacing(20)}>
        <AppText variant="overline">Your journey</AppText>
        <AppText variant="display" style={styles.title}>
          Progress
        </AppText>
        <View style={styles.gap5}>
          <Skeleton width="100%" height={180} />
          <View style={styles.statsRow}>
            <Skeleton width="48%" height={100} />
            <Skeleton width="48%" height={100} />
          </View>
        </View>
      </Screen>
    );
  }

  if (completedScans.length === 0) {
    return (
      <Screen bottomInset={spacing(20)}>
        <Animated.View entering={FadeIn.duration(300)}>
          <AppText variant="overline">Your journey</AppText>
          <AppText variant="display" style={styles.title}>
            Progress
          </AppText>
        </Animated.View>
        <View style={styles.emptyBlock}>
          <GlowiAvatar state="idle" size={72} />
          <AppText variant="title" style={styles.emptyTitle}>
            Complete your first scan to start tracking
          </AppText>
          <AppText variant="body" style={styles.emptyBody}>
            Every scan adds to your timeline — streaks, trends, and a before &amp; after view of
            your skin.
          </AppText>
          <GlowButton
            label="Run your first scan"
            onPress={() => router.push('/scan')}
            style={styles.emptyBtn}
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen bottomInset={spacing(20)}>
      <Animated.View entering={FadeIn.duration(300)}>
        <AppText variant="overline">Your journey</AppText>
        <AppText variant="display" style={styles.title}>
          Progress
        </AppText>
      </Animated.View>

      <Stagger delay={0}>
        {/* Score chart */}
        {completedScans.length >= 2 && (
          <GlassCard style={styles.section}>
            <View style={styles.chartHeader}>
              <AppText variant="caption" color={palette.textSecondary}>
                Skin score · {Math.min(completedScans.length, 8)} weeks
              </AppText>
              {scoreDelta != null && (
                <View style={styles.deltaRow}>
                  <Ionicons
                    name={scoreDelta >= 0 ? 'trending-up' : 'trending-down'}
                    size={14}
                    color={scoreDelta >= 0 ? palette.success : palette.warning}
                  />
                  <AppText
                    variant="heading"
                    color={scoreDelta >= 0 ? palette.success : palette.warning}
                  >
                    {scoreDelta >= 0 ? '+' : ''}
                    {scoreDelta}
                  </AppText>
                </View>
              )}
            </View>
            <ScoreTrend scans={completedScans} />
          </GlassCard>
        )}

        {/* Before & After comparison */}
        {completedScans.length >= 2 && oldestScan && latestScan && (
          <GlassCard style={styles.section}>
            <SectionHeader overline="Comparison" title="Before & After" />
            {deltaLoading ? (
              <Skeleton width="100%" height={300} />
            ) : (
              <View style={styles.beforeAfterContent}>
                <BeforeAfterSlider
                  beforeScan={oldestScan}
                  afterScan={latestScan}
                  beforeUrl={beforeUrl}
                  afterUrl={afterUrl}
                />
                {aiDelta && (
                  <View style={styles.aiDeltaBlock}>
                    <AppText variant="subheading" style={styles.aiHeadline}>
                      {aiDelta.headline}
                    </AppText>
                    <AppText variant="body" color={palette.textBody} style={styles.aiNarrative}>
                      {aiDelta.overall_narrative}
                    </AppText>
                    {aiDelta.changes.map((change, i) => (
                      <View key={i} style={styles.changeRow}>
                        <View
                          style={[
                            styles.directionBadge,
                            { borderColor: directionColor(change.direction) },
                          ]}
                        >
                          <AppText
                            variant="overline"
                            style={[
                              styles.directionText,
                              { color: directionColor(change.direction) },
                            ]}
                          >
                            {change.direction}
                          </AppText>
                        </View>
                        <AppText
                          variant="caption"
                          color={palette.textSecondary}
                          style={styles.changeObs}
                          numberOfLines={2}
                        >
                          {change.observation}
                        </AppText>
                      </View>
                    ))}
                    {aiDelta.caveat && (
                      <AppText variant="caption" color={palette.textTertiary} style={styles.caveat}>
                        ⓘ {aiDelta.caveat}
                      </AppText>
                    )}
                  </View>
                )}
              </View>
            )}
          </GlassCard>
        )}

        {/* Per-concern trend sparklines */}
        {concernTrends.length > 0 && (
          <GlassCard style={styles.section}>
            <SectionHeader overline="History" title="Concern trends" />
            {concernTrends.map((ct) => (
              <ConcernTrendSparkline key={ct.name} name={ct.name} values={ct.values} />
            ))}
          </GlassCard>
        )}

        {/* Stats row */}
        <View style={[styles.section, styles.statsRow]}>
          <GlassCard style={styles.statBox}>
            <AppText variant="display" style={styles.statNum}>
              {streak}
            </AppText>
            <AppText variant="caption" color={palette.textSecondary}>
              day streak 🔥
            </AppText>
          </GlassCard>
          <GlassCard style={styles.statBox}>
            <AppText variant="display" style={styles.statNum}>
              {completedScans.length}
            </AppText>
            <AppText variant="caption" color={palette.textSecondary}>
              scans logged
            </AppText>
          </GlassCard>
        </View>

        {/* Concerns trending down */}
        {trendingDown.length > 0 && (
          <GlassCard style={styles.section}>
            <AppText variant="subheading" style={styles.trendTitle}>
              Concerns trending down
            </AppText>
            {trendingDown.map((c) => (
              <View key={c.name} style={styles.trendRow}>
                <AppText variant="caption" style={styles.trendName} numberOfLines={1}>
                  {c.name}
                </AppText>
                <View style={styles.trendBarTrack}>
                  <View style={[styles.trendBarFill, { width: `${c.to}%` as `${number}%` }]} />
                </View>
                <AppText variant="caption" color={palette.accentBright} style={styles.trendDelta}>
                  {c.from} → {c.to}
                </AppText>
              </View>
            ))}
          </GlassCard>
        )}

        {/* Weekly scan nudge */}
        {showNudge && (
          <GlassCard style={[styles.section, styles.nudgeCard]}>
            <View style={styles.nudgeRow}>
              <GlowiAvatar state="idle" size={40} />
              <View style={styles.nudgeText}>
                <AppText variant="subheading">Ready for your weekly scan?</AppText>
                <AppText variant="caption" color={palette.textSecondary}>
                  {Math.floor(daysSinceLastScan)} days since your last check-in.
                </AppText>
              </View>
            </View>
            <View style={styles.nudgeActions}>
              <GlowButton
                label="Scan now"
                onPress={() => router.push('/scan')}
                style={styles.nudgeScanBtn}
              />
              <PressableScale onPress={() => setNudgeDismissed(true)} style={styles.nudgeDismiss}>
                <AppText variant="caption" color={palette.textTertiary}>
                  Not now
                </AppText>
              </PressableScale>
            </View>
          </GlassCard>
        )}

        {/* Scan history */}
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

const styles = StyleSheet.create({
  title: { marginTop: spacing(1) },
  section: { marginTop: spacing(5) },
  gap5: { gap: spacing(5), marginTop: spacing(5) },
  emptyBlock: { alignItems: 'center', gap: spacing(2), paddingVertical: spacing(10) },
  emptyTitle: { textAlign: 'center', marginTop: spacing(1) },
  emptyBody: { textAlign: 'center', maxWidth: 280 },
  emptyBtn: { marginTop: spacing(2) },

  chartHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing(3),
  },
  deltaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(1) },

  // Before & After
  beforeAfterContent: { gap: spacing(4), marginTop: spacing(2) },
  aiDeltaBlock: { gap: spacing(3) },
  aiHeadline: { lineHeight: 22 },
  aiNarrative: { lineHeight: 20 },
  changeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing(2),
  },
  directionBadge: {
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: spacing(1.5),
    paddingVertical: 2,
    minWidth: 72,
    alignItems: 'center',
  },
  directionText: { fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.6 },
  changeObs: { flex: 1, lineHeight: 17 },
  caveat: { fontStyle: 'italic', lineHeight: 17 },

  statsRow: { flexDirection: 'row', gap: spacing(3) },
  statBox: { flex: 1, gap: spacing(1) },
  statNum: { fontSize: 36, lineHeight: 42 },

  trendTitle: { marginBottom: spacing(4) },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2),
    marginBottom: spacing(3),
  },
  trendName: { width: 96 },
  trendBarTrack: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: palette.surfaceStrong,
    overflow: 'hidden',
  },
  trendBarFill: { height: 4, borderRadius: 2, backgroundColor: palette.accentBright },
  trendDelta: { width: 58, textAlign: 'right' },

  // Weekly nudge
  nudgeCard: { borderWidth: 1, borderColor: palette.accentDim },
  nudgeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(3) },
  nudgeText: { flex: 1, gap: spacing(1) },
  nudgeActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(4),
    marginTop: spacing(4),
  },
  nudgeScanBtn: { flex: 1 },
  nudgeDismiss: { paddingVertical: spacing(2) },

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
