import { Text, type TextProps, type TextStyle } from 'react-native';

import { fonts, palette } from '@/theme';

type Variant = 'display' | 'title' | 'heading' | 'subheading' | 'body' | 'caption' | 'overline';

const variants: Record<Variant, TextStyle> = {
  display: { fontFamily: fonts.displayBold, fontSize: 34, lineHeight: 40, color: palette.text },
  title: { fontFamily: fonts.display, fontSize: 26, lineHeight: 32, color: palette.text },
  heading: { fontFamily: fonts.bodySemiBold, fontSize: 18, lineHeight: 24, color: palette.text },
  subheading: {
    fontFamily: fonts.bodyMedium,
    fontSize: 15,
    lineHeight: 21,
    color: palette.textBody,
  },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: palette.textBody },
  caption: { fontFamily: fonts.body, fontSize: 12.5, lineHeight: 17, color: palette.textSecondary },
  overline: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: palette.textTertiary,
  },
};

interface AppTextProps extends TextProps {
  variant?: Variant;
  color?: string;
}

export function AppText({ variant = 'body', color, style, ...rest }: AppTextProps) {
  return <Text {...rest} style={[variants[variant], color ? { color } : null, style]} />;
}
