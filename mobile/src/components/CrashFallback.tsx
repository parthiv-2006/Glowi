import { StyleSheet, View } from 'react-native';

import { GlowiAvatar } from '@/components/GlowiAvatar';
import { AppText, GlowButton, Screen } from '@/components/ui';
import { spacing } from '@/theme';

interface CrashFallbackProps {
  /** Clears the error boundary and re-mounts the tree — see the note below. */
  onRestart: () => void;
}

/**
 * What the user sees when the app crashes out of React entirely (E1).
 *
 * The alternative is React Native's default: a blank white screen on iOS, or the
 * red box in dev. A crash is the worst moment to abandon the app's voice, so Glowi
 * shows up, says something human, and offers the one action that helps.
 *
 * "Restart" resets the error boundary rather than reloading the bundle: the crash
 * is usually a render error on one screen, and re-mounting from the root clears it
 * without the user losing their session. If the same crash recurs immediately the
 * boundary simply catches it again — no worse than where they started.
 *
 * Deliberately shows no error text. A stack trace tells the user nothing and
 * makes a bad moment feel broken; the trace goes to Sentry, where it is useful.
 */
export function CrashFallback({ onRestart }: CrashFallbackProps) {
  return (
    <Screen scroll={false} style={styles.wrap}>
      <View style={styles.content} accessibilityLiveRegion="assertive">
        <GlowiAvatar state="idle" size={96} />
        <AppText variant="title" style={styles.center}>
          Something went wrong
        </AppText>
        <AppText variant="subheading" style={styles.center}>
          That&apos;s on us, not on you. Your scans and history are safe — restarting should put
          things right.
        </AppText>
        <GlowButton label="Restart Glowi" onPress={onRestart} style={styles.button} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { justifyContent: 'center' },
  content: { alignItems: 'center', gap: spacing(3) },
  center: { textAlign: 'center', maxWidth: 300 },
  button: { marginTop: spacing(2) },
});
