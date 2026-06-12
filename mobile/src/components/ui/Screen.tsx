import type { PropsWithChildren } from 'react';
import { ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { palette, spacing } from '@/theme';

interface ScreenProps extends PropsWithChildren {
  /** Scrollable content (default) vs fixed layout. */
  scroll?: boolean;
  /** Horizontal padding on by default. */
  padded?: boolean;
  style?: ViewStyle;
  /** Extra bottom inset, e.g. above the floating tab bar. */
  bottomInset?: number;
}

export function Screen({ children, scroll = true, padded = true, style, bottomInset = 0 }: ScreenProps) {
  const insets = useSafeAreaInsets();
  const base: ViewStyle = {
    paddingTop: insets.top + spacing(3),
    paddingBottom: insets.bottom + spacing(4) + bottomInset,
    ...(padded ? { paddingHorizontal: spacing(5) } : null),
  };

  if (!scroll) {
    return <View style={[styles.root, base, style]}>{children}</View>;
  }
  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[base, style]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.bg },
});
