import { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Blur,
  Canvas,
  Circle,
  Group,
  Line,
  LinearGradient,
  Path,
  Rect,
  Skia,
  vec,
} from '@shopify/react-native-skia';
import type { SharedValue } from 'react-native-reanimated';
import Animated, {
  Easing,
  FadeIn,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { AppText } from '@/components/ui';
import { palette, radii, severityColor, spacing } from '@/theme';

export interface ScanZone {
  /** e.g. "Congestion · 52" or "Hydration · good". */
  label: string;
  /** Severity 0-100 for tinting, or omit for a neutral/success pill. */
  severity?: number;
  /** Normalized position within the frame, 0-1. */
  x: number;
  y: number;
  /** Stagger delay before this pill pops in (ms). */
  delay?: number;
}

interface ParticleSpec {
  x: number;
  r: number;
  speed: number;
  phase: number;
}

/** One drifting particle — its own component so hooks aren't called in a loop. */
function Particle({
  p,
  drift,
  height,
}: {
  p: ParticleSpec;
  drift: SharedValue<number>;
  height: number;
}) {
  const cy = useDerivedValue(() => {
    const prog = (drift.value * p.speed + p.phase) % 1;
    return height - prog * height;
  });
  const op = useDerivedValue(() => {
    const prog = (drift.value * p.speed + p.phase) % 1;
    return Math.sin(prog * Math.PI);
  });
  return <Circle cx={p.x} cy={cy} r={p.r} color={palette.accentBright} opacity={op} />;
}

interface ScanTheaterProps {
  width: number;
  height: number;
  /** Stop the sweep once analysis is done (beam parks, mesh fades). */
  active?: boolean;
  /** Detected-zone callout pills that pop in over the face mesh. */
  zones?: ScanZone[];
}

const PARTICLE_COUNT = 16;

/** One pulsing mesh node — breathing opacity + radius, its own component so hooks aren't called in a loop. */
function MeshNode({
  x,
  y,
  drift,
  phase,
}: {
  x: number;
  y: number;
  drift: SharedValue<number>;
  phase: number;
}) {
  const r = useDerivedValue(() => {
    const pulse = (Math.sin((drift.value * 2 + phase) * Math.PI * 2) + 1) / 2;
    return 2 + pulse * 1.6;
  });
  const opacity = useDerivedValue(() => {
    const pulse = (Math.sin((drift.value * 2 + phase) * Math.PI * 2) + 1) / 2;
    return 0.45 + pulse * 0.45;
  });
  return <Circle cx={x} cy={y} r={r} color={palette.accentBright} opacity={opacity} />;
}

/**
 * The Skia scan-FX overlay: a triangulated face-mapping mesh with pulsing
 * nodes, drifting particles, corner reticles, a glowing jade beam that sweeps
 * the captured photo, and detected-zone callout pills. Drawn on a
 * transparent canvas sized to the photo. This is Glowi's signature moment.
 */
export function ScanTheater({ width, height, active = true, zones = [] }: ScanTheaterProps) {
  const t = useSharedValue(0); // beam sweep 0→1
  const drift = useSharedValue(0); // particle clock

  useEffect(() => {
    t.value = withRepeat(
      withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.ease) }),
      -1,
      false,
    );
    drift.value = withRepeat(withTiming(1, { duration: 4200, easing: Easing.linear }), -1, false);
  }, [t, drift]);

  const beamY = useDerivedValue(() => t.value * height);
  const beamOpacity = useDerivedValue(() => {
    // fade the beam in/out at the travel extremes
    const edge = Math.min(t.value, 1 - t.value) * 4;
    return Math.min(1, edge) * (active ? 1 : 0.15);
  });
  const beamTop = useDerivedValue(() => beamY.value - 24);
  const trailTop = useDerivedValue(() => beamY.value - 120);

  // Triangulated face-mapping mesh: a jittered grid of nodes, each connected
  // to its right/down/diagonal neighbor so the lines read as triangles.
  const cols = 6;
  const rows = 7;
  const { meshNodes, meshLines } = useMemo(() => {
    const nodes: { x: number; y: number }[][] = [];
    for (let r = 0; r <= rows; r++) {
      const row: { x: number; y: number }[] = [];
      for (let c = 0; c <= cols; c++) {
        const jitterX = (Math.random() - 0.5) * (width / cols) * 0.3;
        const jitterY = (Math.random() - 0.5) * (height / rows) * 0.3;
        row.push({
          x: (width / cols) * c + jitterX,
          y: (height / rows) * r + jitterY,
        });
      }
      nodes.push(row);
    }
    const lines: { p1: ReturnType<typeof vec>; p2: ReturnType<typeof vec> }[] = [];
    for (let r = 0; r <= rows; r++) {
      for (let c = 0; c <= cols; c++) {
        const n = nodes[r][c];
        if (c < cols)
          lines.push({ p1: vec(n.x, n.y), p2: vec(nodes[r][c + 1].x, nodes[r][c + 1].y) });
        if (r < rows)
          lines.push({ p1: vec(n.x, n.y), p2: vec(nodes[r + 1][c].x, nodes[r + 1][c].y) });
        if (r < rows && c < cols) {
          lines.push({ p1: vec(n.x, n.y), p2: vec(nodes[r + 1][c + 1].x, nodes[r + 1][c + 1].y) });
        }
      }
    }
    return { meshNodes: nodes.flat(), meshLines: lines };
  }, [width, height]);

  const particles = useMemo<ParticleSpec[]>(
    () =>
      Array.from({ length: PARTICLE_COUNT }).map(() => ({
        x: Math.random() * width,
        r: 1 + Math.random() * 2.5,
        speed: 0.4 + Math.random() * 0.8,
        phase: Math.random(),
      })),
    [width],
  );

  // Corner reticle brackets.
  const bracket = 26;
  const corners = useMemo(() => {
    const p = Skia.Path.Make();
    const m = 6;
    // top-left
    p.moveTo(m, m + bracket);
    p.lineTo(m, m);
    p.lineTo(m + bracket, m);
    // top-right
    p.moveTo(width - m - bracket, m);
    p.lineTo(width - m, m);
    p.lineTo(width - m, m + bracket);
    // bottom-left
    p.moveTo(m, height - m - bracket);
    p.lineTo(m, height - m);
    p.lineTo(m + bracket, height - m);
    // bottom-right
    p.moveTo(width - m - bracket, height - m);
    p.lineTo(width - m, height - m);
    p.lineTo(width - m, height - m - bracket);
    return p;
  }, [width, height]);

  return (
    <View style={{ width, height, pointerEvents: 'none' }}>
      <Canvas style={{ width, height }}>
        {/* face-mapping mesh */}
        <Group opacity={active ? 0.22 : 0.06}>
          {meshLines.map((l, i) => (
            <Line key={i} p1={l.p1} p2={l.p2} color={palette.accentBright} strokeWidth={1} />
          ))}
          {meshNodes.map((n, i) => (
            <MeshNode key={i} x={n.x} y={n.y} drift={drift} phase={(i % 7) / 7} />
          ))}
        </Group>

        {/* particles */}
        <Group opacity={active ? 0.7 : 0.2}>
          {particles.map((p, i) => (
            <Particle key={i} p={p} drift={drift} height={height} />
          ))}
        </Group>

        {/* sweep trail */}
        <Group opacity={beamOpacity}>
          <Rect x={0} y={trailTop} width={width} height={120}>
            <LinearGradient
              start={vec(0, 0)}
              end={vec(0, 120)}
              colors={['rgba(45,212,191,0)', 'rgba(45,212,191,0.18)']}
            />
          </Rect>
          {/* the beam */}
          <Rect x={0} y={beamTop} width={width} height={3} color={palette.accentBright}>
            <Blur blur={2} />
          </Rect>
          <Rect x={0} y={beamTop} width={width} height={48} opacity={0.5}>
            <LinearGradient
              start={vec(0, 0)}
              end={vec(0, 48)}
              colors={['rgba(94,234,212,0.5)', 'rgba(94,234,212,0)']}
            />
            <Blur blur={6} />
          </Rect>
        </Group>

        {/* corner reticles */}
        <Path
          path={corners}
          style="stroke"
          strokeWidth={2.5}
          color={palette.accentBright}
          opacity={0.9}
        />
      </Canvas>

      {/* detected-zone callout pills */}
      {zones.map((z, i) => (
        <ZonePill key={i} zone={z} width={width} height={height} />
      ))}
    </View>
  );
}

function ZonePill({ zone, width, height }: { zone: ScanZone; width: number; height: number }) {
  const color = zone.severity != null ? severityColor(zone.severity) : palette.success;
  return (
    <Animated.View
      entering={FadeIn.delay(zone.delay ?? 0).duration(320)}
      style={[
        styles.pill,
        {
          left: zone.x * width,
          top: zone.y * height,
          borderColor: `${color}55`,
          backgroundColor: 'rgba(7,9,11,0.78)',
        },
      ]}
    >
      <View style={[styles.pillDot, { backgroundColor: color }]} />
      <AppText variant="caption" color={palette.text} style={styles.pillText}>
        {zone.label}
      </AppText>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pill: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(1.5),
    paddingHorizontal: spacing(2.5),
    paddingVertical: spacing(1.25),
    borderRadius: radii.full,
    borderWidth: StyleSheet.hairlineWidth,
  },
  pillDot: { width: 6, height: 6, borderRadius: 3 },
  pillText: { fontSize: 11.5 },
});
