import { StyleSheet, View, type ViewStyle } from 'react-native';

import { palette, radii, spacing } from '@/theme';
import { AppText } from './AppText';

interface BadgeProps {
  label: string;
  /** Tint color; renders at low opacity background with full-strength text. */
  color?: string;
  style?: ViewStyle;
}

export function Badge({ label, color = palette.accent, style }: BadgeProps) {
  return (
    <View
      style={[styles.base, { backgroundColor: `${color}22`, borderColor: `${color}44` }, style]}
    >
      <AppText variant="caption" style={styles.text} color={color}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingHorizontal: spacing(2.5),
    paddingVertical: spacing(1),
    borderRadius: radii.full,
    borderWidth: StyleSheet.hairlineWidth,
    alignSelf: 'flex-start',
  },
  text: { fontSize: 11.5, lineHeight: 15 },
});
