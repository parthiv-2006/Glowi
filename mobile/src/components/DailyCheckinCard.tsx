/**
 * Today's lifestyle check-in — a 10-second daily habit that feeds the correlation
 * engine (sustained streaks) and the coach's memory. Each tap upserts immediately;
 * there is no save button. Collapses to a one-line summary once the day is logged.
 * The cycle-phase row appears only when the user opts in (Profile → Track cycle phase).
 */
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn } from 'react-native-reanimated';

import { AppText, GlassCard, PressableScale } from '@/components/ui';
import { useLifestyleLogs, useUpsertLifestyleLog } from '@/lib/hooks';
import type { LifestyleLogInput } from '@/lib/api';
import { haptics } from '@/lib/haptics';
import { getLastNightSleepHours } from '@/lib/health';
import { formatSleepHours, sleepQualityFromHours } from '@/lib/sleepMapping';
import { useSettings } from '@/stores/settings';
import { palette, radii, spacing } from '@/theme';
import type { CyclePhase, LifestyleLevel, LifestyleLog } from '@/lib/types';

/** Fields a check-in tap can set (log_date is supplied by the card). */
type CheckinPatch = Omit<LifestyleLogInput, 'log_date'>;

const today = () => new Date().toISOString().slice(0, 10);

/** A 3-level tap scale, low → high, with a typed read + patch so no dynamic keys are needed. */
interface Scale {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  options: [string, string, string];
  /** Word for each level in the collapsed summary. */
  words: [string, string, string];
  value: (log: LifestyleLog | undefined) => LifestyleLevel | null;
  patch: (level: LifestyleLevel) => CheckinPatch;
}

const SCALES: Scale[] = [
  {
    icon: 'moon-outline',
    label: 'Sleep',
    options: ['Poor', 'Okay', 'Great'],
    words: ['Poor sleep', 'Okay sleep', 'Slept great'],
    value: (l) => l?.sleep_quality ?? null,
    patch: (sleep_quality) => ({ sleep_quality }),
  },
  {
    icon: 'pulse-outline',
    label: 'Stress',
    options: ['Calm', 'Some', 'High'],
    words: ['Low stress', 'Some stress', 'High stress'],
    value: (l) => l?.stress_level ?? null,
    patch: (stress_level) => ({ stress_level }),
  },
  {
    icon: 'water-outline',
    label: 'Water',
    options: ['Low', 'Okay', 'Good'],
    words: ['Low water', 'Okay water', 'Well hydrated'],
    value: (l) => l?.water_level ?? null,
    patch: (water_level) => ({ water_level }),
  },
];

interface DietFlag {
  label: string;
  value: (log: LifestyleLog | undefined) => boolean;
  patch: (on: boolean) => CheckinPatch;
}

const DIET: DietFlag[] = [
  { label: 'Dairy', value: (l) => !!l?.diet_dairy, patch: (diet_dairy) => ({ diet_dairy }) },
  { label: 'Sugar', value: (l) => !!l?.diet_sugar, patch: (diet_sugar) => ({ diet_sugar }) },
  {
    label: 'Alcohol',
    value: (l) => !!l?.diet_alcohol,
    patch: (diet_alcohol) => ({ diet_alcohol }),
  },
];

const CYCLE: { key: CyclePhase; label: string }[] = [
  { key: 'menstrual', label: 'Menstrual' },
  { key: 'follicular', label: 'Follicular' },
  { key: 'ovulation', label: 'Ovulation' },
  { key: 'luteal', label: 'Luteal' },
];

export function DailyCheckinCard() {
  const { data: logs } = useLifestyleLogs();
  const upsert = useUpsertLifestyleLog();
  const cycleEnabled = useSettings((s) => s.cycleTrackingEnabled);
  const healthAutoFillEnabled = useSettings((s) => s.healthAutoFillEnabled);
  const [editing, setEditing] = useState(false);
  const [sleepSuggestion, setSleepSuggestion] = useState<{
    hours: number;
    level: LifestyleLevel;
  } | null>(null);

  const date = today();
  const log = useMemo(() => logs?.find((l) => l.log_date === date), [logs, date]);
  const sleepUnanswered = log?.sleep_quality == null;

  // Suggest-and-confirm (ADR-0017): fetch last night's sleep once per mount
  // while the scale is unanswered; the user still taps to log it.
  useEffect(() => {
    if (!healthAutoFillEnabled || !sleepUnanswered) return;
    let cancelled = false;
    void getLastNightSleepHours().then((hours) => {
      if (cancelled || hours == null) return;
      const level = sleepQualityFromHours(hours);
      if (level != null) setSleepSuggestion({ hours, level });
    });
    return () => {
      cancelled = true;
    };
  }, [healthAutoFillEnabled, sleepUnanswered]);

  const apply = (patch: CheckinPatch) => {
    haptics.tap();
    upsert.mutate({ log_date: date, ...patch });
  };

  // "Logged" once all three scales are answered — diet flags always carry a value.
  const fullyLogged =
    log?.sleep_quality != null && log?.stress_level != null && log?.water_level != null;

  if (fullyLogged && !editing) {
    return (
      <Animated.View entering={FadeIn.duration(300)}>
        <GlassCard tier="raised" style={styles.card}>
          <PressableScale
            onPress={() => setEditing(true)}
            style={styles.collapsedRow}
            haptic={false}
          >
            <View style={styles.collapsedIcon}>
              <Ionicons name="checkmark" size={16} color={palette.sage} />
            </View>
            <View style={styles.collapsedBody}>
              <AppText variant="heading">Logged for today</AppText>
              <AppText variant="caption" numberOfLines={1}>
                {summary(log, cycleEnabled)}
              </AppText>
            </View>
            <AppText variant="caption" color={palette.clay}>
              Edit
            </AppText>
          </PressableScale>
        </GlassCard>
      </Animated.View>
    );
  }

  return (
    <GlassCard tier="raised" style={styles.card}>
      <View style={styles.header}>
        <AppText variant="overline">Today&apos;s check-in</AppText>
        <AppText variant="caption">10-second daily log</AppText>
      </View>

      {SCALES.map((s) => {
        const current = s.value(log);
        return (
          <View key={s.label} style={styles.scaleRow}>
            <View style={styles.scaleLabel}>
              <Ionicons name={s.icon} size={15} color={palette.clay} />
              <AppText variant="subheading" color={palette.ink}>
                {s.label}
              </AppText>
            </View>
            <View style={styles.segment}>
              {s.options.map((opt, level) => {
                const active = current === level;
                return (
                  <PressableScale
                    key={opt}
                    onPress={() => apply(s.patch(level as LifestyleLevel))}
                    style={[styles.segmentBtn, active && styles.segmentActive]}
                    haptic={false}
                  >
                    <AppText
                      variant="caption"
                      color={active ? palette.textOnAccent : palette.inkSoft}
                    >
                      {opt}
                    </AppText>
                  </PressableScale>
                );
              })}
            </View>
          </View>
        );
      })}

      {sleepSuggestion != null && sleepUnanswered ? (
        <PressableScale
          onPress={() => {
            apply({ sleep_quality: sleepSuggestion.level });
            setSleepSuggestion(null);
          }}
          style={styles.healthSuggestRow}
          haptic={false}
        >
          <Ionicons name="heart-outline" size={14} color={palette.clay} />
          <AppText variant="caption" color={palette.inkSoft} style={styles.healthSuggestText}>
            Health saw {formatSleepHours(sleepSuggestion.hours)} of sleep —{' '}
            {SCALES[0].options[sleepSuggestion.level].toLowerCase()}. Tap to log it.
          </AppText>
        </PressableScale>
      ) : null}

      <View style={styles.dietRow}>
        {DIET.map((d) => {
          const active = d.value(log);
          return (
            <PressableScale
              key={d.label}
              onPress={() => apply(d.patch(!active))}
              style={[styles.chip, active && styles.chipActive]}
              haptic={false}
            >
              <AppText variant="caption" color={active ? palette.textOnAccent : palette.inkSoft}>
                {d.label}
              </AppText>
            </PressableScale>
          );
        })}
      </View>

      {cycleEnabled ? (
        <View style={styles.cycleWrap}>
          <AppText variant="caption" style={styles.cycleLabel}>
            Cycle phase
          </AppText>
          <View style={styles.cycleRow}>
            {CYCLE.map((c) => {
              const active = log?.cycle_phase === c.key;
              return (
                <PressableScale
                  key={c.key}
                  onPress={() => apply({ cycle_phase: active ? null : c.key })}
                  style={[styles.chip, active && styles.chipActive]}
                  haptic={false}
                >
                  <AppText
                    variant="caption"
                    color={active ? palette.textOnAccent : palette.inkSoft}
                  >
                    {c.label}
                  </AppText>
                </PressableScale>
              );
            })}
          </View>
        </View>
      ) : null}
    </GlassCard>
  );
}

/** One-line recap for the collapsed state. */
function summary(log: LifestyleLog, cycleEnabled: boolean): string {
  const bits: string[] = [];
  for (const s of SCALES) {
    const level = s.value(log);
    if (level != null) bits.push(s.words[level]);
  }
  const flags = DIET.filter((d) => d.value(log)).map((d) => d.label.toLowerCase());
  if (flags.length) bits.push(flags.join(' + '));
  if (cycleEnabled && log.cycle_phase) bits.push(log.cycle_phase);
  return bits.join(' · ');
}

const styles = StyleSheet.create({
  card: { gap: spacing(3) },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  scaleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(3) },
  scaleLabel: { flexDirection: 'row', alignItems: 'center', gap: spacing(1.5), width: 88 },
  segment: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: palette.well,
    borderRadius: radii.full,
    padding: spacing(0.5),
    gap: spacing(0.5),
  },
  segmentBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing(2),
    borderRadius: radii.full,
  },
  segmentActive: { backgroundColor: palette.clay },
  dietRow: { flexDirection: 'row', gap: spacing(2) },
  healthSuggestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2),
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2),
    borderRadius: radii.md,
    backgroundColor: palette.well,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.line,
  },
  healthSuggestText: { flex: 1, lineHeight: 16 },
  chip: {
    paddingHorizontal: spacing(3.5),
    paddingVertical: spacing(2),
    borderRadius: radii.full,
    backgroundColor: palette.well,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.line,
  },
  chipActive: { backgroundColor: palette.clay, borderColor: palette.clay },
  cycleWrap: { gap: spacing(2) },
  cycleLabel: { color: palette.inkFaint },
  cycleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(2) },
  collapsedRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(3) },
  collapsedIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(117,135,106,0.14)',
  },
  collapsedBody: { flex: 1, minWidth: 0, gap: spacing(0.5) },
});
