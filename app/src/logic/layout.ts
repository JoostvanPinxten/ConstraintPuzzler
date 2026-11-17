/**
 * Where everything of a puzzle is drawn: the cells (as polygons, with the area for the small
 * candidate values and the place of the big value) and the decorations around them (Sudoku
 * block lines, Kakuro clue triangles, Futoshiki inequality signs, Sumbrero clue hexagons).
 *
 * The geometry follows the PySide6 windows (sudokuMain.py, kakuroMain.py, futoshikiMain.py,
 * sumbreroMain.py and gui/puzzlerepresentation). It is pure data, so it can be tested without
 * rendering; components/Board.tsx draws it with react-native-svg.
 */
import {
  CellGreaterThanCellConstraint,
  clueAnchor,
  LINE_DIRECTIONS,
  lineKind,
  neighbour,
  PositionedCell,
  TotalSumValueConstraint,
  type Cell,
  type Direction,
  type Position,
  type Puzzle,
  type PuzzleTypeName,
} from '@constraintpuzzler/core';

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface CellShape {
  readonly cell: Cell;
  /** the outline of the cell, in board coordinates */
  readonly outline: readonly Point[];
  readonly strokeWidth: number;
  /** where the small candidate values and notes are laid out */
  readonly hintArea: Rect;
  /** the centre of the big value */
  readonly valueCenter: Point;
  readonly valueFontSize: number;
}

export type Decoration =
  | {
      readonly kind: 'polygon';
      readonly points: readonly Point[];
      readonly fill: string;
      readonly stroke?: string;
      readonly strokeWidth?: number;
    }
  | {
      readonly kind: 'polyline';
      readonly points: readonly Point[];
      readonly stroke: string;
      readonly strokeWidth: number;
    }
  | {
      readonly kind: 'text';
      readonly at: Point;
      readonly text: string;
      readonly fontSize: number;
      readonly fill: string;
      readonly bold?: boolean;
    };

export interface BoardLayout {
  /** the area that holds everything (the SVG viewBox) */
  readonly bounds: Rect;
  readonly cells: readonly CellShape[];
  /** drawn on top of the cells */
  readonly decorations: readonly Decoration[];
}

const BLACK = '#000000';
const WHITE = '#ffffff';

/** (columns, rows) of the grid that shows `count` candidate values (3x3 for 1-9). */
export function hintGrid(count: number): [number, number] {
  const columns = Math.max(1, Math.ceil(Math.sqrt(count)));
  return [columns, Math.max(1, Math.ceil(count / columns))];
}

function square(cell: Cell, x: number, y: number, size: number): CellShape {
  return {
    cell,
    outline: [
      { x, y },
      { x: x + size, y },
      { x: x + size, y: y + size },
      { x, y: y + size },
    ],
    strokeWidth: 1,
    hintArea: { x, y, width: size, height: size },
    valueCenter: { x: x + size / 2, y: y + size / 2 },
    valueFontSize: size * 0.55,
  };
}

function boundsOf(points: Iterable<Point>, margin: number): Rect {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  if (minX === Infinity) return { x: 0, y: 0, width: 1, height: 1 };
  return {
    x: minX - margin,
    y: minY - margin,
    width: maxX - minX + 2 * margin,
    height: maxY - minY + 2 * margin,
  };
}

function decorationPoints(decoration: Decoration): readonly Point[] {
  return decoration.kind === 'text' ? [decoration.at] : decoration.points;
}

function finish(cells: CellShape[], decorations: Decoration[], margin = 4): BoardLayout {
  const points = [...cells.flatMap((c) => c.outline), ...decorations.flatMap(decorationPoints)];
  return { bounds: boundsOf(points, margin), cells, decorations };
}

function rectangle(x: number, y: number, width: number, height: number, fill: string): Decoration {
  return {
    kind: 'polygon',
    points: [
      { x, y },
      { x: x + width, y },
      { x: x + width, y: y + height },
      { x, y: y + height },
    ],
    fill,
  };
}

// --- Sudoku ----------------------------------------------------------------------------------

export function sudokuLayout(puzzle: Puzzle): BoardLayout {
  const cellSize = 55;
  const blockPadding = 3;
  const grid = puzzle.getGrid();
  const cells: CellShape[] = [];
  for (let y = 0; y < 9; y++) {
    for (let x = 0; x < 9; x++) {
      // leave room between the 3x3 blocks for the block lines
      const left = cellSize * x + Math.floor(x / 3) * blockPadding;
      const top = cellSize * y + Math.floor(y / 3) * blockPadding;
      cells.push(square(grid.getCellFromSquareGrid(x, y), left, top, cellSize));
    }
  }
  const decorations: Decoration[] = [];
  const length = 9 * cellSize + 4 * blockPadding;
  for (let i = 0; i < 4; i++) {
    const offset = 3 * cellSize * i + (i - 1) * blockPadding;
    decorations.push(rectangle(offset, -blockPadding, blockPadding, length, BLACK));
    decorations.push(rectangle(-blockPadding, offset, length, blockPadding, BLACK));
  }
  return finish(cells, decorations, 1);
}

// --- Kakuro ----------------------------------------------------------------------------------

export function kakuroLayout(puzzle: Puzzle): BoardLayout {
  const cellSize = 55;
  const cells = puzzle
    .getGrid()
    .getPositionedCells()
    .map((c) =>
      square(c, c.getPosition().x() * cellSize, c.getPosition().y() * cellSize, cellSize),
    );

  // the sum of a line goes in a triangle of the black square just before the line
  const decorations: Decoration[] = [];
  for (const group of puzzle.getConstraintGroups()) {
    for (const constraint of group.getConstraints()) {
      if (!(constraint instanceof TotalSumValueConstraint) || group.getCells().length === 0) {
        continue;
      }
      const [anchor, direction] = clueAnchor(group.getPositionedCells());
      const x = anchor.x() * cellSize;
      const y = anchor.y() * cellSize;
      const s = cellSize;
      // down: the bottom-left half (sum below the diagonal); across: the top-right half
      const corners =
        direction === 'down'
          ? [
              { x, y },
              { x: x + s, y: y + s },
              { x, y: y + s },
            ]
          : [
              { x, y },
              { x: x + s, y: y + s },
              { x: x + s, y },
            ];
      decorations.push({
        kind: 'polygon',
        points: corners,
        fill: BLACK,
        stroke: WHITE,
        strokeWidth: 1,
      });
      decorations.push({
        kind: 'text',
        at:
          direction === 'down'
            ? { x: x + s / 3, y: y + 0.72 * s }
            : { x: x + (2 * s) / 3, y: y + 0.3 * s },
        text: String(constraint.getTotalValue()),
        fontSize: s * 0.3,
        fill: WHITE,
      });
    }
  }
  return finish(cells, decorations);
}

// --- Futoshiki -------------------------------------------------------------------------------

/** A chevron centred between two cell centres, its point towards the lesser cell. */
export function inequalitySign(
  greaterCenter: Point,
  lesserCenter: Point,
  depth: number,
  width: number,
): Decoration {
  const dx = lesserCenter.x - greaterCenter.x;
  const dy = lesserCenter.y - greaterCenter.y;
  const length = Math.hypot(dx, dy);
  if (length === 0) throw new Error('an inequality needs two distinct cells');
  const direction = { x: dx / length, y: dy / length };
  const normal = { x: -direction.y, y: direction.x };
  const middle = {
    x: (greaterCenter.x + lesserCenter.x) / 2,
    y: (greaterCenter.y + lesserCenter.y) / 2,
  };
  const tip = { x: middle.x + (direction.x * depth) / 2, y: middle.y + (direction.y * depth) / 2 };
  const back = { x: middle.x - (direction.x * depth) / 2, y: middle.y - (direction.y * depth) / 2 };
  return {
    kind: 'polyline',
    points: [
      { x: back.x + (normal.x * width) / 2, y: back.y + (normal.y * width) / 2 },
      tip,
      { x: back.x - (normal.x * width) / 2, y: back.y - (normal.y * width) / 2 },
    ],
    stroke: BLACK,
    strokeWidth: Math.max(1.5, depth / 6),
  };
}

export function futoshikiLayout(puzzle: Puzzle): BoardLayout {
  const cellSize = 55;
  const cellGap = 22; // room between the cells for the inequality signs
  const pitch = cellSize + cellGap;
  const shapes = new Map<Cell, CellShape>();
  for (const c of puzzle.getGrid().getPositionedCells()) {
    shapes.set(c, square(c, c.getPosition().x() * pitch, c.getPosition().y() * pitch, cellSize));
  }
  const decorations: Decoration[] = [];
  for (const constraint of puzzle.getConstraints()) {
    if (!(constraint instanceof CellGreaterThanCellConstraint)) continue;
    const greater = constraint.greaterCell && shapes.get(constraint.greaterCell);
    const lesser = constraint.lesserCell && shapes.get(constraint.lesserCell);
    if (greater && lesser) {
      decorations.push(
        inequalitySign(greater.valueCenter, lesser.valueCenter, cellGap * 0.45, cellGap * 0.8),
      );
    }
  }
  return finish([...shapes.values()], decorations);
}

// --- Sumbrero --------------------------------------------------------------------------------

const ALL_DIRECTIONS: readonly Direction[] = ['N', 'S', 'NE', 'SE', 'NW', 'SW'];
/** the wedges of a clue hexagon that hold line sums */
export type ClueDirection = 'NE' | 'SE' | 'S';

/**
 * Where the sum of every line is drawn: the black hexagon just before the first cell of the
 * line, and the wedge of that hexagon that faces along the line (S, SE or NE).
 */
export function clueLayout(
  puzzle: Puzzle,
): Map<TotalSumValueConstraint, [Position, ClueDirection]> {
  const layout = new Map<TotalSumValueConstraint, [Position, ClueDirection]>();
  for (const group of puzzle.getConstraintGroups()) {
    const kind = lineKind(group);
    if (kind === null || group.getCells().length === 0) continue;
    const [backward, forward] = LINE_DIRECTIONS[kind];
    const first = group
      .getPositionedCells()
      .map((c) => c.getPosition())
      .reduce((a, b) => (b.x() < a.x() || (b.x() === a.x() && b.y() < a.y()) ? b : a));
    for (const constraint of group.getConstraints()) {
      if (constraint instanceof TotalSumValueConstraint) {
        layout.set(constraint, [neighbour(first, backward), forward as ClueDirection]);
      }
    }
  }
  return layout;
}

/** The black hexagons around the grid: every position next to a cell that is not a cell. */
export function framePositions(puzzle: Puzzle): Position[] {
  const cells = new Set(
    puzzle
      .getGrid()
      .getPositionedCells()
      .map((c) => c.getPosition().key()),
  );
  const frame = new Map<string, Position>();
  for (const cell of puzzle.getGrid().getPositionedCells()) {
    for (const direction of ALL_DIRECTIONS) {
      const p = neighbour(cell.getPosition(), direction);
      if (!cells.has(p.key())) frame.set(p.key(), p);
    }
  }
  return [...frame.values()].sort((a, b) => a.x() - b.x() || a.y() - b.y());
}

export function sumbreroLayout(puzzle: Puzzle): BoardLayout {
  const side = 100; // the width of a flat-topped hexagon
  const height = (side * Math.sqrt(3)) / 2;
  const topLeft = (p: Position): Point => ({
    x: p.x() * 0.75 * side,
    y: p.y() * height + (((p.x() % 2) + 2) % 2 === 1 ? height / 2 : 0),
  });
  const hexagon = (origin: Point): Point[] =>
    Array.from({ length: 6 }, (_, k) => ({
      x: origin.x + ((Math.cos((k * Math.PI) / 3) + 1) * side) / 2,
      y: origin.y + ((Math.sin((k * Math.PI) / 3) + Math.sqrt(3) / 2) * side) / 2,
    }));

  const cells: CellShape[] = puzzle
    .getGrid()
    .getPositionedCells()
    .map((c: PositionedCell) => {
      const origin = topLeft(c.getPosition());
      const quarter = side / 4;
      return {
        cell: c,
        outline: hexagon(origin),
        strokeWidth: 2,
        hintArea: {
          x: origin.x + 0.7 * quarter,
          y: origin.y + 0.25 * quarter,
          width: 3 * quarter,
          height: 3 * quarter,
        },
        valueCenter: { x: origin.x + side / 2, y: origin.y + height / 2 },
        valueFontSize: side * 0.42,
      };
    });

  const cluesAt = new Map<string, Map<ClueDirection, TotalSumValueConstraint>>();
  for (const [constraint, [position, direction]] of clueLayout(puzzle)) {
    const clues = cluesAt.get(position.key()) ?? new Map<ClueDirection, TotalSumValueConstraint>();
    clues.set(direction, constraint);
    cluesAt.set(position.key(), clues);
  }

  const decorations: Decoration[] = [];
  const lineWidth = Math.max(1, side / 50);
  for (const position of framePositions(puzzle)) {
    const { x, y } = topLeft(position);
    const corner = {
      right: { x: x + side, y: y + height / 2 },
      bottomRight: { x: x + 0.75 * side, y: y + height },
      bottomLeft: { x: x + 0.25 * side, y: y + height },
      left: { x, y: y + height / 2 },
      topLeft: { x: x + 0.25 * side, y },
      topRight: { x: x + 0.75 * side, y },
    };
    const center = { x: x + side / 2, y: y + height / 2 };
    decorations.push({
      kind: 'polygon',
      points: Object.values(corner),
      fill: BLACK,
      stroke: WHITE,
      strokeWidth: lineWidth,
    });
    for (const [from, to] of [
      [corner.topRight, corner.bottomLeft],
      [center, corner.right],
      [center, corner.bottomRight],
    ] as const) {
      decorations.push({
        kind: 'polyline',
        points: [from, to],
        stroke: WHITE,
        strokeWidth: lineWidth,
      });
    }
    const wedges: Record<ClueDirection, [Point, Point]> = {
      NE: [corner.topRight, corner.right],
      SE: [corner.right, corner.bottomRight],
      S: [corner.bottomRight, corner.bottomLeft],
    };
    for (const [direction, constraint] of cluesAt.get(position.key()) ?? []) {
      const [a, b] = wedges[direction];
      decorations.push({
        kind: 'text',
        at: { x: (center.x + a.x + b.x) / 3, y: (center.y + a.y + b.y) / 3 },
        text: String(constraint.getTotalValue()),
        fontSize: side * 0.16,
        fill: WHITE,
        bold: true,
      });
    }
  }
  return finish(cells, decorations, 2);
}

export const LAYOUTS: Readonly<Record<PuzzleTypeName, (puzzle: Puzzle) => BoardLayout>> = {
  sudoku: sudokuLayout,
  kakuro: kakuroLayout,
  futoshiki: futoshikiLayout,
  sumbrero: sumbreroLayout,
};
