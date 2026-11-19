// A small, static picture of a puzzle: its cells, given values and decorations, as on the board
// but without candidates, highlights or taps. The start page shows one per puzzle type.
import { parsePuzzle, type PuzzleType } from '@constraintpuzzler/core';
import { useMemo } from 'react';
import { Platform } from 'react-native';
import Svg, { Polygon, Polyline, Text as SvgText } from 'react-native-svg';

import { LAYOUTS, type BoardLayout, type Point } from '../logic/layout';
import { exampleText } from '../puzzles/open';
import { COLORS } from '../theme';

const FONT = Platform.select({
  web: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  android: 'sans-serif',
  default: undefined,
});

const pointsAttribute = (points: readonly Point[]): string =>
  points.map((p) => `${p.x},${p.y}`).join(' ');

const cache = new Map<string, BoardLayout>();

/** The layout of a type's default example (parsed once). */
export function previewLayout(type: PuzzleType): BoardLayout {
  let layout = cache.get(type.name);
  if (layout === undefined) {
    const file = type.examples[type.defaultExample];
    if (file === undefined) throw new Error(`${type.label} has no default example`);
    layout = LAYOUTS[type.name](parsePuzzle(type, exampleText(file), file));
    cache.set(type.name, layout);
  }
  return layout;
}

export function BoardPreview({ type, height }: { type: PuzzleType; height: number }) {
  const layout = useMemo(() => previewLayout(type), [type]);
  const { bounds } = layout;
  // a margin of a few percent, so the outer lines are not clipped
  const m = Math.max(bounds.width, bounds.height) * 0.03;
  return (
    <Svg
      width="100%"
      height={height}
      viewBox={`${bounds.x - m} ${bounds.y - m} ${bounds.width + 2 * m} ${bounds.height + 2 * m}`}
      testID={`preview-${type.name}`}
    >
      {layout.cells.map((shape) => {
        const value = shape.cell.isGiven() ? shape.cell.getValue() : null;
        // a nonogram's values are colours: a given value is a filled cell
        const colour = value !== null ? layout.palette?.get(value) : undefined;
        if (layout.palette !== undefined) {
          return (
            <Polygon
              key={`c${shape.cell.getName()}`}
              points={pointsAttribute(shape.outline)}
              fill={colour ?? shape.background ?? COLORS.board}
              stroke="#000000"
              strokeWidth={shape.strokeWidth}
            />
          );
        }
        return [
          <Polygon
            key={`c${shape.cell.getName()}`}
            points={pointsAttribute(shape.outline)}
            fill={shape.background ?? COLORS.board}
            stroke="#000000"
            strokeWidth={shape.strokeWidth}
          />,
          value !== null && (
            <SvgText
              key={`v${shape.cell.getName()}`}
              x={shape.valueCenter.x}
              y={shape.valueCenter.y + shape.valueFontSize * 0.35}
              fontSize={shape.valueFontSize}
              fill={COLORS.given}
              textAnchor="middle"
              fontFamily={FONT}
            >
              {String(value)}
            </SvgText>
          ),
        ];
      })}
      {layout.decorations.map((d, i) => {
        switch (d.kind) {
          case 'polygon':
            return (
              <Polygon
                key={i}
                points={pointsAttribute(d.points)}
                fill={d.fill}
                stroke={d.stroke ?? 'none'}
                strokeWidth={d.strokeWidth ?? 0}
              />
            );
          case 'polyline':
            return (
              <Polyline
                key={i}
                points={pointsAttribute(d.points)}
                fill="none"
                stroke={d.stroke}
                strokeWidth={d.strokeWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            );
          case 'text':
            return (
              <SvgText
                key={i}
                x={d.at.x}
                y={d.at.y + d.fontSize * 0.35}
                fontSize={d.fontSize}
                fill={d.fill}
                fontWeight={d.bold ? 'bold' : 'normal'}
                textAnchor="middle"
                fontFamily={FONT}
              >
                {d.text}
              </SvgText>
            );
        }
      })}
    </Svg>
  );
}
