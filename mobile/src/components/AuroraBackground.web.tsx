import { StyleSheet, View } from 'react-native';

import { palette } from '@/theme';

export function AuroraBackground({ intensity = 1 }: { intensity?: number }) {
  return (
    <View
      style={[StyleSheet.absoluteFill, styles.root]}
      pointerEvents="none"
    />
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: palette.bg,
    opacity: 1,
  },
});
