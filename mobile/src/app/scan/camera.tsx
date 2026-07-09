import { useCallback, useRef, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { CameraView, useCameraPermissions, type CameraType } from 'expo-camera';
import { AlphaType, ColorType, FilterMode, MipmapMode, Skia } from '@shopify/react-native-skia';
import Svg, { Defs, Ellipse, Line, Mask, Rect } from 'react-native-svg';

import { AppText, GlowButton, PressableScale } from '@/components/ui';
import { assessCapture, captureQualityMessage, type CaptureQuality } from '@/lib/captureQuality';
import { haptics } from '@/lib/haptics';
import type { CaptureMeta } from '@/lib/types';
import { motion, palette, radii, spacing } from '@/theme';

/**
 * Guided scan capture — in-app front camera with a fixed face-alignment overlay
 * and a post-capture lighting check. Consistent framing + light make the trend
 * features (before/after, sparklines, WS3's coach correlations) honest.
 *
 * Web degrades to the library picker: see camera.web.tsx. The Skia pixel read
 * and CameraView here are native-only.
 */

/** Version of the alignment-overlay geometry; recorded in capture_meta so trends
 *  can tell which guidance the photo was framed against. Bump on geometry change. */
export const OVERLAY_VERSION = 1;

const DOWNSCALE_W = 48;
const DOWNSCALE_H = 60; // 4:5, matching the scan frame

/** Decode → downscale (≤64px) → assess. Returns null if Skia can't read the file. */
async function assessUri(uri: string): Promise<CaptureQuality | null> {
  try {
    const data = await Skia.Data.fromURI(uri);
    const image = Skia.Image.MakeImageFromEncoded(data);
    if (!image) return null;
    const surface = Skia.Surface.Make(DOWNSCALE_W, DOWNSCALE_H);
    if (!surface) return null;
    surface
      .getCanvas()
      .drawImageRectOptions(
        image,
        Skia.XYWHRect(0, 0, image.width(), image.height()),
        Skia.XYWHRect(0, 0, DOWNSCALE_W, DOWNSCALE_H),
        FilterMode.Linear,
        MipmapMode.None,
      );
    const pixels = surface.makeImageSnapshot().readPixels(0, 0, {
      width: DOWNSCALE_W,
      height: DOWNSCALE_H,
      colorType: ColorType.RGBA_8888,
      alphaType: AlphaType.Unpremul,
    });
    if (!(pixels instanceof Uint8Array)) return null;
    return assessCapture(pixels, DOWNSCALE_W, DOWNSCALE_H);
  } catch {
    return null;
  }
}

export default function GuidedCamera() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { area } = useLocalSearchParams<{ area?: string }>();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [facing, setFacing] = useState<CameraType>('front');
  const [frame, setFrame] = useState({ width: 0, height: 0 });
  const [busy, setBusy] = useState(false);
  const [review, setReview] = useState<{ uri: string; quality: CaptureQuality | null } | null>(
    null,
  );

  const proceed = useCallback(
    (uri: string, quality: CaptureQuality | null) => {
      const captureMeta: CaptureMeta = {
        guided: true,
        overlay_version: OVERLAY_VERSION,
        mean_luminance: quality ? Math.round(quality.meanLuminance) : null,
        verdict: quality ? quality.verdict : null,
      };
      router.replace({
        pathname: '/scan/analyzing',
        params: { uri, area: area ?? '', meta: JSON.stringify(captureMeta) },
      });
    },
    [router, area],
  );

  const capture = useCallback(async () => {
    if (!cameraRef.current || busy) return;
    setBusy(true);
    haptics.press();
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.7 });
      if (!photo?.uri) {
        setBusy(false);
        return;
      }
      const quality = await assessUri(photo.uri);
      // A failed read (null) shouldn't block the user — only a clear bad verdict does.
      if (!quality || quality.verdict === 'good') {
        haptics.success();
        proceed(photo.uri, quality);
      } else {
        haptics.tap();
        setReview({ uri: photo.uri, quality });
      }
    } catch {
      setBusy(false);
    }
  }, [busy, proceed]);

  const retake = useCallback(() => {
    setReview(null);
    setBusy(false);
  }, []);

  if (!permission) {
    // Permissions still resolving.
    return <View style={styles.root} />;
  }

  if (!permission.granted) {
    return (
      <View
        style={[
          styles.root,
          styles.gate,
          { paddingTop: insets.top + spacing(6), paddingBottom: insets.bottom + spacing(6) },
        ]}
      >
        <Ionicons name="camera-outline" size={40} color={palette.clayBright} />
        <AppText variant="title" color={palette.inkDark} style={styles.center}>
          Camera access
        </AppText>
        <AppText variant="subheading" color={palette.inkSoftDark} style={styles.center}>
          Glowi uses the camera for a guided, well-framed scan. You can also upload a photo instead.
        </AppText>
        <GlowButton label="Enable camera" onPress={requestPermission} style={styles.gateBtn} />
        <PressableScale onPress={() => router.replace('/scan')} style={styles.gateAlt}>
          <AppText variant="subheading" color={palette.clayBright}>
            Upload a photo instead
          </AppText>
        </PressableScale>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.root,
        { paddingTop: insets.top + spacing(2), paddingBottom: insets.bottom + spacing(3) },
      ]}
    >
      <View style={styles.headerRow}>
        <PressableScale onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="close" size={26} color={palette.inkDark} />
        </PressableScale>
        <AppText variant="overline" color={palette.inkFaintDark}>
          Guided scan
        </AppText>
        <View style={{ width: 26 }} />
      </View>

      <View style={styles.stageWrap}>
        <View
          style={styles.frame}
          onLayout={(e) =>
            setFrame({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })
          }
        >
          <CameraView ref={cameraRef} facing={facing} style={StyleSheet.absoluteFill} />
          {review ? (
            <Image
              source={{ uri: review.uri }}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
            />
          ) : null}
          {frame.width > 0 ? <AlignmentOverlay width={frame.width} height={frame.height} /> : null}
          {!review ? (
            <View style={styles.captionWrap} pointerEvents="none">
              <AppText variant="caption" color={palette.inkDark} style={styles.caption}>
                Fill the oval · hold at arm&apos;s length · eyes level
              </AppText>
            </View>
          ) : null}
        </View>
      </View>

      {!review ? (
        <View style={styles.controls}>
          <PressableScale
            onPress={() => {
              haptics.tap();
              setFacing((f) => (f === 'front' ? 'back' : 'front'));
            }}
            style={styles.sideBtn}
            hitSlop={12}
          >
            <Ionicons name="camera-reverse-outline" size={26} color={palette.inkSoftDark} />
          </PressableScale>

          <PressableScale onPress={capture} disabled={busy} style={styles.shutter}>
            <View style={styles.shutterInner} />
          </PressableScale>

          <View style={styles.sideBtn} />
        </View>
      ) : (
        <View style={{ height: 96 }} />
      )}

      {review ? (
        <View style={styles.sheetScrim} pointerEvents="box-none">
          <Animated.View
            entering={FadeInUp.duration(motion.base)}
            style={[styles.sheet, { paddingBottom: insets.bottom + spacing(4) }]}
          >
            <View style={styles.sheetHandle} />
            <Ionicons name="bulb-outline" size={26} color={palette.clayBright} />
            <AppText variant="heading" color={palette.inkDark} style={styles.center}>
              Let&apos;s retake that
            </AppText>
            <AppText variant="subheading" color={palette.inkSoftDark} style={styles.center}>
              {review.quality ? captureQualityMessage(review.quality.verdict) : ''}
            </AppText>
            <GlowButton label="Retake" onPress={retake} style={styles.sheetBtn} />
            <PressableScale
              onPress={() => proceed(review.uri, review.quality)}
              style={styles.useAnyway}
            >
              <AppText variant="subheading" color={palette.clayBright}>
                Use this photo anyway
              </AppText>
            </PressableScale>
          </Animated.View>
        </View>
      ) : null}
    </View>
  );
}

/** Fixed guidance geometry — a face oval cut from a dimming scrim, with
 *  forehead/chin ticks. Non-interactive; versioned by OVERLAY_VERSION. */
function AlignmentOverlay({ width, height }: { width: number; height: number }) {
  const cx = width / 2;
  const cy = height * 0.46; // slightly above middle
  const rx = width * 0.31; // ~62% frame width
  const ry = height * 0.36;
  const tick = 14;
  const stroke = 'rgba(210,119,78,0.55)';
  return (
    <Animated.View
      entering={FadeIn.duration(motion.slow)}
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
    >
      <Svg width={width} height={height}>
        <Defs>
          <Mask id="ovalCut">
            <Rect x={0} y={0} width={width} height={height} fill="#ffffff" />
            <Ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="#000000" />
          </Mask>
        </Defs>
        <Rect
          x={0}
          y={0}
          width={width}
          height={height}
          fill="rgba(21,17,14,0.55)"
          mask="url(#ovalCut)"
        />
        <Ellipse cx={cx} cy={cy} rx={rx} ry={ry} stroke={stroke} strokeWidth={1.5} fill="none" />
        <Line x1={cx} y1={cy - ry - tick} x2={cx} y2={cy - ry} stroke={stroke} strokeWidth={1.5} />
        <Line x1={cx} y1={cy + ry} x2={cx} y2={cy + ry + tick} stroke={stroke} strokeWidth={1.5} />
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.bgDarkDeep, paddingHorizontal: spacing(5) },
  gate: { alignItems: 'center', justifyContent: 'center', gap: spacing(3) },
  gateBtn: { alignSelf: 'stretch', marginTop: spacing(3) },
  gateAlt: { paddingVertical: spacing(2) },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing(3),
  },
  stageWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  frame: {
    width: '100%',
    aspectRatio: 4 / 5,
    borderRadius: radii.xl,
    overflow: 'hidden',
    backgroundColor: palette.cardDark,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.lineDark,
  },
  captionWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: spacing(3),
    alignItems: 'center',
  },
  caption: {
    textAlign: 'center',
    backgroundColor: 'rgba(21,17,14,0.6)',
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(1.5),
    borderRadius: radii.full,
    overflow: 'hidden',
  },
  controls: {
    height: 96,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing(4),
  },
  sideBtn: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
  shutter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 3,
    borderColor: palette.clayBright,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: palette.inkDark,
  },
  center: { textAlign: 'center' },
  sheetScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    backgroundColor: palette.bgDark,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: palette.lineDark,
    paddingHorizontal: spacing(5),
    paddingTop: spacing(3),
    alignItems: 'center',
    gap: spacing(3),
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: palette.lineDark,
    marginBottom: spacing(1),
  },
  sheetBtn: { alignSelf: 'stretch', marginTop: spacing(1) },
  useAnyway: { paddingVertical: spacing(1) },
});
