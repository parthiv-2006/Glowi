/**
 * In-store compare — photograph two products on the shelf in front of you and
 * get a verdict grounded in your latest scan, your cabinet, and your reaction
 * log. Stateless: nothing is saved unless you add the winner to your shelf.
 */
import { useState } from 'react';
import { Image, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn } from 'react-native-reanimated';

import { AppText, GlassCard, GlowButton, PressableScale } from '@/components/ui';
import { getAIProvider } from '@/lib/ai';
import { CATEGORY_LABEL } from '@/lib/constants';
import { haptics } from '@/lib/haptics';
import type { ProductComparison } from '@/lib/types';
import { palette, radii, spacing } from '@/theme';

type Slot = 'a' | 'b';

async function uriToBase64(uri: string): Promise<string> {
  const blob = await fetch(uri).then((r) => r.blob());
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () => reject(new Error('Could not read the image'));
    reader.readAsDataURL(blob);
  });
}

function SlotFrame({
  label,
  uri,
  winner,
  onPick,
}: {
  label: string;
  uri: string | null;
  winner: boolean;
  onPick: () => void;
}) {
  return (
    <View style={styles.slotCol}>
      <AppText variant="overline" color={winner ? palette.accentBright : palette.textSecondary}>
        {label}
      </AppText>
      <PressableScale
        onPress={onPick}
        style={[styles.slot, winner && styles.slotWinner]}
        haptic={false}
      >
        {uri ? (
          <Image source={{ uri }} style={styles.slotImage} resizeMode="cover" />
        ) : (
          <View style={styles.slotEmpty}>
            <Ionicons name="camera-outline" size={22} color={palette.accentBright} />
            <AppText variant="caption" color={palette.textSecondary}>
              Tap to snap
            </AppText>
          </View>
        )}
        {winner ? (
          <View style={styles.winnerBadge}>
            <Ionicons name="checkmark" size={14} color={palette.textOnAccent} />
          </View>
        ) : null}
      </PressableScale>
    </View>
  );
}

export default function CompareScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [uris, setUris] = useState<Record<Slot, string | null>>({ a: null, b: null });
  const [comparing, setComparing] = useState(false);
  const [result, setResult] = useState<ProductComparison | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function pick(slot: Slot) {
    haptics.tap();
    setError(null);
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.6 };
    // Camera when available; the library is the fallback (and the web path).
    const res = perm.granted
      ? await ImagePicker.launchCameraAsync(opts).catch(() =>
          ImagePicker.launchImageLibraryAsync(opts),
        )
      : await ImagePicker.launchImageLibraryAsync(opts);
    if (res.canceled || !res.assets[0]) return;
    setResult(null);
    setUris((prev) => ({ ...prev, [slot]: res.assets[0].uri }));
  }

  async function compare() {
    if (!uris.a || !uris.b) return;
    haptics.press();
    setComparing(true);
    setError(null);
    try {
      const [a, b] = await Promise.all([uriToBase64(uris.a), uriToBase64(uris.b)]);
      const comparison = await getAIProvider().compareProducts({
        imageABase64: a,
        imageBBase64: b,
      });
      setResult(comparison);
      haptics.success();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not compare those products.');
      haptics.error();
    } finally {
      setComparing(false);
    }
  }

  const verdictLabel =
    result &&
    {
      a: `Buy ${[result.product_a.brand, result.product_a.name].filter(Boolean).join(' ')}`,
      b: `Buy ${[result.product_b.brand, result.product_b.name].filter(Boolean).join(' ')}`,
      either: 'Either works — pick by price',
      neither: 'Skip both',
    }[result.verdict];

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing(2), paddingBottom: insets.bottom + spacing(10) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <PressableScale onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="close" size={26} color={palette.text} />
          </PressableScale>
          <AppText variant="overline">In-store compare</AppText>
          <View style={{ width: 26 }} />
        </View>

        <AppText variant="title" style={styles.title}>
          Which one should you buy?
        </AppText>
        <AppText variant="subheading" style={styles.sub}>
          Snap both labels. Glowi checks them against your last scan, your shelf, and your reaction
          log.
        </AppText>

        <View style={styles.slotRow}>
          <SlotFrame
            label="Product A"
            uri={uris.a}
            winner={result?.verdict === 'a'}
            onPick={() => void pick('a')}
          />
          <View style={styles.vsBubble}>
            <AppText variant="caption" color={palette.textSecondary}>
              vs
            </AppText>
          </View>
          <SlotFrame
            label="Product B"
            uri={uris.b}
            winner={result?.verdict === 'b'}
            onPick={() => void pick('b')}
          />
        </View>

        {!result ? (
          <GlowButton
            label={comparing ? 'Reading both labels…' : 'Compare'}
            onPress={compare}
            loading={comparing}
            disabled={!uris.a || !uris.b}
            style={styles.compareBtn}
          />
        ) : (
          <Animated.View entering={FadeIn.duration(320)} style={styles.resultWrap}>
            <GlassCard tier="glow" style={styles.verdictCard}>
              <AppText variant="overline" color={palette.textSecondary}>
                The verdict
              </AppText>
              <AppText variant="heading" style={styles.verdictText}>
                {verdictLabel}
              </AppText>
              <AppText variant="caption" color={palette.textSecondary} style={styles.rationale}>
                {result.rationale}
              </AppText>
            </GlassCard>

            {result.considerations.length ? (
              <GlassCard style={styles.considerations}>
                {result.considerations.map((c) => (
                  <View key={c} style={styles.considerationRow}>
                    <Ionicons name="information-circle-outline" size={15} color={palette.warning} />
                    <AppText
                      variant="caption"
                      color={palette.textSecondary}
                      style={styles.considerationText}
                    >
                      {c}
                    </AppText>
                  </View>
                ))}
              </GlassCard>
            ) : null}

            <View style={styles.identRow}>
              {(
                [
                  ['A', result.product_a],
                  ['B', result.product_b],
                ] as const
              ).map(([slot, p]) => (
                <GlassCard key={slot} style={styles.identCard}>
                  <AppText variant="overline" color={palette.textSecondary}>
                    {slot} · {p.category ? (CATEGORY_LABEL[p.category] ?? p.category) : 'Unknown'}
                  </AppText>
                  <AppText variant="heading" numberOfLines={2} style={styles.identName}>
                    {[p.brand, p.name].filter(Boolean).join(' ')}
                  </AppText>
                  {p.key_ingredients.length ? (
                    <AppText variant="caption" color={palette.textTertiary} numberOfLines={2}>
                      {p.key_ingredients.join(' · ')}
                    </AppText>
                  ) : null}
                </GlassCard>
              ))}
            </View>

            <GlowButton
              label="Compare two more"
              variant="ghost"
              onPress={() => {
                haptics.tap();
                setUris({ a: null, b: null });
                setResult(null);
              }}
            />
          </Animated.View>
        )}

        {error ? (
          <View style={styles.errorRow}>
            <Ionicons name="alert-circle" size={16} color={palette.danger} />
            <AppText variant="caption" color={palette.danger} style={styles.errorText}>
              {error}
            </AppText>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.bg },
  content: { paddingHorizontal: spacing(5) },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing(5),
  },
  title: { fontSize: 26 },
  sub: { marginTop: spacing(2), marginBottom: spacing(6) },
  slotRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(3) },
  slotCol: { flex: 1, gap: spacing(2) },
  slot: {
    aspectRatio: 3 / 4,
    borderRadius: radii.lg,
    overflow: 'hidden',
    backgroundColor: palette.bgElevated,
    borderWidth: 1.5,
    borderColor: 'rgba(188,94,56,0.25)',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotWinner: { borderStyle: 'solid', borderColor: palette.accent },
  slotImage: { width: '100%', height: '100%' },
  slotEmpty: { alignItems: 'center', gap: spacing(2) },
  winnerBadge: {
    position: 'absolute',
    top: spacing(2),
    right: spacing(2),
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vsBubble: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: palette.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing(5),
  },
  compareBtn: { marginTop: spacing(6) },
  resultWrap: { marginTop: spacing(6), gap: spacing(3) },
  verdictCard: { gap: spacing(2) },
  verdictText: { fontSize: 19, lineHeight: 25 },
  rationale: { lineHeight: 18 },
  considerations: { gap: spacing(2.5) },
  considerationRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing(2) },
  considerationText: { flex: 1, lineHeight: 17 },
  identRow: { flexDirection: 'row', gap: spacing(3) },
  identCard: { flex: 1, gap: spacing(1.5) },
  identName: { fontSize: 14, lineHeight: 19 },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(2), marginTop: spacing(4) },
  errorText: { flex: 1, lineHeight: 17 },
});
