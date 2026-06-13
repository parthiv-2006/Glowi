import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import Animated, { FadeIn } from 'react-native-reanimated';
import { formatDistanceToNow } from 'date-fns';

import {
  AppText,
  GlassCard,
  GlowButton,
  PressableScale,
  Screen,
  Skeleton,
  Stagger,
} from '@/components/ui';
import { createSession, deleteSession } from '@/lib/api';
import { qk } from '@/lib/query';
import { useSessions } from '@/lib/hooks';
import { haptics } from '@/lib/haptics';
import { useAuth } from '@/stores/auth';
import { palette, radii, spacing } from '@/theme';

export default function ChatTab() {
  const router = useRouter();
  const qc = useQueryClient();
  const userId = useAuth((s) => s.session?.user.id);
  const { data: sessions, isLoading } = useSessions();
  const [creating, setCreating] = useState(false);

  async function startChat() {
    if (!userId || creating) return;
    setCreating(true);
    haptics.press();
    try {
      const session = await createSession(userId);
      qc.invalidateQueries({ queryKey: qk.sessions });
      router.push(`/chat/${session.id}`);
    } finally {
      setCreating(false);
    }
  }

  async function remove(id: string) {
    haptics.tap();
    await deleteSession(id);
    qc.invalidateQueries({ queryKey: qk.sessions });
  }

  return (
    <Screen bottomInset={spacing(20)}>
      <Animated.View entering={FadeIn.duration(400)}>
        <AppText variant="display">Coach</AppText>
        <AppText variant="subheading" style={styles.sub}>
          Your skincare expert — with a memory.
        </AppText>
      </Animated.View>

      <View style={styles.actions}>
        <GlowButton
          label="New conversation"
          onPress={startChat}
          loading={creating}
          icon={<Ionicons name="add" size={20} color={palette.textOnAccent} />}
        />
        <PressableScale onPress={() => router.push('/memory')}>
          <GlassCard style={styles.memoryCard}>
            <View style={styles.memoryIcon}>
              <Ionicons name="bookmark-outline" size={18} color={palette.accentBright} />
            </View>
            <View style={{ flex: 1 }}>
              <AppText variant="subheading" color={palette.text}>
                What Glowi remembers
              </AppText>
              <AppText variant="caption">The facts your coach carries between chats</AppText>
            </View>
            <Ionicons name="chevron-forward" size={18} color={palette.textTertiary} />
          </GlassCard>
        </PressableScale>
      </View>

      <AppText variant="overline" style={styles.recentLabel}>
        Recent
      </AppText>

      {isLoading ? (
        <View style={styles.skeletons}>
          <Skeleton width="100%" height={72} radius={radii.lg} />
          <Skeleton width="100%" height={72} radius={radii.lg} />
        </View>
      ) : sessions?.length ? (
        <Stagger delay={60}>
          {sessions.map((s) => (
            <PressableScale key={s.id} onPress={() => router.push(`/chat/${s.id}`)} style={styles.row}>
              <GlassCard style={styles.sessionCard}>
                <View style={{ flex: 1 }}>
                  <AppText variant="heading" numberOfLines={1} style={styles.sessionTitle}>
                    {s.title}
                  </AppText>
                  <AppText variant="caption" numberOfLines={1}>
                    {s.summary ?? 'Tap to continue'} ·{' '}
                    {formatDistanceToNow(new Date(s.last_message_at), { addSuffix: true })}
                  </AppText>
                </View>
                <PressableScale onPress={() => remove(s.id)} hitSlop={10} haptic={false}>
                  <Ionicons name="trash-outline" size={18} color={palette.textTertiary} />
                </PressableScale>
              </GlassCard>
            </PressableScale>
          ))}
        </Stagger>
      ) : (
        <GlassCard style={styles.emptyCard}>
          <AppText variant="subheading" style={styles.emptyText}>
            No conversations yet. Start one — your coach already knows your latest scan.
          </AppText>
        </GlassCard>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  sub: { marginTop: spacing(1) },
  actions: { gap: spacing(3), marginTop: spacing(5) },
  memoryCard: { flexDirection: 'row', alignItems: 'center', gap: spacing(3), paddingVertical: spacing(3.5) },
  memoryIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.accentDim,
  },
  recentLabel: { marginTop: spacing(7), marginBottom: spacing(3) },
  skeletons: { gap: spacing(3) },
  row: { marginBottom: spacing(3) },
  sessionCard: { flexDirection: 'row', alignItems: 'center', gap: spacing(3), paddingVertical: spacing(4) },
  sessionTitle: { fontSize: 16, marginBottom: spacing(1) },
  emptyCard: { paddingVertical: spacing(6) },
  emptyText: { textAlign: 'center', lineHeight: 22 },
});
