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
        <AppText variant="overline" style={styles.label}>
          {label}
        </AppText>
      ) : null}
      <TextInput
        placeholderTextColor={palette.inkFaint}
        selectionColor={palette.clay}
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
        <AppText variant="caption" color={palette.rose}>
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
