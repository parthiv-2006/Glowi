import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppText } from '@/components/ui';
import { palette, severityColor, spacing } from '@/theme';

interface SparklineEntry {
  date: string;
  severity: number;
}

interface ConcernTrendSparklineProps {
  name: string;
  values: SparklineEntry[];
}

const BAR_WIDTH = 6;
const BAR_MAX_HEIGHT = 24;
const BAR_MIN_HEIGHT = 3;
const DIRECTION_THRESHOLD = 5;

function trendDirection(values: SparklineEntry[]): 'down' | 'up' | 'flat' {
  if (values.length < 2) return 'flat';
  const delta = values[values.length - 1].severity - values[0].severity;
  if (delta <= -DIRECTION_THRESHOLD) return 'down';
  if (delta >= DIRECTION_THRESHOLD) return 'up';
  return 'flat';
}

export function ConcernTrendSparkline({ name, values }: ConcernTrendSparklineProps) {
  const dir = trendDirection(values);
  const iconName = dir === 'down' ? 'trending-down' : dir === 'up' ? 'trending-up' : 'remove';
  const iconColor =
    dir === 'down' ? palette.success : dir === 'up' ? palette.danger : palette.textSecondary;

  return (
    <View style={styles.row}>
      <AppText variant="caption" style={styles.name} numberOfLines={1}>
        {name}
      </AppText>

      <View style={styles.bars}>
        {values.map((v, i) => {
          const barH = Math.max(BAR_MIN_HEIGHT, Math.round((v.severity / 100) * BAR_MAX_HEIGHT));
          return (
            <View
              key={i}
              style={[
                styles.bar,
                {
                  height: barH,
                  backgroundColor: severityColor(v.severity),
                },
              ]}
            />
          );
        })}
      </View>

      <Ionicons name={iconName} size={16} color={iconColor} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
    marginBottom: spacing(3),
  },
  name: {
    width: 100,
    color: palette.textSecondary,
  },
  bars: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing(1),
    height: BAR_MAX_HEIGHT,
  },
  bar: {
    width: BAR_WIDTH,
    borderRadius: 3,
  },
});
