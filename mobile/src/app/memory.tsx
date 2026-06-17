import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn } from 'react-native-reanimated';

import {
  AppText,
  Badge,
  EmptyState,
  GlassCard,
  PressableScale,
  Screen,
  Skeleton,
  Stagger,
} from '@/components/ui';
import { useMemories, useDeleteMemory } from '@/lib/hooks';
import { haptics } from '@/lib/haptics';
import type { AiMemory, MemoryType } from '@/lib/types';
import { palette, radii, spacing } from '@/theme';

const TYPE_META: Record<
  MemoryType,
  { label: string; icon: keyof typeof Ionicons.glyphMap; color: string }
> = {
  gotcha: { label: 'Safety note', icon: 'warning-outline', color: palette.warning },
  profile_fact: { label: 'About you', icon: 'person-outline', color: palette.accent },
  goal: { label: 'Goal', icon: 'flag-outline', color: palette.accentBright },
  preference: { label: 'Preference', icon: 'heart-outline', color: palette.accent },
  event: { label: 'History', icon: 'time-outline', color: palette.textSecondary },
};

const ORDER: MemoryType[] = ['gotcha', 'profile_fact', 'goal', 'preference', 'event'];

export default function MemoryScreen() {
  const router = useRouter();
  const { data: memories, isLoading } = useMemories();
  const del = useDeleteMemory();

  const grouped = useMemo(() => {
    const map = new Map<MemoryType, AiMemory[]>();
    for (const m of memories ?? []) {
      const arr = map.get(m.type) ?? [];
      arr.push(m);
      map.set(m.type, arr);
    }
    return ORDER.filter((t) => map.has(t)).map((t) => ({ type: t, items: map.get(t)! }));
  }, [memories]);

  function remove(id: string) {
    haptics.tap();
    del.mutate(id);
  }

  return (
    <Screen bottomInset={spacing(8)}>
      <View style={styles.headerRow}>
        <PressableScale onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-down" size={26} color={palette.text} />
        </PressableScale>
        <AppText variant="overline">Glowi&apos;s memory</AppText>
        <View style={{ width: 26 }} />
      </View>

      <Animated.View entering={FadeIn.duration(400)} style={styles.intro}>
        <AppText variant="title">What Glowi remembers</AppText>
        <AppText variant="subheading" style={styles.introSub}>
          Your coach carries these facts into every new conversation, so you never start over.
          Remove anything you&apos;d rather it forgot.
        </AppText>
      </Animated.View>

      {isLoading ? (
        <View style={styles.skeletons}>
          <Skeleton width="100%" height={64} radius={radii.lg} />
          <Skeleton width="100%" height={64} radius={radii.lg} />
          <Skeleton width="100%" height={64} radius={radii.lg} />
        </View>
      ) : grouped.length === 0 ? (
        <EmptyState
          title="Nothing remembered yet"
          body="As you scan and chat, Glowi notes durable facts about your skin here — your type, goals, and anything that's reacted badly."
        />
      ) : (
        grouped.map((group) => (
          <View key={group.type} style={styles.group}>
            <View style={styles.groupHeader}>
              <Ionicons
                name={TYPE_META[group.type].icon}
                size={15}
                color={TYPE_META[group.type].color}
              />
              <AppText variant="overline" color={TYPE_META[group.type].color}>
                {TYPE_META[group.type].label}
              </AppText>
            </View>
            <Stagger delay={40}>
              {group.items.map((m) => (
                <View key={m.id} style={styles.memoryWrap}>
                  <GlassCard
                    style={styles.memoryCard}
                    tier={group.type === 'gotcha' ? 'glow' : 'raised'}
                  >
                    <AppText variant="body" style={styles.memoryText}>
                      {m.content}
                    </AppText>
                    <View style={styles.memoryFooter}>
                      <Badge label={m.source} color={palette.textTertiary} />
                      <PressableScale onPress={() => remove(m.id)} hitSlop={10} haptic={false}>
                        <Ionicons name="close-circle" size={20} color={palette.textTertiary} />
                      </PressableScale>
                    </View>
                  </GlassCard>
                </View>
              ))}
            </Stagger>
          </View>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing(4),
  },
  intro: { gap: spacing(2), marginBottom: spacing(6) },
  introSub: { lineHeight: 22 },
  skeletons: { gap: spacing(3) },
  group: { marginBottom: spacing(6) },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2),
    marginBottom: spacing(3),
  },
  memoryWrap: { marginBottom: spacing(3) },
  memoryCard: { gap: spacing(3) },
  memoryText: { lineHeight: 22 },
  memoryFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
