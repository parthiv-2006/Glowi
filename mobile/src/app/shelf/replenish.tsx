/**
 * Smart Replenishment — "what to get next". Groups ranked catalog
 * replacements under each shelf item that's expiring, expired, low, or out,
 * so the Shelf's expiry/stock signals turn into an actual next purchase.
 */
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn } from 'react-native-reanimated';

import {
  AppText,
  Badge,
  EmptyState,
  GlassCard,
  PressableScale,
  Screen,
  Skeleton,
  Stagger,
} from '@/components/ui';
import { ProductCard } from '@/components/ProductCard';
import { expiryColor, stockColor } from '@/lib/constants';
import { haptics } from '@/lib/haptics';
import { useCatalogProducts, useReactionLogs, useScans, useShelfItems } from '@/lib/hooks';
import {
  replenishmentTriggers,
  suggestReplacements,
  type ReplenishmentTrigger,
} from '@/lib/replenishment';
import { useAuth } from '@/stores/auth';
import { palette, radii, spacing } from '@/theme';

const REASON_LABEL: Record<ReplenishmentTrigger['reason'], string> = {
  expired: 'Expired',
  expiring: 'Expiring soon',
  out: 'Out of stock',
  low_stock: 'Running low',
};

function reasonColor(reason: ReplenishmentTrigger['reason']): string {
  if (reason === 'expired') return expiryColor('expired');
  if (reason === 'expiring') return expiryColor('expiring');
  if (reason === 'out') return stockColor('out');
  return stockColor('low');
}

export default function ReplenishScreen() {
  const router = useRouter();
  const profile = useAuth((s) => s.profile);
  const { data: shelf, isLoading: shelfLoading } = useShelfItems();
  const { data: reactions = [] } = useReactionLogs();
  const { data: scans } = useScans();
  const { data: catalog, isLoading: catalogLoading } = useCatalogProducts();

  const latestScan = useMemo(() => scans?.find((s) => s.status === 'complete') ?? null, [scans]);
  const triggers = useMemo(() => (shelf ? replenishmentTriggers(shelf) : []), [shelf]);

  const grouped = useMemo(() => {
    if (!catalog) return [];
    return triggers.map((trigger) => ({
      trigger,
      suggestions: suggestReplacements(
        trigger,
        catalog,
        latestScan,
        reactions,
        shelf ?? [],
        profile?.skin_type ?? null,
      ),
    }));
  }, [triggers, catalog, latestScan, reactions, shelf, profile]);

  const isLoading = shelfLoading || catalogLoading;

  return (
    <Screen bottomInset={spacing(8)}>
      <Animated.View entering={FadeIn.duration(260)} style={styles.headerRow}>
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
        <AppText variant="overline">What to get next</AppText>
      </Animated.View>

      {isLoading ? (
        <View style={{ gap: spacing(3) }}>
          <Skeleton width="60%" height={26} />
          <Skeleton width="100%" height={96} />
          <Skeleton width="100%" height={96} />
        </View>
      ) : !grouped.length ? (
        <EmptyState
          title="Nothing needs replacing"
          body="Your shelf is stocked. Come back here when something's running low or close to expiring."
          actionLabel="Back to shelf"
          onAction={() => router.back()}
        />
      ) : (
        <>
          <AppText variant="display" style={styles.title}>
            What to get next
          </AppText>
          <AppText variant="subheading" style={styles.subtitle}>
            Ranked against your latest scan, your shelf, and any past reactions.
          </AppText>

          <Stagger delay={80} interval={60}>
            {grouped.map(({ trigger, suggestions }) => (
              <View key={trigger.item.id} style={styles.group}>
                <View style={styles.groupHeader}>
                  <AppText variant="heading" numberOfLines={1} style={styles.groupTitle}>
                    {trigger.item.name}
                  </AppText>
                  <Badge label={REASON_LABEL[trigger.reason]} color={reasonColor(trigger.reason)} />
                </View>

                {suggestions.length ? (
                  <View style={styles.cards}>
                    {suggestions.map((s) => (
                      <ProductCard key={s.product.id} product={s.product} rationale={s.why} />
                    ))}
                  </View>
                ) : (
                  <GlassCard style={styles.noMatch}>
                    <AppText variant="caption" color={palette.textSecondary}>
                      No safe match in the catalog yet for this category.
                    </AppText>
                  </GlassCard>
                )}
              </View>
            ))}
          </Stagger>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: {
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
  title: { fontSize: 30 },
  subtitle: { marginTop: spacing(2), marginBottom: spacing(6), lineHeight: 19 },
  group: { marginBottom: spacing(6) },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing(3),
    marginBottom: spacing(3),
  },
  groupTitle: { flex: 1 },
  cards: { gap: spacing(3) },
  noMatch: { borderRadius: radii.md },
});
