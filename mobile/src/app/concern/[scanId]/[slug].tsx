import { useState } from 'react';
import { Linking, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import {
  AppText,
  Badge,
  EmptyState,
  ErrorState,
  GlassCard,
  PressableScale,
  ProgressRing,
  Screen,
  Skeleton,
  Stagger,
} from '@/components/ui';
import { ProductCard } from '@/components/ProductCard';
import { FaceZoneMap } from '@/components/FaceZoneMap';
import { zoneSeverities } from '@/lib/faceZones';
import {
  useConcern,
  useNutritionGuide,
  useProductsForConcern,
  useScan,
  useTips,
} from '@/lib/hooks';
import { DISCLAIMER, concernIcon } from '@/lib/constants';
import { haptics } from '@/lib/haptics';
import type { NutritionGuide, ProductForConcern, Tip } from '@/lib/types';
import { palette, radii, severityColor, severityLabel, spacing } from '@/theme';

/* ── Tab definitions ─────────────────────────────────────────────────── */

const TABS = ['Products', 'Nutrition', 'Tips'] as const;
type Tab = (typeof TABS)[number];

const TIP_CATEGORY_LABEL: Record<Tip['category'], string> = {
  habit: 'Habit',
  application: 'How to apply',
  environment: 'Environment',
  myth: 'Myth',
};

const TIP_CATEGORY_COLOR: Record<Tip['category'], string> = {
  habit: palette.accent,
  application: palette.accentBright,
  environment: palette.success,
  myth: palette.warning,
};

/* ── Screen ──────────────────────────────────────────────────────────── */

export default function ConcernDetailScreen() {
  const { scanId, slug } = useLocalSearchParams<{ scanId: string; slug: string }>();
  const router = useRouter();

  const {
    data: concern,
    isLoading: concernLoading,
    isError: concernError,
    refetch: refetchConcern,
  } = useConcern(slug);
  const { data: scan, isLoading: scanLoading } = useScan(scanId);
  const { data: products, isLoading: productsLoading } = useProductsForConcern(slug);
  const { data: guide, isLoading: guideLoading } = useNutritionGuide(slug);
  const { data: tips, isLoading: tipsLoading } = useTips(slug);

  const [activeTab, setActiveTab] = useState<Tab>('Products');

  const scanConcern = scan?.concerns.find((c) => c.concern_slug === slug) ?? null;
  const headerLoading = concernLoading || scanLoading;

  return (
    <Screen bottomInset={spacing(8)}>
      {/* Back button */}
      <Animated.View entering={FadeIn.duration(260)} style={styles.backRow}>
        <PressableScale
          onPress={() => {
            haptics.tap();
            router.back();
          }}
          style={styles.backBtn}
          haptic={false}
          accessibilityLabel="Back"
        >
          <Ionicons name="chevron-back" size={22} color={palette.accentBright} />
        </PressableScale>
        <AppText variant="overline">Concern detail</AppText>
      </Animated.View>

      {/* Header */}
      {headerLoading ? (
        <HeaderSkeleton />
      ) : concernError ? (
        <ErrorState title="Couldn't load this concern" onRetry={() => void refetchConcern()} />
      ) : concern ? (
        <Animated.View
          entering={FadeInDown.delay(80).duration(460).springify().damping(16)}
          style={styles.header}
        >
          {/* Icon halo */}
          <View style={styles.iconHalo}>
            <Ionicons name={concernIcon(concern.icon)} size={28} color={palette.accentBright} />
          </View>

          <View style={styles.headerText}>
            <AppText variant="title" style={styles.concernName}>
              {concern.name}
            </AppText>
            <AppText variant="subheading" style={styles.blurb}>
              {concern.blurb}
            </AppText>
          </View>

          {/* Severity ring from the scan, if available */}
          {scanConcern ? (
            <View style={styles.severityBlock}>
              <ProgressRing
                value={scanConcern.severity}
                size={78}
                strokeWidth={7}
                color={severityColor(scanConcern.severity)}
                sublabel="severity"
                delay={300}
              />
              <Badge
                label={severityLabel(scanConcern.severity)}
                color={severityColor(scanConcern.severity)}
                style={styles.severityBadge}
              />
            </View>
          ) : null}
        </Animated.View>
      ) : null}

      {/* Face-zone map — where this one concern was seen, tinted by severity. */}
      {scanConcern && zoneSeverities([scanConcern]).zones.size > 0 ? (
        <Animated.View entering={FadeIn.delay(160).duration(340)} style={styles.mapCard}>
          <GlassCard>
            <FaceZoneMap concerns={[scanConcern]} height={150} />
          </GlassCard>
        </Animated.View>
      ) : null}

      {/* Segmented tab control */}
      <Animated.View entering={FadeIn.delay(200).duration(340)} style={styles.tabBarWrap}>
        <SegmentedControl
          tabs={TABS}
          active={activeTab}
          onChange={(t) => {
            haptics.tap();
            setActiveTab(t);
          }}
        />
      </Animated.View>

      {/* Tab content */}
      {activeTab === 'Products' && (
        <ProductsTab products={products ?? []} isLoading={productsLoading} />
      )}
      {activeTab === 'Nutrition' && <NutritionTab guide={guide ?? null} isLoading={guideLoading} />}
      {activeTab === 'Tips' && <TipsTab tips={tips ?? []} isLoading={tipsLoading} />}

      {/* Disclaimer */}
      <AppText variant="caption" color={palette.textTertiary} style={styles.disclaimer}>
        {DISCLAIMER}
      </AppText>
    </Screen>
  );
}

/* ── Segmented Control ───────────────────────────────────────────────── */

function SegmentedControl<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: readonly T[];
  active: T;
  onChange: (t: T) => void;
}) {
  const activeIndex = tabs.indexOf(active);
  const segWidth = 100 / tabs.length;

  const pillLeft = useSharedValue(activeIndex * segWidth);

  function handlePress(tab: T, index: number) {
    pillLeft.value = withSpring(index * segWidth, {
      damping: 18,
      stiffness: 200,
    });
    onChange(tab);
  }

  const pillStyle = useAnimatedStyle(() => ({
    left: `${pillLeft.value}%`,
  }));

  return (
    <View style={styles.tabBar}>
      {/* Animated jade pill */}
      <Animated.View style={[styles.tabPill, pillStyle, { width: `${segWidth}%` }]} />

      {tabs.map((tab, i) => {
        const isActive = tab === active;
        return (
          <TouchableOpacity
            key={tab}
            onPress={() => handlePress(tab, i)}
            style={styles.tabItem}
            activeOpacity={0.7}
          >
            <AppText
              variant="subheading"
              color={isActive ? palette.accentBright : palette.textSecondary}
              style={styles.tabLabel}
            >
              {tab}
            </AppText>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

/* ── Products Tab ────────────────────────────────────────────────────── */

function ProductsTab({
  products,
  isLoading,
}: {
  products: ProductForConcern[];
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <Animated.View entering={FadeIn.duration(220)} style={styles.tabContent}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={{ marginBottom: spacing(4) }}>
            <Skeleton width="100%" height={120} />
          </View>
        ))}
      </Animated.View>
    );
  }

  if (!products || products.length === 0) {
    return (
      <Animated.View entering={FadeIn.duration(220)} style={styles.tabContent}>
        <EmptyState
          title="No products yet"
          body="We haven't curated products for this concern yet. Check back soon."
        />
      </Animated.View>
    );
  }

  return (
    <Animated.View entering={FadeIn.duration(220)} style={styles.tabContent}>
      <Stagger delay={60} interval={70}>
        {products.map((p) => (
          <View key={p.id} style={{ marginBottom: spacing(4) }}>
            <ProductCard product={p} rationale={p.rationale} />
          </View>
        ))}
      </Stagger>
    </Animated.View>
  );
}

/* ── Nutrition Tab ───────────────────────────────────────────────────── */

function NutritionTab({ guide, isLoading }: { guide: NutritionGuide | null; isLoading: boolean }) {
  if (isLoading) {
    return (
      <Animated.View entering={FadeIn.duration(220)} style={styles.tabContent}>
        <Skeleton width="100%" height={80} />
        <View style={{ height: spacing(4) }} />
        <Skeleton width="100%" height={160} />
        <View style={{ height: spacing(4) }} />
        <Skeleton width="100%" height={120} />
      </Animated.View>
    );
  }

  if (!guide) {
    return (
      <Animated.View entering={FadeIn.duration(220)} style={styles.tabContent}>
        <EmptyState
          title="No nutrition guide yet"
          body="Nutritional guidance for this concern is coming soon."
        />
      </Animated.View>
    );
  }

  return (
    <Animated.View entering={FadeIn.duration(220)} style={styles.tabContent}>
      {/* Overview */}
      <GlassCard style={styles.overviewCard}>
        <AppText variant="overline">Overview</AppText>
        <AppText variant="body" style={styles.overviewText}>
          {guide.overview}
        </AppText>
      </GlassCard>

      {/* Eat more */}
      {guide.foods.length > 0 && (
        <View style={styles.nutSection}>
          <AppText variant="overline" style={styles.nutSectionLabel}>
            Eat more
          </AppText>
          <Stagger delay={60} interval={60}>
            {guide.foods.map((f) => (
              <GlassCard key={f.food} style={styles.foodCard}>
                <AppText variant="heading" style={styles.foodName}>
                  {f.food}
                </AppText>
                <AppText variant="caption" color={palette.textSecondary}>
                  {f.why}
                </AppText>
                {f.nutrients.length > 0 && (
                  <View style={styles.nutrientBadges}>
                    {f.nutrients.map((n) => (
                      <Badge key={n} label={n} color={palette.success} />
                    ))}
                  </View>
                )}
              </GlassCard>
            ))}
          </Stagger>
        </View>
      )}

      {/* Key nutrients */}
      {guide.nutrients.length > 0 && (
        <View style={styles.nutSection}>
          <AppText variant="overline" style={styles.nutSectionLabel}>
            Key nutrients
          </AppText>
          <Stagger delay={60} interval={60}>
            {guide.nutrients.map((n) => (
              <GlassCard key={n.nutrient} style={styles.nutrientCard}>
                <View style={styles.nutrientRow}>
                  <AppText variant="heading" style={styles.nutrientName}>
                    {n.nutrient}
                  </AppText>
                  <Badge label={n.dose_note} color={palette.accent} />
                </View>
                <AppText variant="caption" color={palette.textSecondary}>
                  {n.evidence}
                </AppText>
              </GlassCard>
            ))}
          </Stagger>
        </View>
      )}

      {/* Go easy on */}
      {guide.avoid.length > 0 && (
        <View style={styles.nutSection}>
          <AppText variant="overline" style={styles.nutSectionLabel}>
            Go easy on
          </AppText>
          <Stagger delay={60} interval={60}>
            {guide.avoid.map((a) => (
              <GlassCard key={a.item} style={styles.avoidCard}>
                <View style={styles.avoidRow}>
                  <Ionicons name="remove-circle" size={16} color={palette.warning} />
                  <AppText variant="heading" style={styles.avoidName}>
                    {a.item}
                  </AppText>
                </View>
                <AppText variant="caption" color={palette.textSecondary}>
                  {a.why}
                </AppText>
              </GlassCard>
            ))}
          </Stagger>
        </View>
      )}

      {/* Evidence / citations */}
      {guide.citations.length > 0 && (
        <View style={styles.nutSection}>
          <AppText variant="overline" style={styles.nutSectionLabel}>
            Evidence
          </AppText>
          {guide.citations.map((c) => (
            <PressableScale
              key={c.url}
              onPress={() => Linking.openURL(c.url).catch(() => {})}
              style={styles.citationRow}
              haptic={false}
            >
              <View style={styles.citationText}>
                <AppText variant="subheading" color={palette.text}>
                  {c.label}
                </AppText>
                <AppText variant="caption" color={palette.textSecondary}>
                  {c.source}
                </AppText>
              </View>
              <Ionicons name="open-outline" size={16} color={palette.accentBright} />
            </PressableScale>
          ))}
        </View>
      )}
    </Animated.View>
  );
}

/* ── Tips Tab ────────────────────────────────────────────────────────── */

type TipCategory = Tip['category'];

function TipsTab({ tips, isLoading }: { tips: Tip[]; isLoading: boolean }) {
  if (isLoading) {
    return (
      <Animated.View entering={FadeIn.duration(220)} style={styles.tabContent}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={{ marginBottom: spacing(4) }}>
            <Skeleton width="100%" height={100} />
          </View>
        ))}
      </Animated.View>
    );
  }

  if (!tips || tips.length === 0) {
    return (
      <Animated.View entering={FadeIn.duration(220)} style={styles.tabContent}>
        <EmptyState title="No tips yet" body="Tips for this concern are coming soon." />
      </Animated.View>
    );
  }

  /* Group tips by category in display order */
  const categoryOrder: TipCategory[] = ['habit', 'application', 'environment', 'myth'];
  const grouped = categoryOrder
    .map((cat) => ({ cat, items: tips.filter((t) => t.category === cat) }))
    .filter((g) => g.items.length > 0);

  return (
    <Animated.View entering={FadeIn.duration(220)} style={styles.tabContent}>
      {grouped.map(({ cat, items }) => (
        <View key={cat} style={styles.tipGroup}>
          <AppText variant="overline" style={styles.tipGroupLabel}>
            {TIP_CATEGORY_LABEL[cat]}
          </AppText>
          <Stagger delay={60} interval={60}>
            {items.map((tip) => (
              <GlassCard key={tip.id} style={styles.tipCard}>
                <View style={styles.tipHeader}>
                  <AppText variant="heading" style={styles.tipTitle}>
                    {tip.title}
                  </AppText>
                  <Badge
                    label={TIP_CATEGORY_LABEL[tip.category]}
                    color={TIP_CATEGORY_COLOR[tip.category]}
                  />
                </View>
                <AppText variant="body" color={palette.textSecondary} style={styles.tipBody}>
                  {tip.body}
                </AppText>
              </GlassCard>
            ))}
          </Stagger>
        </View>
      ))}
    </Animated.View>
  );
}

/* ── Header Skeleton ─────────────────────────────────────────────────── */

function HeaderSkeleton() {
  return (
    <View style={styles.header}>
      <Skeleton width={68} height={68} radius={34} />
      <View style={[styles.headerText, { flex: 1 }]}>
        <Skeleton width="60%" height={22} />
        <View style={{ height: spacing(2) }} />
        <Skeleton width="100%" height={16} />
        <View style={{ height: spacing(1.5) }} />
        <Skeleton width="80%" height={16} />
      </View>
    </View>
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
    borderColor: 'rgba(188,94,56,0.22)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing(4),
    marginBottom: spacing(6),
  },
  iconHalo: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.accentDim,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(188,94,56,0.25)',
    flexShrink: 0,
  },
  headerText: {
    flex: 1,
    gap: spacing(2),
  },
  concernName: {
    fontSize: 22,
    lineHeight: 28,
  },
  blurb: {
    lineHeight: 21,
  },
  severityBlock: {
    alignItems: 'center',
    gap: spacing(2),
    flexShrink: 0,
  },
  severityBadge: {
    alignSelf: 'center',
  },

  /* Face-zone map */
  mapCard: {
    marginBottom: spacing(5),
  },

  /* Tab bar */
  tabBarWrap: {
    marginBottom: spacing(5),
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: palette.surfaceSunken,
    borderRadius: radii.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: spacing(1),
    position: 'relative',
    overflow: 'hidden',
  },
  tabPill: {
    position: 'absolute',
    top: spacing(1),
    bottom: spacing(1),
    borderRadius: radii.full,
    backgroundColor: palette.accentDim,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(188,94,56,0.28)',
  },
  tabItem: {
    flex: 1,
    paddingVertical: spacing(2.5),
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    fontWeight: '600',
    fontSize: 14,
  },

  /* Tab content */
  tabContent: {
    gap: spacing(0),
  },

  /* Products */

  /* Nutrition */
  overviewCard: {
    gap: spacing(2),
    marginBottom: spacing(5),
  },
  overviewText: {
    lineHeight: 23,
  },
  nutSection: {
    marginBottom: spacing(6),
    gap: spacing(3),
  },
  nutSectionLabel: {
    marginBottom: spacing(1),
  },
  foodCard: {
    gap: spacing(2),
    marginBottom: spacing(3),
  },
  foodName: {
    fontSize: 16,
  },
  nutrientBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing(2),
  },
  nutrientCard: {
    gap: spacing(2),
    marginBottom: spacing(3),
  },
  nutrientRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing(3),
    flexWrap: 'wrap',
  },
  nutrientName: {
    fontSize: 16,
    flex: 1,
  },
  avoidCard: {
    gap: spacing(2),
    marginBottom: spacing(3),
  },
  avoidRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2),
  },
  avoidName: {
    fontSize: 16,
  },
  citationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
    paddingVertical: spacing(3),
    paddingHorizontal: spacing(4),
    borderRadius: radii.md,
    backgroundColor: palette.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
    marginBottom: spacing(2),
  },
  citationText: {
    flex: 1,
    gap: spacing(1),
  },

  /* Tips */
  tipGroup: {
    marginBottom: spacing(6),
  },
  tipGroupLabel: {
    marginBottom: spacing(3),
  },
  tipCard: {
    gap: spacing(2.5),
    marginBottom: spacing(3),
  },
  tipHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing(3),
    flexWrap: 'wrap',
  },
  tipTitle: {
    fontSize: 16,
    flex: 1,
  },
  tipBody: {
    lineHeight: 22,
  },

  /* Footer */
  disclaimer: {
    marginTop: spacing(8),
    textAlign: 'center',
    lineHeight: 18,
  },
});
