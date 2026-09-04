/**
 * "What helped" — past events that measurably improved one concern, from the
 * existing scan-to-trend correlation engine (lib/concernHistory.ts), shown
 * on that concern's detail screen. Renders nothing when there's nothing to
 * show; the caller decides whether to render a wrapping section at all.
 */
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppText, GlassCard } from '@/components/ui';
import type { ConcernHelp } from '@/lib/concernHistory';
import { palette, spacing } from '@/theme';

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return iso;
  }
}

export function WhatHelpedCard({ helps }: { helps: ConcernHelp[] }) {
  if (!helps.length) return null;

  return (
    <GlassCard style={styles.card}>
      <View style={styles.header}>
        <Ionicons name="trending-down" size={16} color={palette.success} />
        <AppText variant="overline">What helped</AppText>
      </View>
      {helps.map((h, i) => (
        <View key={`${h.label}-${h.date}`} style={[styles.row, i > 0 && styles.rowBorder]}>
          <AppText variant="subheading" color={palette.text} style={styles.label} numberOfLines={2}>
            {h.label}
          </AppText>
          <View style={styles.meta}>
            <AppText variant="caption" color={palette.success}>
              {Math.abs(h.delta)} pts
            </AppText>
            <AppText variant="caption" color={palette.textTertiary}>
              {formatDate(h.date)}
            </AppText>
          </View>
        </View>
      ))}
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing(3) },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing(2) },
  row: { gap: spacing(1), paddingTop: spacing(2) },
  rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.border },
  label: { fontSize: 14, lineHeight: 19 },
  meta: { flexDirection: 'row', gap: spacing(3) },
});
