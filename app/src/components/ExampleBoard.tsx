// A small picture of a technique in the Rules dialog: a few cells with values, candidates
// (crossed out where the technique removes them) and the highlight colours of a hint.
import { parseExampleBoard, type ExampleBoard as Board } from '@constraintpuzzler/core';
import { useMemo } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Line, Rect, Text as SvgText } from 'react-native-svg';

import { exampleBoardLayout } from '../logic/guide';
import { HighlightRole, roleColor, RULED_OUT_COLOR } from '../logic/highlight';
import { COLORS } from '../theme';

const FONT = Platform.select({
  web: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  android: 'sans-serif',
  default: undefined,
});

/** the largest size of a cell, in pixels (smaller when the dialog is narrow) */
const CELL_SIZE = 44;

/**
 * Board units per cell. Android's react-native-svg measures text at a font size of at least
 * one unit, so a font size below 1 shifts centred text (a candidate landed in the next cell):
 * draw a cell 100 units wide so every font size is well above 1.
 */
const U = 100;

const MARK_FILL = {
  pattern: roleColor(HighlightRole.PATTERN),
  answer: roleColor(HighlightRole.SELECTED),
  target: '#ffffff',
} as const;

export function ExampleBoard({ board, testID }: { board: Board; testID?: string }) {
  const layout = useMemo(() => exampleBoardLayout(board, parseExampleBoard(board)), [board]);
  const { width, height, cells, thickLines, labels } = layout;
  return (
    <View style={styles.figure} testID={testID}>
      <View style={{ width: '100%', maxWidth: CELL_SIZE * width, aspectRatio: width / height }}>
        <Svg
          width="100%"
          height="100%"
          viewBox={`${-0.05 * U} ${-0.05 * U} ${(width + 0.1) * U} ${(height + 0.1) * U}`}
          accessibilityLabel={board.caption}
        >
          {labels.map((label) => (
            <SvgText
              key={`l${label.y}`}
              x={label.x * U}
              y={(label.y + 0.18) * U}
              fontSize={0.5 * U}
              fill={COLORS.text}
              fontWeight="bold"
              textAnchor="end"
              fontFamily={FONT}
            >
              {label.text}
            </SvgText>
          ))}
          {cells.map(({ x, y, cell }) => (
            <G key={`${x},${y}`}>
              <Rect
                x={x * U}
                y={y * U}
                width={U}
                height={U}
                fill={
                  cell.value === '#'
                    ? '#000000'
                    : cell.mark !== null
                      ? MARK_FILL[cell.mark]
                      : COLORS.board
                }
                stroke="#000000"
                strokeWidth={0.03 * U}
              />
              {cell.mark === 'target' && (
                <Rect
                  x={(x + 0.08) * U}
                  y={(y + 0.08) * U}
                  width={0.84 * U}
                  height={0.84 * U}
                  fill="none"
                  stroke={RULED_OUT_COLOR}
                  strokeWidth={0.04 * U}
                  strokeDasharray={`${0.1 * U} ${0.08 * U}`}
                />
              )}
              {cell.mark === 'answer' && cell.value === '#' && (
                <Rect
                  x={(x + 0.1) * U}
                  y={(y + 0.1) * U}
                  width={0.8 * U}
                  height={0.8 * U}
                  fill="none"
                  stroke={MARK_FILL.answer}
                  strokeWidth={0.1 * U}
                />
              )}
              {cell.value === 'x' && <Circle cx={(x + 0.5) * U} cy={(y + 0.5) * U} r={0.07 * U} fill="#000000" />}
              {cell.value !== null && cell.value !== '#' && cell.value !== 'x' && (
                <SvgText
                  x={(x + 0.5) * U}
                  y={(y + 0.68) * U}
                  fontSize={0.55 * U}
                  fill={COLORS.given}
                  textAnchor="middle"
                  fontFamily={FONT}
                >
                  {cell.value}
                </SvgText>
              )}
              {[...cell.candidates, ...cell.removed].map((v) => {
                const cx = (x + 0.19 + 0.31 * ((v - 1) % 3)) * U;
                const cy = (y + 0.19 + 0.31 * Math.floor((v - 1) / 3)) * U;
                const removed = cell.removed.includes(v);
                return (
                  <G key={v}>
                    <SvgText
                      x={cx}
                      y={cy + 0.1 * U}
                      fontSize={0.29 * U}
                      fill={removed ? COLORS.danger : COLORS.candidate}
                      textAnchor="middle"
                      fontFamily={FONT}
                    >
                      {String(v)}
                    </SvgText>
                    {removed && (
                      <Line
                        x1={cx - 0.11 * U}
                        y1={cy + 0.11 * U}
                        x2={cx + 0.11 * U}
                        y2={cy - 0.11 * U}
                        stroke={COLORS.danger}
                        strokeWidth={0.03 * U}
                      />
                    )}
                  </G>
                );
              })}
            </G>
          ))}
          {thickLines.map((l) => (
            <Line
              key={`t${l.x1},${l.y1},${l.x2},${l.y2}`}
              x1={l.x1 * U}
              y1={l.y1 * U}
              x2={l.x2 * U}
              y2={l.y2 * U}
              stroke="#000000"
              strokeWidth={0.08 * U}
            />
          ))}
        </Svg>
      </View>
      <Text style={styles.caption}>{board.caption}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  figure: { gap: 4, marginTop: 4 },
  caption: { fontSize: 13, color: COLORS.muted, lineHeight: 18 },
});
