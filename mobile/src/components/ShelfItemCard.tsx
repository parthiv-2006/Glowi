/**
 * A single product on the Shelf — category icon, name/brand, expiry + stock
 * status chips, and a remaining-amount bar. Tapping opens the item detail.
 */
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppText, GlassCard, PressableScale } from '@/components/ui';
import { categoryIcon, expiryColor, stockColor } from '@/lib/constants';
import { expiryLabel, expiryStatus, stockStatus } from '@/lib/shelf';
import type { ShelfItem } from '@/lib/types';
import { palette, radii, spacing } from '@/theme';

export function ShelfItemCard({ item, onPress }: { item: ShelfItem; onPress: () => void }) {
  const expiry = expiryStatus(item);
  const stock = stockStatus(item.amount_remaining);
  const eColor = expiryColor(expiry.kind);
  const sColor = stockColor(stock);

  return (
    <PressableScale onPress={onPress} style={styles.wrap} haptic={false}>
      <GlassCard style={styles.card}>
        <View style={styles.row}>
          <View style={[styles.iconTile, { backgroundColor: palette.accentDim }]}>
            <Ionicons name={categoryIcon(item.category)} size={20} color={palette.accentBright} />
          </View>
          <View style={styles.body}>
            <AppText variant="heading" numberOfLines={1} style={styles.name}>
              {item.name}
            </AppText>
            {item.brand ? (
              <AppText variant="caption" color={palette.textSecondary} numberOfLines={1}>
                {item.brand}
              </AppText>
            ) : null}
            <View style={styles.chips}>
              <View style={styles.chip}>
                <View style={[styles.dot, { backgroundColor: eColor }]} />
                <AppText variant="caption" color={eColor}>
                  {expiryLabel(expiry)}
                </AppText>
              </View>
              <View style={styles.chip}>
                <View style={[styles.dot, { backgroundColor: sColor }]} />
                <AppText variant="caption" color={palette.textSecondary}>
                  {item.amount_remaining}% left
                </AppText>
              </View>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={16} color={palette.textTertiary} />
        </View>

        <View style={styles.barTrack}>
          <View
            style={[
              styles.barFill,
              { width: `${item.amount_remaining}%` as unknown as number, backgroundColor: sColor },
            ]}
          />
        </View>
      </GlassCard>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing(3) },
  card: { gap: spacing(3) },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing(3) },
  iconTile: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, gap: spacing(0.5) },
  name: { fontSize: 16 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(3), marginTop: spacing(1) },
  chip: { flexDirection: 'row', alignItems: 'center', gap: spacing(1.5) },
  dot: { width: 7, height: 7, borderRadius: 4 },
  barTrack: {
    height: 3,
    borderRadius: radii.full,
    backgroundColor: palette.surfaceStrong,
    overflow: 'hidden',
  },
  barFill: { height: 3, borderRadius: radii.full },
});
