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
import { gradientFor, palette, radii, spacing } from '@/theme';
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
      {/* Gradient banner */}
      <LinearGradient
        colors={colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.cardBanner}
      >
        {/* Top-left: category overline */}
        <AppText variant="overline" color="rgba(244,246,245,0.7)" style={styles.cardCategory}>
          {article.category}
        </AppText>

        {/* Bottom-right: read time pill */}
        <View style={styles.readPill}>
          <Ionicons name="time-outline" size={11} color={palette.accentBright} />
          <AppText variant="caption" color={palette.accentBright} style={styles.readPillText}>
            {article.read_minutes} min read
          </AppText>
        </View>
      </LinearGradient>

      {/* Text content below banner */}
      <View style={styles.cardBody}>
        <AppText variant="title" style={styles.cardTitle}>
          {article.title}
        </AppText>
        <AppText variant="subheading" numberOfLines={2} style={styles.cardExcerpt}>
          {article.excerpt}
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
            icon="search-outline"
            title="No articles found"
            body={
              query
                ? `No results for "${query}". Try a different search.`
                : 'No articles in this category yet.'
            }
          />
        ) : (
          <Stagger delay={60}>
            {filtered.map((article) => (
              <View key={article.id} style={styles.cardGap}>
                <ArticleCard
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
    backgroundColor: 'rgba(45,212,191,0.12)',
    borderColor: 'rgba(45,212,191,0.4)',
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
    height: 120,
    padding: spacing(4),
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  cardCategory: {
    alignSelf: 'flex-start',
  },
  readPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(1),
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: spacing(2.5),
    paddingVertical: spacing(1),
    borderRadius: radii.full,
  },
  readPillText: {
    fontSize: 11,
  },
  cardBody: {
    padding: spacing(4),
    gap: spacing(2),
  },
  cardTitle: {
    fontSize: 20,
    lineHeight: 26,
  },
  cardExcerpt: {
    lineHeight: 21,
  },

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
