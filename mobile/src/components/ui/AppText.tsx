import { Text, type TextProps, type TextStyle } from 'react-native';

import { fonts, palette } from '@/theme';

type Variant =
  | 'display'
  | 'title'
  | 'cardTitle'
  | 'heading'
  | 'subheading'
  | 'body'
  | 'caption'
  | 'overline'
  | 'mono';

const variants: Record<Variant, TextStyle> = {
  display: {
    fontFamily: fonts.serifMedium,
    fontSize: 34,
    lineHeight: 37,
    letterSpacing: -0.5,
    color: palette.ink,
  },
  title: {
    fontFamily: fonts.serif,
    fontSize: 28,
    lineHeight: 32,
    color: palette.ink,
  },
  cardTitle: {
    fontFamily: fonts.serif,
    fontSize: 20,
    lineHeight: 24,
    color: palette.ink,
  },
  heading: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 16,
    lineHeight: 22,
    color: palette.ink,
  },
  subheading: {
    fontFamily: fonts.bodyMedium,
    fontSize: 15,
    lineHeight: 22,
    color: palette.inkSoft,
  },
  body: {
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 23,
    color: palette.inkSoft,
  },
  caption: {
    fontFamily: fonts.body,
    fontSize: 12.5,
    lineHeight: 17,
    color: palette.inkFaint,
  },
  overline: {
    fontFamily: fonts.mono,
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    color: palette.inkFaint,
  },
  mono: {
    fontFamily: fonts.mono,
    fontSize: 11,
    lineHeight: 15,
    letterSpacing: 1.5,
    color: palette.inkSoft,
  },
};

interface AppTextProps extends TextProps {
  variant?: Variant;
  color?: string;
  /** Use the italic serif variant for Newsreader emphasis words. */
  italic?: boolean;
}

export function AppText({ variant = 'body', color, italic, style, ...rest }: AppTextProps) {
  let italicStyle: TextStyle | null = null;
  if (italic) {
    const isSerif = variant === 'display' || variant === 'title' || variant === 'cardTitle';
    italicStyle = {
      fontFamily: isSerif
        ? variant === 'display'
          ? fonts.serifMediumItalic
          : fonts.serifItalic
        : undefined,
      fontStyle: 'italic',
    };
  }
  return (
    <Text {...rest} style={[variants[variant], color ? { color } : null, italicStyle, style]} />
  );
}
