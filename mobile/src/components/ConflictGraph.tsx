/**
 * ConflictGraph — a small force-free network of the user's shelf products and
 * the interactions between them, drawn above the existing conflict cards on the
 * shelf → conflicts screen. Products are nodes on a circle; each conflict's
 * products are joined by an edge whose colour, dash pattern, and legend entry
 * all encode the severity (never colour alone). Tapping an edge or a node
 * selects the matching conflict, which the caller scrolls to and highlights.
 *
 * SVG house style follows ScoreTrend / ProgressRing (onLayout width, fixed
 * height, per-element animation in a child component to respect hooks rules).
 * The graph is a visual index over the cards — never the source of truth — so
 * zero-product conflicts stay visible as cards and are simply absent here.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, G, Line, Path, Text as SvgText } from 'react-native-svg';

import { AppText } from '@/components/ui';
import {
  buildConflictGraph,
  truncateLabel,
  type ConflictEdge,
  type ConflictNode,
} from '@/lib/conflictGraph';
import type { ConflictReport, ConflictSeverity } from '@/lib/types';
import { motion, palette, spacing } from '@/theme';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedG = Animated.createAnimatedComponent(G);

/** Edge/self-ring colour per severity. `time_of_day` is `clay`, not `accentBright`. */
const SEVERITY_COLOR: Record<ConflictSeverity, string> = {
  avoid: palette.rose,
  caution: palette.ochre,
  time_of_day: palette.clay,
};
/** Dash pattern per severity — the redundancy that carries severity without colour. */
const SEVERITY_DASH: Record<ConflictSeverity, string | undefined> = {
  avoid: undefined, // solid
  caution: '6 4',
  time_of_day: '2 4',
};
const SEVERITY_WIDTH: Record<ConflictSeverity, number> = {
  avoid: 2.5,
  caution: 2,
  time_of_day: 2,
};
const SEVERITY_LEGEND: Record<ConflictSeverity, string> = {
  avoid: 'Avoid together',
  caution: 'Use with caution',
  time_of_day: 'Time of day',
};
/** Worst-first rank — picks the self-ring colour when a node has several self-conflicts. */
const SEVERITY_RANK: Record<ConflictSeverity, number> = {
  time_of_day: 0,
  caution: 1,
  avoid: 2,
};
/** Legend / a11y ordering, worst first. */
const SEVERITY_ORDER: ConflictSeverity[] = ['avoid', 'caution', 'time_of_day'];

const PAD = 34;
const LABEL_PAD = 20;
const NODE_R = 16;
const SELF_RING_R = 20;
const EDGE_STAGGER = 60;

/** A straight line, or a bowed quadratic bézier for duplicate same-pair edges. */
function edgePath(
  a: { x: number; y: number },
  b: { x: number; y: number },
  parallelIndex: number,
): string {
  if (parallelIndex === 0) return `M ${a.x} ${a.y} L ${b.x} ${b.y}`;
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  // Perpendicular unit vector, alternating side, growing with the parallel index.
  const sign = parallelIndex % 2 === 1 ? 1 : -1;
  const mag = 8 * parallelIndex;
  const cx = mx + (-dy / len) * mag * sign;
  const cy = my + (dx / len) * mag * sign;
  return `M ${a.x} ${a.y} Q ${cx} ${cy} ${b.x} ${b.y}`;
}

interface DrawEdgeProps {
  d: string;
  color: string;
  dash?: string;
  width: number;
  /** Selection dimming applied on top of the draw-on fade. */
  dimOpacity: number;
  index: number;
  reduceMotion: boolean;
  onPress: () => void;
}

/** One edge, drawing itself in on a staggered fade; a fat invisible copy is the hit target. */
function DrawEdge({
  d,
  color,
  dash,
  width,
  dimOpacity,
  index,
  reduceMotion,
  onPress,
}: DrawEdgeProps) {
  const progress = useSharedValue(reduceMotion ? 1 : 0);

  useEffect(() => {
    if (reduceMotion) {
      progress.value = 1;
      return;
    }
    progress.value = withDelay(
      index * EDGE_STAGGER,
      withTiming(1, { duration: motion.base, easing: motion.easing }),
    );
  }, [index, progress, reduceMotion]);

  const animatedProps = useAnimatedProps(() => ({ opacity: progress.value * dimOpacity }));

  return (
    <>
      <AnimatedPath
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={width}
        strokeDasharray={dash}
        strokeLinecap="round"
        animatedProps={animatedProps}
      />
      {/* Fat transparent hit target. Touch-only: a screen reader lands on the whole-graph
          summary and reads the cards below, so these press targets need not be reachable. */}
      <Path d={d} fill="none" stroke="transparent" strokeWidth={16} onPress={onPress} />
    </>
  );
}

interface ConflictGraphProps {
  report: ConflictReport;
  selectedConflict: number | null;
  onSelectConflict: (index: number) => void;
  height?: number;
}

export function ConflictGraph({
  report,
  selectedConflict,
  onSelectConflict,
  height = 240,
}: ConflictGraphProps) {
  const reduceMotion = useReducedMotion();
  const [width, setWidth] = useState(0);
  const model = useMemo(() => buildConflictGraph(report), [report]);
  // Last conflict a node cycled to, so repeated taps walk through its interactions.
  const nodeCursor = useRef<Record<string, number>>({});

  // Nodes fade in as a group once the edges have finished drawing.
  const nodesOpacity = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    if (reduceMotion) {
      nodesOpacity.value = 1;
      return;
    }
    nodesOpacity.value = withDelay(
      model.edges.length * EDGE_STAGGER + 80,
      withTiming(1, { duration: motion.base, easing: motion.easing }),
    );
  }, [model.edges.length, nodesOpacity, reduceMotion]);
  const nodesAnimatedProps = useAnimatedProps(() => ({ opacity: nodesOpacity.value }));

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  if (model.nodes.length < 2 || model.edges.length === 0) return null;
  if (!width) return <View style={{ height }} onLayout={onLayout} />;

  const plotW = width - PAD * 2;
  const plotH = height - PAD - LABEL_PAD;
  const toX = (nx: number) => PAD + nx * plotW;
  const toY = (ny: number) => PAD + ny * plotH;
  const nodeById = new Map(model.nodes.map((node) => [node.id, node]));

  const handleNodePress = (node: ConflictNode) => {
    if (node.conflictIndices.length === 0) return;
    const cursor = nodeCursor.current[node.id] ?? -1;
    const next = (cursor + 1) % node.conflictIndices.length;
    nodeCursor.current[node.id] = next;
    onSelectConflict(node.conflictIndices[next]);
  };

  const dimFor = (conflictIndex: number) =>
    selectedConflict === null || selectedConflict === conflictIndex ? 1 : 0.35;
  const widthFor = (edge: ConflictEdge) =>
    selectedConflict === edge.conflictIndex ? 3.5 : SEVERITY_WIDTH[edge.severity];

  const present = SEVERITY_ORDER.filter(
    (sev) =>
      model.edges.some((edge) => edge.severity === sev) ||
      model.nodes.some((node) => node.selfSeverities.includes(sev)),
  );

  // One composed summary for the whole graph; the cards below carry the detail.
  const counts = SEVERITY_ORDER.map(
    (sev) => [sev, report.conflicts.filter((c) => c.severity === sev).length] as const,
  ).filter(([, count]) => count > 0);
  const total = report.conflicts.length;
  const breakdown = counts.map(([sev, count]) => `${count} ${sev.replace(/_/g, ' ')}`).join(', ');
  const a11yLabel =
    `Conflict map: ${model.nodes.length} products, ` +
    `${total} ${total === 1 ? 'interaction' : 'interactions'}` +
    (breakdown ? `: ${breakdown}` : '') +
    '.';

  return (
    <View style={styles.container}>
      <View
        style={{ width: '100%', height }}
        onLayout={onLayout}
        // One accessible node for the whole graph — the SVG press targets are touch-only.
        accessible
        accessibilityRole="image"
        accessibilityLabel={a11yLabel}
        accessibilityHint="Interactions are listed in detail below."
      >
        <Svg width={width} height={height}>
          {model.edges.map((edge, i) => {
            const a = nodeById.get(edge.from)!;
            const b = nodeById.get(edge.to)!;
            const d = edgePath(
              { x: toX(a.x), y: toY(a.y) },
              { x: toX(b.x), y: toY(b.y) },
              edge.parallelIndex,
            );
            return (
              <DrawEdge
                key={`${edge.from}-${edge.to}-${edge.conflictIndex}`}
                d={d}
                color={SEVERITY_COLOR[edge.severity]}
                dash={SEVERITY_DASH[edge.severity]}
                width={widthFor(edge)}
                dimOpacity={dimFor(edge.conflictIndex)}
                index={i}
                reduceMotion={reduceMotion}
                onPress={() => onSelectConflict(edge.conflictIndex)}
              />
            );
          })}

          <AnimatedG animatedProps={nodesAnimatedProps}>
            {model.nodes.map((node) => {
              const x = toX(node.x);
              const y = toY(node.y);
              const worstSelf = node.selfSeverities.length
                ? [...node.selfSeverities].sort(
                    (s1, s2) => SEVERITY_RANK[s2] - SEVERITY_RANK[s1],
                  )[0]
                : null;
              return (
                <G key={node.id}>
                  {worstSelf ? (
                    <Circle
                      cx={x}
                      cy={y}
                      r={SELF_RING_R}
                      fill="none"
                      stroke={SEVERITY_COLOR[worstSelf]}
                      strokeWidth={1.5}
                      strokeDasharray={SEVERITY_DASH[worstSelf]}
                    />
                  ) : null}
                  <Circle
                    cx={x}
                    cy={y}
                    r={NODE_R}
                    fill={palette.card}
                    stroke={palette.lineStrong}
                    strokeWidth={1.5}
                  />
                  <SvgText
                    x={x}
                    y={y + NODE_R + 12}
                    fontSize={9}
                    fill={palette.inkSoft}
                    textAnchor="middle"
                  >
                    {truncateLabel(node.label)}
                  </SvgText>
                  <Circle
                    cx={x}
                    cy={y}
                    r={SELF_RING_R + 4}
                    fill="transparent"
                    onPress={() => handleNodePress(node)}
                  />
                </G>
              );
            })}
          </AnimatedG>
        </Svg>
      </View>

      <View style={styles.legend}>
        {present.map((sev) => (
          <View
            key={sev}
            style={styles.legendItem}
            accessible
            accessibilityLabel={SEVERITY_LEGEND[sev]}
          >
            <Svg width={24} height={8}>
              <Line
                x1={1}
                y1={4}
                x2={23}
                y2={4}
                stroke={SEVERITY_COLOR[sev]}
                strokeWidth={2.5}
                strokeDasharray={SEVERITY_DASH[sev]}
                strokeLinecap="round"
              />
            </Svg>
            <AppText variant="caption" color={palette.inkSoft}>
              {SEVERITY_LEGEND[sev]}
            </AppText>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing(3) },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing(3),
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(1.5),
  },
});
