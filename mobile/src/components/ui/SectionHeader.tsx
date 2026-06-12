import { StyleSheet, View } from 'react-native';

import { palette, spacing } from '@/theme';
import { AppText } from './AppText';
import { PressableScale } from './PressableScale';

interface SectionHeaderProps {
  overline?: string;
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function SectionHeader({ overline, title, actionLabel, onAction }: SectionHeaderProps) {
  return (
    <View style={styles.row}>
      <View style={styles.titles}>
        {overline ? <AppText variant="overline">{overline}</AppText> : null}
        <AppText variant="title" style={styles.title}>
          {title}
        </AppText>
      </View>
      {actionLabel && onAction ? (
        <PressableScale onPress={onAction} hitSlop={8}>
          <AppText variant="subheading" color={palette.accentBright}>
            {actionLabel}
          </AppText>
        </PressableScale>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: spacing(3),
  },
  titles: { gap: spacing(1), flex: 1 },
  title: { fontSize: 22, lineHeight: 27 },
});
