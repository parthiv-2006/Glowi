import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedProps,
  useAnimatedReaction,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { fonts, motion, palette } from '@/theme';
import { AppText } from './AppText';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

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
  /** What the ring measures, e.g. "Skin score". Falls back to the sublabel. */
  a11yLabel?: string;
}

/**
 * Animated arc ring — skin scores, concern severities, streaks.
 * The number counts up while the arc fills so the metric reads as computed.
 *
 * Under reduce-motion the ring is drawn at its final value with no fill or
 * count-up: the metric is the point, the animation is the decoration.
 */
export function ProgressRing({
  value,
  size = 120,
  strokeWidth = 9,
  color = palette.sage,
  label,
  sublabel,
  delay = 0,
  a11yLabel,
}: ProgressRingProps) {
  const clamped = Math.min(100, Math.max(0, value));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(reduceMotion ? clamped / 100 : 0);
  const [counted, setCounted] = useState(0);
  // Under reduce-motion there is no count-up to read from — the value is simply itself.
  const display = reduceMotion ? clamped : counted;

  useEffect(() => {
    if (reduceMotion) {
      progress.value = clamped / 100;
      return;
    }
    progress.value = withDelay(
      delay + FILL_DELAY,
      withTiming(clamped / 100, { duration: FILL_DURATION, easing: motion.easing }),
    );
  }, [clamped, delay, progress, reduceMotion]);

  useAnimatedReaction(
    () => Math.round(progress.value * clamped),
    (current, previous) => {
      if (current !== previous) runOnJS(setCounted)(current);
    },
  );

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progress.value),
  }));

  return (
    <View
      style={{ width: size, height: size }}
      // One node, not a loose number + orphaned overline: the ring announces as
      // "Skin score, 72%" rather than "72" followed by "SCORE".
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={a11yLabel ?? sublabel}
      accessibilityValue={{ min: 0, max: 100, now: clamped, text: label }}
    >
      <Svg width={size} height={size}>
        {/* Track */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={palette.line}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Soft halo */}
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth + 6}
          strokeLinecap="round"
          fill="none"
          opacity={0.22}
          strokeDasharray={`${circumference} ${circumference}`}
          animatedProps={animatedProps}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        {/* Arc */}
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
          style={{ fontSize: size * 0.26, lineHeight: size * 0.3, fontFamily: fonts.serifMedium }}
          color={palette.ink}
        >
          {label ?? display}
        </AppText>
        {sublabel ? (
          <AppText
            variant="overline"
            style={{ fontSize: Math.max(8, size * 0.075), letterSpacing: 1.5 }}
          >
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
