import { forwardRef, type PropsWithChildren } from 'react';
import { ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useResponsive } from '@/lib/responsive';
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

export const Screen = forwardRef<ScrollView, ScreenProps>(function Screen(
  { children, scroll = true, padded = true, style, bottomInset = 0 },
  ref,
) {
  const insets = useSafeAreaInsets();
  const { hPadding } = useResponsive();
  const base: ViewStyle = {
    paddingTop: insets.top + spacing(3),
    paddingBottom: insets.bottom + spacing(4) + bottomInset,
    ...(padded ? { paddingHorizontal: hPadding } : null),
  };

  if (!scroll) {
    return <View style={[styles.root, base, style]}>{children}</View>;
  }
  return (
    <ScrollView
      ref={ref}
      style={styles.root}
      contentContainerStyle={[base, style]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.bg },
});
