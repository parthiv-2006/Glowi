import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, Ellipse, Path, RadialGradient, Stop } from 'react-native-svg';

export type GlowiState = 'idle' | 'thinking' | 'scanning' | 'celebrating';

interface GlowiAvatarProps {
  state?: GlowiState;
  size?: number;
}

/**
 * Glowi, the brand mascot — a glossy jade sphere with an expressive face.
 * Always render through this component (never a one-off mascot) so shading
 * and expression stay consistent. See MASCOT_AND_LOGO.md.
 */
export function GlowiAvatar({ state = 'idle', size = 96 }: GlowiAvatarProps) {
  const breath = useSharedValue(0);

  useEffect(() => {
    breath.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2250, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 2250, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
    );
  }, [breath]);

  const sphereStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + breath.value * 0.035 }, { translateY: -breath.value * size * 0.05 }],
  }));

  const haloSize = size * 1.55;

  return (
    <View style={[styles.wrap, { width: haloSize, height: haloSize }]}>
      <View style={[styles.halo, { width: haloSize, height: haloSize }]}>
        <Svg width={haloSize} height={haloSize} viewBox="0 0 100 100">
          <Defs>
            <RadialGradient id="halo" cx="50" cy="50" r="50">
              <Stop offset="0" stopColor="#5EEAD4" stopOpacity={0.5} />
              <Stop offset="0.68" stopColor="#5EEAD4" stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx={50} cy={50} r={50} fill="url(#halo)" />
        </Svg>
      </View>

      <Animated.View style={[styles.sphereWrap, { width: size, height: size }, sphereStyle]}>
        <Sphere size={size} state={state} />
      </Animated.View>

      {state === 'thinking' ? <ThinkingDots size={size} /> : null}
      {state === 'celebrating' ? <Sparkles size={size} /> : null}
    </View>
  );
}

function Sphere({ size, state }: { size: number; state: GlowiState }) {
  const scanLine = useSharedValue(0);

  useEffect(() => {
    if (state !== 'scanning') return;
    scanLine.value = 0;
    scanLine.value = withRepeat(
      withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
      -1,
      false,
    );
  }, [state, scanLine]);

  const scanStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: scanLine.value * size - size / 2 }],
    opacity: 0.55,
  }));

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Defs>
          <RadialGradient id="body" cx="40" cy="34" r="62">
            <Stop offset="0" stopColor="#8FF4E5" />
            <Stop offset="0.26" stopColor="#4FE0CC" />
            <Stop offset="0.5" stopColor="#2DD4BF" />
            <Stop offset="0.74" stopColor="#119C8C" />
            <Stop offset="1" stopColor="#0B6B62" />
          </RadialGradient>
          <RadialGradient id="sheen" cx="38" cy="30" r="26">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.5} />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="bounce" cx="64" cy="88" r="34">
            <Stop offset="0" stopColor="#B4FFF4" stopOpacity={0.42} />
            <Stop offset="1" stopColor="#B4FFF4" stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="innerShadow" cx="70" cy="76" r="48">
            <Stop offset="0" stopColor="#062E29" stopOpacity={0.55} />
            <Stop offset="0.7" stopColor="#062E29" stopOpacity={0} />
          </RadialGradient>
        </Defs>

        <Circle cx={50} cy={50} r={46} fill="url(#body)" />
        <Circle cx={50} cy={50} r={46} fill="url(#innerShadow)" />
        <Circle cx={50} cy={50} r={46} fill="url(#bounce)" />
        <Circle cx={50} cy={50} r={46} fill="url(#sheen)" />

        {/* specular highlight */}
        <Ellipse cx={33} cy={28} rx={14} ry={10} fill="#FFFFFF" opacity={0.22} />
        <Circle cx={30} cy={24} r={3} fill="#FFFFFF" opacity={0.85} />

        <Face state={state} />
      </Svg>

      {state === 'scanning' ? (
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            { borderRadius: size / 2, overflow: 'hidden', pointerEvents: 'none' },
          ]}
        >
          <Animated.View
            style={[
              { position: 'absolute', left: 0, right: 0, height: size * 0.1, top: size / 2 },
              { backgroundColor: '#EAFFFB' },
              scanStyle,
            ]}
          />
        </Animated.View>
      ) : null}
    </View>
  );
}

const FACE_COLOR = '#07332C';
const CHEEK_COLOR = 'rgba(255,122,122,0.28)';
const GLINT_COLOR = '#EAFFFB';

function Face({ state }: { state: GlowiState }) {
  const cheeks = (
    <>
      <Circle cx={32} cy={62} r={5.5} fill={CHEEK_COLOR} />
      <Circle cx={68} cy={62} r={5.5} fill={CHEEK_COLOR} />
    </>
  );

  if (state === 'thinking') {
    return (
      <>
        {cheeks}
        <Ellipse cx={40} cy={46} rx={3.4} ry={4.2} fill={FACE_COLOR} />
        <Ellipse cx={60} cy={44} rx={3.4} ry={4.2} fill={FACE_COLOR} />
        <Circle cx={41} cy={44} r={1} fill={GLINT_COLOR} />
        <Circle cx={61} cy={42} r={1} fill={GLINT_COLOR} />
        <Path
          d="M 47 60 Q 50 62 53 60"
          stroke={FACE_COLOR}
          strokeWidth={2.4}
          strokeLinecap="round"
          fill="none"
        />
      </>
    );
  }

  if (state === 'scanning') {
    return (
      <>
        {cheeks}
        <Path d="M 35 48 L 45 48" stroke={FACE_COLOR} strokeWidth={3} strokeLinecap="round" />
        <Path d="M 55 48 L 65 48" stroke={FACE_COLOR} strokeWidth={3} strokeLinecap="round" />
        <Path d="M 44 60 L 56 60" stroke={FACE_COLOR} strokeWidth={2.4} strokeLinecap="round" />
      </>
    );
  }

  if (state === 'celebrating') {
    return (
      <>
        {cheeks}
        <Path
          d="M 36 48 Q 40 42 44 48"
          stroke={FACE_COLOR}
          strokeWidth={2.6}
          strokeLinecap="round"
          fill="none"
        />
        <Path
          d="M 56 48 Q 60 42 64 48"
          stroke={FACE_COLOR}
          strokeWidth={2.6}
          strokeLinecap="round"
          fill="none"
        />
        <Path d="M 39 58 Q 50 70 61 58 Q 50 64 39 58" fill={FACE_COLOR} />
        <Path
          d="M 47 64 Q 50 68 53 64"
          stroke="#FB7185"
          strokeWidth={2.2}
          strokeLinecap="round"
          fill="none"
        />
      </>
    );
  }

  // idle
  return (
    <>
      {cheeks}
      <Circle cx={40} cy={46} r={3.6} fill={FACE_COLOR} />
      <Circle cx={60} cy={46} r={3.6} fill={FACE_COLOR} />
      <Circle cx={41.3} cy={44.3} r={1.1} fill={GLINT_COLOR} />
      <Circle cx={61.3} cy={44.3} r={1.1} fill={GLINT_COLOR} />
      <Path
        d="M 42 60 Q 50 66 58 60"
        stroke={FACE_COLOR}
        strokeWidth={2.6}
        strokeLinecap="round"
        fill="none"
      />
    </>
  );
}

function ThinkingDots({ size }: { size: number }) {
  return (
    <View style={[styles.dotsRow, { top: -size * 0.18 }]}>
      {[0, 1, 2].map((i) => (
        <Dot key={i} delay={i * 180} />
      ))}
    </View>
  );
}

function Dot({ delay }: { delay: number }) {
  const lift = useSharedValue(0);

  useEffect(() => {
    lift.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 420, easing: Easing.out(Easing.ease) }),
          withTiming(0, { duration: 420, easing: Easing.in(Easing.ease) }),
        ),
        -1,
      ),
    );
  }, [lift, delay]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: -lift.value * 6 }],
    opacity: 0.5 + lift.value * 0.5,
  }));

  return <Animated.View style={[styles.dot, style]} />;
}

function Sparkles({ size }: { size: number }) {
  const specs = [
    { x: 0.08, y: 0.12, d: 0 },
    { x: 0.86, y: 0.2, d: 220 },
    { x: 0.92, y: 0.6, d: 440 },
    { x: 0.04, y: 0.62, d: 320 },
  ];
  return (
    <>
      {specs.map((s, i) => (
        <Sparkle key={i} x={s.x * size} y={s.y * size} delay={s.d} />
      ))}
    </>
  );
}

function Sparkle({ x, y, delay }: { x: number; y: number; delay: number }) {
  const twinkle = useSharedValue(0);

  useEffect(() => {
    twinkle.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 520, easing: Easing.out(Easing.ease) }),
          withTiming(0, { duration: 520, easing: Easing.in(Easing.ease) }),
        ),
        -1,
      ),
    );
  }, [twinkle, delay]);

  const style = useAnimatedStyle(() => ({
    opacity: twinkle.value,
    transform: [{ scale: 0.6 + twinkle.value * 0.6 }],
  }));

  return (
    <Animated.View style={[styles.sparkle, { left: x, top: y }, style]}>
      <Svg width={10} height={10} viewBox="0 0 10 10">
        <Path d="M5 0 L6.2 3.8 L10 5 L6.2 6.2 L5 10 L3.8 6.2 L0 5 L3.8 3.8 Z" fill="#FFD700" />
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  halo: { position: 'absolute' },
  sphereWrap: { alignItems: 'center', justifyContent: 'center' },
  dotsRow: { position: 'absolute', flexDirection: 'row', gap: 4, alignSelf: 'center' },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#5EEAD4',
  },
  sparkle: { position: 'absolute' },
});
