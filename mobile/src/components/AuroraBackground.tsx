import { useEffect } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import { Blur, Canvas, Circle, Fill, Group } from '@shopify/react-native-skia';
import {
  Easing,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { palette } from '@/theme';

/**
 * Slow-drifting jade aurora behind dark screens — the signature ambient
 * motion of Glowi. GPU-rendered via Skia; purely decorative.
 */
export function AuroraBackground({ intensity = 1 }: { intensity?: number }) {
  const { width, height } = useWindowDimensions();
  const t = useSharedValue(0);

  useEffect(() => {
    t.value = withRepeat(
      withTiming(1, { duration: 14000, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [t]);

  const c1x = useDerivedValue(() => width * 0.28 + Math.sin(t.value * Math.PI * 2) * 50);
  const c1y = useDerivedValue(() => height * 0.22 + Math.cos(t.value * Math.PI * 2) * 40);
  const c2x = useDerivedValue(() => width * 0.78 - Math.cos(t.value * Math.PI * 2) * 60);
  const c2y = useDerivedValue(() => height * 0.34 + Math.sin(t.value * Math.PI * 2) * 50);
  const c3y = useDerivedValue(() => height * 0.7 - Math.sin(t.value * Math.PI * 2) * 40);

  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
      <Fill color={palette.bg} />
      <Group opacity={0.55 * intensity}>
        <Circle cx={c1x} cy={c1y} r={width * 0.5} color={palette.accentDeep}>
          <Blur blur={90} />
        </Circle>
        <Circle cx={c2x} cy={c2y} r={width * 0.42} color="#155E63">
          <Blur blur={100} />
        </Circle>
        <Circle cx={width * 0.5} cy={c3y} r={width * 0.45} color="#0B3A52">
          <Blur blur={110} />
        </Circle>
      </Group>
    </Canvas>
  );
}
