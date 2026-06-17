/**
 * BeforeAfterSlider — Transformation comparison for the Progress tab.
 *
 * When both photo URLs are available: interactive drag-to-reveal photo comparison.
 * Otherwise: side-by-side score-ring tiles with a delta badge.
 */
import { useCallback, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Image } from 'expo-image';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

import { AppText, ProgressRing } from '@/components/ui';
import { palette, radii, scoreColor, spacing } from '@/theme';
import type { Scan } from '@/lib/types';

const HANDLE_SIZE = 44;

export interface BeforeAfterSliderProps {
  beforeScan: Scan;
  afterScan: Scan;
  beforeUrl: string | null;
  afterUrl: string | null;
}

function formatShort(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ─── Score delta row (shared) ────────────────────────────────────────────────

function ScoreDelta({ beforeScan, afterScan }: { beforeScan: Scan; afterScan: Scan }) {
  if (beforeScan.skin_score == null || afterScan.skin_score == null) return null;
  const delta = afterScan.skin_score - beforeScan.skin_score;
  const positive = delta >= 0;
  const days = Math.round(
    (new Date(afterScan.created_at).getTime() - new Date(beforeScan.created_at).getTime()) /
      86_400_000,
  );
  return (
    <View style={styles.deltaRow}>
      <Ionicons
        name={positive ? 'trending-up-outline' : 'trending-down-outline'}
        size={16}
        color={positive ? palette.success : palette.warning}
      />
      <AppText variant="subheading" color={positive ? palette.success : palette.warning}>
        {positive ? '+' : ''}
        {delta} pts over {days} days
      </AppText>
    </View>
  );
}

// ─── Photo drag-to-reveal slider ─────────────────────────────────────────────

function PhotoSlider({
  beforeScan,
  afterScan,
  beforeUrl,
  afterUrl,
}: {
  beforeScan: Scan;
  afterScan: Scan;
  beforeUrl: string;
  afterUrl: string;
}) {
  const sliderX = useSharedValue(0);
  const [ready, setReady] = useState(false);

  const onLayout = useCallback(
    (e: LayoutChangeEvent) => {
      sliderX.value = e.nativeEvent.layout.width * 0.4;
      setReady(true);
    },
    [sliderX],
  );

  const pan = Gesture.Pan().onChange((e) => {
    sliderX.value = Math.max(0, Math.min(sliderX.value + e.changeX, 9999));
  });

  // After-image wrapper clips from sliderX → right edge
  const afterWrapStyle = useAnimatedStyle(() => ({
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: sliderX.value,
    right: 0,
  }));

  // Image inside wrapper shifts left by sliderX so it stays visually aligned with the frame
  const afterImgStyle = useAnimatedStyle(() => ({
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: -sliderX.value,
    right: 0,
  }));

  const dividerStyle = useAnimatedStyle(() => ({
    left: sliderX.value - 1,
  }));

  const handleStyle = useAnimatedStyle(() => ({
    left: sliderX.value - HANDLE_SIZE / 2,
  }));

  return (
    <View style={styles.sliderWrap}>
      <GestureDetector gesture={pan}>
        <View style={styles.frame} onLayout={onLayout}>
          {/* Before image — full frame, bottom layer */}
          <Image source={{ uri: beforeUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />

          {ready && (
            <>
              {/* After image — clipped to the right of the divider */}
              <Animated.View style={[styles.afterWrap, afterWrapStyle]}>
                <Animated.View style={afterImgStyle}>
                  <Image
                    source={{ uri: afterUrl }}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                  />
                </Animated.View>
              </Animated.View>

              {/* Divider line */}
              <Animated.View style={[styles.divider, dividerStyle]} />

              {/* Drag handle */}
              <Animated.View style={[styles.handleWrap, handleStyle]}>
                <View style={styles.handle}>
                  <Ionicons name="chevron-back" size={13} color={palette.bg} />
                  <Ionicons name="chevron-forward" size={13} color={palette.bg} />
                </View>
              </Animated.View>
            </>
          )}

          {/* Corner labels */}
          <View style={[styles.cornerLabel, styles.cornerLabelLeft]}>
            <AppText variant="caption" color={palette.text} style={styles.cornerText}>
              BEFORE
            </AppText>
          </View>
          <View style={[styles.cornerLabel, styles.cornerLabelRight]}>
            <AppText variant="caption" color={palette.text} style={styles.cornerText}>
              AFTER
            </AppText>
          </View>
        </View>
      </GestureDetector>

      <ScoreDelta beforeScan={beforeScan} afterScan={afterScan} />
    </View>
  );
}

// ─── Score-ring tile comparison ───────────────────────────────────────────────

function ScoreTiles({
  beforeScan,
  afterScan,
  beforeUrl,
  afterUrl,
}: {
  beforeScan: Scan;
  afterScan: Scan;
  beforeUrl: string | null;
  afterUrl: string | null;
}) {
  return (
    <View style={styles.tilesWrap}>
      <View style={styles.tilesRow}>
        {/* Before */}
        <Tile scan={beforeScan} url={beforeUrl} />

        <View style={styles.arrowWrap}>
          <Ionicons name="arrow-forward" size={22} color={palette.accentBright} />
        </View>

        {/* After */}
        <Tile scan={afterScan} url={afterUrl} />
      </View>

      <ScoreDelta beforeScan={beforeScan} afterScan={afterScan} />
    </View>
  );
}

function Tile({ scan, url }: { scan: Scan; url: string | null }) {
  return (
    <View style={styles.tile}>
      {url ? (
        <Image source={{ uri: url }} style={styles.tileImage} contentFit="cover" />
      ) : (
        <View style={styles.tilePlaceholder}>
          <ProgressRing
            value={scan.skin_score ?? 0}
            size={72}
            strokeWidth={6}
            color={scoreColor(scan.skin_score ?? 0)}
          />
        </View>
      )}
      <AppText variant="caption" style={styles.tileLabel}>
        {formatShort(scan.created_at)}
      </AppText>
      <AppText variant="overline" color={scoreColor(scan.skin_score ?? 0)}>
        Score {scan.skin_score ?? '—'}
      </AppText>
    </View>
  );
}

// ─── Public component ─────────────────────────────────────────────────────────

export function BeforeAfterSlider({
  beforeScan,
  afterScan,
  beforeUrl,
  afterUrl,
}: BeforeAfterSliderProps) {
  if (beforeUrl && afterUrl) {
    return (
      <PhotoSlider
        beforeScan={beforeScan}
        afterScan={afterScan}
        beforeUrl={beforeUrl}
        afterUrl={afterUrl}
      />
    );
  }
  return (
    <ScoreTiles
      beforeScan={beforeScan}
      afterScan={afterScan}
      beforeUrl={beforeUrl}
      afterUrl={afterUrl}
    />
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Photo slider
  sliderWrap: { gap: spacing(2) },
  frame: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: radii.md,
    overflow: 'hidden',
    backgroundColor: palette.surfaceStrong,
  },
  afterWrap: {
    overflow: 'hidden',
  },
  divider: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: '#fff',
  },
  handleWrap: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: HANDLE_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  handle: {
    width: HANDLE_SIZE,
    height: HANDLE_SIZE,
    borderRadius: HANDLE_SIZE / 2,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 1,
    boxShadow: '0px 2px 8px rgba(0,0,0,0.25)',
  },
  cornerLabel: {
    position: 'absolute',
    top: spacing(3),
    paddingHorizontal: spacing(2.5),
    paddingVertical: spacing(1),
    borderRadius: radii.full,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  cornerLabelLeft: { left: spacing(3) },
  cornerLabelRight: { right: spacing(3) },
  cornerText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },

  // Delta
  deltaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2),
    justifyContent: 'center',
    paddingTop: spacing(1),
  },

  // Score tiles
  tilesWrap: { gap: spacing(3) },
  tilesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
  },
  tile: {
    flex: 1,
    alignItems: 'center',
    gap: spacing(1.5),
  },
  tileImage: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: radii.md,
    backgroundColor: palette.surfaceStrong,
  },
  tilePlaceholder: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: radii.md,
    backgroundColor: palette.surfaceStrong,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
  },
  tileLabel: { textAlign: 'center' },
  arrowWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: spacing(7),
  },
});
