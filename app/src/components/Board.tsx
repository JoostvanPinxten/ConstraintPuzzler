// The puzzle drawn with react-native-svg: the cells (value, or notes and candidates), their
// highlight, and the decorations of the puzzle type. Tapping a cell selects it.
import { BLANK, type Cell, type Value } from '@constraintpuzzler/core';
import { memo, useMemo, useState } from 'react';
import { Platform, View, type LayoutChangeEvent } from 'react-native';
import Svg, {
  Circle,
  Defs,
  G,
  Line,
  Pattern,
  Polygon,
  Polyline,
  Rect,
  Text as SvgText,
} from 'react-native-svg';

import { HighlightRole, REASON_GROUP_COLOR, roleColor, RULED_OUT_COLOR } from '../logic/highlight';
import {
  hintGrid,
  LAYOUTS,
  outlineEdges,
  type BoardLayout,
  type CellShape,
  type Point,
} from '../logic/layout';
import type { PuzzleSession } from '../logic/session';
import { useSettings } from '../settings';
import { useSession } from '../useSession';
import { COLORS } from '../theme';

// sans-serif, like the desktop app (SVG text is serif by default)
const FONT = Platform.select({
  web: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  android: 'sans-serif',
  default: undefined,
});

/** the id of the dashed hatching drawn over the cells a hint rules out */
const RULED_OUT = 'ruled-out';

const pointsAttribute = (points: readonly Point[]): string =>
  points.map((p) => `${p.x},${p.y}`).join(' ');

interface CellViewProps {
  readonly shape: CellShape;
  readonly values: readonly Value[];
  /** the big value and its colour, or null for an open cell */
  readonly value: Value | null;
  readonly valueColor: string;
  /** small values: notes (green) and candidates (grey) */
  readonly notes: string;
  readonly candidates: string;
  readonly fill: string;
  /** hatched: a hint's number rules the value out of this cell */
  readonly ruledOut: boolean;
  /** the values are colours (a nonogram): value -> CSS colour */
  readonly palette: ReadonlyMap<Value, string> | undefined;
  readonly onPress: (cell: Cell) => void;
}

/**
 * A value as a colour: a filled square (inset, so the highlight of the cell shows around it), or
 * a dot for BLANK; `color` marks how it got there (a mistake: a red cross over it).
 */
function ColorValue({
  shape,
  value,
  palette,
  color,
}: {
  shape: CellShape;
  value: Value;
  palette: ReadonlyMap<Value, string>;
  color: string;
}) {
  const area = shape.hintArea;
  const inset = Math.min(area.width, area.height) * 0.08;
  const mistake = color === COLORS.violation;
  const { x, y } = shape.valueCenter;
  const r = Math.min(area.width, area.height) * 0.3;
  return (
    <>
      {value === BLANK ? (
        <Circle cx={x} cy={y} r={r * 0.25} fill={color} testID={`blank-${shape.cell.getName()}`} />
      ) : (
        <Rect
          x={area.x + inset}
          y={area.y + inset}
          width={area.width - 2 * inset}
          height={area.height - 2 * inset}
          fill={palette.get(value) ?? '#000000'}
          testID={`color-${shape.cell.getName()}`}
        />
      )}
      {mistake && (
        <Polyline
          points={`${x - r},${y - r} ${x + r},${y + r} ${x},${y} ${x + r},${y - r} ${x - r},${y + r}`}
          fill="none"
          stroke={COLORS.violation}
          strokeWidth={r / 4}
          strokeLinecap="round"
        />
      )}
    </>
  );
}

const CellView = memo(function CellView({
  shape,
  values,
  value,
  valueColor,
  notes,
  candidates,
  fill,
  ruledOut,
  palette,
  onPress,
}: CellViewProps) {
  const noteSet = new Set(notes.split(',').filter(Boolean).map(Number));
  const candidateSet = new Set(candidates.split(',').filter(Boolean).map(Number));
  const [columns, rows] = hintGrid(values.length);
  const area = shape.hintArea;
  const smallSize = Math.min(area.width / columns, area.height / rows) * 0.62;
  return (
    <G onPress={() => onPress(shape.cell)} testID={`cell-${shape.cell.getName()}`}>
      <Polygon
        points={pointsAttribute(shape.outline)}
        fill={fill}
        stroke="#000000"
        strokeWidth={shape.strokeWidth}
      />
      {ruledOut && (
        <Polygon
          points={pointsAttribute(shape.outline)}
          fill={`url(#${RULED_OUT})`}
          testID={`ruled-out-${shape.cell.getName()}`}
        />
      )}
      {value !== null && palette !== undefined ? (
        <ColorValue shape={shape} value={value} palette={palette} color={valueColor} />
      ) : value !== null ? (
        <SvgText
          x={shape.valueCenter.x}
          y={shape.valueCenter.y + shape.valueFontSize * 0.35}
          fontSize={shape.valueFontSize}
          fill={valueColor}
          textAnchor="middle"
          fontFamily={FONT}
        >
          {String(value)}
        </SvgText>
      ) : (
        values.map((v, index) => {
          const isNote = noteSet.has(v);
          if (!isNote && !candidateSet.has(v)) return null;
          const x = area.x + ((index % columns) + 0.5) * (area.width / columns);
          const y = area.y + (Math.floor(index / columns) + 0.5) * (area.height / rows);
          if (palette !== undefined) {
            // a small swatch per colour (a ring for BLANK); a note gets a green border
            const half = smallSize * 0.45;
            return v === BLANK ? (
              <Circle
                key={v}
                cx={x}
                cy={y}
                r={half * 0.8}
                fill="none"
                stroke={isNote ? COLORS.note : COLORS.candidate}
                strokeWidth={isNote ? half / 2.5 : half / 4}
              />
            ) : (
              <Rect
                key={v}
                x={x - half}
                y={y - half}
                width={2 * half}
                height={2 * half}
                fill={palette.get(v) ?? '#000000'}
                stroke={isNote ? COLORS.note : 'none'}
                strokeWidth={half / 2.5}
              />
            );
          }
          return (
            <SvgText
              key={v}
              x={x}
              y={y + smallSize * 0.35}
              fontSize={smallSize}
              fill={isNote ? COLORS.note : COLORS.candidate}
              fontWeight={isNote ? 'bold' : 'normal'}
              textAnchor="middle"
              fontFamily={FONT}
            >
              {String(v)}
            </SvgText>
          );
        })
      )}
    </G>
  );
});

/** Dashed diagonal lines, spaced to the cell size, that fill the ruled-out cells. */
function RuledOutPattern({ spacing }: { spacing: number }) {
  return (
    <Defs>
      <Pattern
        id={RULED_OUT}
        patternUnits="userSpaceOnUse"
        width={spacing}
        height={spacing}
        patternTransform="rotate(45)"
      >
        <Line
          x1={spacing / 2}
          y1={0}
          x2={spacing / 2}
          y2={spacing}
          stroke={RULED_OUT_COLOR}
          strokeWidth={spacing / 7}
          strokeDasharray={`${spacing / 2} ${spacing / 2}`}
        />
      </Pattern>
    </Defs>
  );
}

/** A highlight colours the cell; otherwise it shows its own background (e.g. a shaded box). */
function cellFill(role: HighlightRole, background: string | undefined): string {
  return role === HighlightRole.NONE && background !== undefined ? background : roleColor(role);
}

function Decorations({ layout }: { layout: BoardLayout }) {
  return (
    <>
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
    </>
  );
}

/** A border around each group through which a hint's numbers rule the value out. */
function ReasonGroups({ session, layout }: { session: PuzzleSession; layout: BoardLayout }) {
  const groups = [...session.hintReasonGroups];
  if (groups.length === 0) return null;
  const width = (layout.cells[0]?.valueFontSize ?? 10) / 7;
  return (
    <>
      {groups.map((group) => {
        const cells = new Set(group.getCells());
        const edges = outlineEdges(layout.cells.filter((s) => cells.has(s.cell)));
        return (
          <G key={group.getName()} testID={`reason-group-${group.getName()}`}>
            {edges.map(([a, b], i) => (
              <Line
                key={i}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={REASON_GROUP_COLOR}
                strokeWidth={width}
                strokeLinecap="square"
              />
            ))}
          </G>
        );
      })}
    </>
  );
}

export function Board({ session }: { session: PuzzleSession }) {
  useSession(session);
  const { settings } = useSettings();
  const [size, setSize] = useState({ width: 0, height: 0 });
  const layout = useMemo(() => LAYOUTS[session.type.name](session.puzzle), [session]);
  const values = useMemo(() => session.puzzle.getValues(), [session]);

  const { game } = session;
  const violations = session.violations();
  const roles = session.highlight();
  const onPress = useMemo(() => (cell: Cell) => session.selectCell(cell), [session]);
  const { bounds } = layout;
  // about six lines across a cell
  const hatchSpacing = (layout.cells[0]?.valueFontSize ?? 10) / 3.3;

  return (
    <View
      style={{ flex: 1, alignSelf: 'stretch' }}
      onLayout={(e: LayoutChangeEvent) => setSize(e.nativeEvent.layout)}
      testID="board"
    >
      {size.width > 0 && size.height > 0 && (
        <Svg
          width={size.width}
          height={size.height}
          viewBox={`${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}`}
        >
          <RuledOutPattern spacing={hatchSpacing} />
          {layout.cells.map((shape) => {
            const cell = shape.cell;
            const shown = game.valueOf(cell);
            let valueColor: string = COLORS.given;
            if (game.isMistake(cell) || (shown !== null && violations.has(cell))) {
              valueColor = COLORS.violation;
            } else if (cell.isEntered()) {
              valueColor = COLORS.entered;
            } else if (cell.isInferred()) {
              valueColor = COLORS.solver;
            }
            const candidates =
              shown === null && settings.showHints
                ? [...cell.values].sort((a, b) => a - b).join(',')
                : '';
            return (
              <CellView
                key={cell.getName()}
                shape={shape}
                values={values}
                value={shown}
                valueColor={valueColor}
                notes={[...game.notesOf(cell)].sort((a, b) => a - b).join(',')}
                candidates={candidates}
                fill={cellFill(roles.get(cell) ?? HighlightRole.NONE, shape.background)}
                ruledOut={session.hintRuledOut.has(cell)}
                palette={layout.palette}
                onPress={onPress}
              />
            );
          })}
          <Decorations layout={layout} />
          <ReasonGroups session={session} layout={layout} />
        </Svg>
      )}
    </View>
  );
}
