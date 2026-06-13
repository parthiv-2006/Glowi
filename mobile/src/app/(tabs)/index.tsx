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
import { useScans } from '@/lib/hooks';
import { haptics } from '@/lib/haptics';
import { useAuth } from '@/stores/auth';
import { palette, radii, scoreColor, severityColor, spacing } from '@/theme';

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

  const latest = useMemo(() => scans?.find((s) => s.status === 'complete'), [scans]);
  const firstName = profile?.display_name?.split(' ')[0];

  return (
    <Screen bottomInset={spacing(20)}>
      <Animated.View entering={FadeIn.duration(400)}>
        <AppText variant="overline">{greeting()}</AppText>
        <AppText variant="display" style={styles.name}>
          {firstName ?? 'Welcome'}
        </AppText>
      </Animated.View>

      <Stagger delay={120}>
        {/* Hero scan CTA */}
        <PressableScale
          onPress={() => {
            haptics.press();
            router.push('/scan');
          }}
          style={styles.heroWrap}
        >
          <LinearGradient
            colors={['#0F766E', '#0A2E2A']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.hero}
          >
            <View style={styles.heroGlow} />
            <View style={styles.heroContent}>
              <View style={styles.scanIcon}>
                <Ionicons name="scan-outline" size={26} color={palette.accentBright} />
              </View>
              <AppText variant="title" style={styles.heroTitle}>
                Start a skin scan
              </AppText>
              <AppText variant="subheading" color="rgba(244,246,245,0.75)">
                Point, capture, and get your personalized read in seconds.
              </AppText>
            </View>
            <Ionicons name="arrow-forward-circle" size={32} color={palette.accentBright} />
          </LinearGradient>
        </PressableScale>

        {/* Latest scan snapshot */}
        {isLoading ? (
          <GlassCard style={styles.section}>
            <Skeleton width="50%" height={20} />
            <View style={{ height: spacing(3) }} />
            <Skeleton width="100%" height={64} />
          </GlassCard>
        ) : latest ? (
          <PressableScale onPress={() => router.push(`/results/${latest.id}`)}>
            <GlassCard emphasized style={styles.section}>
              <View style={styles.snapshotRow}>
                <ProgressRing
                  value={latest.skin_score ?? 0}
                  size={92}
                  strokeWidth={8}
                  color={scoreColor(latest.skin_score ?? 0)}
                  sublabel="score"
                />
                <View style={styles.snapshotBody}>
                  <AppText variant="overline">Latest scan</AppText>
                  <AppText variant="heading" numberOfLines={2} style={styles.snapshotSummary}>
                    {latest.summary ?? 'Your results are ready.'}
                  </AppText>
                  <View style={styles.concernChips}>
                    {latest.concerns.slice(0, 3).map((c) => (
                      <View key={c.concern_slug} style={styles.chip}>
                        <View style={[styles.chipDot, { backgroundColor: severityColor(c.severity) }]} />
                        <AppText variant="caption" color={palette.textSecondary}>
                          {c.display_name}
                        </AppText>
                      </View>
                    ))}
                  </View>
                </View>
              </View>
            </GlassCard>
          </PressableScale>
        ) : (
          <GlassCard style={styles.section}>
            <AppText variant="heading">No scans yet</AppText>
            <AppText variant="subheading" style={{ marginTop: spacing(1) }}>
              Your first scan unlocks tailored products, a nutrition plan, and routines built around
              what Glowi finds.
            </AppText>
          </GlassCard>
        )}

        {/* Quick actions */}
        <View style={styles.actionsRow}>
          <QuickAction
            icon="chatbubbles-outline"
            label="Ask the coach"
            onPress={() => router.push('/(tabs)/chat')}
          />
          <QuickAction
            icon="sunny-outline"
            label="My routine"
            onPress={() => router.push('/routine')}
          />
        </View>
        <View style={styles.actionsRow}>
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
        <Ionicons name={icon} size={22} color={palette.accentBright} />
        <AppText variant="subheading" color={palette.text}>
          {label}
        </AppText>
      </GlassCard>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  name: { fontSize: 32, marginTop: spacing(1) },
  heroWrap: { marginTop: spacing(5) },
  hero: {
    borderRadius: radii.xl,
    padding: spacing(5),
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(94,234,212,0.25)',
  },
  heroGlow: {
    position: 'absolute',
    top: -40,
    right: -20,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: palette.glow,
    opacity: 0.25,
  },
  heroContent: { flex: 1, gap: spacing(1.5) },
  scanIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
    marginBottom: spacing(1),
  },
  heroTitle: { fontSize: 22 },
  section: { marginTop: spacing(4) },
  snapshotRow: { flexDirection: 'row', gap: spacing(4), alignItems: 'center' },
  snapshotBody: { flex: 1, gap: spacing(1) },
  snapshotSummary: { fontSize: 15, lineHeight: 20 },
  concernChips: { gap: spacing(1), marginTop: spacing(2) },
  chip: { flexDirection: 'row', alignItems: 'center', gap: spacing(2) },
  chipDot: { width: 7, height: 7, borderRadius: 4 },
  actionsRow: { flexDirection: 'row', gap: spacing(4), marginTop: spacing(4) },
  actionWrap: { flex: 1 },
  action: { flexDirection: 'row', alignItems: 'center', gap: spacing(3), paddingVertical: spacing(4) },
});
