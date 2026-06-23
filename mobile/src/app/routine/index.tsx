/**
 * AM/PM skincare routine builder screen.
 *
 * States:
 *  1. Loading   — skeleton while routines fetch
 *  2. Has steps — animated step list with remove + save-changes
 *  3. Has scan, no routine — hero CTA to generate from latest scan
 *  4. No scan   — EmptyState prompting to scan first
 */
import { useMemo, useState, useCallback } from 'react';
import { ActivityIndicator, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeIn,
  FadeOut,
  Layout,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';

import {
  AppText,
  Badge,
  EmptyState,
  GlassCard,
  GlowButton,
  PressableScale,
  Screen,
  Skeleton,
  Stagger,
} from '@/components/ui';
import { CATEGORY_LABEL } from '@/lib/constants';
import { getProductsForConcern, saveRoutine } from '@/lib/api';
import { haptics } from '@/lib/haptics';
import { useRoutines, useScans } from '@/lib/hooks';
import { generateRoutineSteps } from '@/lib/routineGenerator';
import type { ProductForConcern, RoutineStep } from '@/lib/types';
import { useAuth } from '@/stores/auth';
import { motion, palette, radii, spacing } from '@/theme';

// ─── Period toggle ────────────────────────────────────────────────────────────

type Period = 'am' | 'pm';

function PeriodToggle({ value, onChange }: { value: Period; onChange: (p: Period) => void }) {
  const pillX = useSharedValue(value === 'am' ? 0 : 1);

  const pillStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: withTiming(pillX.value * TOGGLE_HALF, {
          duration: motion.base,
          easing: motion.easing,
        }),
      },
    ],
  }));

  function press(p: Period) {
    if (p === value) return;
    haptics.tap();
    pillX.value = p === 'am' ? 0 : 1;
    onChange(p);
  }

  return (
    <View style={toggle.wrap}>
      {/* Animated pill */}
      <Animated.View style={[toggle.pill, pillStyle]} />

      <TouchableOpacity style={toggle.side} onPress={() => press('am')} activeOpacity={0.8}>
        <Ionicons
          name="sunny-outline"
          size={15}
          color={value === 'am' ? palette.textOnAccent : palette.textSecondary}
        />
        <AppText
          variant="subheading"
          color={value === 'am' ? palette.textOnAccent : palette.textSecondary}
        >
          Morning
        </AppText>
      </TouchableOpacity>

      <TouchableOpacity style={toggle.side} onPress={() => press('pm')} activeOpacity={0.8}>
        <Ionicons
          name="moon-outline"
          size={15}
          color={value === 'pm' ? palette.textOnAccent : palette.textSecondary}
        />
        <AppText
          variant="subheading"
          color={value === 'pm' ? palette.textOnAccent : palette.textSecondary}
        >
          Evening
        </AppText>
      </TouchableOpacity>
    </View>
  );
}

const TOGGLE_HALF = 144;

const toggle = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    backgroundColor: palette.surface,
    borderRadius: radii.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
    height: 44,
    position: 'relative',
    width: TOGGLE_HALF * 2,
    alignSelf: 'center',
  },
  pill: {
    position: 'absolute',
    top: 3,
    left: 3,
    width: TOGGLE_HALF - 6,
    height: 38,
    borderRadius: radii.full,
    backgroundColor: palette.accent,
    boxShadow: '0px 0px 12px rgba(188,94,56,0.4)',
  },
  side: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing(1.5),
  },
});

// ─── Step row ─────────────────────────────────────────────────────────────────

const FREQ_LABEL: Record<RoutineStep['frequency'], string> = {
  daily: 'Daily',
  'every-other-day': 'Alt. days',
  '2-3x-week': '2–3×/wk',
  weekly: 'Weekly',
};

function StepRow({
  step,
  index,
  onRemove,
}: {
  step: RoutineStep;
  index: number;
  onRemove: () => void;
}) {
  const productName = step.product?.name ?? step.custom_name ?? 'Custom step';
  const productBrand = step.product?.brand ?? null;
  const category = step.product?.category;
  const categoryLabel = category ? (CATEGORY_LABEL[category] ?? category) : null;

  return (
    <Animated.View
      entering={FadeIn.duration(280)}
      exiting={FadeOut.duration(200)}
      layout={Layout.springify().damping(14)}
    >
      <GlassCard style={styles.stepCard}>
        <View style={styles.stepRow}>
          {/* Step number bubble */}
          <View style={styles.stepBubble}>
            <AppText variant="caption" color={palette.accentBright} style={styles.stepNum}>
              {String(index + 1).padStart(2, '0')}
            </AppText>
          </View>

          {/* Product info */}
          <View style={styles.stepBody}>
            {productBrand ? (
              <AppText variant="overline" color={palette.textSecondary}>
                {productBrand}
              </AppText>
            ) : null}
            <AppText variant="heading" numberOfLines={2} style={styles.stepName}>
              {productName}
            </AppText>
            <AppText variant="caption" color={palette.textSecondary} style={styles.stepInstruction}>
              {step.instruction}
            </AppText>
            <View style={styles.stepMeta}>
              <Badge label={FREQ_LABEL[step.frequency]} color={palette.accent} />
              {categoryLabel ? <Badge label={categoryLabel} color={palette.textTertiary} /> : null}
            </View>
          </View>

          {/* Remove */}
          <PressableScale onPress={onRemove} style={styles.removeBtn}>
            <Ionicons name="trash-outline" size={18} color={palette.textTertiary} />
          </PressableScale>
        </View>
      </GlassCard>
    </Animated.View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function RoutineScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const userId = useAuth((s) => s.session?.user.id);

  const { data: routinesRaw, isLoading: routinesLoading } = useRoutines();
  const { data: scans } = useScans();

  const [period, setPeriod] = useState<Period>('am');
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  // Local edits — null means use server data
  const [localSteps, setLocalSteps] = useState<Record<Period, RoutineStep[] | null>>({
    am: null,
    pm: null,
  });

  // Derived
  const latestScan = useMemo(() => scans?.find((s) => s.status === 'complete') ?? null, [scans]);

  const amRoutine = useMemo(
    () => routinesRaw?.find((r) => r.period === 'am') ?? null,
    [routinesRaw],
  );
  const pmRoutine = useMemo(
    () => routinesRaw?.find((r) => r.period === 'pm') ?? null,
    [routinesRaw],
  );
  const activeRoutine = period === 'am' ? amRoutine : pmRoutine;

  // Effective steps for current period: local edits take precedence
  const activeSteps: RoutineStep[] = useMemo(
    () => localSteps[period] ?? activeRoutine?.steps ?? [],
    [localSteps, period, activeRoutine],
  );

  const hasRoutine = amRoutine != null || pmRoutine != null;
  const isDirty = localSteps[period] != null;

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handlePeriodChange = useCallback((p: Period) => {
    setPeriod(p);
  }, []);

  function removeStep(idx: number) {
    haptics.tap();
    const next = activeSteps.filter((_, i) => i !== idx);
    setLocalSteps((prev) => ({ ...prev, [period]: next }));
  }

  async function handleGenerate() {
    if (!latestScan || !userId) return;
    haptics.press();
    setGenerating(true);
    try {
      const concerns = latestScan.concerns;
      // Fetch products for every concern in parallel
      const results = await Promise.all(
        concerns.map((c) =>
          getProductsForConcern(c.concern_slug).then((products): [string, ProductForConcern[]] => [
            c.concern_slug,
            products,
          ]),
        ),
      );
      const productsByConcern = Object.fromEntries(results);

      const { am, pm } = generateRoutineSteps(concerns, productsByConcern);

      const toSaveSteps = (steps: ReturnType<typeof generateRoutineSteps>['am']) =>
        steps.map((s, i) => ({
          position: i,
          product_id: s.product.id,
          custom_name: null,
          instruction: s.instruction,
          frequency: s.frequency,
        }));

      await Promise.all([
        saveRoutine(userId, 'am', latestScan.id, toSaveSteps(am)),
        saveRoutine(userId, 'pm', latestScan.id, toSaveSteps(pm)),
      ]);

      await qc.invalidateQueries({ queryKey: ['routines'] });
      // Clear any local edits after a regeneration
      setLocalSteps({ am: null, pm: null });
      haptics.success();
    } catch {
      // Silently allow the UI to recover; error state is not in scope
    } finally {
      setGenerating(false);
    }
  }

  async function handleSaveChanges() {
    if (!userId || !isDirty) return;
    haptics.press();
    setSaving(true);
    try {
      const stepsToSave = activeSteps.map((s, i) => ({
        position: i,
        product_id: s.product_id,
        custom_name: s.custom_name,
        instruction: s.instruction,
        frequency: s.frequency,
      }));
      const scanId = activeRoutine?.generated_from_scan ?? latestScan?.id ?? null;
      await saveRoutine(userId, period, scanId, stepsToSave);
      await qc.invalidateQueries({ queryKey: ['routines'] });
      setLocalSteps((prev) => ({ ...prev, [period]: null }));
      haptics.success();
    } catch {
      // no-op
    } finally {
      setSaving(false);
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <Screen bottomInset={spacing(20)}>
      {/* Header */}
      <Animated.View entering={FadeIn.duration(320)} style={styles.header}>
        <PressableScale onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={palette.accentBright} />
        </PressableScale>
        <View style={styles.headerText}>
          <AppText variant="title" style={styles.titleText}>
            Your routine
          </AppText>
          <AppText variant="subheading" color={palette.textSecondary}>
            {hasRoutine ? 'Tailored to your skin analysis' : 'Generate a routine from your scan'}
          </AppText>
        </View>
      </Animated.View>

      {/* Period toggle */}
      <Animated.View entering={FadeIn.delay(80).duration(280)} style={styles.toggleWrap}>
        <PeriodToggle value={period} onChange={handlePeriodChange} />
      </Animated.View>

      {/* Body */}
      {routinesLoading ? (
        <LoadingSkeleton />
      ) : hasRoutine ? (
        <RoutineContent
          steps={activeSteps}
          period={period}
          isDirty={isDirty}
          saving={saving}
          generating={generating}
          hasLatestScan={latestScan != null}
          onRemoveStep={removeStep}
          onSaveChanges={handleSaveChanges}
          onRegenerate={handleGenerate}
        />
      ) : latestScan ? (
        <GenerateFromScanCard generating={generating} onGenerate={handleGenerate} />
      ) : (
        <EmptyState
          title="No scan yet"
          body="Scan your skin first so Glowi can build a routine personalised to what it finds."
          actionLabel="Start a scan"
          onAction={() => {
            haptics.press();
            router.push('/scan');
          }}
        />
      )}
    </Screen>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <View style={styles.skeletonWrap}>
      {[0, 1, 2].map((i) => (
        <GlassCard key={i} style={styles.stepCard}>
          <View style={styles.stepRow}>
            <Skeleton width={36} height={36} style={{ borderRadius: radii.full }} />
            <View style={{ flex: 1, gap: spacing(2) }}>
              <Skeleton width="30%" height={12} />
              <Skeleton width="70%" height={18} />
              <Skeleton width="90%" height={12} />
            </View>
          </View>
        </GlassCard>
      ))}
    </View>
  );
}

function RoutineContent({
  steps,
  period,
  isDirty,
  saving,
  generating,
  hasLatestScan,
  onRemoveStep,
  onSaveChanges,
  onRegenerate,
}: {
  steps: RoutineStep[];
  period: Period;
  isDirty: boolean;
  saving: boolean;
  generating: boolean;
  hasLatestScan: boolean;
  onRemoveStep: (idx: number) => void;
  onSaveChanges: () => void;
  onRegenerate: () => void;
}) {
  return (
    <View style={styles.contentWrap}>
      {steps.length === 0 ? (
        <View style={styles.emptyPeriod}>
          <AppText variant="subheading" color={palette.textSecondary} style={styles.emptyText}>
            No steps for your {period === 'am' ? 'morning' : 'evening'} routine yet.
          </AppText>
        </View>
      ) : (
        <Stagger delay={60}>
          {steps.map((step, idx) => (
            <View key={step.id ?? `step-${idx}`} style={styles.stepSpacing}>
              <StepRow step={step} index={idx} onRemove={() => onRemoveStep(idx)} />
            </View>
          ))}
        </Stagger>
      )}

      {/* Save changes button when user has removed steps */}
      {isDirty ? (
        <Animated.View entering={FadeIn.duration(200)} style={styles.actionRow}>
          <GlowButton
            label="Save changes"
            onPress={onSaveChanges}
            loading={saving}
            style={styles.actionButton}
          />
        </Animated.View>
      ) : null}

      {/* Regenerate ghost button */}
      {hasLatestScan ? (
        <View style={styles.regenerateRow}>
          {generating ? (
            <ActivityIndicator color={palette.accent} size="small" />
          ) : (
            <GlowButton
              label="Regenerate from scan"
              variant="ghost"
              onPress={onRegenerate}
              icon={<Ionicons name="refresh-outline" size={16} color={palette.accentBright} />}
              style={styles.actionButton}
            />
          )}
        </View>
      ) : null}
    </View>
  );
}

function GenerateFromScanCard({
  generating,
  onGenerate,
}: {
  generating: boolean;
  onGenerate: () => void;
}) {
  return (
    <Animated.View entering={FadeIn.delay(160).duration(360)} style={styles.heroCardWrap}>
      <LinearGradient
        colors={['rgba(13,94,80,0.6)', 'rgba(7,9,11,0.0)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroGradientBorder}
      >
        <GlassCard tier="glow" style={styles.heroCard}>
          {/* Glow halo */}
          <View style={styles.heroHalo}>
            <Ionicons name="sparkles" size={32} color={palette.accentBright} />
          </View>

          <AppText variant="heading" style={styles.heroTitle}>
            Ready to build your routine
          </AppText>
          <AppText variant="subheading" color={palette.textSecondary} style={styles.heroBody}>
            Glowi will match products to your scan results and build a step-by-step AM and PM
            routine personalised to your skin.
          </AppText>

          <View style={styles.pillRow}>
            {(['Cleanser', 'Serum', 'Moisturiser', 'SPF'] as const).map((label) => (
              <View key={label} style={styles.featurePill}>
                <AppText variant="caption" color={palette.accentBright}>
                  {label}
                </AppText>
              </View>
            ))}
          </View>

          <GlowButton
            label="Generate from your latest scan"
            onPress={onGenerate}
            loading={generating}
            style={styles.generateBtn}
            icon={
              !generating ? (
                <Ionicons name="flash-outline" size={16} color={palette.textOnAccent} />
              ) : undefined
            }
          />
        </GlassCard>
      </LinearGradient>
    </Animated.View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing(3),
    marginBottom: spacing(5),
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: radii.full,
    backgroundColor: palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
    marginTop: spacing(1),
  },
  headerText: { flex: 1, gap: spacing(1) },
  titleText: { fontSize: 26 },

  toggleWrap: { alignItems: 'center', marginBottom: spacing(6) },

  skeletonWrap: { gap: spacing(3) },

  contentWrap: { gap: spacing(3) },
  stepSpacing: {},
  stepCard: { gap: spacing(3) },
  stepRow: { flexDirection: 'row', gap: spacing(3.5), alignItems: 'flex-start' },
  stepBubble: {
    width: 36,
    height: 36,
    borderRadius: radii.full,
    backgroundColor: palette.accentDim,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(188,94,56,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  stepNum: { fontSize: 11, fontVariant: ['tabular-nums'] },
  stepBody: { flex: 1, gap: spacing(1.5) },
  stepName: { fontSize: 16, lineHeight: 21 },
  stepInstruction: { lineHeight: 18, marginTop: spacing(0.5) },
  stepMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(2), marginTop: spacing(1) },
  removeBtn: {
    padding: spacing(1),
    marginLeft: spacing(1),
    flexShrink: 0,
  },

  emptyPeriod: { paddingVertical: spacing(12), alignItems: 'center' },
  emptyText: { textAlign: 'center' },

  actionRow: { marginTop: spacing(2) },
  regenerateRow: {
    alignItems: 'center',
    marginTop: spacing(2),
    paddingTop: spacing(4),
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
  },
  actionButton: {},

  heroCardWrap: { marginTop: spacing(4) },
  heroGradientBorder: { borderRadius: radii.xl + 2, padding: 1 },
  heroCard: { gap: spacing(4) },
  heroHalo: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: palette.accentDim,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(188,94,56,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  heroTitle: { fontSize: 20, textAlign: 'center' },
  heroBody: { textAlign: 'center', lineHeight: 22 },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(2), justifyContent: 'center' },
  featurePill: {
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(1.5),
    borderRadius: radii.full,
    backgroundColor: palette.accentDim,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(188,94,56,0.25)',
  },
  generateBtn: { marginTop: spacing(2) },
});
