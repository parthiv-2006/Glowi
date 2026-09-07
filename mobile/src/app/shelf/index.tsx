/**
 * The Shelf — the user's product inventory. Surfaces expiry and low-stock
 * nudges, and routes into add / detail flows.
 */
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn } from 'react-native-reanimated';

import {
  AppText,
  EmptyState,
  ErrorState,
  GlassCard,
  GlowButton,
  PressableScale,
  Screen,
  Skeleton,
  Stagger,
  TextField,
} from '@/components/ui';
import { ShelfItemCard } from '@/components/ShelfItemCard';
import { CATEGORY_LABEL } from '@/lib/constants';
import { useReactionLogs, useShelfItems } from '@/lib/hooks';
import { haptics } from '@/lib/haptics';
import { riskyShelfItems } from '@/lib/reactions';
import { replenishmentTriggers } from '@/lib/replenishment';
import { matchesShelfSearch } from '@/lib/shelfSearch';
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

/** A single category filter pill — "All" plus whatever categories are actually on the shelf. */
function CategoryChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <PressableScale
      onPress={onPress}
      haptic={false}
      style={[chipStyles.chip, selected && chipStyles.chipSelected]}
      accessibilityState={{ selected }}
    >
      <AppText
        variant="caption"
        color={selected ? palette.accentBright : palette.textSecondary}
        style={selected ? chipStyles.chipTextSelected : undefined}
      >
        {label}
      </AppText>
    </PressableScale>
  );
}

const chipStyles = StyleSheet.create({
  chip: {
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(2),
    borderRadius: radii.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
    backgroundColor: palette.surface,
  },
  chipSelected: {
    backgroundColor: 'rgba(188,94,56,0.1)',
    borderColor: 'rgba(188,94,56,0.3)',
  },
  chipTextSelected: {
    fontWeight: '600',
  },
});

export default function ShelfScreen() {
  const router = useRouter();
  const { data: items, isLoading, isError, refetch } = useShelfItems();
  const { data: reactions = [] } = useReactionLogs();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');

  const sorted = useMemo(
    () => (items ? [...items].sort((a, b) => attentionRank(a) - attentionRank(b)) : []),
    [items],
  );
  const categories = useMemo(() => {
    const present = new Set((items ?? []).map((i) => i.category).filter((c) => !!c));
    return ['All', ...Array.from(present)];
  }, [items]);
  const searched = useMemo(
    () => sorted.filter((i) => matchesShelfSearch(i, query)),
    [sorted, query],
  );
  const filtered = useMemo(
    () => (category === 'All' ? searched : searched.filter((i) => i.category === category)),
    [searched, category],
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
            accessibilityLabel="Back"
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
            accessibilityLabel="Add product to shelf"
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
      ) : isError ? (
        <ErrorState title="Couldn't load your shelf" onRetry={() => void refetch()} />
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

          <View style={styles.searchWrap}>
            <TextField
              value={query}
              onChangeText={setQuery}
              placeholder="Search your shelf…"
              returnKeyType="search"
              autoCapitalize="none"
              autoCorrect={false}
              clearButtonMode="while-editing"
            />
          </View>

          {categories.length > 2 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipsRow}
              style={styles.chipsScroll}
            >
              {categories.map((cat) => (
                <CategoryChip
                  key={cat}
                  label={cat === 'All' ? 'All' : (CATEGORY_LABEL[cat] ?? cat)}
                  selected={category === cat}
                  onPress={() => {
                    haptics.tap();
                    setCategory(cat);
                  }}
                />
              ))}
            </ScrollView>
          ) : null}

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
              {filtered.map((item) => (
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
  searchWrap: { marginTop: spacing(4), marginBottom: spacing(1) },
  chipsScroll: { marginBottom: spacing(2), marginHorizontal: -spacing(5) },
  chipsRow: { flexDirection: 'row', gap: spacing(2), paddingHorizontal: spacing(5) },
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
