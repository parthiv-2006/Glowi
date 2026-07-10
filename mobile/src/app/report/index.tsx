/**
 * Glow Report history — every past Weekly Glow Report, newest first, each row
 * deep-linking into /report/[weekStart]. A plain read over the immutable
 * `glow_reports` cache (zero AI cost); if the most recent completed week hasn't
 * been generated yet it appears as a "tap to generate" row on top, reusing the
 * lazy generation the report screen already does.
 */
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { format, parseISO } from 'date-fns';
import Animated, { FadeIn } from 'react-native-reanimated';

import {
  AppText,
  EmptyState,
  GlassCard,
  PressableScale,
  Screen,
  Skeleton,
  Stagger,
} from '@/components/ui';
import { useGlowReports } from '@/lib/hooks';
import { mostRecentCompletedWeekStart, weekEndOf } from '@/lib/glowReport';
import { haptics } from '@/lib/haptics';
import { palette, spacing } from '@/theme';
import type { GlowReport } from '@/lib/types';

function weekLabel(weekStart: string): string {
  return `${format(parseISO(weekStart), 'MMM d')} – ${format(parseISO(weekEndOf(weekStart)), 'MMM d')}`;
}

function ReportRow({ report, onPress }: { report: GlowReport; onPress: () => void }) {
  const { stats } = report.content;
  const adherencePct = Math.round((stats.checkins / stats.checkin_possible) * 100);
  return (
    <PressableScale onPress={onPress} style={styles.rowWrap}>
      <GlassCard style={styles.row}>
        <View style={styles.rowBody}>
          <AppText variant="overline" color={palette.clay}>
            {weekLabel(report.week_start)}
          </AppText>
          <AppText variant="subheading" numberOfLines={2} style={styles.rowHeadline}>
            {report.content.headline}
          </AppText>
          <AppText variant="caption" color={palette.inkSoft}>
            {stats.scans} scan{stats.scans === 1 ? '' : 's'} · {adherencePct}% adherence ·{' '}
            {stats.streak_days}-day streak
          </AppText>
        </View>
        <Ionicons name="chevron-forward" size={16} color={palette.inkFaint} />
      </GlassCard>
    </PressableScale>
  );
}

export default function GlowReportHistoryScreen() {
  const router = useRouter();
  const { data: reports = [], isLoading } = useGlowReports();

  // The most recent completed week may not be generated yet — offer it on top.
  const latestWeek = useMemo(() => mostRecentCompletedWeekStart(), []);
  const latestMissing = !isLoading && !reports.some((r) => r.week_start === latestWeek);

  const openWeek = (weekStart: string) => {
    haptics.tap();
    router.push(`/report/${weekStart}`);
  };

  return (
    <Screen bottomInset={spacing(8)}>
      <Animated.View entering={FadeIn.duration(260)} style={styles.backRow}>
        <PressableScale
          onPress={() => {
            haptics.tap();
            router.back();
          }}
          style={styles.backBtn}
          haptic={false}
        >
          <Ionicons name="chevron-back" size={22} color={palette.accentBright} />
        </PressableScale>
        <AppText variant="overline">Glow Reports</AppText>
      </Animated.View>

      <Animated.View entering={FadeIn.duration(300)}>
        <AppText variant="display" style={styles.title}>
          Your weeks in review
        </AppText>
        <AppText variant="body" color={palette.inkSoft} style={styles.subtitle}>
          Every Glow Report you’ve unlocked — scroll your story week over week.
        </AppText>
      </Animated.View>

      {isLoading ? (
        <View style={styles.skeletons}>
          <Skeleton width="100%" height={96} />
          <Skeleton width="100%" height={96} />
          <Skeleton width="100%" height={96} />
        </View>
      ) : reports.length === 0 && !latestMissing ? (
        <EmptyState
          title="No reports yet"
          body="Your first Glow Report arrives once a full Monday-to-Sunday week is behind you. Keep scanning and checking in."
          actionLabel="Back"
          onAction={() => router.back()}
        />
      ) : (
        <View style={styles.list}>
          <Stagger delay={80} interval={60}>
            {latestMissing && (
              <PressableScale onPress={() => openWeek(latestWeek)} style={styles.rowWrap}>
                <GlassCard style={[styles.row, styles.pendingRow]}>
                  <View style={styles.rowBody}>
                    <AppText variant="overline" color={palette.clay}>
                      {weekLabel(latestWeek)}
                    </AppText>
                    <AppText variant="subheading" style={styles.rowHeadline}>
                      Your latest report is ready to unlock →
                    </AppText>
                  </View>
                  <Ionicons name="sparkles-outline" size={16} color={palette.clayBright} />
                </GlassCard>
              </PressableScale>
            )}
            {reports.map((report) => (
              <ReportRow
                key={report.id}
                report={report}
                onPress={() => openWeek(report.week_start)}
              />
            ))}
          </Stagger>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
    marginBottom: spacing(5),
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.accentDim,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(188,94,56,0.25)',
  },
  title: { marginTop: spacing(1) },
  subtitle: { marginTop: spacing(2), lineHeight: 22 },
  skeletons: { gap: spacing(3), marginTop: spacing(6) },
  list: { marginTop: spacing(6) },
  rowWrap: { marginBottom: spacing(3) },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
    paddingVertical: spacing(3),
  },
  pendingRow: { borderWidth: 1, borderColor: palette.accentDim },
  rowBody: { flex: 1, gap: spacing(1) },
  rowHeadline: { fontSize: 15, lineHeight: 20 },
});
