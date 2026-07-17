/**
 * CorrelationChart — a mini before/after line chart under a correlation
 * insight's headline on the Progress tab. The dashed run-in shows the metric
 * before the routine-change event, the solid direction-coloured segment shows
 * it after, a clay pin marks the event itself, and a signed delta annotates
 * the last point. Direction is never colour alone: the row's Badge and the
 * signed number carry it redundantly.
 *
 * SVG house style follows ScoreTrend (onLayout width, fixed height, pure
 * toX/toY mappers) with one deliberate divergence: the Y domain hugs the data
 * ([min−8, max+8] clamped to 0–100) so a 10-point move doesn't flatten.
 */
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Line, Path, Polyline, Text as SvgText } from 'react-native-svg';

import { AppText } from '@/components/ui';
import type { CorrelationInsight } from '@/lib/correlation';
import { insightSeries, polylineLength } from '@/lib/correlationSeries';
import type { ChangeDirection, Scan } from '@/lib/types';
import { motion, palette, spacing } from '@/theme';

const AnimatedPath = Animated.createAnimatedComponent(Path);

const CHART_HEIGHT = 118;
const PAD_X = 30;
const PAD_Y = 16;
const DRAW_DELAY = 150;

const DIRECTION_COLOR: Record<ChangeDirection, string> = {
  improved: palette.sage,
  worsened: palette.rose,
  unchanged: palette.inkSoft,
};

interface DrawnAfterPathProps {
  d: string;
  length: number;
  color: string;
  reduceMotion: boolean;
}

/** The after segment, drawing itself on via a dash-offset sweep. */
function DrawnAfterPath({ d, length, color, reduceMotion }: DrawnAfterPathProps) {
  const offset = useSharedValue(reduceMotion ? 0 : length);

  useEffect(() => {
    if (reduceMotion) {
      offset.value = 0;
      return;
    }
    offset.value = length;
    offset.value = withDelay(
      DRAW_DELAY,
      withTiming(0, { duration: motion.slow, easing: motion.easing }),
    );
  }, [length, offset, reduceMotion]);

  const animatedProps = useAnimatedProps(() => ({ strokeDashoffset: offset.value }));

  return (
    <AnimatedPath
      d={d}
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeDasharray={`${length} ${length}`}
      animatedProps={animatedProps}
    />
  );
}

interface CorrelationChartProps {
  insight: CorrelationInsight;
  scans: Scan[];
  height?: number;
}

export function CorrelationChart({ insight, scans, height = CHART_HEIGHT }: CorrelationChartProps) {
  const reduceMotion = useReducedMotion();
  const [width, setWidth] = useState(0);
  const series = useMemo(() => insightSeries(insight, scans), [insight, scans]);

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  if (!series) return null;
  if (!width) return <View style={{ height }} onLayout={onLayout} />;

  const { points, eventIndex, concernName, delta } = series;
  const directionColor = DIRECTION_COLOR[insight.direction];

  const plotW = width - PAD_X * 2;
  const plotH = height - PAD_Y * 2;

  // Dynamic Y domain hugging the data so small movements stay visible.
  const values = points.map((p) => p.value);
  const domainMin = Math.max(0, Math.min(...values) - 8);
  const domainMax = Math.min(100, Math.max(...values) + 8);
  const toY = (v: number) => PAD_Y + plotH - ((v - domainMin) / (domainMax - domainMin)) * plotH;
  const toX = (i: number) => PAD_X + (i / (points.length - 1)) * plotW;

  const xy = points.map((p, i) => ({ x: toX(i), y: toY(p.value) }));
  const beforePts = xy.slice(0, eventIndex + 1);
  const afterPts = xy.slice(eventIndex); // shares the baseline point
  const hasAfter = afterPts.length >= 2;
  const afterD = afterPts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const afterLen = polylineLength(afterPts);

  // Event pin between the baseline and the first after-scan.
  const markerX = hasAfter ? (xy[eventIndex].x + xy[eventIndex + 1].x) / 2 : xy[eventIndex].x;

  const last = xy[xy.length - 1];
  const deltaLabelY = last.y > PAD_Y + 14 ? last.y - 10 : last.y + 18;
  const deltaText = `${delta >= 0 ? '+' : '−'}${Math.abs(delta)}`;

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  const a11yLabel =
    `${concernName ?? 'Skin score'} went from ${points[eventIndex].value} ` +
    `to ${points[points.length - 1].value} after ${insight.event.label}`;

  return (
    <View style={styles.container}>
      <View
        style={{ width: '100%', height }}
        onLayout={onLayout}
        accessible
        accessibilityRole="image"
        accessibilityLabel={a11yLabel}
      >
        <Svg width={width} height={height}>
          {/* Axis bounds */}
          <SvgText
            x={PAD_X - 6}
            y={PAD_Y + 4}
            fontSize={9}
            fill={palette.inkFaint}
            textAnchor="end"
          >
            {domainMax}
          </SvgText>
          <SvgText
            x={PAD_X - 6}
            y={PAD_Y + plotH + 4}
            fontSize={9}
            fill={palette.inkFaint}
            textAnchor="end"
          >
            {domainMin}
          </SvgText>

          {/* Before run-in */}
          {beforePts.length >= 2 && (
            <Polyline
              points={beforePts.map((p) => `${p.x},${p.y}`).join(' ')}
              fill="none"
              stroke={palette.inkFaint}
              strokeWidth={2}
              strokeDasharray="4 4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Event pin */}
          <Line
            x1={markerX}
            y1={PAD_Y}
            x2={markerX}
            y2={PAD_Y + plotH}
            stroke={palette.clay}
            strokeWidth={1}
            strokeDasharray="3 3"
          />
          <Circle cx={markerX} cy={PAD_Y} r={3} fill={palette.clay} />

          {/* After segment, drawn on */}
          {hasAfter && (
            <DrawnAfterPath
              d={afterD}
              length={afterLen}
              color={directionColor}
              reduceMotion={reduceMotion}
            />
          )}

          {/* Signed delta at the last point */}
          <SvgText
            x={last.x}
            y={deltaLabelY}
            fontSize={10}
            fill={directionColor}
            textAnchor="middle"
            fontWeight="600"
          >
            {deltaText}
          </SvgText>

          {/* First / last dates */}
          <SvgText
            x={xy[0].x}
            y={height - 3}
            fontSize={9}
            fill={palette.inkFaint}
            textAnchor="middle"
          >
            {formatDate(points[0].date)}
          </SvgText>
          <SvgText
            x={last.x}
            y={height - 3}
            fontSize={9}
            fill={palette.inkFaint}
            textAnchor="middle"
          >
            {formatDate(points[points.length - 1].date)}
          </SvgText>
        </Svg>
      </View>

      <View style={styles.legend}>
        {beforePts.length >= 2 && (
          <View style={styles.legendItem}>
            <Svg width={24} height={8}>
              <Line
                x1={1}
                y1={4}
                x2={23}
                y2={4}
                stroke={palette.inkFaint}
                strokeWidth={2}
                strokeDasharray="4 4"
                strokeLinecap="round"
              />
            </Svg>
            <AppText variant="caption" color={palette.inkSoft}>
              before
            </AppText>
          </View>
        )}
        {hasAfter && (
          <View style={styles.legendItem}>
            <Svg width={24} height={8}>
              <Line
                x1={1}
                y1={4}
                x2={23}
                y2={4}
                stroke={directionColor}
                strokeWidth={2}
                strokeLinecap="round"
              />
            </Svg>
            <AppText variant="caption" color={palette.inkSoft}>
              after · {insight.direction}
            </AppText>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing(1.5), marginTop: spacing(1) },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing(3),
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(1.5),
  },
});
