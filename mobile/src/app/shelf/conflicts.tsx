/**
 * Ingredient Conflict Checker — analyses the active shelf for ingredient
 * interactions and surfaces severity-coded cards with citations.
 */
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn } from 'react-native-reanimated';

import {
  AppText,
  EmptyState,
  GlassCard,
  GlowButton,
  PressableScale,
  Screen,
  Skeleton,
  Stagger,
} from '@/components/ui';
import { getAIProvider } from '@/lib/ai';
import { haptics } from '@/lib/haptics';
import { qk } from '@/lib/query';
import type { IngredientConflict } from '@/lib/types';
import { palette, radii, spacing } from '@/theme';

const SEVERITY_COLOR: Record<IngredientConflict['severity'], string> = {
  avoid: palette.danger,
  caution: palette.warning,
  time_of_day: palette.accentBright,
};

const SEVERITY_LABEL: Record<IngredientConflict['severity'], string> = {
  avoid: 'Avoid together',
  caution: 'Use with caution',
  time_of_day: 'Time of day',
};

function ConflictCard({ conflict }: { conflict: IngredientConflict }) {
  const color = SEVERITY_COLOR[conflict.severity];
  const label = SEVERITY_LABEL[conflict.severity];

  return (
    <GlassCard style={styles.card}>
      <View style={[styles.accentBar, { backgroundColor: color }]} />
      <View style={styles.cardBody}>
        <View style={[styles.chip, { borderColor: color }]}>
          <AppText variant="caption" color={color}>
            {label}
          </AppText>
        </View>

        <AppText variant="heading" style={styles.ingredientLine}>
          {conflict.ingredients.join(' + ')}
        </AppText>

        <AppText variant="caption" color={palette.textSecondary} style={styles.products}>
          {conflict.products.join(' · ')}
        </AppText>

        <AppText variant="subheading" style={styles.reason}>
          {conflict.reason}
        </AppText>

        <View style={styles.recommendationRow}>
          <Ionicons name="bulb-outline" size={14} color={palette.accentBright} />
          <AppText variant="subheading" color={palette.accentBright} style={styles.recommendation}>
            {conflict.recommendation}
          </AppText>
        </View>

        <AppText variant="caption" color={palette.textTertiary} style={styles.citation}>
          {conflict.citation}
        </AppText>
      </View>
    </GlassCard>
  );
}

export default function ConflictsScreen() {
  const router = useRouter();

  const {
    data: report,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: qk.conflictReport,
    queryFn: () => getAIProvider().checkConflicts(),
    staleTime: 0, // always re-validate; caching is server-side in conflict_reports
  });

  const checkedTime = report
    ? new Date(report.checkedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;

  const busy = isLoading || isRefetching;

  return (
    <Screen bottomInset={spacing(8)}>
      <Animated.View entering={FadeIn.duration(260)} style={styles.headerRow}>
        <View style={styles.headerLeft}>
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
          <View>
            <AppText variant="overline">Conflict check</AppText>
            {checkedTime ? (
              <AppText variant="caption" color={palette.textSecondary}>
                Checked at {checkedTime}
              </AppText>
            ) : null}
          </View>
        </View>
      </Animated.View>

      {busy ? (
        <View style={styles.skeletons}>
          <AppText variant="subheading" color={palette.textSecondary} style={styles.loadingLabel}>
            Analysing your shelf…
          </AppText>
          <Skeleton width="100%" height={140} />
          <Skeleton width="100%" height={120} />
        </View>
      ) : isError ? (
        <View style={styles.errorWrap}>
          <Ionicons name="alert-circle-outline" size={32} color={palette.warning} />
          <AppText variant="subheading" color={palette.warning} style={styles.errorText}>
            {error instanceof Error ? error.message : 'Could not run conflict check.'}
          </AppText>
          <GlowButton
            label="Try again"
            variant="ghost"
            onPress={() => {
              haptics.tap();
              void refetch();
            }}
          />
        </View>
      ) : !report?.conflicts.length ? (
        <EmptyState
          title="No conflicts found"
          body="Your current products are safe to layer together. Add more products to your shelf to get richer analysis."
          actionLabel="Re-check"
          onAction={() => {
            haptics.tap();
            void refetch();
          }}
        />
      ) : (
        <>
          <AppText variant="display" style={styles.title}>
            {report.conflicts.length === 1
              ? '1 interaction'
              : `${report.conflicts.length} interactions`}
          </AppText>
          <AppText variant="subheading" color={palette.textSecondary} style={styles.subtitle}>
            Flagged across your active shelf products.
          </AppText>

          <View style={styles.list}>
            <Stagger delay={80} interval={60}>
              {report.conflicts.map((conflict, i) => (
                <ConflictCard key={i} conflict={conflict} />
              ))}
            </Stagger>
          </View>

          <GlowButton
            label="Re-check"
            variant="ghost"
            onPress={() => {
              haptics.press();
              void refetch();
            }}
          />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing(5),
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing(3) },
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
  skeletons: { gap: spacing(3) },
  loadingLabel: { marginBottom: spacing(2) },
  errorWrap: { alignItems: 'center', gap: spacing(4), marginTop: spacing(8) },
  errorText: { textAlign: 'center' },
  title: { fontSize: 30 },
  subtitle: { marginTop: spacing(1), marginBottom: spacing(5) },
  list: { gap: spacing(3), marginBottom: spacing(4) },
  card: {
    flexDirection: 'row',
    borderRadius: radii.md,
    overflow: 'hidden',
    padding: 0,
  },
  accentBar: { width: 4, flexShrink: 0 },
  cardBody: { flex: 1, padding: spacing(4), gap: spacing(2) },
  chip: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing(2.5),
    paddingVertical: spacing(1),
    borderRadius: radii.full,
    borderWidth: 1,
  },
  ingredientLine: { fontSize: 15 },
  products: { fontStyle: 'italic' },
  reason: { lineHeight: 20 },
  recommendationRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing(2) },
  recommendation: { flex: 1, lineHeight: 19 },
  citation: { marginTop: spacing(1), lineHeight: 16 },
});
