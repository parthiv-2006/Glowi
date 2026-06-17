/**
 * Skin Weather — the full daily forecast. Shows the environment that drives
 * today's advice and the personalized routine adjustments derived from it.
 */
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { format, parseISO } from 'date-fns';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import {
  AppText,
  EmptyState,
  GlassCard,
  GlowButton,
  PressableScale,
  Screen,
  SectionHeader,
  Skeleton,
  Stagger,
} from '@/components/ui';
import {
  aqiLevel,
  humidityLevel,
  pollenLevel,
  swingLevel,
  uvLevel,
  type EnvLevel,
} from '@/lib/ai/forecast';
import { DISCLAIMER, FORECAST_ACTION, toneColor } from '@/lib/constants';
import { useSkinForecast } from '@/lib/hooks';
import { haptics } from '@/lib/haptics';
import type { ForecastGuidance } from '@/lib/types';
import { palette, radii, spacing } from '@/theme';

export default function ForecastScreen() {
  const router = useRouter();
  const { data: forecast, isLoading } = useSkinForecast();

  if (isLoading) {
    return (
      <Screen bottomInset={spacing(8)}>
        <View style={styles.backRow}>
          <Skeleton width={36} height={36} radius={18} />
        </View>
        <Skeleton width="70%" height={28} />
        <View style={{ height: spacing(4) }} />
        <Skeleton width="100%" height={120} />
        <View style={{ height: spacing(4) }} />
        <Skeleton width="100%" height={160} />
      </Screen>
    );
  }

  if (!forecast) {
    return (
      <Screen bottomInset={spacing(8)}>
        <EmptyState
          title="No forecast yet"
          body="We couldn’t put together today’s Skin Weather. Pull back to the home screen and try again in a moment."
          actionLabel="Back home"
          onAction={() => router.replace('/(tabs)')}
        />
      </Screen>
    );
  }

  const env = forecast.environment;
  const dateLabel = format(parseISO(forecast.forecast_date), 'EEEE, MMMM d');

  const tiles: { label: string; value: string; level: EnvLevel }[] = [
    { label: 'UV index', value: `${Math.round(env.uv_index)}`, level: uvLevel(env.uv_index) },
    {
      label: 'Humidity',
      value: `${Math.round(env.humidity)}%`,
      level: humidityLevel(env.humidity),
    },
    {
      label: 'Temp swing',
      value: `${Math.round(env.temp_swing_c)}°`,
      level: swingLevel(env.temp_swing_c),
    },
    {
      label: 'Air quality',
      value: `${Math.round(env.air_quality_index)}`,
      level: aqiLevel(env.air_quality_index),
    },
    {
      label: 'Pollen',
      value: pollenLevel(env.pollen_level).label,
      level: pollenLevel(env.pollen_level),
    },
    {
      label: 'Now',
      value: `${Math.round(env.temp_c)}°`,
      level: { label: env.condition, tone: 'good' },
    },
  ];

  return (
    <Screen bottomInset={spacing(8)}>
      {/* Back */}
      <Animated.View entering={FadeIn.duration(260)} style={styles.backRow}>
        <PressableScale
          onPress={() => {
            haptics.tap();
            router.back();
          }}
          style={styles.backBtn}
          haptic={false}
        >
          <Ionicons name="chevron-back" size={22} color={palette.accentBright} />
        </PressableScale>
        <AppText variant="overline">Skin Weather</AppText>
      </Animated.View>

      {/* Headline */}
      <Animated.View entering={FadeInDown.delay(80).duration(460).springify().damping(16)}>
        <View style={styles.metaRow}>
          <Ionicons name="location-outline" size={13} color={palette.textTertiary} />
          <AppText variant="caption" color={palette.textTertiary}>
            {forecast.location_label} · {dateLabel}
          </AppText>
        </View>
        <AppText variant="title" style={styles.headline}>
          {forecast.headline}
        </AppText>
        <AppText variant="body" color={palette.textSecondary} style={styles.summary}>
          {forecast.summary}
        </AppText>
      </Animated.View>

      {/* Environment grid */}
      <View style={styles.section}>
        <SectionHeader overline="Conditions today" title="What’s in the air" />
        <View style={styles.grid}>
          {tiles.map((t, i) => (
            <Animated.View
              key={t.label}
              entering={FadeInDown.delay(160 + i * 50)
                .duration(420)
                .springify()
                .damping(16)}
              style={styles.tileWrap}
            >
              <GlassCard style={styles.tile}>
                <AppText variant="overline">{t.label}</AppText>
                <AppText variant="title" style={styles.tileValue}>
                  {t.value}
                </AppText>
                <View style={styles.tileLevel}>
                  <View style={[styles.dot, { backgroundColor: toneColor(t.level.tone) }]} />
                  <AppText variant="caption" color={palette.textSecondary}>
                    {t.level.label}
                  </AppText>
                </View>
              </GlassCard>
            </Animated.View>
          ))}
        </View>
      </View>

      {/* Today's plan */}
      <View style={styles.section}>
        <SectionHeader overline="Your move" title="Today’s plan" />
        <Stagger delay={120} interval={70}>
          {forecast.guidance.map((g, i) => (
            <GuidanceRow key={i} guidance={g} />
          ))}
        </Stagger>
      </View>

      {/* CTA */}
      <GlowButton
        label="Ask the coach about today"
        variant="ghost"
        onPress={() => {
          haptics.tap();
          router.push('/(tabs)/chat');
        }}
        style={styles.cta}
      />

      <AppText variant="caption" color={palette.textTertiary} style={styles.disclaimer}>
        {DISCLAIMER}
      </AppText>
    </Screen>
  );
}

function GuidanceRow({ guidance }: { guidance: ForecastGuidance }) {
  const action = FORECAST_ACTION[guidance.kind];
  return (
    <View style={styles.guidanceWrap}>
      <GlassCard style={styles.guidanceCard}>
        <View style={[styles.guidanceIcon, { backgroundColor: `${action.color}1F` }]}>
          <Ionicons name={action.icon} size={18} color={action.color} />
        </View>
        <View style={styles.guidanceBody}>
          <AppText variant="overline" color={action.color}>
            {action.verb}
          </AppText>
          <AppText variant="body" style={styles.guidanceText}>
            {guidance.text}
          </AppText>
        </View>
      </GlassCard>
    </View>
  );
}

const styles = StyleSheet.create({
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
    marginBottom: spacing(5),
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.accentDim,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(94,234,212,0.25)',
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(1.5) },
  headline: { marginTop: spacing(2), fontSize: 26, lineHeight: 32 },
  summary: { marginTop: spacing(3), lineHeight: 23 },
  section: { marginTop: spacing(8) },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(3) },
  tileWrap: { width: '47%', flexGrow: 1 },
  tile: { gap: spacing(1.5) },
  tileValue: { fontSize: 24, lineHeight: 28 },
  tileLevel: { flexDirection: 'row', alignItems: 'center', gap: spacing(2) },
  dot: { width: 7, height: 7, borderRadius: 4 },
  guidanceWrap: { marginBottom: spacing(3) },
  guidanceCard: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing(3) },
  guidanceIcon: {
    width: 36,
    height: 36,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guidanceBody: { flex: 1, gap: spacing(1) },
  guidanceText: { lineHeight: 21 },
  cta: { marginTop: spacing(8) },
  disclaimer: { marginTop: spacing(6), textAlign: 'center', lineHeight: 18 },
});
