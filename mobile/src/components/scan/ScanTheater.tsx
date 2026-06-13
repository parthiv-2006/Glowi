import { useEffect, useMemo } from 'react';
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
import {
  Easing,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { palette } from '@/theme';

interface ParticleSpec {
  x: number;
  r: number;
  speed: number;
  phase: number;
}

/** One drifting particle — its own component so hooks aren't called in a loop. */
function Particle({ p, drift, height }: { p: ParticleSpec; drift: SharedValue<number>; height: number }) {
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
  /** Stop the sweep once analysis is done (beam parks, grid fades). */
  active?: boolean;
}

const PARTICLE_COUNT = 16;

/**
 * The Skia scan-FX overlay: a measurement grid, drifting particles, corner
 * reticles, and a glowing jade beam that sweeps the captured photo. Drawn on
 * a transparent canvas sized to the photo. This is Glowi's signature moment.
 */
export function ScanTheater({ width, height, active = true }: ScanTheaterProps) {
  const t = useSharedValue(0); // beam sweep 0→1
  const drift = useSharedValue(0); // particle clock

  useEffect(() => {
    t.value = withRepeat(withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.ease) }), -1, false);
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

  // Static measurement grid lines.
  const cols = 6;
  const rows = 8;
  const gridLines = useMemo(() => {
    const lines: { p1: ReturnType<typeof vec>; p2: ReturnType<typeof vec> }[] = [];
    for (let i = 1; i < cols; i++) {
      const x = (width / cols) * i;
      lines.push({ p1: vec(x, 0), p2: vec(x, height) });
    }
    for (let i = 1; i < rows; i++) {
      const y = (height / rows) * i;
      lines.push({ p1: vec(0, y), p2: vec(width, y) });
    }
    return lines;
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
    p.moveTo(m, m + bracket); p.lineTo(m, m); p.lineTo(m + bracket, m);
    // top-right
    p.moveTo(width - m - bracket, m); p.lineTo(width - m, m); p.lineTo(width - m, m + bracket);
    // bottom-left
    p.moveTo(m, height - m - bracket); p.lineTo(m, height - m); p.lineTo(m + bracket, height - m);
    // bottom-right
    p.moveTo(width - m - bracket, height - m); p.lineTo(width - m, height - m); p.lineTo(width - m, height - m - bracket);
    return p;
  }, [width, height]);

  return (
    <Canvas style={{ width, height }} pointerEvents="none">
      {/* grid */}
      <Group opacity={active ? 0.18 : 0.06}>
        {gridLines.map((l, i) => (
          <Line key={i} p1={l.p1} p2={l.p2} color={palette.accentBright} strokeWidth={1} />
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
      <Path path={corners} style="stroke" strokeWidth={2.5} color={palette.accentBright} opacity={0.9} />
    </Canvas>
  );
}
