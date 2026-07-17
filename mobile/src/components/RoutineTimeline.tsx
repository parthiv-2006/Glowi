/**
 * RoutineTimeline — a horizontal strip above the editable step list that turns
 * each step's wait time into a proportional bar, so the routine's pacing reads
 * at a glance instead of being buried in per-step WaitConnector pills (which
 * stay untouched below). Sequence warnings have no step attribution, so they
 * surface here only as a static count flag, not a tap target.
 *
 * SVG-free — this is plain Views/bars, not a chart, so it skips the SVG house
 * style used by ScoreTrend/FaceZoneMap/ConflictGraph.
 */
import { Fragment, useEffect } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { AppText } from '@/components/ui';
import { CATEGORY_LABEL, categoryIcon } from '@/lib/constants';
import { buildTimeline, type TimelineSegment } from '@/lib/routineTimeline';
import type { RoutineStep } from '@/lib/types';
import { motion, palette, radii, spacing } from '@/theme';

interface RoutineTimelineProps {
  steps: RoutineStep[];
  period: 'am' | 'pm';
  warningsCount?: number;
}

export function RoutineTimeline({ steps, period, warningsCount = 0 }: RoutineTimelineProps) {
  const reduceMotion = useReducedMotion();

  if (steps.length < 2) return null;

  const { segments, totalWaitMinutes } = buildTimeline(steps);

  const summaryLabel =
    `${period === 'am' ? 'Morning' : 'Evening'} routine: ${steps.length} steps, ` +
    `${totalWaitMinutes} minutes total wait` +
    (warningsCount > 0 ? `, ${warningsCount} sequence warnings listed below` : '');

  return (
    <View accessible={false}>
      <View accessible accessibilityRole="summary" accessibilityLabel={summaryLabel} />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {steps.map((step, index) => {
          const segment = index < segments.length ? segments[index] : null;
          const name = step.product?.name ?? step.custom_name ?? 'Custom step';
          const category = step.product?.category ?? null;
          const categoryLabel = category ? (CATEGORY_LABEL[category] ?? category) : null;

          let a11yLabel = `Step ${index + 1}: ${name}`;
          if (categoryLabel) a11yLabel += `, ${categoryLabel}`;
          if (segment && segment.minutes > 0) {
            a11yLabel += `. Wait ${segment.minutes} minutes before the next step.`;
          }

          const entering = reduceMotion
            ? FadeIn.duration(motion.base)
            : FadeInDown.delay(index * motion.stagger).duration(motion.slow);

          return (
            <Fragment key={step.id ?? `step-${index}`}>
              <Animated.View
                entering={entering}
                style={styles.node}
                accessible
                accessibilityLabel={a11yLabel}
              >
                <View style={styles.iconCircle}>
                  <Ionicons name={categoryIcon(category)} size={18} color={palette.inkFaint} />
                  <View style={styles.numberBadge}>
                    <AppText variant="mono" color={palette.inkSoft} style={styles.numberText}>
                      {index + 1}
                    </AppText>
                  </View>
                </View>
                <AppText
                  variant="caption"
                  color={palette.inkSoft}
                  numberOfLines={1}
                  style={styles.nodeName}
                >
                  {name}
                </AppText>
              </Animated.View>

              {segment ? (
                <Connector segment={segment} index={index} reduceMotion={reduceMotion} />
              ) : null}
            </Fragment>
          );
        })}

        {warningsCount > 0 ? <WarningsFlag count={warningsCount} /> : null}
      </ScrollView>
    </View>
  );
}

function Connector({
  segment,
  index,
  reduceMotion,
}: {
  segment: TimelineSegment;
  index: number;
  reduceMotion: boolean;
}) {
  const hasWait = segment.minutes > 0;

  return (
    <View style={styles.connector}>
      <View style={styles.connectorLabelSlot}>
        {hasWait ? (
          <AppText variant="mono" color={palette.inkFaint} style={styles.connectorLabel}>
            {segment.minutes}m
          </AppText>
        ) : null}
      </View>
      <GrowingBar
        width={segment.width}
        color={hasWait ? palette.lineStrong : palette.line}
        index={index}
        reduceMotion={reduceMotion}
      />
    </View>
  );
}

function GrowingBar({
  width,
  color,
  index,
  reduceMotion,
}: {
  width: number;
  color: string;
  index: number;
  reduceMotion: boolean;
}) {
  const barWidth = useSharedValue(reduceMotion ? width : 0);

  useEffect(() => {
    if (reduceMotion) {
      barWidth.value = width;
      return;
    }
    barWidth.value = withDelay(
      (index + 0.5) * motion.stagger,
      withTiming(width, { duration: motion.base, easing: motion.easing }),
    );
  }, [width, index, reduceMotion, barWidth]);

  const animatedStyle = useAnimatedStyle(() => ({ width: barWidth.value }));

  return <Animated.View style={[styles.bar, { backgroundColor: color }, animatedStyle]} />;
}

function WarningsFlag({ count }: { count: number }) {
  return (
    <View
      style={styles.warningsFlag}
      accessible
      accessibilityLabel={`${count} sequence warning${count === 1 ? '' : 's'}`}
    >
      <View style={styles.warningsCircle}>
        <Ionicons name="alert-circle" size={16} color={palette.rose} />
      </View>
      <AppText variant="caption" color={palette.rose}>
        {count}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: { alignItems: 'flex-start', paddingHorizontal: spacing(1) },

  node: { width: 72, alignItems: 'center' },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: radii.full,
    backgroundColor: palette.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numberBadge: {
    position: 'absolute',
    top: -4,
    left: -4,
    minWidth: 16,
    height: 16,
    borderRadius: radii.full,
    backgroundColor: palette.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.line,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  numberText: { fontSize: 8, lineHeight: 10 },
  nodeName: { marginTop: spacing(1.5), width: 68, textAlign: 'center' },

  connector: {
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: spacing(1),
  },
  connectorLabelSlot: { height: 12, justifyContent: 'center', marginBottom: spacing(0.5) },
  connectorLabel: { fontSize: 9 },
  bar: { height: 4, borderRadius: 2 },

  warningsFlag: { width: 44, alignItems: 'center', marginLeft: spacing(2) },
  warningsCircle: {
    width: 28,
    height: 28,
    borderRadius: radii.full,
    backgroundColor: 'rgba(175,77,60,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
