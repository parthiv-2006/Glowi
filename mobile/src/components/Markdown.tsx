/**
 * Markdown.tsx — minimal dependency-free markdown renderer.
 * Supports: headings (#/##/###), bullets (- ), bold (**), italic (*),
 * tables (| … |), blank line spacing, and plain body paragraphs.
 * Designed for long-form editorial articles in the Glowi clinical-luxe aesthetic.
 */
import { Fragment } from 'react';
import type { ReactNode } from 'react';
import { StyleSheet, View, Text } from 'react-native';

import { AppText, GlassCard } from '@/components/ui';
import { fonts, palette, spacing } from '@/theme';

interface MarkdownProps {
  source: string;
}

// ---------------------------------------------------------------------------
// Inline parser — handles **bold** and *italic* within a single line.
// Returns an array of React Text elements with appropriate font styles.
// ---------------------------------------------------------------------------
function parseInline(text: string, baseKey: string): ReactNode {
  // Split on ** (bold) and * (italic), keeping delimiters
  const parts: { text: string; bold: boolean; italic: boolean }[] = [];
  let remaining = text;
  let boldOpen = false;
  let italicOpen = false;

  // We parse left-to-right, toggling bold on ** and italic on *
  // Simple state machine: detect ** before * to avoid ambiguity
  while (remaining.length > 0) {
    const boldIdx = remaining.indexOf('**');
    const italicIdx = remaining.indexOf('*');

    if (boldIdx === -1 && italicIdx === -1) {
      // No more markers
      parts.push({ text: remaining, bold: boldOpen, italic: italicOpen });
      break;
    }

    // Determine which marker comes first
    const useBold = boldIdx !== -1 && (italicIdx === -1 || boldIdx <= italicIdx);

    if (useBold) {
      if (boldIdx > 0) {
        parts.push({ text: remaining.slice(0, boldIdx), bold: boldOpen, italic: italicOpen });
      }
      boldOpen = !boldOpen;
      remaining = remaining.slice(boldIdx + 2);
    } else {
      // italic — but only if it's not part of **
      if (italicIdx > 0) {
        parts.push({ text: remaining.slice(0, italicIdx), bold: boldOpen, italic: italicOpen });
      }
      italicOpen = !italicOpen;
      remaining = remaining.slice(italicIdx + 1);
    }
  }

  if (parts.length === 1 && !parts[0].bold && !parts[0].italic) {
    // Fast path: no formatting
    return parts[0].text;
  }

  return (
    <>
      {parts.map((p, i) => {
        if (!p.text) return null;
        const isBold = p.bold;
        const isItalic = p.italic;
        if (isBold || isItalic) {
          return (
            <Text
              key={`${baseKey}-s${i}`}
              style={[isBold && styles.bold, isItalic && styles.italic]}
            >
              {p.text}
            </Text>
          );
        }
        return <Fragment key={`${baseKey}-s${i}`}>{p.text}</Fragment>;
      })}
    </>
  );
}

// ---------------------------------------------------------------------------
// Table renderer — parses lines with | separators.
// ---------------------------------------------------------------------------
function TableBlock({ lines, startKey }: { lines: string[]; startKey: string }) {
  // Remove separator lines (---)
  const dataLines = lines.filter((l) => !/^\|[\s\-|:]+\|$/.test(l.trim()));

  const rows = dataLines.map((line) => {
    // Strip leading/trailing pipes then split
    const stripped = line.replace(/^\||\|$/g, '');
    return stripped.split('|').map((c) => c.trim());
  });

  if (rows.length === 0) return null;

  const header = rows[0];
  const body = rows.slice(1);

  return (
    <GlassCard style={styles.tableCard} padded={false}>
      {/* Header row */}
      <View style={styles.tableHeaderRow}>
        {header.map((cell, ci) => (
          <View key={`${startKey}-h${ci}`} style={styles.tableCell}>
            <AppText variant="caption" color={palette.accentBright} style={styles.tableCellText}>
              {cell}
            </AppText>
          </View>
        ))}
      </View>
      {/* Body rows */}
      {body.map((row, ri) => (
        <View
          key={`${startKey}-r${ri}`}
          style={[styles.tableBodyRow, ri < body.length - 1 && styles.tableRowBorder]}
        >
          {row.map((cell, ci) => (
            <View key={`${startKey}-r${ri}c${ci}`} style={styles.tableCell}>
              <AppText variant="caption" color={palette.text} style={styles.tableCellText}>
                {cell}
              </AppText>
            </View>
          ))}
        </View>
      ))}
    </GlassCard>
  );
}

// ---------------------------------------------------------------------------
// Main parser — processes source line by line.
// ---------------------------------------------------------------------------
type Block =
  | { type: 'h1' | 'h2' | 'h3'; text: string }
  | { type: 'bullet'; text: string }
  | { type: 'table'; lines: string[] }
  | { type: 'para'; text: string }
  | { type: 'blank' };

function parseBlocks(source: string): Block[] {
  const lines = source.split('\n');
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const raw = lines[i];
    const line = raw.trimEnd();

    if (line === '') {
      blocks.push({ type: 'blank' });
      i++;
      continue;
    }

    if (line.startsWith('### ')) {
      blocks.push({ type: 'h3', text: line.slice(4) });
      i++;
      continue;
    }

    if (line.startsWith('## ')) {
      blocks.push({ type: 'h2', text: line.slice(3) });
      i++;
      continue;
    }

    if (line.startsWith('# ')) {
      blocks.push({ type: 'h1', text: line.slice(2) });
      i++;
      continue;
    }

    if (line.startsWith('- ')) {
      blocks.push({ type: 'bullet', text: line.slice(2) });
      i++;
      continue;
    }

    // Table: a line (or run of lines) that contains '|'
    if (line.includes('|')) {
      const tableLines: string[] = [line];
      let j = i + 1;
      while (j < lines.length && lines[j].includes('|')) {
        tableLines.push(lines[j].trimEnd());
        j++;
      }
      blocks.push({ type: 'table', lines: tableLines });
      i = j;
      continue;
    }

    // Default: paragraph
    blocks.push({ type: 'para', text: line });
    i++;
  }

  return blocks;
}

// ---------------------------------------------------------------------------
// Renderer
// ---------------------------------------------------------------------------
export function Markdown({ source }: MarkdownProps) {
  const blocks = parseBlocks(source ?? '');
  const elements: ReactNode[] = [];
  let blankCount = 0;

  blocks.forEach((block, idx) => {
    const key = `md-${idx}`;

    if (block.type === 'blank') {
      blankCount++;
      // Add paragraph spacing only once per blank-line run
      if (blankCount === 1) {
        elements.push(<View key={key} style={styles.paragraphGap} />);
      }
      return;
    }

    blankCount = 0;

    switch (block.type) {
      case 'h1':
        elements.push(
          <AppText key={key} variant="title" style={styles.h1}>
            {parseInline(block.text, key)}
          </AppText>,
        );
        break;

      case 'h2':
        elements.push(
          <AppText key={key} variant="heading" style={styles.h2}>
            {parseInline(block.text, key)}
          </AppText>,
        );
        break;

      case 'h3':
        elements.push(
          <AppText key={key} variant="subheading" style={styles.h3} color={palette.text}>
            {parseInline(block.text, key)}
          </AppText>,
        );
        break;

      case 'bullet':
        elements.push(
          <View key={key} style={styles.bulletRow}>
            <View style={styles.bulletDot} />
            <AppText variant="body" style={styles.bulletText}>
              {parseInline(block.text, key)}
            </AppText>
          </View>,
        );
        break;

      case 'table':
        elements.push(<TableBlock key={key} lines={block.lines} startKey={key} />);
        break;

      case 'para':
        elements.push(
          <AppText key={key} variant="body" style={styles.para}>
            {parseInline(block.text, key)}
          </AppText>,
        );
        break;
    }
  });

  return <View style={styles.root}>{elements}</View>;
}

const styles = StyleSheet.create({
  root: {
    gap: 0,
  },

  // Headings — top margin to create visual breathing room
  h1: {
    marginTop: spacing(7),
    marginBottom: spacing(2),
    lineHeight: 34,
  },
  h2: {
    marginTop: spacing(6),
    marginBottom: spacing(2),
    lineHeight: 26,
  },
  h3: {
    marginTop: spacing(4),
    marginBottom: spacing(1),
    fontFamily: fonts.bodySemiBold,
    fontSize: 15,
    lineHeight: 22,
  },

  // Body copy
  para: {
    lineHeight: 24,
    color: palette.text,
  },
  paragraphGap: {
    height: spacing(3),
  },

  // Inline
  bold: {
    fontFamily: fonts.bodySemiBold,
    color: palette.text,
  },
  italic: {
    fontStyle: 'italic',
    color: palette.textSecondary,
  },

  // Bullets
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing(3),
    marginVertical: spacing(1),
    paddingLeft: spacing(1),
  },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: palette.accent,
    marginTop: 9, // vertically centre against the first line of body text
  },
  bulletText: {
    flex: 1,
    lineHeight: 24,
  },

  // Table
  tableCard: {
    marginTop: spacing(4),
    marginBottom: spacing(2),
    overflow: 'hidden',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(45,212,191,0.08)',
    paddingVertical: spacing(2.5),
    paddingHorizontal: spacing(3),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.border,
  },
  tableBodyRow: {
    flexDirection: 'row',
    paddingVertical: spacing(2.5),
    paddingHorizontal: spacing(3),
  },
  tableRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.border,
  },
  tableCell: {
    flex: 1,
  },
  tableCellText: {
    lineHeight: 18,
  },
});
