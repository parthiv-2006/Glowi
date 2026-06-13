import { Linking, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { AppText, Badge, GlassCard, PressableScale } from '@/components/ui';
import { CATEGORY_LABEL } from '@/lib/constants';
import { haptics } from '@/lib/haptics';
import type { Product } from '@/lib/types';
import { brandGradient, palette, radii, spacing } from '@/theme';

interface ProductCardProps {
  product: Product;
  rationale?: string | null;
  /** Compact variant for inline chat recommendations. */
  compact?: boolean;
}

export function ProductCard({ product, rationale, compact }: ProductCardProps) {
  const link = product.retailer_links[0];
  const [g0, g1] = brandGradient(product.brand);

  async function open() {
    if (!link) return;
    haptics.press();
    await Linking.openURL(link.url).catch(() => {});
  }

  return (
    <GlassCard padded={false} style={styles.card}>
      <View style={styles.row}>
        <LinearGradient colors={[g0, g1]} style={[styles.thumb, compact && styles.thumbCompact]}>
          <AppText variant="overline" color={palette.accentBright}>
            {product.brand.slice(0, 2).toUpperCase()}
          </AppText>
        </LinearGradient>

        <View style={styles.body}>
          <AppText variant="overline">{product.brand}</AppText>
          <AppText variant="heading" style={styles.name} numberOfLines={2}>
            {product.name}
          </AppText>
          <View style={styles.metaRow}>
            <Badge label={CATEGORY_LABEL[product.category] ?? product.category} />
            {product.price_usd != null && (
              <AppText variant="caption" color={palette.textSecondary}>
                ${product.price_usd.toFixed(2)}
              </AppText>
            )}
          </View>
        </View>
      </View>

      {!compact && rationale ? (
        <View style={styles.rationale}>
          <Ionicons name="sparkles" size={13} color={palette.accent} />
          <AppText variant="caption" color={palette.textSecondary} style={styles.rationaleText}>
            {rationale}
          </AppText>
        </View>
      ) : null}

      {!compact && product.key_ingredients.length ? (
        <AppText variant="caption" style={styles.ingredients} numberOfLines={1}>
          Key: {product.key_ingredients.slice(0, 3).join(' · ')}
        </AppText>
      ) : null}

      {link ? (
        <PressableScale onPress={open} style={styles.cta}>
          <AppText variant="subheading" color={palette.accentBright}>
            View at {link.retailer}
          </AppText>
          <Ionicons name="arrow-forward" size={16} color={palette.accentBright} />
        </PressableScale>
      ) : null}
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: { padding: spacing(4), gap: spacing(3) },
  row: { flexDirection: 'row', gap: spacing(3.5), alignItems: 'center' },
  thumb: {
    width: 60,
    height: 60,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
  },
  thumbCompact: { width: 48, height: 48 },
  body: { flex: 1, gap: spacing(1) },
  name: { fontSize: 16, lineHeight: 21 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(2), marginTop: spacing(1) },
  rationale: { flexDirection: 'row', gap: spacing(2), alignItems: 'flex-start' },
  rationaleText: { flex: 1, lineHeight: 17, fontStyle: 'italic' },
  ingredients: { color: palette.textTertiary },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing(3),
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
  },
});
