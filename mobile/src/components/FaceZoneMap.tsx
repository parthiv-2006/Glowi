/**
 * FaceZoneMap — a small face silhouette that tints the regions where a scan's
 * concerns were seen, shaded by severity. Purely additive over the model's
 * free-text `areas`: whatever the {@link normalizeArea} mapper can't place is
 * surfaced as an "Also mentioned" caption, and the caller's existing area chips
 * stay untouched, so no model data is ever hidden.
 *
 * SVG house style follows ScoreTrend / ProgressRing (fixed viewBox, per-element
 * animation in a child component to respect hooks rules). Severity is never
 * colour-alone: every legend chip pairs its dot with a severity word.
 */
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Ellipse, Path } from 'react-native-svg';

import { AppText } from '@/components/ui';
import { FACE_ZONES, FACE_ZONE_LABEL, zoneSeverities, type FaceZone } from '@/lib/faceZones';
import type { ScanConcern } from '@/lib/types';
import { motion, palette, severityColor, severityLabel, spacing } from '@/theme';

const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse);

const VIEW_W = 100;
const VIEW_H = 120;

/** Single-path face outline, viewBox units. Selfie-mirror: left = viewer's left. */
const SILHOUETTE =
  'M 50 6 C 27 6 16 25 16 47 C 16 65 22 82 32 95 C 38 103 44 109 50 111 ' +
  'C 56 109 62 103 68 95 C 78 82 84 65 84 47 C 84 25 73 6 50 6 Z';

interface EllipseSpec {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  rotate?: number;
}

/** Each zone is one or two ellipses over the silhouette (viewBox units). */
const ZONE_ELLIPSES: Record<FaceZone, EllipseSpec[]> = {
  forehead: [{ cx: 50, cy: 22, rx: 22, ry: 10 }],
  temples: [
    { cx: 27, cy: 34, rx: 6, ry: 7 },
    { cx: 73, cy: 34, rx: 6, ry: 7 },
  ],
  under_eyes: [
    { cx: 37, cy: 48, rx: 8, ry: 4.5 },
    { cx: 63, cy: 48, rx: 8, ry: 4.5 },
  ],
  nose: [{ cx: 50, cy: 55, rx: 6.5, ry: 12 }],
  left_cheek: [{ cx: 31, cy: 62, rx: 9, ry: 11 }],
  right_cheek: [{ cx: 69, cy: 62, rx: 9, ry: 11 }],
  perioral: [{ cx: 50, cy: 80, rx: 11, ry: 7 }],
  chin: [{ cx: 50, cy: 96, rx: 9, ry: 7 }],
  jawline: [
    { cx: 30, cy: 84, rx: 5.5, ry: 12, rotate: 24 },
    { cx: 70, cy: 84, rx: 5.5, ry: 12, rotate: -24 },
  ],
};

interface ZoneShapeProps {
  zone: FaceZone;
  color: string;
  index: number;
  reduceMotion: boolean;
}

/** One zone's ellipses, fading in to 0.28 fill opacity on a staggered delay. */
function ZoneShape({ zone, color, index, reduceMotion }: ZoneShapeProps) {
  const progress = useSharedValue(reduceMotion ? 1 : 0);

  useEffect(() => {
    if (reduceMotion) {
      progress.value = 1;
      return;
    }
    progress.value = withDelay(
      index * motion.stagger,
      withTiming(1, { duration: motion.base, easing: motion.easing }),
    );
  }, [index, progress, reduceMotion]);

  const animatedProps = useAnimatedProps(() => ({ fillOpacity: progress.value * 0.28 }));

  return (
    <>
      {ZONE_ELLIPSES[zone].map((s, i) => (
        <AnimatedEllipse
          key={i}
          cx={s.cx}
          cy={s.cy}
          rx={s.rx}
          ry={s.ry}
          fill={color}
          stroke={color}
          strokeOpacity={0.85}
          strokeWidth={1}
          animatedProps={animatedProps}
          transform={s.rotate ? `rotate(${s.rotate} ${s.cx} ${s.cy})` : undefined}
        />
      ))}
    </>
  );
}

interface FaceZoneMapProps {
  concerns: ScanConcern[];
  height?: number;
  showLegend?: boolean;
  unmappedLabel?: string;
}

export function FaceZoneMap({
  concerns,
  height = 190,
  showLegend = true,
  unmappedLabel = 'Also mentioned',
}: FaceZoneMapProps) {
  const reduceMotion = useReducedMotion();
  const { zones, unmappedAreas } = zoneSeverities(concerns);

  if (zones.size === 0) return null;

  // Legend order = top → bottom; nose painted last so it sits over the cheeks.
  const active = FACE_ZONES.filter((z) => zones.has(z));
  const drawOrder = [...active.filter((z) => z !== 'nose'), ...active.filter((z) => z === 'nose')];

  const svgWidth = (height * VIEW_W) / VIEW_H;

  // One composed label for the whole map — screen readers get every zone + severity.
  const a11yLabel =
    'Where concerns appear. ' +
    active.map((z) => `${FACE_ZONE_LABEL[z]}: ${severityLabel(zones.get(z)!)}`).join('. ') +
    '.';

  return (
    <View style={styles.container}>
      <View
        style={{ width: svgWidth, height }}
        accessible
        accessibilityRole="image"
        accessibilityLabel={a11yLabel}
      >
        <Svg width={svgWidth} height={height} viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}>
          <Path d={SILHOUETTE} fill={palette.card} stroke={palette.inkFaint} strokeWidth={1.2} />
          {drawOrder.map((zone, i) => (
            <ZoneShape
              key={zone}
              zone={zone}
              color={severityColor(zones.get(zone)!)}
              index={i}
              reduceMotion={reduceMotion}
            />
          ))}
        </Svg>
      </View>

      {showLegend ? (
        <View style={styles.legend}>
          {active.map((zone) => {
            const severity = zones.get(zone)!;
            const label = FACE_ZONE_LABEL[zone];
            const severityText = severityLabel(severity);
            return (
              <View
                key={zone}
                style={styles.chip}
                accessible
                accessibilityLabel={`${label}: ${severityText}`}
              >
                <View style={[styles.dot, { backgroundColor: severityColor(severity) }]} />
                <AppText variant="caption" color={palette.inkSoft}>
                  {`${label} · ${severityText}`}
                </AppText>
              </View>
            );
          })}
        </View>
      ) : null}

      {unmappedAreas.length > 0 ? (
        <AppText variant="caption" color={palette.inkFaint} style={styles.unmapped}>
          {`${unmappedLabel}: ${unmappedAreas.join(', ')}`}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: spacing(3),
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing(2),
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(1.5),
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  unmapped: {
    textAlign: 'center',
  },
});
