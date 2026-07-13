import { useState } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { fonts, palette, radii, spacing } from '@/theme';
import { AppText } from './AppText';

interface TextFieldProps extends TextInputProps {
  label?: string;
  error?: string | null;
}

export function TextField({ label, error, style, ...rest }: TextFieldProps) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.wrap}>
      {label ? (
        // The visual label is decorative to a screen reader — the input carries the
        // same string as its accessibilityLabel, so announcing it twice is noise.
        <AppText variant="overline" style={styles.label} accessibilityElementsHidden>
          {label}
        </AppText>
      ) : null}
      <TextInput
        placeholderTextColor={palette.inkFaint}
        selectionColor={palette.clay}
        accessibilityLabel={label}
        // Errors are rendered below the field; without this a screen-reader user
        // focused on the input never learns why their submission failed.
        accessibilityHint={error ?? undefined}
        {...rest}
        onFocus={(e) => {
          setFocused(true);
          rest.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          rest.onBlur?.(e);
        }}
        style={[styles.input, focused && styles.focused, error ? styles.errored : null, style]}
      />
      {error ? (
        <AppText variant="caption" color={palette.rose} accessibilityLiveRegion="polite">
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing(1.5) },
  label: { color: palette.inkSoft },
  input: {
    backgroundColor: palette.well,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: palette.lineStrong,
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(3.5),
    color: palette.ink,
    fontFamily: fonts.body,
    fontSize: 15,
  },
  focused: { borderColor: palette.clay },
  errored: { borderColor: palette.rose },
});
