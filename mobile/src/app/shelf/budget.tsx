/**
 * Shelf budget — what the cabinet is worth, what the last quarter cost, and
 * which products are actually earning their price (cost-per-use leaderboard).
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
  PressableScale,
  Screen,
  Skeleton,
  Stagger,
} from '@/components/ui';
import { formatUsd, quarterSpend, shelfValue, valueLeaderboard } from '@/lib/budget';
import { categoryIcon } from '@/lib/constants';
import { haptics } from '@/lib/haptics';
import { useShelfItems } from '@/lib/hooks';
import { palette, radii, spacing } from '@/theme';

export default function ShelfBudget() {
  const router = useRouter();
  const { data: items, isLoading } = useShelfItems();

  const active = useMemo(() => (items ?? []).filter((i) => i.status === 'active'), [items]);
  const priced = useMemo(() => active.filter((i) => i.price_usd != null), [active]);
  const board = useMemo(() => valueLeaderboard(active), [active]);
  const value = shelfValue(active);
  const spend = quarterSpend(active);

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
          accessibilityLabel="Back"
        >
          <Ionicons name="chevron-back" size={22} color={palette.accentBright} />
        </PressableScale>
        <AppText variant="overline">Shelf budget</AppText>
      </Animated.View>

      {isLoading ? (
        <View style={{ gap: spacing(3) }}>
          <Skeleton width="60%" height={26} />
          <Skeleton width="100%" height={96} />
          <Skeleton width="100%" height={96} />
        </View>
      ) : !priced.length ? (
        <EmptyState
          title="No prices yet"
          body="Add what you paid when you put a product on the shelf, and Glowi will track your spend and show which products actually earn their price."
          actionLabel="Back to shelf"
          onAction={() => router.back()}
        />
      ) : (
        <>
          <AppText variant="display" style={styles.title}>
            What it costs
          </AppText>
          <AppText variant="subheading" style={styles.subtitle}>
            {priced.length} of {active.length} products priced.
          </AppText>

          <View style={styles.statRow}>
            <GlassCard style={styles.statCard}>
              <AppText variant="overline">Shelf value</AppText>
              <AppText variant="heading" style={styles.statValue}>
                {formatUsd(value)}
              </AppText>
            </GlassCard>
            <GlassCard style={styles.statCard}>
              <AppText variant="overline">Last 90 days</AppText>
              <AppText variant="heading" style={styles.statValue}>
                {formatUsd(spend)}
              </AppText>
            </GlassCard>
          </View>

          <AppText variant="overline" style={styles.sectionLabel}>
            Value leaderboard
          </AppText>
          {!board.length ? (
            <AppText variant="caption" color={palette.textSecondary}>
              Mark products as used and their cost-per-use will rank here — the cheapest real-world
              products first.
            </AppText>
          ) : (
            <View style={styles.list}>
              <Stagger delay={80} interval={60}>
                {board.map((entry, idx) => (
                  <GlassCard key={entry.item.id} style={styles.entryCard}>
                    <View style={styles.rankBubble}>
                      <AppText variant="caption" color={palette.accentBright}>
                        {idx + 1}
                      </AppText>
                    </View>
                    <View style={styles.entryIcon}>
                      <Ionicons
                        name={categoryIcon(entry.item.category)}
                        size={18}
                        color={palette.accentBright}
                      />
                    </View>
                    <View style={styles.entryBody}>
                      {entry.item.brand ? (
                        <AppText variant="overline" color={palette.textSecondary}>
                          {entry.item.brand}
                        </AppText>
                      ) : null}
                      <AppText variant="heading" numberOfLines={1} style={styles.entryName}>
                        {entry.item.name}
                      </AppText>
                      <AppText variant="caption" color={palette.textTertiary}>
                        {formatUsd(entry.item.price_usd ?? 0)} · used {entry.item.times_used}{' '}
                        {entry.item.times_used === 1 ? 'time' : 'times'}
                      </AppText>
                    </View>
                    <View style={styles.cpuWrap}>
                      <AppText variant="heading" color={palette.accentBright} style={styles.cpu}>
                        {formatUsd(entry.costPerUse)}
                      </AppText>
                      <AppText variant="caption" color={palette.textTertiary}>
                        per use
                      </AppText>
                    </View>
                  </GlassCard>
                ))}
              </Stagger>
            </View>
          )}

          {priced.length > board.length ? (
            <AppText variant="caption" color={palette.textTertiary} style={styles.hint}>
              {priced.length - board.length} priced{' '}
              {priced.length - board.length === 1 ? 'product hasn’t' : 'products haven’t'} been
              marked as used yet — cost-per-use appears after the first use.
            </AppText>
          ) : null}
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
  subtitle: { marginTop: spacing(2), marginBottom: spacing(5) },
  statRow: { flexDirection: 'row', gap: spacing(3) },
  statCard: { flex: 1, gap: spacing(1.5) },
  statValue: { fontSize: 22 },
  sectionLabel: { marginTop: spacing(6), marginBottom: spacing(3) },
  list: { gap: spacing(3) },
  entryCard: { flexDirection: 'row', alignItems: 'center', gap: spacing(3) },
  rankBubble: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.accentDim,
    flexShrink: 0,
  },
  entryIcon: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.accentDim,
    flexShrink: 0,
  },
  entryBody: { flex: 1, gap: spacing(0.5) },
  entryName: { fontSize: 15 },
  cpuWrap: { alignItems: 'flex-end', flexShrink: 0 },
  cpu: { fontSize: 16 },
  hint: { marginTop: spacing(4), lineHeight: 17 },
});
