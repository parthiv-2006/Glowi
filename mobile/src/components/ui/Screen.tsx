import { forwardRef, type PropsWithChildren } from 'react';
import { ScrollView, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { palette, spacing } from '@/theme';

interface ScreenProps extends PropsWithChildren {
  /** Scrollable content (default) vs fixed layout. */
  scroll?: boolean;
  /** Horizontal padding on by default (26px per design spec). */
  padded?: boolean;
  style?: ViewStyle;
  /** Extra bottom inset, e.g. above the floating tab bar. */
  bottomInset?: number;
  /** Dark espresso background for scan screens. */
  dark?: boolean;
}

export const Screen = forwardRef<ScrollView, ScreenProps>(function Screen(
  { children, scroll = true, padded = true, style, bottomInset = 0, dark = false },
  ref,
) {
  const insets = useSafeAreaInsets();
  const bg = dark ? palette.bgDark : palette.bg;
  const base: ViewStyle = {
    paddingTop: insets.top + spacing(3),
    paddingBottom: insets.bottom + spacing(4) + bottomInset,
    ...(padded ? { paddingHorizontal: 26 } : null),
  };

  if (!scroll) {
    return <View style={[{ flex: 1, backgroundColor: bg }, base, style]}>{children}</View>;
  }
  return (
    <ScrollView
      ref={ref}
      style={{ flex: 1, backgroundColor: bg }}
      contentContainerStyle={[base, style]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
});
