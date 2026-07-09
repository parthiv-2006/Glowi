/**
 * The Shelf — the user's product inventory. Surfaces expiry and low-stock
 * nudges, and routes into add / detail flows.
 */
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
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
import { ShelfItemCard } from '@/components/ShelfItemCard';
import { useReactionLogs, useShelfItems } from '@/lib/hooks';
import { haptics } from '@/lib/haptics';
import { riskyShelfItems } from '@/lib/reactions';
import { replenishmentTriggers } from '@/lib/replenishment';
import { expiryStatus, stockStatus, summarizeShelf } from '@/lib/shelf';
import type { ShelfItem } from '@/lib/types';
import { palette, radii, spacing } from '@/theme';

/** Sort the cabinet so anything needing attention floats to the top. */
function attentionRank(item: ShelfItem): number {
  const e = expiryStatus(item);
  const s = stockStatus(item.amount_remaining);
  if (e.kind === 'expired') return 0;
  if (e.kind === 'expiring' || s === 'out') return 1;
  if (s === 'low') return 2;
  return 3;
}

export default function ShelfScreen() {
  const router = useRouter();
  const { data: items, isLoading } = useShelfItems();
  const { data: reactions = [] } = useReactionLogs();

  const sorted = useMemo(
    () => (items ? [...items].sort((a, b) => attentionRank(a) - attentionRank(b)) : []),
    [items],
  );
  const summary = useMemo(() => (items ? summarizeShelf(items) : null), [items]);
  const risks = useMemo(() => riskyShelfItems(reactions, items ?? []), [reactions, items]);
  const triggers = useMemo(() => (items ? replenishmentTriggers(items) : []), [items]);

  const nudge = summary
    ? [
        summary.expired ? `${summary.expired} expired` : null,
        summary.expiring ? `${summary.expiring} expiring soon` : null,
        summary.low ? `${summary.low} running low` : null,
      ].filter(Boolean)
    : [];

  return (
    <Screen bottomInset={spacing(8)}>
      {/* Back + add */}
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
          <AppText variant="overline">The Shelf</AppText>
        </View>
        {items?.length ? (
          <PressableScale
            onPress={() => {
              haptics.press();
              router.push('/shelf/add');
            }}
            style={styles.addBtn}
            haptic={false}
          >
            <Ionicons name="add" size={20} color={palette.textOnAccent} />
          </PressableScale>
        ) : null}
      </Animated.View>

      {isLoading ? (
        <View style={{ gap: spacing(3) }}>
          <Skeleton width="60%" height={26} />
          <Skeleton width="100%" height={96} />
          <Skeleton width="100%" height={96} />
        </View>
      ) : !items?.length ? (
        <EmptyState
          title="Your shelf is empty"
          body="Add the products you already own. Glowi will track expiry and stock, and route your daily forecast through what's in your cabinet."
          actionLabel="Add a product"
          onAction={() => router.push('/shelf/add')}
        />
      ) : (
        <>
          <AppText variant="display" style={styles.title}>
            Your shelf
          </AppText>

          {risks.length ? (
            <GlassCard style={styles.nudge}>
              <Ionicons name="warning-outline" size={18} color={palette.danger} />
              <AppText variant="subheading" color={palette.text} style={styles.nudgeText}>
                {risks.length === 1
                  ? `${risks[0].item.name} shares ${risks[0].ingredients.join(', ')} with a product that reacted.`
                  : `${risks.length} products share ingredients with something that reacted.`}
              </AppText>
            </GlassCard>
          ) : null}

          {nudge.length ? (
            <GlassCard style={styles.nudge}>
              <Ionicons name="notifications-outline" size={18} color={palette.warning} />
              <AppText variant="subheading" color={palette.text} style={styles.nudgeText}>
                {nudge.join(' · ')}.
              </AppText>
            </GlassCard>
          ) : (
            <AppText variant="subheading" style={styles.subtitle}>
              {summary?.total} {summary?.total === 1 ? 'product' : 'products'} · all fresh and
              stocked.
            </AppText>
          )}

          {triggers.length ? (
            <PressableScale
              onPress={() => {
                haptics.tap();
                router.push('/shelf/replenish');
              }}
              style={styles.replenishLink}
              haptic={false}
            >
              <AppText variant="subheading" color={palette.accentBright}>
                See what to get next →
              </AppText>
            </PressableScale>
          ) : null}

          <View style={styles.list}>
            <Stagger delay={80} interval={60}>
              {sorted.map((item) => (
                <ShelfItemCard
                  key={item.id}
                  item={item}
                  onPress={() => {
                    haptics.tap();
                    router.push(`/shelf/${item.id}`);
                  }}
                />
              ))}
            </Stagger>
          </View>

          <GlowButton
            label="Add another product"
            variant="ghost"
            onPress={() => {
              haptics.press();
              router.push('/shelf/add');
            }}
          />
          <GlowButton
            label="Check for conflicts"
            variant="ghost"
            onPress={() => {
              haptics.press();
              router.push('/shelf/conflicts');
            }}
          />
          <GlowButton
            label="Reaction log"
            variant="ghost"
            onPress={() => {
              haptics.press();
              router.push('/reactions');
            }}
          />
          <GlowButton
            label="Shelf budget"
            variant="ghost"
            onPress={() => {
              haptics.press();
              router.push('/shelf/budget');
            }}
          />
          <GlowButton
            label="Comparing in a store?"
            variant="ghost"
            onPress={() => {
              haptics.press();
              router.push('/compare');
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
    borderColor: 'rgba(188,94,56,0.25)',
  },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.accent,
  },
  title: { fontSize: 30 },
  subtitle: { marginTop: spacing(2), marginBottom: spacing(5) },
  nudge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2.5),
    marginTop: spacing(3),
    marginBottom: spacing(5),
    borderRadius: radii.md,
  },
  nudgeText: { flex: 1 },
  replenishLink: { marginBottom: spacing(5) },
  list: { marginBottom: spacing(4) },
});
