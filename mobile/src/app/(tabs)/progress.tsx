import { useMemo } from 'react';
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
import { GlowiAvatar } from '@/components/GlowiAvatar';
import { ScoreTrend } from '@/components/ScoreTrend';
import { useRecentCheckins, useScans } from '@/lib/hooks';
import { haptics } from '@/lib/haptics';
import { computeStreak } from '@/lib/streak';
import { palette, scoreColor, spacing } from '@/theme';
import type { Scan } from '@/lib/types';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
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
                  <View
                    style={[styles.trendBarFill, { width: `${c.to}%` as `${number}%` }]}
                  />
                </View>
                <AppText variant="caption" color={palette.accentBright} style={styles.trendDelta}>
                  {c.from} → {c.to}
                </AppText>
              </View>
            ))}
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
