/**
 * Product Wishlist — catalog products the user saved for later, from
 * wherever a ProductCard's heart toggle is wired in (concern detail,
 * replenish, …). Distinct from The Shelf, which tracks products already
 * owned.
 */
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn } from 'react-native-reanimated';

import {
  AppText,
  EmptyState,
  ErrorState,
  PressableScale,
  Screen,
  Skeleton,
  Stagger,
} from '@/components/ui';
import { ProductCard } from '@/components/ProductCard';
import { useCatalogProducts, useToggleWishlist, useWishlist } from '@/lib/hooks';
import { haptics } from '@/lib/haptics';
import { palette, spacing } from '@/theme';

export default function WishlistScreen() {
  const router = useRouter();
  const {
    data: wishlistIds,
    isLoading: wishlistLoading,
    isError: wishlistError,
    refetch: refetchWishlist,
  } = useWishlist();
  const {
    data: catalog,
    isLoading: catalogLoading,
    isError: catalogError,
    refetch: refetchCatalog,
  } = useCatalogProducts();
  const toggleWishlist = useToggleWishlist();

  const saved = useMemo(() => {
    if (!wishlistIds?.length || !catalog) return [];
    const ids = new Set(wishlistIds);
    return catalog.filter((p) => ids.has(p.id)).sort((a, b) => a.name.localeCompare(b.name));
  }, [wishlistIds, catalog]);

  const isLoading = wishlistLoading || catalogLoading;
  const isError = wishlistError || catalogError;

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
        <AppText variant="overline">Wishlist</AppText>
      </Animated.View>

      {isLoading ? (
        <View style={{ gap: spacing(3) }}>
          <Skeleton width="60%" height={26} />
          <Skeleton width="100%" height={96} />
          <Skeleton width="100%" height={96} />
        </View>
      ) : isError ? (
        <ErrorState
          title="Couldn't load your wishlist"
          onRetry={() => {
            void refetchWishlist();
            void refetchCatalog();
          }}
        />
      ) : !saved.length ? (
        <EmptyState
          title="Nothing saved yet"
          body="Tap the heart on any product to save it here for later."
        />
      ) : (
        <>
          <AppText variant="display" style={styles.title}>
            Wishlist
          </AppText>
          <AppText variant="subheading" style={styles.subtitle}>
            {saved.length} {saved.length === 1 ? 'product' : 'products'} saved for later.
          </AppText>

          <Stagger delay={80} interval={60}>
            <View style={styles.cards}>
              {saved.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  saved
                  onToggleSave={() => {
                    haptics.tap();
                    toggleWishlist.mutate({ productId: product.id, wishlisted: true });
                  }}
                />
              ))}
            </View>
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
  subtitle: { marginTop: spacing(2), marginBottom: spacing(6) },
  cards: { gap: spacing(3) },
});
