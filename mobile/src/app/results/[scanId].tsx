import { useMemo, useRef } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

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
import { useScan, useScans } from '@/lib/hooks';
import { DISCLAIMER } from '@/lib/constants';
import { haptics } from '@/lib/haptics';
import type { ScanConcern } from '@/lib/types';
import { palette, radii, scoreColor, severityColor, severityLabel, spacing } from '@/theme';

export default function ResultsScreen() {
  const { scanId } = useLocalSearchParams<{ scanId: string }>();
  const router = useRouter();
  const { data: scan, isLoading } = useScan(scanId);
  const { data: scans } = useScans();
  const scrollRef = useRef<ScrollView>(null);

  const scoreDelta = useMemo(() => {
    if (!scan || !scans) return null;
    const sorted = scans
      .filter((s) => s.skin_score != null)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
    const idx = sorted.findIndex((s) => s.id === scan.id);
    const prev = idx >= 0 ? sorted[idx + 1] : undefined;
    if (!prev || scan.skin_score == null || prev.skin_score == null) return null;
    return scan.skin_score - prev.skin_score;
  }, [scan, scans]);

  /* ── Loading ── */
  if (isLoading) {
    return (
      <Screen bottomInset={spacing(8)}>
        <View style={styles.backRow}>
          <Skeleton width={32} height={32} radius={16} />
        </View>
        <View style={styles.hero}>
          <Skeleton width={140} height={140} radius={70} />
          <View style={styles.heroText}>
            <Skeleton width="80%" height={20} />
            <View style={{ height: spacing(2) }} />
            <Skeleton width="100%" height={16} />
            <View style={{ height: spacing(2) }} />
            <Skeleton width="60%" height={16} />
          </View>
        </View>
        <View style={{ marginTop: spacing(8) }}>
          <Skeleton width="50%" height={18} />
          <View style={{ height: spacing(4) }} />
          <Skeleton width="100%" height={120} />
          <View style={{ height: spacing(4) }} />
          <Skeleton width="100%" height={120} />
        </View>
      </Screen>
    );
  }

  /* ── Failed / null ── */
  if (!scan || scan.status === 'failed') {
    return (
      <Screen bottomInset={spacing(8)}>
        <EmptyState
          title="Analysis didn't complete"
          body={
            scan?.summary ?? 'Something went wrong while analyzing your skin. Please try again.'
          }
          actionLabel="Try another scan"
          onAction={() => router.replace('/scan')}
        />
      </Screen>
    );
  }

  const skinScore = scan.skin_score ?? 0;
  const skinTypeLabel = scan.skin_type_estimate
    ? `${scan.skin_type_estimate.charAt(0).toUpperCase()}${scan.skin_type_estimate.slice(1)} skin`
    : null;

  const avgConfidence =
    scan.concerns.length > 0
      ? Math.round(
          (scan.concerns.reduce((sum, c) => sum + c.confidence, 0) / scan.concerns.length) * 100,
        )
      : null;

  return (
    <Screen ref={scrollRef} bottomInset={spacing(8)}>
      {/* Back button */}
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
        <AppText variant="overline">Scan results</AppText>
      </Animated.View>

      {/* Hero — the reveal */}
      <Animated.View
        entering={FadeInDown.delay(80).duration(460).springify().damping(16)}
        style={styles.hero}
      >
        <ProgressRing
          value={skinScore}
          size={176}
          strokeWidth={11}
          color={scoreColor(skinScore)}
          sublabel="SKIN SCORE"
          delay={200}
        />
        <View style={styles.heroText}>
          {skinTypeLabel ? (
            <Badge label={skinTypeLabel} color={palette.accent} style={styles.skinTypeBadge} />
          ) : null}
          <AppText variant="title" style={styles.summary}>
            {scan.summary ?? 'Your skin analysis is ready.'}
          </AppText>
        </View>

        <View style={styles.statRow}>
          <View style={styles.statCol}>
            <AppText variant="heading">{scan.concerns.length}</AppText>
            <AppText variant="caption">concerns</AppText>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCol}>
            <AppText
              variant="heading"
              color={
                scoreDelta == null
                  ? palette.text
                  : scoreDelta >= 0
                    ? palette.success
                    : palette.danger
              }
            >
              {scoreDelta == null ? '—' : `${scoreDelta >= 0 ? '+' : ''}${scoreDelta}`}
            </AppText>
            <AppText variant="caption">vs last</AppText>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCol}>
            <AppText variant="heading">{avgConfidence == null ? '—' : `${avgConfidence}%`}</AppText>
            <AppText variant="caption">confidence</AppText>
          </View>
        </View>

        <GlowButton
          label="See what we found"
          onPress={() => {
            haptics.tap();
            scrollRef.current?.scrollTo({ y: 520, animated: true });
          }}
          style={styles.seeMoreBtn}
        />
      </Animated.View>

      {/* Concerns section */}
      <View style={styles.section}>
        <SectionHeader title="What we found" />

        <Stagger delay={160} interval={70}>
          {scan.concerns.map((c) => (
            <ConcernCard
              key={c.concern_slug}
              concern={c}
              onPress={() => {
                haptics.press();
                router.push(`/concern/${scanId}/${c.concern_slug}`);
              }}
            />
          ))}
        </Stagger>
      </View>

      {/* CTAs */}
      <View style={styles.ctaGroup}>
        <GlowButton
          label="Build my routine"
          onPress={() => {
            haptics.success();
            router.push('/routine');
          }}
          style={styles.ctaPrimary}
        />
        <GlowButton
          label="Ask the coach"
          variant="ghost"
          onPress={() => {
            haptics.tap();
            router.push('/(tabs)/chat');
          }}
          style={styles.ctaGhost}
        />
      </View>

      {/* Disclaimer */}
      <AppText variant="caption" color={palette.textTertiary} style={styles.disclaimer}>
        {DISCLAIMER}
      </AppText>
    </Screen>
  );
}

/* ── Concern Card ────────────────────────────────────────────────────── */

function ConcernCard({ concern, onPress }: { concern: ScanConcern; onPress: () => void }) {
  const sColor = severityColor(concern.severity);
  const sLabel = severityLabel(concern.severity);
  const confidencePct = Math.round(concern.confidence * 100);

  return (
    <PressableScale onPress={onPress} style={styles.concernWrap} haptic={false}>
      <GlassCard style={[styles.concernCard, { borderLeftWidth: 3, borderLeftColor: sColor }]}>
        {/* Title + badges */}
        <View style={styles.concernMeta}>
          <AppText variant="heading" style={styles.concernName}>
            {concern.display_name}
          </AppText>
          <View style={styles.concernBadgeRow}>
            <Badge label={`${sLabel} · ${concern.severity}`} color={sColor} />
            <Badge label={`${confidencePct}% confidence`} color={palette.textSecondary} />
          </View>
        </View>

        {/* Area chips */}
        {concern.areas.length > 0 && (
          <View style={styles.areaChips}>
            {concern.areas.map((area) => (
              <View key={area} style={styles.areaChip}>
                <AppText variant="caption" color={palette.textSecondary}>
                  {area}
                </AppText>
              </View>
            ))}
          </View>
        )}

        {/* Observations */}
        <AppText
          variant="caption"
          numberOfLines={2}
          color={palette.textSecondary}
          style={styles.observations}
        >
          {concern.observations}
        </AppText>

        {/* Caution */}
        {concern.caution ? (
          <View style={styles.cautionRow}>
            <Ionicons name="alert-circle" size={14} color={palette.warning} />
            <AppText variant="caption" color={palette.warning} style={styles.cautionText}>
              {concern.caution}
            </AppText>
          </View>
        ) : null}

        {/* Navigate hint */}
        <View style={styles.concernFooter}>
          <AppText variant="caption" color={palette.accentBright}>
            View details
          </AppText>
          <Ionicons name="chevron-forward" size={14} color={palette.accentBright} />
        </View>
      </GlassCard>
    </PressableScale>
  );
}

/* ── Styles ──────────────────────────────────────────────────────────── */

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
    borderColor: 'rgba(94,234,212,0.25)',
  },
  hero: {
    alignItems: 'center',
    gap: spacing(5),
    paddingVertical: spacing(4),
  },
  heroText: {
    alignItems: 'center',
    gap: spacing(3),
    width: '100%',
  },
  skinTypeBadge: {
    alignSelf: 'center',
  },
  summary: {
    textAlign: 'center',
    fontSize: 20,
    lineHeight: 28,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(4),
    marginTop: spacing(2),
  },
  statCol: { alignItems: 'center', gap: spacing(1) },
  statDivider: { width: StyleSheet.hairlineWidth, height: 28, backgroundColor: palette.border },
  seeMoreBtn: {
    marginTop: spacing(2),
    alignSelf: 'stretch',
  },
  section: {
    marginTop: spacing(8),
  },
  concernWrap: {
    marginBottom: spacing(4),
  },
  concernCard: {
    gap: spacing(3),
  },
  concernMeta: {
    gap: spacing(2),
  },
  concernName: {
    fontSize: 17,
  },
  concernBadgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing(2),
  },
  areaChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing(2),
  },
  areaChip: {
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(1.5),
    borderRadius: radii.full,
    backgroundColor: palette.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
  },
  observations: {
    lineHeight: 18,
  },
  cautionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing(2),
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2.5),
    borderRadius: radii.sm,
    backgroundColor: 'rgba(251,191,36,0.08)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(251,191,36,0.2)',
  },
  cautionText: {
    flex: 1,
    lineHeight: 17,
  },
  concernFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing(1),
    paddingTop: spacing(2),
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
  },
  ctaGroup: {
    gap: spacing(3),
    marginTop: spacing(8),
  },
  ctaPrimary: {},
  ctaGhost: {},
  disclaimer: {
    marginTop: spacing(6),
    textAlign: 'center',
    lineHeight: 18,
  },
});
