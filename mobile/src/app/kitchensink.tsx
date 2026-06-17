import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AuroraBackground } from '@/components/AuroraBackground';
import { GlowiAvatar } from '@/components/GlowiAvatar';
import { AppText } from '@/components/ui/AppText';
import { GlassCard } from '@/components/ui/GlassCard';
import { GlowButton } from '@/components/ui/GlowButton';
import { GradientText } from '@/components/ui/effects';
import { PressableScale } from '@/components/ui/PressableScale';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { Screen } from '@/components/ui/Screen';
import { palette, scoreColor, severityColor, spacing } from '@/theme';

/**
 * Throwaway Phase-1 gate surface (BUILD_ORDER): every §0 effect and rebuilt
 * primitive on one screen, so each can be screenshot-compared to the reference.
 * Not a product route — delete before ship.
 */
export default function KitchenSink() {
  const [ringKey, setRingKey] = useState(0);

  return (
    <View style={styles.root}>
      <AuroraBackground />
      <Screen bottomInset={spacing(6)}>
        <AppText variant="overline">Phase 1 · primitives</AppText>
        <View style={styles.titleRow}>
          <AppText variant="display">Built </AppText>
          <GradientText style={styles.displayInline}>scientifically.</GradientText>
        </View>
        <AppText variant="body" style={styles.gap}>
          This body copy is textBody — readable, not muddy grey. The line above is real MaskedView
          gradient text, not a tinted fill.
        </AppText>

        <Label text="GlassCard tiers" />
        <GlassCard tier="sunken" style={styles.card}>
          <AppText variant="heading">Sunken</AppText>
          <AppText variant="body">Flat #0B0F0E well — inputs, search, empty interiors.</AppText>
        </GlassCard>
        <GlassCard tier="raised" style={styles.card}>
          <AppText variant="heading">Raised (default)</AppText>
          <AppText variant="body">
            Top-down gradient + the inner highlight line that reads as lit glass.
          </AppText>
        </GlassCard>
        <GlassCard tier="raised" strong style={styles.card}>
          <AppText variant="heading">Raised · strong</AppText>
          <AppText variant="body">The latest-scan-strip variant.</AppText>
        </GlassCard>
        <GlassCard tier="glow" style={styles.card}>
          <AppText variant="heading">Glow (one per screen)</AppText>
          <AppText variant="body">Jade gradient, jade border, negative-spread halo.</AppText>
        </GlassCard>
        <GlassCard tier="glow" selected style={styles.card}>
          <AppText variant="heading" color={palette.accentBright}>
            Glow · selected row
          </AppText>
          <AppText variant="body">Brighter .4 border for the active selection.</AppText>
        </GlassCard>

        <Label text="GlowButton" />
        <GlowButton label="Primary CTA" onPress={() => {}} style={styles.btn} />
        <GlowButton label="With sheen sweep" sheen onPress={() => {}} style={styles.btn} />
        <GlowButton label="Ghost" variant="ghost" onPress={() => {}} style={styles.btn} />
        <GlowButton label="Disabled" disabled onPress={() => {}} style={styles.btn} />

        <Label text="ProgressRing (fills + counts up)" />
        <PressableScale onPress={() => setRingKey((k) => k + 1)}>
          <GlassCard tier="raised" style={[styles.card, styles.ringRow]}>
            <ProgressRing key={`a${ringKey}`} value={82} size={120} color={scoreColor(82)} />
            <ProgressRing
              key={`b${ringKey}`}
              value={52}
              size={88}
              strokeWidth={7}
              color={severityColor(52)}
            />
            <AppText variant="caption" style={styles.replay}>
              tap to replay
            </AppText>
          </GlassCard>
        </PressableScale>

        <Label text="GlowiAvatar — 4 states" />
        <GlassCard tier="raised" style={[styles.card, styles.avatarRow]}>
          {(['idle', 'thinking', 'scanning', 'celebrating'] as const).map((s) => (
            <View key={s} style={styles.avatarCell}>
              <GlowiAvatar state={s} size={64} />
              <AppText variant="caption">{s}</AppText>
            </View>
          ))}
        </GlassCard>
      </Screen>
    </View>
  );
}

function Label({ text }: { text: string }) {
  return (
    <AppText variant="overline" style={styles.label}>
      {text}
    </AppText>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.bg },
  titleRow: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap' },
  displayInline: { fontSize: 34, lineHeight: 40 },
  gap: { marginTop: spacing(2) },
  label: { marginTop: spacing(7), marginBottom: spacing(2) },
  card: { marginBottom: spacing(3), gap: spacing(1) },
  btn: { marginBottom: spacing(3) },
  ringRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  replay: { position: 'absolute', bottom: 6, right: 12 },
  avatarRow: { flexDirection: 'row', justifyContent: 'space-between' },
  avatarCell: { alignItems: 'center', gap: spacing(2) },
});
