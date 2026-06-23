import { StyleSheet, View } from 'react-native';

import { palette } from '@/theme';

/**
 * Web fallback for the Skia aurora. Skia/CanvasKit isn't wired up for web, so
 * we approximate the drifting jade blobs with blurred colored circles (RN 0.85
 * supports the `filter` style on web). Static — enough to read as the same
 * ambient glow during screenshot verification; the native build animates.
 */
export function AuroraBackground({ intensity = 1 }: { intensity?: number }) {
  return (
    <View style={[StyleSheet.absoluteFill, styles.root, { pointerEvents: 'none' }]}>
      <View style={[styles.blob, styles.blob1, { opacity: 0.55 * intensity }]} />
      <View style={[styles.blob, styles.blob2, { opacity: 0.5 * intensity }]} />
      <View style={[styles.blob, styles.blob3, { opacity: 0.45 * intensity }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: palette.bg, overflow: 'hidden' },
  blob: { position: 'absolute', borderRadius: 9999, filter: 'blur(90px)' } as object,
  blob1: {
    width: 320,
    height: 320,
    top: '8%',
    left: '-10%',
    backgroundColor: 'rgba(188,94,56,0.35)',
  },
  blob2: {
    width: 300,
    height: 300,
    top: '24%',
    right: '-14%',
    backgroundColor: '#7A3A1A',
  },
  blob3: {
    width: 340,
    height: 340,
    bottom: '6%',
    left: '20%',
    backgroundColor: '#4A1E0A',
  },
});
