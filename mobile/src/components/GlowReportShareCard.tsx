import { forwardRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { AppText } from '@/components/ui';
import { GlowiAvatar } from '@/components/GlowiAvatar';
import { palette, radii, scoreColor, spacing } from '@/theme';
import type { GlowReport } from '@/lib/types';

interface GlowReportShareCardProps {
  report: GlowReport;
  /** The week's ending skin score (0–100), or null when there were no scans. */
  endScore: number | null;
  /** Score movement vs. the prior scan, or null when it can't be measured. */
  scoreDelta: number | null;
}

/**
 * The 4:5 branded card the user shares. Deliberately share-safe: no user photos,
 * no concern details — just the mark, the week's headline metric, one win, and
 * the streak. A COMPONENT_FIDELITY-grade dark surface, captured via a ref by
 * react-native-view-shot, so its ring is static (no animation to catch mid-frame)
 * and every text color is set explicitly for the dark field.
 */
export const GlowReportShareCard = forwardRef<View, GlowReportShareCardProps>(
  function GlowReportShareCard({ report, endScore, scoreDelta }, ref) {
    const { stats, wins, headline } = report.content;
    // Score ring when there was a scan; otherwise the streak stands in.
    const showScore = endScore != null;
    const ringValue = showScore ? endScore : Math.min(100, (stats.streak_days / 7) * 100);
    const ringColor = showScore ? scoreColor(endScore) : palette.clayBright;
    const centerLabel = showScore ? String(endScore) : String(stats.streak_days);
    const centerSub = showScore ? 'SKIN SCORE' : 'DAY STREAK';

    return (
      <View ref={ref} style={styles.card} collapsable={false}>
        <View style={styles.header}>
          <GlowiAvatar state="celebrating" size={30} />
          <View>
            <AppText variant="cardTitle" color={palette.inkDark} style={styles.wordmark}>
              Glowi
            </AppText>
            <AppText variant="overline" color={palette.clayBright}>
              Weekly Glow
            </AppText>
          </View>
        </View>

        <View style={styles.ringWrap}>
          <StaticRing value={ringValue} color={ringColor} />
          <View style={styles.ringCenter}>
            <AppText variant="display" color={palette.inkDark} style={styles.ringNumber}>
              {centerLabel}
            </AppText>
            <AppText variant="overline" color={palette.inkSoftDark}>
              {centerSub}
            </AppText>
          </View>
          {showScore && scoreDelta != null && scoreDelta !== 0 && (
            <View
              style={[
                styles.deltaChip,
                {
                  backgroundColor:
                    scoreDelta > 0 ? 'rgba(117,135,106,0.22)' : 'rgba(188,83,64,0.22)',
                },
              ]}
            >
              <AppText
                variant="mono"
                color={scoreDelta > 0 ? palette.sage : palette.rose}
                style={styles.deltaText}
              >
                {scoreDelta > 0 ? '+' : ''}
                {scoreDelta} pts
              </AppText>
            </View>
          )}
        </View>

        <AppText variant="cardTitle" color={palette.inkDark} style={styles.headline}>
          {headline}
        </AppText>

        {wins[0] && (
          <AppText variant="body" color={palette.inkSoftDark} style={styles.win}>
            “{wins[0]}”
          </AppText>
        )}

        <View style={styles.footer}>
          <View style={styles.streakChip}>
            <AppText variant="mono" color={palette.inkDark}>
              🔥 {stats.streak_days}-day streak
            </AppText>
          </View>
          <AppText variant="overline" color={palette.inkFaintDark}>
            glowi
          </AppText>
        </View>
      </View>
    );
  },
);

/** Non-animated arc ring — safe to screenshot at any moment. */
function StaticRing({ value, color }: { value: number; color: string }) {
  const size = 148;
  const stroke = 12;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const clamped = Math.min(100, Math.max(0, value));
  const offset = circ * (1 - clamped / 100);
  return (
    <Svg width={size} height={size}>
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke="rgba(255,255,255,0.10)"
        strokeWidth={stroke}
        fill="none"
      />
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        fill="none"
        strokeDasharray={`${circ} ${circ}`}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 320,
    height: 400,
    backgroundColor: palette.bgDarkDeep,
    borderRadius: radii.xl,
    padding: spacing(6),
    justifyContent: 'space-between',
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing(2) },
  wordmark: { letterSpacing: 0.5 },
  ringWrap: { alignItems: 'center', justifyContent: 'center' },
  ringCenter: { position: 'absolute', alignItems: 'center' },
  ringNumber: { fontSize: 44, lineHeight: 48 },
  deltaChip: {
    position: 'absolute',
    bottom: -6,
    paddingHorizontal: spacing(2.5),
    paddingVertical: spacing(1),
    borderRadius: radii.full,
  },
  deltaText: { fontSize: 12 },
  headline: { textAlign: 'center', lineHeight: 26 },
  win: { textAlign: 'center', fontStyle: 'italic', lineHeight: 21 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  streakChip: {
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(1.5),
    borderRadius: radii.full,
    backgroundColor: 'rgba(224,169,132,0.16)',
  },
});
