import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn } from 'react-native-reanimated';

import {
  AppText,
  EmptyState,
  PressableScale,
  Screen,
  Skeleton,
  Stagger,
  TextField,
} from '@/components/ui';
import { useArticles } from '@/lib/hooks';
import { haptics } from '@/lib/haptics';
import { fonts, gradientFor, palette, radii, spacing } from '@/theme';
import type { Article } from '@/lib/types';

// ---------------------------------------------------------------------------
// Category filter chip
// ---------------------------------------------------------------------------
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
      style={[styles.chip, selected && styles.chipSelected]}
    >
      <AppText
        variant="caption"
        color={selected ? palette.accentBright : palette.textSecondary}
        style={selected ? styles.chipTextSelected : undefined}
      >
        {label}
      </AppText>
    </PressableScale>
  );
}

// ---------------------------------------------------------------------------
// Article card
// ---------------------------------------------------------------------------
function ArticleCard({ article, onPress }: { article: Article; onPress: () => void }) {
  const colors = gradientFor(article.hero_gradient);

  return (
    <PressableScale onPress={onPress} style={styles.cardWrap}>
      {/* Gradient cover — category overline top-left, read-time pill top-right */}
      <LinearGradient
        colors={colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.cardBanner}
      >
        <View style={styles.bannerGlow} />
        <AppText variant="overline" color={palette.accentBright} style={styles.cardCategory}>
          {article.category}
        </AppText>
        <View style={styles.readPill}>
          <Ionicons name="time-outline" size={11} color={palette.textBody} />
          <AppText variant="caption" color={palette.textBody} style={styles.readPillText}>
            {article.read_minutes} min
          </AppText>
        </View>
      </LinearGradient>

      {/* Text content below cover */}
      <View style={styles.cardBody}>
        <AppText variant="title" style={styles.cardTitle}>
          {article.title}
        </AppText>
        <AppText
          variant="caption"
          color={palette.textSecondary}
          numberOfLines={2}
          style={styles.cardExcerpt}
        >
          {article.excerpt}
        </AppText>
      </View>
    </PressableScale>
  );
}

// Compact list row — 64px gradient thumbnail + Fraunces title + meta.
function ArticleRow({ article, onPress }: { article: Article; onPress: () => void }) {
  const colors = gradientFor(article.hero_gradient);
  return (
    <PressableScale onPress={onPress} style={styles.row}>
      <LinearGradient
        colors={colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.rowThumb}
      >
        <AppText variant="overline" color={palette.accentBright} style={styles.rowThumbTag}>
          {article.category.slice(0, 3)}
        </AppText>
      </LinearGradient>
      <View style={styles.rowBody}>
        <AppText variant="heading" numberOfLines={2} style={styles.rowTitle}>
          {article.title}
        </AppText>
        <AppText variant="caption" color={palette.textTertiary} style={styles.rowMeta}>
          {`${article.read_minutes} min read · ${article.category}`}
        </AppText>
      </View>
    </PressableScale>
  );
}

// ---------------------------------------------------------------------------
// Skeleton card for loading state
// ---------------------------------------------------------------------------
function SkeletonCard() {
  return (
    <View style={styles.skeletonWrap}>
      <Skeleton width="100%" height={120} style={styles.skeletonBanner} />
      <View style={styles.skeletonBody}>
        <Skeleton width="40%" height={12} />
        <View style={{ height: spacing(2) }} />
        <Skeleton width="90%" height={20} />
        <View style={{ height: spacing(1.5) }} />
        <Skeleton width="75%" height={16} />
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------
export default function LearnScreen() {
  const router = useRouter();
  const { data: articles, isLoading } = useArticles();
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');

  // Derive unique categories
  const categories = useMemo(() => {
    if (!articles) return ['All'];
    const cats = Array.from(new Set(articles.map((a) => a.category))).sort();
    return ['All', ...cats];
  }, [articles]);

  // Filter by category + search query
  const filtered = useMemo(() => {
    if (!articles) return [];
    const q = query.toLowerCase().trim();
    return articles.filter((a) => {
      const matchCat = activeCategory === 'All' || a.category === activeCategory;
      const matchQuery =
        !q || a.title.toLowerCase().includes(q) || a.category.toLowerCase().includes(q);
      return matchCat && matchQuery;
    });
  }, [articles, query, activeCategory]);

  return (
    <Screen bottomInset={spacing(20)}>
      {/* Header */}
      <Animated.View entering={FadeIn.duration(400)}>
        <AppText variant="display">Learn</AppText>
        <AppText variant="subheading" style={styles.subtitle}>
          Evidence-based skincare, minus the noise.
        </AppText>
      </Animated.View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <TextField
          value={query}
          onChangeText={setQuery}
          placeholder="Search articles…"
          returnKeyType="search"
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
        />
      </View>

      {/* Category filter chips — horizontal scroll */}
      {!isLoading && (
        <Animated.View entering={FadeIn.delay(80).duration(300)}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsRow}
            style={styles.chipsScroll}
          >
            {categories.map((cat) => (
              <CategoryChip
                key={cat}
                label={cat}
                selected={activeCategory === cat}
                onPress={() => {
                  haptics.tap();
                  setActiveCategory(cat);
                }}
              />
            ))}
          </ScrollView>
        </Animated.View>
      )}

      {/* Content */}
      <View style={styles.listWrap}>
        {isLoading ? (
          // Loading skeletons
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : filtered.length === 0 ? (
          <EmptyState
            title="No articles found"
            body={
              query
                ? `No results for "${query}". Try a different search.`
                : 'No articles in this category yet.'
            }
          />
        ) : (
          <Stagger delay={60}>
            <View style={styles.cardGap}>
              <ArticleCard
                article={filtered[0]}
                onPress={() => router.push(`/article/${filtered[0].slug}`)}
              />
            </View>
            {filtered.slice(1).map((article) => (
              <View key={article.id} style={styles.rowGap}>
                <ArticleRow
                  article={article}
                  onPress={() => router.push(`/article/${article.slug}`)}
                />
              </View>
            ))}
          </Stagger>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  subtitle: {
    marginTop: spacing(1),
    marginBottom: spacing(1),
  },

  searchWrap: {
    marginTop: spacing(5),
    marginBottom: spacing(3),
  },

  // Category chips
  chipsScroll: {
    marginBottom: spacing(4),
    // Extend slightly beyond screen padding to visually bleed
    marginHorizontal: -spacing(5),
  },
  chipsRow: {
    flexDirection: 'row',
    gap: spacing(2),
    paddingHorizontal: spacing(5),
  },
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

  // Article cards
  listWrap: {
    gap: 0,
  },
  cardGap: {
    marginBottom: spacing(4),
  },
  cardWrap: {
    borderRadius: radii.lg,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
    backgroundColor: palette.bgElevated,
  },
  cardBanner: {
    height: 132,
    overflow: 'hidden',
  },
  bannerGlow: {
    position: 'absolute',
    top: -20,
    right: -10,
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: 'rgba(188,94,56,0.18)',
  },
  cardCategory: {
    position: 'absolute',
    top: spacing(3.5),
    left: spacing(3.5),
    letterSpacing: 1.5,
  },
  readPill: {
    position: 'absolute',
    top: spacing(3),
    right: spacing(3.5),
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(1),
    backgroundColor: 'rgba(7,9,11,0.6)',
    paddingHorizontal: spacing(2.5),
    paddingVertical: spacing(1),
    borderRadius: radii.full,
  },
  readPillText: {
    fontSize: 11,
  },
  cardBody: {
    padding: spacing(4),
    gap: spacing(1.5),
    backgroundColor: palette.surfaceRaised,
  },
  cardTitle: {
    fontSize: 18,
    lineHeight: 23,
  },
  cardExcerpt: {
    lineHeight: 18,
  },

  // Compact list row
  rowGap: { marginBottom: spacing(3) },
  row: {
    flexDirection: 'row',
    gap: spacing(3),
    alignItems: 'center',
    borderRadius: radii.md,
    padding: spacing(3),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
    backgroundColor: palette.surfaceRaised,
  },
  rowThumb: {
    width: 64,
    height: 64,
    borderRadius: radii.sm,
    overflow: 'hidden',
  },
  rowThumbTag: {
    position: 'absolute',
    bottom: spacing(1.5),
    left: spacing(1.5),
    fontSize: 8.5,
    letterSpacing: 1,
  },
  rowBody: { flex: 1, minWidth: 0, gap: spacing(1) },
  rowTitle: { fontFamily: fonts.display, fontSize: 14.5, lineHeight: 18 },
  rowMeta: { fontSize: 11.5 },

  // Skeleton
  skeletonWrap: {
    borderRadius: radii.lg,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
    backgroundColor: palette.bgElevated,
    marginBottom: spacing(4),
  },
  skeletonBanner: {
    borderRadius: 0,
  },
  skeletonBody: {
    padding: spacing(4),
  },
});
