import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn } from 'react-native-reanimated';

import {
  AppText,
  GlassCard,
  PressableScale,
  ProgressRing,
  Screen,
  Skeleton,
  Stagger,
} from '@/components/ui';
import { SkinWeatherCard } from '@/components/SkinWeatherCard';
import { useScans, useSkinForecast } from '@/lib/hooks';
import { haptics } from '@/lib/haptics';
import { useAuth } from '@/stores/auth';
import { fonts, palette, radii, scoreColor, severityColor, spacing } from '@/theme';

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function Home() {
  const router = useRouter();
  const profile = useAuth((s) => s.profile);
  const { data: scans, isLoading } = useScans();
  const { data: forecast, isLoading: forecastLoading } = useSkinForecast();

  const latest = useMemo(() => scans?.find((s) => s.status === 'complete'), [scans]);
  const firstName = profile?.display_name?.split(' ')[0];
  const initial = firstName?.[0]?.toUpperCase();

  return (
    <Screen bottomInset={spacing(20)}>
      <Animated.View entering={FadeIn.duration(400)} style={styles.headerRow}>
        <View style={styles.headerText}>
          <AppText variant="overline" color={palette.clay}>
            {greeting()}
          </AppText>
          <AppText variant="display" style={styles.name}>
            {firstName ?? 'Guest'}
          </AppText>
        </View>
        <View style={styles.headerActions}>
          {latest ? (
            <PressableScale
              onPress={() => {
                haptics.press();
                router.push('/scan');
              }}
              style={styles.headerScan}
              haptic={false}
            >
              <Ionicons name="scan-outline" size={22} color={palette.clay} />
            </PressableScale>
          ) : null}
          {initial ? (
            <PressableScale
              onPress={() => {
                haptics.press();
                router.push('/(tabs)/profile');
              }}
              style={styles.avatar}
              haptic={false}
            >
              <AppText variant="heading" color="#FFFFFF" style={styles.avatarText}>
                {initial}
              </AppText>
            </PressableScale>
          ) : null}
        </View>
      </Animated.View>

      <Stagger delay={120}>
        {forecastLoading ? (
          <GlassCard style={styles.forecastSkeleton}>
            <Skeleton width="40%" height={14} />
            <View style={{ height: spacing(2) }} />
            <Skeleton width="85%" height={20} />
          </GlassCard>
        ) : forecast ? (
          <SkinWeatherCard
            forecast={forecast}
            compact={!!latest}
            onPress={() => router.push('/forecast')}
          />
        ) : null}

        {isLoading ? (
          <GlassCard style={styles.section}>
            <Skeleton width="50%" height={20} />
            <View style={{ height: spacing(3) }} />
            <Skeleton width="100%" height={64} />
          </GlassCard>
        ) : latest ? (
          <>
            <PressableScale
              onPress={() => router.push(`/results/${latest.id}`)}
              style={styles.section}
            >
              <GlassCard tier="raised" strong>
                <View style={styles.snapshotRow}>
                  <ProgressRing
                    value={latest.skin_score ?? 0}
                    size={76}
                    strokeWidth={7}
                    color={scoreColor(latest.skin_score ?? 0)}
                    sublabel="score"
                  />
                  <View style={styles.snapshotBody}>
                    <AppText variant="overline">Latest scan</AppText>
                    <AppText variant="body" numberOfLines={2} style={styles.snapshotSummary}>
                      {latest.summary ?? 'Your results are ready.'}
                    </AppText>
                    <View style={styles.concernChips}>
                      {latest.concerns.slice(0, 2).map((c) => (
                        <View key={c.concern_slug} style={styles.chip}>
                          <View
                            style={[styles.chipDot, { backgroundColor: severityColor(c.severity) }]}
                          />
                          <AppText variant="caption">{c.display_name}</AppText>
                        </View>
                      ))}
                    </View>
                  </View>
                </View>
              </GlassCard>
            </PressableScale>

            <View style={[styles.actionsGrid, styles.section]}>
              <QuickAction
                icon="chatbubbles-outline"
                label="Coach"
                onPress={() => router.push('/(tabs)/chat')}
              />
              <QuickAction
                icon="sunny-outline"
                label="Routine"
                onPress={() => router.push('/routine')}
              />
              <QuickAction
                icon="analytics-outline"
                label="Progress"
                onPress={() => router.push('/(tabs)/progress')}
              />
              <QuickAction
                icon="book-outline"
                label="Learn"
                onPress={() => router.push('/(tabs)/learn')}
              />
            </View>
          </>
        ) : (
          <>
            <PressableScale
              onPress={() => {
                haptics.press();
                router.push('/scan');
              }}
              style={styles.heroWrap}
            >
              <LinearGradient
                colors={['#E8A37A', '#C5704A', '#8E4730']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.hero}
              >
                <View style={styles.heroTopRow}>
                  <View style={styles.scanIcon}>
                    <Ionicons name="scan-outline" size={22} color="rgba(255,255,255,0.9)" />
                  </View>
                  <View style={styles.arrowBtn}>
                    <Ionicons name="arrow-forward" size={18} color="rgba(255,255,255,0.9)" />
                  </View>
                </View>
                <AppText variant="title" color="#FFFFFF" style={styles.heroTitle}>
                  Start a skin scan
                </AppText>
                <AppText variant="subheading" color="rgba(255,255,255,0.78)" style={styles.heroSub}>
                  Point, capture, and get your personalized read in seconds.
                </AppText>
              </LinearGradient>
            </PressableScale>

            <View style={[styles.section, styles.emptyScanCard]}>
              <AppText variant="heading" style={styles.emptyScanTitle}>
                No scans yet
              </AppText>
              <AppText variant="caption" style={styles.emptyScanBody}>
                Your first scan unlocks tailored products, a nutrition plan, and routines built
                around what Glowi finds.
              </AppText>
            </View>
          </>
        )}
      </Stagger>
    </Screen>
  );
}

function QuickAction({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <PressableScale onPress={onPress} style={styles.actionWrap}>
      <GlassCard style={styles.action}>
        <Ionicons name={icon} size={22} color={palette.clay} />
        <AppText variant="subheading" color={palette.ink}>
          {label}
        </AppText>
      </GlassCard>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerText: { flex: 1, minWidth: 0 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing(2) },
  name: { fontSize: 32, marginTop: spacing(1) },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: palette.clay,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontFamily: fonts.bodyBold },
  headerScan: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.accentDim,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(188,94,56,0.22)',
  },
  forecastSkeleton: { marginBottom: spacing(1) },
  heroWrap: { marginTop: spacing(4) },
  hero: {
    borderRadius: radii.xl,
    padding: spacing(5),
    gap: spacing(3),
    overflow: 'hidden',
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  scanIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  arrowBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  heroTitle: { fontSize: 22 },
  heroSub: { lineHeight: 20 },
  section: { marginTop: spacing(4) },
  emptyScanCard: {
    alignItems: 'center',
    width: '100%',
    paddingVertical: spacing(6),
    paddingHorizontal: spacing(5),
    borderRadius: radii.lg,
    backgroundColor: palette.well,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.line,
  },
  emptyScanTitle: { fontSize: 15, marginBottom: spacing(1.5) },
  emptyScanBody: { textAlign: 'center', lineHeight: 18 },
  snapshotRow: { flexDirection: 'row', gap: spacing(4), alignItems: 'center', width: '100%' },
  snapshotBody: { flex: 1, minWidth: 0, gap: spacing(1) },
  snapshotSummary: { fontSize: 15, lineHeight: 20 },
  concernChips: { gap: spacing(1), marginTop: spacing(2) },
  chip: { flexDirection: 'row', alignItems: 'center', gap: spacing(2) },
  chipDot: { width: 7, height: 7, borderRadius: 4 },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(3) },
  actionWrap: { flexGrow: 1, flexBasis: '46%' },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
    paddingVertical: spacing(4),
  },
});
