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
          viewBox={`-0.05 -0.05 ${width + 0.1} ${height + 0.1}`}
          accessibilityLabel={board.caption}
        >
          {labels.map((label) => (
            <SvgText
              key={`l${label.y}`}
              x={label.x}
              y={label.y + 0.18}
              fontSize={0.5}
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
                x={x}
                y={y}
                width={1}
                height={1}
                fill={
                  cell.value === '#'
                    ? '#000000'
                    : cell.mark !== null
                      ? MARK_FILL[cell.mark]
                      : COLORS.board
                }
                stroke="#000000"
                strokeWidth={0.03}
              />
              {cell.mark === 'target' && (
                <Rect
                  x={x + 0.08}
                  y={y + 0.08}
                  width={0.84}
                  height={0.84}
                  fill="none"
                  stroke={RULED_OUT_COLOR}
                  strokeWidth={0.04}
                  strokeDasharray="0.1 0.08"
                />
              )}
              {cell.mark === 'answer' && cell.value === '#' && (
                <Rect
                  x={x + 0.1}
                  y={y + 0.1}
                  width={0.8}
                  height={0.8}
                  fill="none"
                  stroke={MARK_FILL.answer}
                  strokeWidth={0.1}
                />
              )}
              {cell.value === 'x' && <Circle cx={x + 0.5} cy={y + 0.5} r={0.07} fill="#000000" />}
              {cell.value !== null && cell.value !== '#' && cell.value !== 'x' && (
                <SvgText
                  x={x + 0.5}
                  y={y + 0.68}
                  fontSize={0.55}
                  fill={COLORS.given}
                  textAnchor="middle"
                  fontFamily={FONT}
                >
                  {cell.value}
                </SvgText>
              )}
              {[...cell.candidates, ...cell.removed].map((v) => {
                const cx = x + 0.19 + 0.31 * ((v - 1) % 3);
                const cy = y + 0.19 + 0.31 * Math.floor((v - 1) / 3);
                const removed = cell.removed.includes(v);
                return (
                  <G key={v}>
                    <SvgText
                      x={cx}
                      y={cy + 0.1}
                      fontSize={0.29}
                      fill={removed ? COLORS.danger : COLORS.candidate}
                      textAnchor="middle"
                      fontFamily={FONT}
                    >
                      {String(v)}
                    </SvgText>
                    {removed && (
                      <Line
                        x1={cx - 0.11}
                        y1={cy + 0.11}
                        x2={cx + 0.11}
                        y2={cy - 0.11}
                        stroke={COLORS.danger}
                        strokeWidth={0.03}
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
              x1={l.x1}
              y1={l.y1}
              x2={l.x2}
              y2={l.y2}
              stroke="#000000"
              strokeWidth={0.08}
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
