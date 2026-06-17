import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedProps,
  useAnimatedReaction,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { motion, palette } from '@/theme';
import { AppText } from './AppText';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// COMPONENT_FIDELITY §5: the reveal ring fills over 1.7s with a 0.35s delay,
// and the number counts up in lockstep over the same window.
const FILL_DURATION = 1700;
const FILL_DELAY = 350;

interface ProgressRingProps {
  /** 0-100 */
  value: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  /** Static center label; when omitted the value counts up from 0. */
  label?: string;
  sublabel?: string;
  delay?: number;
}

/**
 * Animated arc ring — skin scores, concern severities, streaks. The number is
 * never printed statically: it counts up while the arc fills, so the metric
 * reads as *computed*, not asserted (DESIGN_PRINCIPLES §4).
 */
export function ProgressRing({
  value,
  size = 120,
  strokeWidth = 9,
  color = palette.accent,
  label,
  sublabel,
  delay = 0,
}: ProgressRingProps) {
  const clamped = Math.min(100, Math.max(0, value));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = useSharedValue(0);
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    progress.value = withDelay(
      delay + FILL_DELAY,
      withTiming(clamped / 100, { duration: FILL_DURATION, easing: motion.easing }),
    );
  }, [clamped, delay, progress]);

  // Tick the displayed integer only when it actually changes (≤100 updates),
  // keeping the count-up in perfect sync with the dash fill.
  useAnimatedReaction(
    () => Math.round(progress.value * clamped),
    (current, previous) => {
      if (current !== previous) runOnJS(setDisplay)(current);
    },
  );

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progress.value),
  }));

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={palette.surfaceStrong}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Soft halo beneath the crisp arc — cross-platform stand-in for the
            reference's `drop-shadow` glow on the progress stroke. */}
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth + 6}
          strokeLinecap="round"
          fill="none"
          opacity={0.3}
          strokeDasharray={`${circumference} ${circumference}`}
          animatedProps={animatedProps}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          animatedProps={animatedProps}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={styles.center}>
        <AppText
          variant="title"
          style={{ fontSize: size * 0.24, lineHeight: size * 0.3 }}
          color={palette.text}
        >
          {label ?? display}
        </AppText>
        {sublabel ? (
          <AppText variant="caption" style={{ fontSize: Math.max(10, size * 0.085) }}>
            {sublabel}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
