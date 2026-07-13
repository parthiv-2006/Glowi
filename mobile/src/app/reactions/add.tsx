/**
 * Log a reaction — pick the product (from the Shelf or free text), the
 * symptoms, severity, and when it happened. Saving also writes the 'gotcha'
 * memory that makes the constraint durable across every AI surface.
 */
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, GlassCard, GlowButton, PressableScale, TextField } from '@/components/ui';
import { REACTION_SEVERITY } from '@/lib/constants';
import { haptics } from '@/lib/haptics';
import { useAddReactionLog, useShelfItems } from '@/lib/hooks';
import { REACTION_SYMPTOMS } from '@/lib/reactions';
import type { ReactionSeverity, ShelfItem } from '@/lib/types';
import { palette, radii, spacing } from '@/theme';

const SEVERITIES = Object.keys(REACTION_SEVERITY) as ReactionSeverity[];

/** Quick relative-date options — reactions are logged shortly after they happen. */
const WHEN_OPTIONS = [
  { label: 'Today', daysAgo: 0 },
  { label: 'Yesterday', daysAgo: 1 },
  { label: 'A few days ago', daysAgo: 3 },
  { label: 'A week ago', daysAgo: 7 },
];

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
}

export default function AddReaction() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data: shelfItems } = useShelfItems();
  const addReaction = useAddReactionLog();

  const [selectedItem, setSelectedItem] = useState<ShelfItem | null>(null);
  const [productName, setProductName] = useState('');
  const [brand, setBrand] = useState('');
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [severity, setSeverity] = useState<ReactionSeverity>('moderate');
  const [daysAgo, setDaysAgo] = useState(0);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const activeShelf = (shelfItems ?? []).filter((i) => i.status === 'active');
  const effectiveName = selectedItem?.name ?? productName;

  function pickShelfItem(item: ShelfItem) {
    haptics.tap();
    if (selectedItem?.id === item.id) {
      setSelectedItem(null);
      return;
    }
    setSelectedItem(item);
    setProductName('');
    setBrand('');
  }

  function toggleSymptom(s: string) {
    haptics.tap();
    setSymptoms((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  }

  async function save() {
    if (!effectiveName.trim()) return;
    setError(null);
    try {
      await addReaction.mutateAsync({
        shelf_item_id: selectedItem?.id ?? null,
        product_name: selectedItem?.name ?? productName.trim(),
        brand: selectedItem?.brand ?? (brand.trim() || null),
        key_ingredients: selectedItem?.key_ingredients ?? [],
        reacted_on: isoDaysAgo(daysAgo),
        symptoms,
        severity,
        notes: notes.trim() || null,
      });
      haptics.success();
      router.replace('/reactions');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save. Please try again.');
      haptics.error();
    }
  }

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
          <AppText variant="overline">Log a reaction</AppText>
          <View style={{ width: 26 }} />
        </View>

        <AppText variant="title" style={styles.title}>
          What reacted?
        </AppText>
        <AppText variant="subheading" style={styles.sub}>
          Your coach will never recommend it again, and will watch for similar formulations.
        </AppText>

        {activeShelf.length ? (
          <View>
            <AppText variant="overline" style={styles.fieldLabel}>
              From your shelf
            </AppText>
            <View style={styles.chipWrap}>
              {activeShelf.map((item) => {
                const active = selectedItem?.id === item.id;
                return (
                  <PressableScale
                    key={item.id}
                    onPress={() => pickShelfItem(item)}
                    style={[styles.chip, active && styles.chipActive]}
                    haptic={false}
                    accessibilityState={{ selected: active }}
                  >
                    <AppText
                      variant="caption"
                      color={active ? palette.accentBright : palette.textSecondary}
                    >
                      {[item.brand, item.name].filter(Boolean).join(' ')}
                    </AppText>
                  </PressableScale>
                );
              })}
            </View>
          </View>
        ) : null}

        {!selectedItem ? (
          <>
            <TextField
              label={activeShelf.length ? 'Or type the product' : 'Product name'}
              value={productName}
              onChangeText={setProductName}
              placeholder="e.g. Resurfacing Retinol Serum"
            />
            <TextField
              label="Brand"
              value={brand}
              onChangeText={setBrand}
              placeholder="e.g. CeraVe"
            />
          </>
        ) : (
          <GlassCard style={styles.selectedCard}>
            <Ionicons name="checkmark-circle" size={18} color={palette.success} />
            <AppText variant="caption" color={palette.textSecondary} style={styles.selectedText}>
              {selectedItem.key_ingredients.length
                ? `Logging with its ingredients: ${selectedItem.key_ingredients.join(', ')}.`
                : 'Logging this shelf product.'}
            </AppText>
          </GlassCard>
        )}

        <View>
          <AppText variant="overline" style={styles.fieldLabel}>
            Symptoms
          </AppText>
          <View style={styles.chipWrap}>
            {REACTION_SYMPTOMS.map((s) => {
              const active = symptoms.includes(s);
              return (
                <PressableScale
                  key={s}
                  onPress={() => toggleSymptom(s)}
                  style={[styles.chip, active && styles.chipActive]}
                  haptic={false}
                  accessibilityState={{ selected: active }}
                >
                  <AppText
                    variant="caption"
                    color={active ? palette.accentBright : palette.textSecondary}
                  >
                    {s}
                  </AppText>
                </PressableScale>
              );
            })}
          </View>
        </View>

        <View>
          <AppText variant="overline" style={styles.fieldLabel}>
            How bad was it?
          </AppText>
          <View style={styles.segmentRow}>
            {SEVERITIES.map((s) => {
              const active = severity === s;
              return (
                <PressableScale
                  key={s}
                  onPress={() => {
                    haptics.tap();
                    setSeverity(s);
                  }}
                  style={[styles.segment, active && styles.segmentActive]}
                  haptic={false}
                  accessibilityState={{ selected: active }}
                >
                  <AppText
                    variant="subheading"
                    color={active ? palette.textOnAccent : palette.textSecondary}
                  >
                    {REACTION_SEVERITY[s].label}
                  </AppText>
                </PressableScale>
              );
            })}
          </View>
        </View>

        <View>
          <AppText variant="overline" style={styles.fieldLabel}>
            When did it happen?
          </AppText>
          <View style={styles.chipWrap}>
            {WHEN_OPTIONS.map((w) => {
              const active = daysAgo === w.daysAgo;
              return (
                <PressableScale
                  key={w.label}
                  onPress={() => {
                    haptics.tap();
                    setDaysAgo(w.daysAgo);
                  }}
                  style={[styles.chip, active && styles.chipActive]}
                  haptic={false}
                  accessibilityState={{ selected: active }}
                >
                  <AppText
                    variant="caption"
                    color={active ? palette.accentBright : palette.textSecondary}
                  >
                    {w.label}
                  </AppText>
                </PressableScale>
              );
            })}
          </View>
        </View>

        <TextField
          label="Notes (optional)"
          value={notes}
          onChangeText={setNotes}
          placeholder="e.g. Only reacted when layered with vitamin C"
        />

        {error ? (
          <View style={styles.errorRow}>
            <Ionicons name="alert-circle" size={16} color={palette.danger} />
            <AppText variant="caption" color={palette.danger} style={styles.errorText}>
              {error}
            </AppText>
          </View>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing(3) }]}>
        <GlowButton
          label="Save to reaction log"
          onPress={save}
          loading={addReaction.isPending}
          disabled={!effectiveName.trim()}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.bg },
  content: { paddingHorizontal: spacing(5), gap: spacing(4) },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing(1),
  },
  title: { fontSize: 26 },
  sub: { marginBottom: spacing(1) },
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
  selectedCard: { flexDirection: 'row', alignItems: 'center', gap: spacing(2.5) },
  selectedText: { flex: 1, lineHeight: 17 },
  segmentRow: { flexDirection: 'row', gap: spacing(2) },
  segment: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing(3),
    borderRadius: radii.md,
    backgroundColor: palette.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
  },
  segmentActive: { backgroundColor: palette.accent, borderColor: palette.accent },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(2) },
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
