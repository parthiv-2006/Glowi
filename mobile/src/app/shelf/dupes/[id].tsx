/**
 * Dupe Finder — cheaper catalog alternatives that share key ingredients with
 * one shelf item, so "is there a cheaper version of this" gets a grounded
 * answer instead of a Reddit thread. Pure client-side ranking (lib/dupes.ts);
 * zero AI calls.
 */
import { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn } from 'react-native-reanimated';

import { AppText, EmptyState, ErrorState, PressableScale, Screen, Skeleton } from '@/components/ui';
import { ProductCard } from '@/components/ProductCard';
import { track } from '@/lib/analytics';
import { dupeWhy, findDupes } from '@/lib/dupes';
import { haptics } from '@/lib/haptics';
import { useCatalogProducts, useReactionLogs, useShelfItems } from '@/lib/hooks';
import { palette, spacing } from '@/theme';

export default function DupeFinderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  useEffect(() => {
    track('dupe_finder_viewed');
  }, []);

  const {
    data: shelf,
    isLoading: shelfLoading,
    isError: shelfError,
    refetch: refetchShelf,
  } = useShelfItems();
  const { data: reactions = [] } = useReactionLogs();
  const {
    data: catalog,
    isLoading: catalogLoading,
    isError: catalogError,
    refetch: refetchCatalog,
  } = useCatalogProducts();

  const item = shelf?.find((i) => i.id === id);

  const dupes = useMemo(() => {
    if (!item || !catalog) return [];
    return findDupes(item, catalog, reactions, item.product_id);
  }, [item, catalog, reactions]);

  const isLoading = shelfLoading || catalogLoading;
  const isError = shelfError || catalogError;

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
        <AppText variant="overline">Cheaper dupes</AppText>
      </Animated.View>

      {isLoading ? (
        <View style={{ gap: spacing(3) }}>
          <Skeleton width="60%" height={26} />
          <Skeleton width="100%" height={96} />
          <Skeleton width="100%" height={96} />
        </View>
      ) : isError ? (
        <ErrorState
          title="Couldn't load dupes"
          onRetry={() => {
            void refetchShelf();
            void refetchCatalog();
          }}
        />
      ) : !item ? (
        <EmptyState
          title="Item not found"
          body="This product is no longer on your shelf."
          actionLabel="Back to shelf"
          onAction={() => router.replace('/shelf')}
        />
      ) : !dupes.length ? (
        <EmptyState
          title="No cheaper dupe yet"
          body={
            item.key_ingredients.length
              ? "Nothing in the catalog shares this product's key ingredients for less."
              : 'This item has no key ingredients on file, so there is nothing to match against.'
          }
          actionLabel="Back to item"
          onAction={() => router.back()}
        />
      ) : (
        <>
          <AppText variant="display" style={styles.title}>
            Cheaper dupes
          </AppText>
          <AppText variant="subheading" style={styles.subtitle}>
            Catalog products that share {item.name}&rsquo;s key ingredients, for less.
          </AppText>

          <View style={styles.cards}>
            {dupes.map((d) => (
              <ProductCard key={d.product.id} product={d.product} rationale={dupeWhy(d)} />
            ))}
          </View>
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
  cards: { gap: spacing(3) },
});
