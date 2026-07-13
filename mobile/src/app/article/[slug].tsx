/**
 * Article reader — parallax hero + long-form body via Markdown component.
 * Route: /article/[slug]
 */
import { StyleSheet, View, Linking } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, GlassCard, PressableScale, SectionHeader, Skeleton } from '@/components/ui';
import { Markdown } from '@/components/Markdown';
import { useArticle } from '@/lib/hooks';
import { haptics } from '@/lib/haptics';
import { gradientFor, palette, radii, spacing } from '@/theme';

// Height of the parallax hero gradient panel
const HERO_HEIGHT = 260;
// How far the hero translates up as user scrolls (parallax ratio ~0.4)
const PARALLAX_RATIO = 0.45;

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

export default function ArticleScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data: article, isLoading } = useArticle(slug);

  // Scroll position shared value for parallax
  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });

  // Parallax translate + subtle scale for hero
  const heroStyle = useAnimatedStyle(() => {
    const translateY = interpolate(
      scrollY.value,
      [0, HERO_HEIGHT],
      [0, -HERO_HEIGHT * PARALLAX_RATIO],
      'clamp',
    );
    const scale = interpolate(scrollY.value, [-80, 0], [1.08, 1], 'clamp');
    return { transform: [{ translateY }, { scale }] };
  });

  // Hero text fades out faster than the background
  const heroTextStyle = useAnimatedStyle(() => {
    const opacity = interpolate(scrollY.value, [0, HERO_HEIGHT * 0.5], [1, 0], 'clamp');
    const translateY = interpolate(scrollY.value, [0, HERO_HEIGHT * 0.5], [0, -24], 'clamp');
    return { opacity, transform: [{ translateY }] };
  });

  // Back chevron opacity fades in as hero fades out
  const backOpacityStyle = useAnimatedStyle(() => {
    // always semi-visible; increase to full on scroll
    const opacity = interpolate(scrollY.value, [0, 80], [0.85, 1], 'clamp');
    return { opacity };
  });

  const gradientColors = gradientFor(article?.hero_gradient ?? null);

  return (
    <View style={styles.root}>
      {/* ------------------------------------------------------------------ */}
      {/* Parallax hero (positioned absolutely so it underlaps the scroll)    */}
      {/* ------------------------------------------------------------------ */}
      <Animated.View style={[styles.heroContainer, heroStyle]}>
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroGradient}
        />
      </Animated.View>

      {/* ------------------------------------------------------------------ */}
      {/* Back button (fixed, always on top of hero)                          */}
      {/* ------------------------------------------------------------------ */}
      <Animated.View style={[styles.backBtn, { top: insets.top + spacing(3) }, backOpacityStyle]}>
        <PressableScale
          onPress={() => {
            haptics.tap();
            router.back();
          }}
          style={styles.backPressable}
          haptic={false}
          accessibilityLabel="Back"
        >
          <View style={styles.backPill}>
            <Ionicons name="chevron-back" size={20} color={palette.text} />
          </View>
        </PressableScale>
      </Animated.View>

      {/* ------------------------------------------------------------------ */}
      {/* Scrollable content                                                  */}
      {/* ------------------------------------------------------------------ */}
      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top,
            paddingBottom: insets.bottom + spacing(10),
          },
        ]}
      >
        {/* Hero text overlay — lives inside scroll so it scrolls with content */}
        <Animated.View style={[styles.heroTextWrap, heroTextStyle]}>
          {isLoading ? (
            <View style={styles.heroSkeletons}>
              <Skeleton width="30%" height={12} />
              <View style={{ height: spacing(3) }} />
              <Skeleton width="85%" height={36} />
              <View style={{ height: spacing(2) }} />
              <Skeleton width="50%" height={14} />
            </View>
          ) : article ? (
            <>
              <AppText variant="overline" color="rgba(244,246,245,0.6)" style={styles.heroCategory}>
                {article.category}
              </AppText>
              <AppText variant="display" style={styles.heroTitle}>
                {article.title}
              </AppText>
              {/* Meta row */}
              <View style={styles.metaRow}>
                <View style={styles.metaItem}>
                  <Ionicons name="time-outline" size={13} color={palette.accentBright} />
                  <AppText variant="caption" color={palette.accentBright}>
                    {article.read_minutes} min read
                  </AppText>
                </View>
                <View style={styles.metaDot} />
                <AppText variant="caption" color={palette.textSecondary}>
                  {formatDate(article.published_at)}
                </AppText>
              </View>
            </>
          ) : null}
        </Animated.View>

        {/* ---------------------------------------------------------------- */}
        {/* Body panel — card that sits on top of the hero gradient           */}
        {/* ---------------------------------------------------------------- */}
        <View style={styles.bodyPanel}>
          {isLoading ? (
            <View style={styles.bodySkeletons}>
              {[100, 75, 90, 60, 85, 70, 95].map((w, i) => (
                <View key={i} style={{ marginBottom: spacing(2) }}>
                  <Skeleton width={`${w}%`} height={15} />
                </View>
              ))}
            </View>
          ) : article ? (
            <>
              {/* Article body */}
              <Markdown source={article.body_md} />

              {/* Citations */}
              {article.citations && article.citations.length > 0 && (
                <View style={styles.citationsWrap}>
                  <SectionHeader title="References" />
                  {article.citations.map((cit, i) => (
                    <PressableScale
                      key={i}
                      onPress={() => {
                        haptics.tap();
                        void Linking.openURL(cit.url);
                      }}
                      style={styles.citationPressable}
                    >
                      <GlassCard style={styles.citationCard}>
                        <View style={styles.citationRow}>
                          <View style={styles.citationText}>
                            <AppText
                              variant="caption"
                              color={palette.textTertiary}
                              style={styles.citationLabel}
                            >
                              [{i + 1}]
                            </AppText>
                            <View style={styles.citationDetails}>
                              <AppText
                                variant="subheading"
                                color={palette.text}
                                style={styles.citationSource}
                              >
                                {cit.label}
                              </AppText>
                              <AppText variant="caption" color={palette.textTertiary}>
                                {cit.source}
                              </AppText>
                            </View>
                          </View>
                          <Ionicons
                            name="open-outline"
                            size={15}
                            color={palette.accentBright}
                            style={styles.citationIcon}
                          />
                        </View>
                      </GlassCard>
                    </PressableScale>
                  ))}
                </View>
              )}
            </>
          ) : (
            // Error state
            <View style={styles.errorWrap}>
              <AppText variant="heading" color={palette.textSecondary} style={styles.centerText}>
                Article not found.
              </AppText>
            </View>
          )}
        </View>
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: palette.bg,
  },

  // Hero
  heroContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: HERO_HEIGHT + 40, // extra to cover parallax movement
    zIndex: 0,
  },
  heroGradient: {
    flex: 1,
  },

  // Back button
  backBtn: {
    position: 'absolute',
    left: spacing(5),
    zIndex: 20,
  },
  backPressable: {},
  backPill: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
  },

  // Scroll
  scrollContent: {
    flexGrow: 1,
  },

  // Hero text (inside scroll)
  heroTextWrap: {
    height: HERO_HEIGHT,
    justifyContent: 'flex-end',
    paddingHorizontal: spacing(5),
    paddingBottom: spacing(6),
    gap: spacing(2),
  },
  heroSkeletons: {
    gap: 0,
  },
  heroCategory: {
    marginBottom: spacing(1),
  },
  heroTitle: {
    fontSize: 30,
    lineHeight: 37,
    color: palette.text,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2),
    marginTop: spacing(1),
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(1.5),
  },
  metaDot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: palette.textTertiary,
  },

  // Body panel — white card rising from bottom of hero
  bodyPanel: {
    minHeight: 400,
    backgroundColor: palette.bg,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingHorizontal: spacing(5),
    paddingTop: spacing(7),
    paddingBottom: spacing(6),
    // Overlap the hero by this amount
    marginTop: -radii.xl,
    zIndex: 10,
  },
  bodySkeletons: {
    paddingTop: spacing(2),
  },

  // Citations
  citationsWrap: {
    marginTop: spacing(10),
  },
  citationPressable: {
    marginBottom: spacing(3),
  },
  citationCard: {},
  citationRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  citationText: {
    flex: 1,
    flexDirection: 'row',
    gap: spacing(3),
    alignItems: 'flex-start',
  },
  citationLabel: {
    minWidth: 28,
    paddingTop: 2,
  },
  citationDetails: {
    flex: 1,
    gap: spacing(0.5),
  },
  citationSource: {
    fontSize: 14,
    lineHeight: 19,
  },
  citationIcon: {
    marginLeft: spacing(3),
  },

  // Error
  errorWrap: {
    paddingTop: spacing(10),
    alignItems: 'center',
  },
  centerText: {
    textAlign: 'center',
  },
});
