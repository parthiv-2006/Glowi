/**
 * ScoreTrend — minimal SVG line chart of skin_score over time.
 * Props: scans already filtered to status === 'complete', any order (sorted internally).
 */
import { useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Line, Polyline, Text as SvgText } from 'react-native-svg';

import { palette } from '@/theme';
import type { Scan } from '@/lib/types';

interface ScoreTrendProps {
  scans: Scan[];
}

const CHART_HEIGHT = 110;
const PAD_X = 28;
const PAD_Y = 18;
const DOT_R = 4;
const LATEST_DOT_R = 6;

export function ScoreTrend({ scans }: ScoreTrendProps) {
  const [width, setWidth] = useState(0);

  // Sort oldest → newest
  const sorted = [...scans].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  if (!width) {
    return <View style={{ height: CHART_HEIGHT }} onLayout={onLayout} />;
  }

  const plotW = width - PAD_X * 2;
  const plotH = CHART_HEIGHT - PAD_Y * 2;

  // Map score 0-100 to y (inverted: high score = top)
  const toY = (score: number) => PAD_Y + plotH - (Math.max(0, Math.min(100, score)) / 100) * plotH;
  const toX = (i: number) =>
    sorted.length === 1 ? PAD_X + plotW / 2 : PAD_X + (i / (sorted.length - 1)) * plotW;

  const points = sorted.map((s, i) => ({ x: toX(i), y: toY(s.skin_score ?? 0), score: s.skin_score ?? 0 }));
  const polylinePoints = points.map((p) => `${p.x},${p.y}`).join(' ');

  // Gridline at score 50
  const grid50Y = toY(50);

  return (
    <View onLayout={onLayout}>
      <Svg width={width} height={CHART_HEIGHT}>
        {/* Subtle 50-score guideline */}
        <Line
          x1={PAD_X}
          y1={grid50Y}
          x2={width - PAD_X}
          y2={grid50Y}
          stroke={palette.border}
          strokeWidth={1}
          strokeDasharray="4 4"
        />
        {/* 50 label */}
        <SvgText
          x={PAD_X - 6}
          y={grid50Y + 4}
          fontSize={9}
          fill={palette.textTertiary}
          textAnchor="end"
        >
          50
        </SvgText>

        {/* Min / max labels on y-axis */}
        <SvgText
          x={PAD_X - 6}
          y={PAD_Y + 4}
          fontSize={9}
          fill={palette.textTertiary}
          textAnchor="end"
        >
          100
        </SvgText>
        <SvgText
          x={PAD_X - 6}
          y={PAD_Y + plotH + 4}
          fontSize={9}
          fill={palette.textTertiary}
          textAnchor="end"
        >
          0
        </SvgText>

        {/* Jade polyline */}
        {points.length > 1 && (
          <Polyline
            points={polylinePoints}
            fill="none"
            stroke={palette.accent}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Dots */}
        {points.map((p, i) => {
          const isLatest = i === points.length - 1;
          return (
            <Circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={isLatest ? LATEST_DOT_R : DOT_R}
              fill={isLatest ? palette.accentBright : palette.accent}
              stroke={palette.bg}
              strokeWidth={isLatest ? 2.5 : 1.5}
            />
          );
        })}

        {/* Score label on latest dot */}
        {points.length > 0 && (() => {
          const last = points[points.length - 1];
          const labelY = last.y > PAD_Y + 14 ? last.y - 10 : last.y + 18;
          return (
            <SvgText
              x={last.x}
              y={labelY}
              fontSize={10}
              fill={palette.accentBright}
              textAnchor="middle"
              fontWeight="600"
            >
              {last.score}
            </SvgText>
          );
        })()}

        {/* Date labels: first and last */}
        {sorted.length > 1 && (
          <>
            <SvgText
              x={points[0].x}
              y={CHART_HEIGHT - 3}
              fontSize={9}
              fill={palette.textTertiary}
              textAnchor="middle"
            >
              {new Date(sorted[0].created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </SvgText>
            <SvgText
              x={points[points.length - 1].x}
              y={CHART_HEIGHT - 3}
              fontSize={9}
              fill={palette.textTertiary}
              textAnchor="middle"
            >
              {new Date(sorted[sorted.length - 1].created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </SvgText>
          </>
        )}
      </Svg>
    </View>
  );
}
