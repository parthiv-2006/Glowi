/**
 * Shelf item detail — expiry + stock at a glance, plus the actions that keep the
 * inventory live: mark used, adjust how much is left, set opened date, remove.
 */
import { useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { format, parseISO } from 'date-fns';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import {
  AppText,
  Badge,
  EmptyState,
  GlassCard,
  GlowButton,
  PressableScale,
  Screen,
  Skeleton,
} from '@/components/ui';
import { getShelfImageUrl } from '@/lib/api';
import { categoryIcon, expiryColor, stockColor, CATEGORY_LABEL } from '@/lib/constants';
import {
  useDeleteShelfItem,
  useMarkShelfItemUsed,
  useShelfItems,
  useUpdateShelfItem,
} from '@/lib/hooks';
import { haptics } from '@/lib/haptics';
import { expiryLabel, expiryStatus, stockStatus } from '@/lib/shelf';
import { palette, radii, spacing } from '@/theme';

const AMOUNTS = [0, 25, 50, 75, 100];

export default function ShelfItemDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: items, isLoading } = useShelfItems();
  const item = items?.find((i) => i.id === id);

  const update = useUpdateShelfItem();
  const markUsed = useMarkShelfItemUsed();
  const remove = useDeleteShelfItem();

  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (item?.image_path) {
      void getShelfImageUrl(item.image_path).then((url) => active && setImageUrl(url));
    }
    return () => {
      active = false;
    };
  }, [item?.image_path]);

  if (isLoading) {
    return (
      <Screen bottomInset={spacing(8)}>
        <View style={styles.backRow}>
          <Skeleton width={36} height={36} radius={18} />
        </View>
        <Skeleton width="70%" height={28} />
        <View style={{ height: spacing(4) }} />
        <Skeleton width="100%" height={140} />
      </Screen>
    );
  }

  if (!item) {
    return (
      <Screen bottomInset={spacing(8)}>
        <EmptyState
          title="Item not found"
          body="This product is no longer on your shelf."
          actionLabel="Back to shelf"
          onAction={() => router.replace('/shelf')}
        />
      </Screen>
    );
  }

  const expiry = expiryStatus(item);
  const stock = stockStatus(item.amount_remaining);

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
        <AppText variant="overline">On your shelf</AppText>
      </Animated.View>

      <Animated.View
        entering={FadeInDown.delay(60).duration(420).springify().damping(16)}
        style={styles.hero}
      >
        <View style={styles.heroIcon}>
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} style={styles.heroImage} resizeMode="cover" />
          ) : (
            <Ionicons name={categoryIcon(item.category)} size={30} color={palette.accentBright} />
          )}
        </View>
        <View style={styles.heroBody}>
          {item.category ? (
            <Badge label={CATEGORY_LABEL[item.category] ?? item.category} color={palette.accent} />
          ) : null}
          <AppText variant="title" style={styles.name}>
            {item.name}
          </AppText>
          {item.brand ? <AppText variant="subheading">{item.brand}</AppText> : null}
        </View>
      </Animated.View>

      {/* Status row */}
      <View style={styles.statusRow}>
        <GlassCard style={styles.statusCard}>
          <View style={[styles.statusDot, { backgroundColor: expiryColor(expiry.kind) }]} />
          <AppText variant="overline">Freshness</AppText>
          <AppText variant="heading" color={expiryColor(expiry.kind)} style={styles.statusValue}>
            {expiryLabel(expiry)}
          </AppText>
          {expiry.expiresOn ? (
            <AppText variant="caption" color={palette.textTertiary}>
              PAO {format(parseISO(expiry.expiresOn), 'MMM d, yyyy')}
            </AppText>
          ) : (
            <AppText variant="caption" color={palette.textTertiary}>
              Opens the clock when used
            </AppText>
          )}
        </GlassCard>

        <GlassCard style={styles.statusCard}>
          <View style={[styles.statusDot, { backgroundColor: stockColor(stock) }]} />
          <AppText variant="overline">Remaining</AppText>
          <AppText variant="heading" color={stockColor(stock)} style={styles.statusValue}>
            {item.amount_remaining}%
          </AppText>
          <AppText variant="caption" color={palette.textTertiary}>
            Used {item.times_used} {item.times_used === 1 ? 'time' : 'times'}
            {item.last_used_at ? ` · last ${format(parseISO(item.last_used_at), 'MMM d')}` : ''}
          </AppText>
        </GlassCard>
      </View>

      {/* Amount control */}
      <AppText variant="overline" style={styles.sectionLabel}>
        How much is left?
      </AppText>
      <View style={styles.amountRow}>
        {AMOUNTS.map((a) => {
          const active = item.amount_remaining === a;
          return (
            <PressableScale
              key={a}
              onPress={() => {
                haptics.tap();
                update.mutate({ id: item.id, patch: { amount_remaining: a } });
              }}
              style={[styles.amountBtn, active && styles.amountActive]}
              haptic={false}
            >
              <AppText
                variant="subheading"
                color={active ? palette.textOnAccent : palette.textSecondary}
              >
                {a}%
              </AppText>
            </PressableScale>
          );
        })}
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <GlowButton
          label="Mark used today"
          onPress={() => {
            haptics.success();
            markUsed.mutate(item.id);
          }}
          loading={markUsed.isPending}
        />
        {!item.opened_at ? (
          <GlowButton
            label="Mark as opened today"
            variant="ghost"
            onPress={() => {
              haptics.press();
              update.mutate({
                id: item.id,
                patch: { opened_at: new Date().toISOString().slice(0, 10) },
              });
            }}
          />
        ) : null}
        <GlowButton
          label="Remove from shelf"
          variant="danger"
          onPress={() => {
            haptics.tap();
            remove.mutate(item.id, { onSuccess: () => router.replace('/shelf') });
          }}
        />
      </View>
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
    borderColor: 'rgba(188,94,56,0.22)',
  },
  hero: { flexDirection: 'row', alignItems: 'center', gap: spacing(4), marginBottom: spacing(6) },
  heroIcon: {
    width: 72,
    height: 72,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.accentDim,
    overflow: 'hidden',
  },
  heroImage: { width: '100%', height: '100%' },
  heroBody: { flex: 1, gap: spacing(1.5) },
  name: { fontSize: 22, lineHeight: 28 },
  statusRow: { flexDirection: 'row', gap: spacing(3) },
  statusCard: { flex: 1, gap: spacing(1.5) },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusValue: { fontSize: 16 },
  sectionLabel: { marginTop: spacing(6), marginBottom: spacing(3) },
  amountRow: { flexDirection: 'row', gap: spacing(2) },
  amountBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing(3),
    borderRadius: radii.md,
    backgroundColor: palette.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
  },
  amountActive: { backgroundColor: palette.accent, borderColor: palette.accent },
  actions: { gap: spacing(3), marginTop: spacing(8) },
});
