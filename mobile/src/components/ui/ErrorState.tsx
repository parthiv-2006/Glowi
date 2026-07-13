import { StyleSheet, View } from 'react-native';

import { GlowiAvatar } from '@/components/GlowiAvatar';
import { spacing } from '@/theme';
import { AppText } from './AppText';
import { GlowButton } from './GlowButton';

interface ErrorStateProps {
  /** What failed, in the user's terms — "Couldn't load your shelf", not "Query error". */
  title?: string;
  body?: string;
  onRetry?: () => void;
}

/**
 * The counterpart to `EmptyState`, and the reason it exists: without it, a failed
 * query falls through to the empty state and the app cheerfully tells a user with
 * twenty scans that they have none. "Nothing here yet" and "we couldn't reach the
 * server" are different facts and must look different.
 *
 * Deliberately does not surface the underlying error text — it is a network or
 * Postgres message and means nothing to the person reading it. The retry is the
 * useful part.
 */
export function ErrorState({
  title = "Couldn't load this",
  body = 'Check your connection and try again.',
  onRetry,
}: ErrorStateProps) {
  return (
    <View style={styles.wrap} accessibilityLiveRegion="polite">
      <GlowiAvatar state="idle" size={64} />
      <AppText variant="heading" style={styles.center}>
        {title}
      </AppText>
      <AppText variant="subheading" style={styles.center}>
        {body}
      </AppText>
      {onRetry ? <GlowButton label="Try again" onPress={onRetry} style={styles.button} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: spacing(3), paddingVertical: spacing(10) },
  center: { textAlign: 'center', maxWidth: 280 },
  button: { marginTop: spacing(2) },
});
