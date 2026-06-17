/**
 * Skin Weather — the compact home-screen forecast card. Surfaces today's
 * headline, the key environmental readings, and the first routine adjustment;
 * tapping opens the full /forecast screen.
 */
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppText, GlassCard, PressableScale } from '@/components/ui';
import { aqiLevel, humidityLevel, uvLevel } from '@/lib/ai/forecast';
import { FORECAST_ACTION, toneColor } from '@/lib/constants';
import type { SkinForecast } from '@/lib/types';
import { palette, spacing } from '@/theme';

function conditionIcon(condition: string): keyof typeof Ionicons.glyphMap {
  const c = condition.toLowerCase();
  if (c.includes('clear')) return 'sunny-outline';
  if (c.includes('humid')) return 'water-outline';
  if (c.includes('cold')) return 'snow-outline';
  if (c.includes('haz') || c.includes('smog')) return 'cloud-outline';
  return 'partly-sunny-outline';
}

function Stat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <View style={styles.stat}>
      <View style={styles.statTop}>
        <View style={[styles.dot, { backgroundColor: tone }]} />
        <AppText variant="caption" color={palette.textTertiary} style={styles.statLabel}>
          {label}
        </AppText>
      </View>
      <AppText variant="heading" style={styles.statValue}>
        {value}
      </AppText>
    </View>
  );
}

export function SkinWeatherCard({
  forecast,
  onPress,
  compact = false,
}: {
  forecast: SkinForecast;
  onPress: () => void;
  /** One-line glow strip (populated Home) vs the full 3-stat card (empty Home). */
  compact?: boolean;
}) {
  const env = forecast.environment;
  const uv = uvLevel(env.uv_index);
  const humidity = humidityLevel(env.humidity);
  const air = aqiLevel(env.air_quality_index);
  const lead = forecast.guidance[0];
  const action = lead ? FORECAST_ACTION[lead.kind] : null;

  // Compact strip: icon + "SKIN WEATHER · {condition}" + one-line guidance + chevron.
  if (compact) {
    return (
      <PressableScale onPress={onPress}>
        <GlassCard tier="glow" style={styles.strip}>
          <Ionicons name={conditionIcon(env.condition)} size={22} color={palette.accentBright} />
          <View style={styles.stripBody}>
            <AppText variant="overline" color={palette.accentBright} style={styles.stripOverline}>
              {`Skin Weather · ${env.condition}`}
            </AppText>
            <AppText variant="caption" color={palette.textBody} numberOfLines={1}>
              {lead?.text ?? forecast.headline}
            </AppText>
          </View>
          <Ionicons name="chevron-forward" size={16} color={palette.accentBright} />
        </GlassCard>
      </PressableScale>
    );
  }

  return (
    <PressableScale onPress={onPress}>
      <GlassCard tier="glow" style={styles.card}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Ionicons name={conditionIcon(env.condition)} size={18} color={palette.accentBright} />
            <AppText variant="overline">Skin Weather</AppText>
          </View>
          <AppText variant="caption" color={palette.textTertiary}>
            {forecast.location_label}
          </AppText>
        </View>

        <AppText variant="heading" numberOfLines={2} style={styles.headline}>
          {forecast.headline}
        </AppText>

        <View style={styles.stats}>
          <Stat label="UV" value={uv.label} tone={toneColor(uv.tone)} />
          <Stat
            label="Humidity"
            value={`${Math.round(env.humidity)}%`}
            tone={toneColor(humidity.tone)}
          />
          <Stat label="Air" value={air.label} tone={toneColor(air.tone)} />
        </View>

        {lead && action ? (
          <View style={styles.leadRow}>
            <Ionicons name={action.icon} size={16} color={action.color} />
            <AppText
              variant="caption"
              color={palette.textSecondary}
              numberOfLines={1}
              style={styles.leadText}
            >
              {lead.text}
            </AppText>
          </View>
        ) : null}

        <View style={styles.footer}>
          <AppText variant="caption" color={palette.accentBright}>
            See today’s plan
          </AppText>
          <Ionicons name="chevron-forward" size={14} color={palette.accentBright} />
        </View>
      </GlassCard>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing(3) },
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3.5),
    paddingVertical: spacing(4),
  },
  stripBody: { flex: 1, gap: spacing(0.5) },
  stripOverline: { letterSpacing: 1.5 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing(2) },
  headline: { fontSize: 17, lineHeight: 23 },
  stats: { flexDirection: 'row', gap: spacing(3) },
  stat: { flex: 1, gap: spacing(1) },
  statTop: { flexDirection: 'row', alignItems: 'center', gap: spacing(1.5) },
  statLabel: { letterSpacing: 0.4 },
  statValue: { fontSize: 15 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  leadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2),
    paddingTop: spacing(2),
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
  },
  leadText: { flex: 1, lineHeight: 17 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing(1),
  },
});
