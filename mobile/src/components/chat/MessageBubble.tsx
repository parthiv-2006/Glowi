import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { ProductCard } from '@/components/ProductCard';
import { GlowiAvatar } from '@/components/GlowiAvatar';
import { AppText } from '@/components/ui';
import { useProductsBySlug } from '@/lib/hooks';
import type { ChatMessage } from '@/lib/types';
import { fonts, palette, radii, spacing } from '@/theme';

/** Renders **bold** spans within an assistant paragraph. */
function RichText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return (
    <AppText variant="body" style={styles.assistantText}>
      {parts.map((p, i) =>
        p.startsWith('**') && p.endsWith('**') ? (
          <AppText key={i} variant="body" style={styles.bold}>
            {p.slice(2, -2)}
          </AppText>
        ) : (
          <AppText key={i} variant="body">
            {p}
          </AppText>
        ),
      )}
    </AppText>
  );
}

function ProductRecommendations({ slugs }: { slugs: string[] }) {
  const { data: products } = useProductsBySlug(slugs);
  if (!products?.length) return null;
  // Preserve the order the model suggested.
  const ordered = slugs.map((s) => products.find((p) => p.slug === s)).filter(Boolean);
  return (
    <View style={styles.products}>
      {ordered.map((p) => (
        <ProductCard key={p!.id} product={p!} compact />
      ))}
    </View>
  );
}

export function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';

  if (isUser) {
    return (
      <Animated.View
        entering={FadeInDown.duration(260).springify().damping(18)}
        style={styles.userRow}
      >
        <LinearGradient
          colors={[palette.accentBright, palette.accent]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.userBubble}
        >
          <AppText variant="body" color={palette.textOnAccent} style={styles.userText}>
            {message.content}
          </AppText>
        </LinearGradient>
      </Animated.View>
    );
  }

  // Assistant: split into paragraphs for readable spacing.
  const paragraphs = message.content.split(/\n{2,}/).filter((p) => p.trim());
  return (
    <Animated.View
      entering={FadeInDown.duration(300).springify().damping(18)}
      style={styles.assistantRow}
    >
      <View style={styles.assistantInner}>
        <GlowiAvatar state="idle" size={24} />
        <View style={styles.assistantBubble}>
          {paragraphs.map((p, i) => (
            <RichText key={i} text={p.trim()} />
          ))}
        </View>
      </View>
      {message.product_refs.length > 0 ? (
        <ProductRecommendations slugs={message.product_refs} />
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  userRow: { alignItems: 'flex-end', marginVertical: spacing(1.5) },
  userBubble: {
    maxWidth: '84%',
    paddingVertical: spacing(3),
    paddingHorizontal: spacing(4),
    borderRadius: radii.lg,
    borderBottomRightRadius: spacing(1),
  },
  userText: { lineHeight: 21 },
  assistantRow: { alignItems: 'flex-start', marginVertical: spacing(1.5), maxWidth: '92%' },
  assistantInner: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing(2) },
  assistantBubble: {
    flexShrink: 1,
    backgroundColor: palette.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
    paddingVertical: spacing(3.5),
    paddingHorizontal: spacing(4),
    borderRadius: radii.lg,
    borderBottomLeftRadius: spacing(1),
    gap: spacing(2.5),
  },
  assistantText: { lineHeight: 23 },
  bold: { fontFamily: fonts.bodySemiBold },
  products: { gap: spacing(2.5), marginTop: spacing(2.5), alignSelf: 'stretch' },
});
