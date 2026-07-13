/**
 * Add to Shelf — photograph a product, let the AI read the label, then confirm
 * the editable details before saving. Manual entry is always available.
 */
import { useState } from 'react';
import { Image, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn } from 'react-native-reanimated';

import { AppText, GlassCard, GlowButton, PressableScale, TextField } from '@/components/ui';
import { getAIProvider } from '@/lib/ai';
import * as api from '@/lib/api';
import { useAddShelfItem } from '@/lib/hooks';
import { CATEGORY_LABEL } from '@/lib/constants';
import { haptics } from '@/lib/haptics';
import { effectiveShelfLifeMonths } from '@/lib/shelf';
import type { ProductCategory } from '@/lib/types';
import { useAuth } from '@/stores/auth';
import { palette, radii, spacing } from '@/theme';

const CATEGORIES = Object.keys(CATEGORY_LABEL) as ProductCategory[];
const AMOUNTS = [25, 50, 75, 100];

async function uriToBase64(uri: string): Promise<string> {
  const blob = await fetch(uri).then((r) => r.blob());
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () => reject(new Error('Could not read the image'));
    reader.readAsDataURL(blob);
  });
}

export default function AddShelfItem() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const userId = useAuth((s) => s.session?.user.id);
  const addItem = useAddShelfItem();

  const [uri, setUri] = useState<string | null>(null);
  const [identifying, setIdentifying] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state.
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [category, setCategory] = useState<ProductCategory | null>(null);
  const [opened, setOpened] = useState(true);
  const [shelfLife, setShelfLife] = useState('');
  const [sizeLabel, setSizeLabel] = useState('');
  const [price, setPrice] = useState('');
  const [amount, setAmount] = useState(100);
  const [matchedSlug, setMatchedSlug] = useState<string | null>(null);
  const [keyIngredients, setKeyIngredients] = useState<string[]>([]);

  async function pick(source: 'camera' | 'library') {
    haptics.tap();
    setError(null);
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.6 };
    const perm =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync(opts)
        : await ImagePicker.launchImageLibraryAsync(opts);
    if (result.canceled || !result.assets[0]) return;
    const picked = result.assets[0].uri;
    setUri(picked);
    void identify(picked);
  }

  async function identify(imageUri: string) {
    setIdentifying(true);
    setError(null);
    try {
      const base64 = await uriToBase64(imageUri);
      const id = await getAIProvider().identifyProduct({ imageBase64: base64 });
      if (id.not_product) {
        setError(id.reject_reason ?? "That doesn't look like a product. Try a photo of the label.");
        setUri(null);
        return;
      }
      setName(id.name);
      setBrand(id.brand ?? '');
      setCategory(id.category);
      setShelfLife(id.shelf_life_months ? String(id.shelf_life_months) : '');
      setMatchedSlug(id.matched_slug);
      setKeyIngredients(id.key_ingredients ?? []);
      setRevealed(true);
      haptics.success();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read that product.');
      setUri(null);
    } finally {
      setIdentifying(false);
    }
  }

  async function save() {
    if (!name.trim() || !userId) return;
    setSaving(true);
    setError(null);
    try {
      const matched = matchedSlug ? (await api.getProductsBySlug([matchedSlug]))[0] : undefined;
      const productId = matched?.id ?? null;
      const parsedShelfLife = shelfLife ? Math.round(Number(shelfLife)) : null;
      const parsedPrice = price ? Number(price) : (matched?.price_usd ?? null);
      const item = await addItem.mutateAsync({
        name: name.trim(),
        brand: brand.trim() || null,
        category,
        key_ingredients: keyIngredients,
        product_id: productId,
        opened_at: opened ? new Date().toISOString().slice(0, 10) : null,
        shelf_life_months: parsedShelfLife && parsedShelfLife > 0 ? parsedShelfLife : null,
        size_label: sizeLabel.trim() || null,
        amount_remaining: amount,
        price_usd:
          parsedPrice != null && Number.isFinite(parsedPrice) && parsedPrice >= 0
            ? parsedPrice
            : null,
      });
      if (uri) {
        try {
          const path = await api.uploadShelfImage(userId, item.id, uri);
          await api.updateShelfItem(item.id, { image_path: path });
        } catch {
          // Photo is optional — the item is already saved.
        }
      }
      haptics.success();
      router.replace('/shelf');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save. Please try again.');
      haptics.error();
    } finally {
      setSaving(false);
    }
  }

  const paoPreview =
    category || shelfLife
      ? effectiveShelfLifeMonths({
          shelf_life_months: shelfLife ? Number(shelfLife) : null,
          category,
        })
      : null;

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing(2), paddingBottom: insets.bottom + spacing(20) },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.headerRow}>
          <PressableScale onPress={() => router.back()} hitSlop={12} accessibilityLabel="Close">
            <Ionicons name="close" size={26} color={palette.text} />
          </PressableScale>
          <AppText variant="overline">Add to shelf</AppText>
          <View style={{ width: 26 }} />
        </View>

        {/* Capture */}
        {!revealed ? (
          <Animated.View entering={FadeIn.duration(300)}>
            <AppText variant="title" style={styles.title}>
              What are we adding?
            </AppText>
            <AppText variant="subheading" style={styles.sub}>
              Snap the front of the product — Glowi reads the label for you.
            </AppText>

            <View style={[styles.frame, uri ? null : styles.frameEmpty]}>
              {uri ? (
                <Image source={{ uri }} style={styles.preview} resizeMode="cover" />
              ) : (
                <View style={styles.captureButtons}>
                  <PressableScale onPress={() => pick('camera')} style={styles.captureBtn}>
                    <Ionicons name="camera" size={20} color={palette.textOnAccent} />
                    <AppText variant="subheading" color={palette.textOnAccent}>
                      Take photo
                    </AppText>
                  </PressableScale>
                  <PressableScale onPress={() => pick('library')} style={styles.uploadBtn}>
                    <Ionicons name="images-outline" size={20} color={palette.accentBright} />
                    <AppText variant="subheading" color={palette.accentBright}>
                      Upload
                    </AppText>
                  </PressableScale>
                </View>
              )}
              {identifying ? (
                <View style={styles.readingOverlay}>
                  <View style={styles.readingDot} />
                  <AppText variant="heading" color={palette.accentBright}>
                    Reading the label…
                  </AppText>
                </View>
              ) : null}
            </View>

            {error ? (
              <View style={styles.errorRow}>
                <Ionicons name="alert-circle" size={16} color={palette.warning} />
                <AppText variant="caption" color={palette.warning} style={styles.errorText}>
                  {error}
                </AppText>
              </View>
            ) : null}

            <PressableScale onPress={() => setRevealed(true)} style={styles.manualLink}>
              <AppText variant="subheading" color={palette.textSecondary}>
                or enter it manually
              </AppText>
            </PressableScale>
          </Animated.View>
        ) : (
          <Animated.View entering={FadeIn.duration(300)} style={styles.form}>
            {uri ? (
              <View style={styles.thumbRow}>
                <Image source={{ uri }} style={styles.thumb} resizeMode="cover" />
                <AppText variant="caption" color={palette.textSecondary} style={styles.thumbHint}>
                  Read from your photo — edit anything that looks off.
                </AppText>
              </View>
            ) : null}

            <TextField
              label="Product name"
              value={name}
              onChangeText={setName}
              placeholder="e.g. Moisturizing Cream"
            />
            <TextField
              label="Brand"
              value={brand}
              onChangeText={setBrand}
              placeholder="e.g. CeraVe"
            />

            <View>
              <AppText variant="overline" style={styles.fieldLabel}>
                Category
              </AppText>
              <View style={styles.chipWrap}>
                {CATEGORIES.map((c) => {
                  const active = category === c;
                  return (
                    <PressableScale
                      key={c}
                      onPress={() => {
                        haptics.tap();
                        setCategory(active ? null : c);
                      }}
                      style={[styles.chip, active && styles.chipActive]}
                      haptic={false}
                      accessibilityState={{ selected: active }}
                    >
                      <AppText
                        variant="caption"
                        color={active ? palette.accentBright : palette.textSecondary}
                      >
                        {CATEGORY_LABEL[c]}
                      </AppText>
                    </PressableScale>
                  );
                })}
              </View>
            </View>

            <PressableScale
              onPress={() => {
                haptics.tap();
                setOpened((v) => !v);
              }}
              haptic={false}
              accessibilityRole="switch"
              accessibilityState={{ checked: opened }}
            >
              <GlassCard style={styles.toggleRow}>
                <View>
                  <AppText variant="heading" style={styles.toggleTitle}>
                    Already opened
                  </AppText>
                  <AppText variant="caption" color={palette.textSecondary}>
                    Starts the expiry clock from today.
                  </AppText>
                </View>
                <View style={[styles.switch, opened && styles.switchOn]}>
                  <View style={[styles.knob, opened && styles.knobOn]} />
                </View>
              </GlassCard>
            </PressableScale>

            <View style={styles.twoCol}>
              <View style={styles.col}>
                <TextField
                  label="Shelf life (months)"
                  value={shelfLife}
                  onChangeText={setShelfLife}
                  placeholder={
                    category
                      ? String(effectiveShelfLifeMonths({ shelf_life_months: null, category }))
                      : '12'
                  }
                  keyboardType="number-pad"
                />
              </View>
              <View style={styles.col}>
                <TextField
                  label="Size"
                  value={sizeLabel}
                  onChangeText={setSizeLabel}
                  placeholder="e.g. 50ml"
                />
              </View>
            </View>

            <TextField
              label="Price (USD, optional)"
              value={price}
              onChangeText={setPrice}
              placeholder="e.g. 18.99"
              keyboardType="decimal-pad"
            />

            {opened && paoPreview ? (
              <AppText variant="caption" color={palette.textTertiary}>
                Glowi will flag this ~{paoPreview} months after opening, and warn you 2 weeks
                before.
              </AppText>
            ) : null}

            <View>
              <AppText variant="overline" style={styles.fieldLabel}>
                How much is left?
              </AppText>
              <View style={styles.amountRow}>
                {AMOUNTS.map((a) => {
                  const active = amount === a;
                  return (
                    <PressableScale
                      key={a}
                      onPress={() => {
                        haptics.tap();
                        setAmount(a);
                      }}
                      style={[styles.amountBtn, active && styles.amountActive]}
                      haptic={false}
                      accessibilityState={{ selected: active }}
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
            </View>

            {error ? (
              <View style={styles.errorRow}>
                <Ionicons name="alert-circle" size={16} color={palette.danger} />
                <AppText variant="caption" color={palette.danger} style={styles.errorText}>
                  {error}
                </AppText>
              </View>
            ) : null}
          </Animated.View>
        )}
      </ScrollView>

      {revealed ? (
        <View style={[styles.footer, { paddingBottom: insets.bottom + spacing(3) }]}>
          <GlowButton
            label="Add to shelf"
            onPress={save}
            loading={saving}
            disabled={!name.trim()}
          />
        </View>
      ) : null}
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
  sub: { marginTop: spacing(2), marginBottom: spacing(5) },
  frame: {
    aspectRatio: 4 / 3,
    borderRadius: radii.xl,
    overflow: 'hidden',
    backgroundColor: palette.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  frameEmpty: {
    borderWidth: 1.5,
    borderColor: 'rgba(188,94,56,0.25)',
    borderStyle: 'dashed',
  },
  captureButtons: { flexDirection: 'row', gap: spacing(3) },
  captureBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2),
    backgroundColor: palette.accent,
    paddingVertical: spacing(3),
    paddingHorizontal: spacing(4),
    borderRadius: radii.full,
  },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2),
    backgroundColor: palette.surface,
    paddingVertical: spacing(3),
    paddingHorizontal: spacing(4),
    borderRadius: radii.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.borderStrong,
  },
  preview: { width: '100%', height: '100%' },
  readingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(7,9,11,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing(2.5),
  },
  readingDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: palette.accentBright },
  manualLink: { alignItems: 'center', marginTop: spacing(5) },
  form: { gap: spacing(4) },
  thumbRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(3) },
  thumb: { width: 56, height: 56, borderRadius: radii.md },
  thumbHint: { flex: 1, lineHeight: 17 },
  fieldLabel: { marginBottom: spacing(2), color: palette.textSecondary },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(2) },
  chip: {
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2),
    borderRadius: radii.full,
    backgroundColor: palette.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
  },
  chipActive: { backgroundColor: palette.accentDim, borderColor: 'rgba(188,94,56,0.5)' },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggleTitle: { fontSize: 15 },
  switch: {
    width: 46,
    height: 28,
    borderRadius: radii.full,
    backgroundColor: palette.surfaceStrong,
    padding: 3,
    justifyContent: 'center',
  },
  switchOn: { backgroundColor: palette.accent },
  knob: { width: 22, height: 22, borderRadius: 11, backgroundColor: palette.text },
  knobOn: { alignSelf: 'flex-end', backgroundColor: palette.textOnAccent },
  twoCol: { flexDirection: 'row', gap: spacing(3) },
  col: { flex: 1 },
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
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(2), marginTop: spacing(3) },
  errorText: { flex: 1, lineHeight: 17 },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing(5),
    paddingTop: spacing(3),
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
    backgroundColor: palette.bg,
  },
});
