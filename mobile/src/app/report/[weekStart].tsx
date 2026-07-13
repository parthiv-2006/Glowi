/**
 * Weekly Glow Report — what moved, what worked, and one focus for next week.
 * Generated lazily by the active AIProvider (cached one row per completed week)
 * and reachable from the Progress tab and the weekly notification. The score
 * ring is derived from the user's own scan history for the reported week; the
 * stored report carries only counted stats (see GlowReportContent).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { format, parseISO } from 'date-fns';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';

import {
  AppText,
  EmptyState,
  ErrorState,
  GlassCard,
  GlowButton,
  PressableScale,
  ProgressRing,
  Screen,
  SectionHeader,
  Skeleton,
  Stagger,
} from '@/components/ui';
import { GlowReportShareCard } from '@/components/GlowReportShareCard';
import { track } from '@/lib/analytics';
import { useGlowReport, useScans } from '@/lib/hooks';
import { weekEndOf } from '@/lib/glowReport';
import { DISCLAIMER } from '@/lib/constants';
import { haptics } from '@/lib/haptics';
import { palette, scoreColor, spacing } from '@/theme';

export default function GlowReportScreen() {
  const router = useRouter();
  const { weekStart } = useLocalSearchParams<{ weekStart: string }>();
  const week = String(weekStart ?? '');
  const { data: report, isLoading, isError, refetch } = useGlowReport(week);
  const { data: scans = [] } = useScans();
  const shareRef = useRef<View>(null);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    track('report_opened');
  }, []);

  // The reported week's ending skin score + movement, from the user's own scans.
  const { endScore, scoreDelta } = useMemo(() => {
    if (!week) return { endScore: null, scoreDelta: null };
    const sunday = weekEndOf(week);
    const completed = scans
      .filter((s) => s.status === 'complete' && s.skin_score != null)
      .slice()
      .sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
    const inWeek = completed.filter((s) => {
      const d = s.created_at.slice(0, 10);
      return d >= week && d <= sunday;
    });
    const end = inWeek.length ? (inWeek[inWeek.length - 1].skin_score as number) : null;
    const prior = [...completed].reverse().find((s) => s.created_at.slice(0, 10) < week);
    const base =
      prior?.skin_score ?? (inWeek.length >= 2 ? (inWeek[0].skin_score as number) : null);
    return {
      endScore: end,
      scoreDelta: end != null && base != null ? end - base : null,
    };
  }, [scans, week]);

  const weekLabel = useMemo(() => {
    if (!week) return '';
    return `${format(parseISO(week), 'MMM d')} – ${format(parseISO(weekEndOf(week)), 'MMM d')}`;
  }, [week]);

  async function onShare() {
    if (!report || sharing) return;
    try {
      setSharing(true);
      haptics.tap();
      const available = await Sharing.isAvailableAsync();
      if (!available) return;
      const uri = await captureRef(shareRef, { format: 'png', quality: 1 });
      await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Share your glow' });
    } catch {
      // A cancelled share sheet or capture hiccup is non-fatal — stay on screen.
    } finally {
      setSharing(false);
    }
  }

  if (isLoading) {
    return (
      <Screen bottomInset={spacing(8)}>
        <BackRow onBack={() => router.back()} />
        <Skeleton width="60%" height={26} />
        <View style={{ height: spacing(4) }} />
        <Skeleton width="100%" height={180} />
        <View style={{ height: spacing(4) }} />
        <Skeleton width="100%" height={140} />
      </Screen>
    );
  }

  if (isError) {
    return (
      <Screen bottomInset={spacing(8)}>
        <BackRow onBack={() => router.back()} />
        <ErrorState title="Couldn't load this report" onRetry={() => void refetch()} />
      </Screen>
    );
  }

  if (!report) {
    return (
      <Screen bottomInset={spacing(8)}>
        <BackRow onBack={() => router.back()} />
        <EmptyState
          title="No report yet"
          body="We couldn’t put together your Glow Report for this week. Head back and try again in a moment."
          actionLabel="Back"
          onAction={() => router.back()}
        />
      </Screen>
    );
  }

  const { content } = report;
  const adherencePct = Math.round((content.stats.checkins / content.stats.checkin_possible) * 100);
  const showScoreRing = endScore != null;
  const ringValue = showScoreRing ? (endScore as number) : content.stats.streak_days;
  const citesCorrelation = [...content.wins, ...content.watchouts].some((t) =>
    t.includes('Correlations, not proof'),
  );

  return (
    <Screen bottomInset={spacing(8)}>
      <BackRow onBack={() => router.back()} />

      <Animated.View entering={FadeInDown.delay(60).duration(460).springify().damping(16)}>
        <AppText variant="overline">Weekly Glow · {weekLabel}</AppText>
        <AppText variant="display" style={styles.headline}>
          {content.headline}
        </AppText>
        <AppText variant="body" color={palette.inkSoft} style={styles.scoreNote}>
          {content.score_note}
        </AppText>
      </Animated.View>

      {/* Hero ring — the week's ending score, or the streak when no scan */}
      <Animated.View entering={FadeIn.delay(200).duration(420)} style={styles.hero}>
        <ProgressRing
          value={showScoreRing ? ringValue : Math.min(100, (ringValue / 7) * 100)}
          size={132}
          strokeWidth={10}
          color={showScoreRing ? scoreColor(endScore as number) : palette.clayBright}
          label={String(ringValue)}
          sublabel={showScoreRing ? 'skin score' : 'day streak'}
        />
        {showScoreRing && scoreDelta != null && scoreDelta !== 0 && (
          <View style={styles.deltaRow}>
            <Ionicons
              name={scoreDelta > 0 ? 'trending-up' : 'trending-down'}
              size={16}
              color={scoreDelta > 0 ? palette.sage : palette.rose}
            />
            <AppText variant="heading" color={scoreDelta > 0 ? palette.sage : palette.rose}>
              {scoreDelta > 0 ? '+' : ''}
              {scoreDelta} points vs. last scan
            </AppText>
          </View>
        )}
      </Animated.View>

      {/* Stats row */}
      <View style={[styles.section, styles.statsRow]}>
        <GlassCard style={styles.statBox}>
          <AppText variant="display" style={styles.statNum}>
            {content.stats.scans}
          </AppText>
          <AppText variant="caption" color={palette.inkSoft}>
            scan{content.stats.scans === 1 ? '' : 's'}
          </AppText>
        </GlassCard>
        <GlassCard style={styles.statBox}>
          <AppText variant="display" style={styles.statNum}>
            {adherencePct}%
          </AppText>
          <AppText variant="caption" color={palette.inkSoft}>
            routine adherence
          </AppText>
        </GlassCard>
        <GlassCard style={styles.statBox}>
          <AppText variant="display" style={styles.statNum}>
            {content.stats.streak_days}
          </AppText>
          <AppText variant="caption" color={palette.inkSoft}>
            day streak 🔥
          </AppText>
        </GlassCard>
      </View>

      <Stagger delay={80} interval={70}>
        {/* Wins */}
        <GlassCard style={styles.section}>
          <SectionHeader overline="This week" title="What went well" />
          {content.wins.map((win, i) => (
            <View key={i} style={styles.listRow}>
              <Ionicons name="checkmark-circle" size={18} color={palette.sage} />
              <AppText variant="body" color={palette.ink} style={styles.listText}>
                {win}
              </AppText>
            </View>
          ))}
        </GlassCard>

        {/* Watch-outs */}
        {content.watchouts.length > 0 && (
          <GlassCard style={styles.section}>
            <SectionHeader overline="Keep an eye on" title="Watch-outs" />
            {content.watchouts.map((w, i) => (
              <View key={i} style={styles.listRow}>
                <Ionicons name="alert-circle" size={18} color={palette.ochre} />
                <AppText variant="body" color={palette.ink} style={styles.listText}>
                  {w}
                </AppText>
              </View>
            ))}
          </GlassCard>
        )}

        {/* Next week focus */}
        <GlassCard style={[styles.section, styles.focusCard]}>
          <AppText variant="overline" color={palette.clay}>
            Next week, focus on
          </AppText>
          <AppText variant="cardTitle" color={palette.ink} style={styles.focusText}>
            {content.next_week_focus}
          </AppText>
        </GlassCard>
      </Stagger>

      {citesCorrelation && (
        <AppText variant="caption" color={palette.inkFaint} style={styles.caveat}>
          ⓘ Correlations are patterns from your history, not proof — keep scanning to sharpen them.
        </AppText>
      )}

      {/* Share (native only) */}
      {Platform.OS !== 'web' && (
        <GlowButton
          label={sharing ? 'Preparing…' : 'Share my glow'}
          onPress={onShare}
          loading={sharing}
          sheen
          style={styles.shareBtn}
          icon={<Ionicons name="share-outline" size={18} color="#FFFFFF" />}
        />
      )}

      <AppText variant="caption" color={palette.inkFaint} style={styles.disclaimer}>
        {DISCLAIMER}
      </AppText>

      {/* Off-screen share card, captured by ref (never visible in the layout). */}
      <View style={styles.offscreen} pointerEvents="none">
        <GlowReportShareCard
          ref={shareRef}
          report={report}
          endScore={endScore}
          scoreDelta={scoreDelta}
        />
      </View>
    </Screen>
  );
}

function BackRow({ onBack }: { onBack: () => void }) {
  return (
    <Animated.View entering={FadeIn.duration(260)} style={styles.backRow}>
      <PressableScale
        onPress={() => {
          haptics.tap();
          onBack();
        }}
        style={styles.backBtn}
        haptic={false}
        accessibilityLabel="Back"
      >
        <Ionicons name="chevron-back" size={22} color={palette.accentBright} />
      </PressableScale>
      <AppText variant="overline">Glow Report</AppText>
    </Animated.View>
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
  headline: { marginTop: spacing(2), fontSize: 30, lineHeight: 36 },
  scoreNote: { marginTop: spacing(3), lineHeight: 23 },
  hero: { alignItems: 'center', marginTop: spacing(6), gap: spacing(3) },
  deltaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(1.5) },
  section: { marginTop: spacing(5) },
  statsRow: { flexDirection: 'row', gap: spacing(3) },
  statBox: { flex: 1, alignItems: 'center', gap: spacing(1), paddingVertical: spacing(3) },
  statNum: { fontSize: 30, lineHeight: 34 },
  listRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing(2.5),
    marginTop: spacing(3),
  },
  listText: { flex: 1, lineHeight: 21 },
  focusCard: { borderWidth: 1, borderColor: palette.accentDim, gap: spacing(2) },
  focusText: { lineHeight: 26 },
  caveat: { marginTop: spacing(4), fontStyle: 'italic', lineHeight: 18 },
  shareBtn: { marginTop: spacing(6) },
  disclaimer: { marginTop: spacing(5), textAlign: 'center', lineHeight: 18 },
  offscreen: { position: 'absolute', left: -10000, top: 0 },
});
