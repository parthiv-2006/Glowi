import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { palette, spacing } from '@/theme';
import { AppText } from './AppText';
import { GlowButton } from './GlowButton';

interface EmptyStateProps {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({
  icon = 'sparkles-outline',
  title,
  body,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <View style={styles.wrap}>
      <View style={styles.iconHalo}>
        <Ionicons name={icon} size={30} color={palette.accentBright} />
      </View>
      <AppText variant="heading" style={styles.center}>
        {title}
      </AppText>
      {body ? (
        <AppText variant="subheading" style={styles.center}>
          {body}
        </AppText>
      ) : null}
      {actionLabel && onAction ? (
        <GlowButton label={actionLabel} onPress={onAction} style={styles.button} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: spacing(3), paddingVertical: spacing(10) },
  iconHalo: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.accentDim,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(94,234,212,0.3)',
  },
  center: { textAlign: 'center', maxWidth: 280 },
  button: { marginTop: spacing(2) },
});
