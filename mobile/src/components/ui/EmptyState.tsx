import { StyleSheet, View } from 'react-native';

import { GlowiAvatar } from '@/components/GlowiAvatar';
import { spacing } from '@/theme';
import { AppText } from './AppText';
import { GlowButton } from './GlowButton';

interface EmptyStateProps {
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
}

/**
 * The universal "promise, not a void" empty state (DESIGN_PRINCIPLES §5) — a
 * living mascot instead of a static icon, so every empty/first-run surface
 * carries the brand's presence.
 */
export function EmptyState({ title, body, actionLabel, onAction }: EmptyStateProps) {
  return (
    <View style={styles.wrap}>
      <GlowiAvatar state="idle" size={64} />
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
  center: { textAlign: 'center', maxWidth: 280 },
  button: { marginTop: spacing(2) },
});
