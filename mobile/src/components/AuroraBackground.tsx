import { useEffect } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import { Blur, Canvas, Circle, Fill, Group } from '@shopify/react-native-skia';
import {
  Easing,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { palette } from '@/theme';

/**
 * Slow-drifting clay aurora behind dark screens — the signature ambient
 * motion of Glowi. GPU-rendered via Skia; purely decorative.
 *
 * Under reduce-motion the drift stops and the blobs hold at their mid-cycle
 * position, so the screen keeps its warmth without the perpetual movement.
 */
export function AuroraBackground({ intensity = 1 }: { intensity?: number }) {
  const { width, height } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const t = useSharedValue(reduceMotion ? 0.5 : 0);

  useEffect(() => {
    if (reduceMotion) {
      t.value = 0.5;
      return;
    }
    t.value = withRepeat(
      withTiming(1, { duration: 14000, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [t, reduceMotion]);

  const c1x = useDerivedValue(() => width * 0.28 + Math.sin(t.value * Math.PI * 2) * 50);
  const c1y = useDerivedValue(() => height * 0.22 + Math.cos(t.value * Math.PI * 2) * 40);
  const c2x = useDerivedValue(() => width * 0.78 - Math.cos(t.value * Math.PI * 2) * 60);
  const c2y = useDerivedValue(() => height * 0.34 + Math.sin(t.value * Math.PI * 2) * 50);
  const c3y = useDerivedValue(() => height * 0.7 - Math.sin(t.value * Math.PI * 2) * 40);

  return (
    <Canvas style={[StyleSheet.absoluteFill, { pointerEvents: 'none' }]}>
      <Fill color={palette.bg} />
      <Group opacity={0.55 * intensity}>
        <Circle cx={c1x} cy={c1y} r={width * 0.5} color={palette.clayDeep}>
          <Blur blur={90} />
        </Circle>
        <Circle cx={c2x} cy={c2y} r={width * 0.42} color="#7A3A1A">
          <Blur blur={100} />
        </Circle>
        <Circle cx={width * 0.5} cy={c3y} r={width * 0.45} color="#4A1E0A">
          <Blur blur={110} />
        </Circle>
      </Group>
    </Canvas>
  );
}
