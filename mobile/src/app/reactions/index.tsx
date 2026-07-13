/**
 * Reaction Log — the products that reacted badly, and the constraint the coach
 * carries forward. Every entry also lives as a 'gotcha' memory, so this screen
 * is the user-facing view of the highest-stakes personalization signal.
 */
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn } from 'react-native-reanimated';

import {
  AppText,
  Badge,
  EmptyState,
  GlassCard,
  GlowButton,
  PressableScale,
  Screen,
  Skeleton,
  Stagger,
} from '@/components/ui';
import { REACTION_SEVERITY } from '@/lib/constants';
import { haptics } from '@/lib/haptics';
import { useDeleteReactionLog, useReactionLogs } from '@/lib/hooks';
import type { ReactionLog } from '@/lib/types';
import { palette, radii, spacing } from '@/theme';

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function ReactionCard({ log, onDelete }: { log: ReactionLog; onDelete: () => void }) {
  const severity = REACTION_SEVERITY[log.severity];
  return (
    <GlassCard style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardTitle}>
          {log.brand ? (
            <AppText variant="overline" color={palette.textSecondary}>
              {log.brand}
            </AppText>
          ) : null}
          <AppText variant="heading" numberOfLines={2} style={styles.productName}>
            {log.product_name}
          </AppText>
        </View>
        <PressableScale
          onPress={onDelete}
          style={styles.deleteBtn}
          accessibilityLabel={`Delete reaction log for ${log.product_name}`}
        >
          <Ionicons name="trash-outline" size={18} color={palette.textTertiary} />
        </PressableScale>
      </View>

      <View style={styles.metaRow}>
        <Badge label={severity.label} color={severity.color} />
        <AppText variant="caption" color={palette.textSecondary}>
          {formatDate(log.reacted_on)}
        </AppText>
      </View>

      {log.symptoms.length ? (
        <View style={styles.chipRow}>
          {log.symptoms.map((s) => (
            <View key={s} style={styles.symptomChip}>
              <AppText variant="caption" color={palette.textSecondary}>
                {s}
              </AppText>
            </View>
          ))}
        </View>
      ) : null}

      {log.key_ingredients.length ? (
        <AppText variant="caption" color={palette.textTertiary}>
          Watching for: {log.key_ingredients.join(' · ')}
        </AppText>
      ) : null}

      {log.notes ? (
        <AppText variant="caption" color={palette.textSecondary} style={styles.notes}>
          {log.notes}
        </AppText>
      ) : null}
    </GlassCard>
  );
}

export default function ReactionLogScreen() {
  const router = useRouter();
  const { data: logs, isLoading } = useReactionLogs();
  const { mutate: deleteLog } = useDeleteReactionLog();

  return (
    <Screen bottomInset={spacing(8)}>
      <Animated.View entering={FadeIn.duration(260)} style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <PressableScale
            onPress={() => {
              haptics.tap();
              router.back();
            }}
            style={styles.backBtn}
            haptic={false}
            accessibilityLabel="Back"
          >
            <Ionicons name="chevron-back" size={22} color={palette.accentBright} />
          </PressableScale>
          <AppText variant="overline">Reaction log</AppText>
        </View>
        {logs?.length ? (
          <PressableScale
            onPress={() => {
              haptics.press();
              router.push('/reactions/add');
            }}
            style={styles.addBtn}
            haptic={false}
            accessibilityLabel="Log a reaction"
          >
            <Ionicons name="add" size={20} color={palette.textOnAccent} />
          </PressableScale>
        ) : null}
      </Animated.View>

      {isLoading ? (
        <View style={{ gap: spacing(3) }}>
          <Skeleton width="60%" height={26} />
          <Skeleton width="100%" height={96} />
          <Skeleton width="100%" height={96} />
        </View>
      ) : !logs?.length ? (
        <EmptyState
          title="No reactions logged"
          body="If a product ever breaks you out or stings, log it here. Your coach will never recommend it again — and will warn you about similar formulations."
          actionLabel="Log a reaction"
          onAction={() => router.push('/reactions/add')}
        />
      ) : (
        <>
          <AppText variant="display" style={styles.title}>
            What to avoid
          </AppText>
          <AppText variant="subheading" style={styles.subtitle}>
            Your coach carries {logs.length === 1 ? 'this' : 'these'} into every recommendation.
          </AppText>

          <View style={styles.list}>
            <Stagger delay={80} interval={60}>
              {logs.map((log) => (
                <ReactionCard
                  key={log.id}
                  log={log}
                  onDelete={() => {
                    haptics.tap();
                    deleteLog(log.id);
                  }}
                />
              ))}
            </Stagger>
          </View>

          <GlowButton
            label="Log another reaction"
            variant="ghost"
            onPress={() => {
              haptics.press();
              router.push('/reactions/add');
            }}
          />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing(5),
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing(3) },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.accentDim,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(188,94,56,0.25)',
  },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.accent,
  },
  title: { fontSize: 30 },
  subtitle: { marginTop: spacing(2), marginBottom: spacing(5) },
  list: { gap: spacing(3), marginBottom: spacing(4) },
  card: { gap: spacing(2.5) },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing(2) },
  cardTitle: { flex: 1, gap: spacing(0.5) },
  productName: { fontSize: 16, lineHeight: 21 },
  deleteBtn: { padding: spacing(1), flexShrink: 0 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(2.5) },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(2) },
  symptomChip: {
    paddingHorizontal: spacing(2.5),
    paddingVertical: spacing(1),
    borderRadius: radii.full,
    backgroundColor: palette.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
  },
  notes: { lineHeight: 18 },
});
