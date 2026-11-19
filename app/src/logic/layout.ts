/**
 * Where everything of a puzzle is drawn: the cells (as polygons, with the area for the small
 * candidate values and the place of the big value) and the decorations around them (Sudoku
 * block lines, Kakuro clue triangles, Sumbrero clue hexagons). The inequalities of Futoshiki and
 * Jidoku are not decorations but bent cell edges, as in O'Sullivan & Horan, "Generating and Solving
 * Logic Puzzles through Constraint Satisfaction" (AAAI 2007), Figure 1.
 *
 * The geometry follows the former PySide6 windows (sudokuMain.py, kakuroMain.py, futoshikiMain.py,
 * sumbreroMain.py and gui/puzzlerepresentation, in the git history). It is pure data, so it can be tested without
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
  /** the fill when the cell is not highlighted (default: the white board), e.g. a shaded box */
  readonly background?: string;
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

// --- bent edges (Futoshiki, Jidoku) -----------------------------------------------------------

/** How far a bent edge reaches into the lesser cell, as a fraction of the cell size. */
export const BEND_DEPTH = 0.16;
/** How much of the edge the bend spans, as a fraction of the edge. */
export const BEND_SPAN = 0.42;

/** A square cell before its edges are bent: top-left corner and size. */
interface SquarePlacement {
  readonly cell: Cell;
  readonly x: number;
  readonly y: number;
  readonly size: number;
  readonly background?: string;
}

type Side = 'top' | 'right' | 'bottom' | 'left';
/** the outward normal of each side (y grows downwards) */
const SIDE_NORMALS: Readonly<Record<Side, Point>> = {
  top: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  bottom: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
};
const OPPOSITE: Readonly<Record<Side, Side>> = {
  top: 'bottom',
  right: 'left',
  bottom: 'top',
  left: 'right',
};

/** The side of `a` that `b` touches (they share a whole edge), or null. */
function touchingSide(a: SquarePlacement, b: SquarePlacement): Side | null {
  const close = (p: number, q: number) => Math.abs(p - q) < 1e-6;
  if (!close(a.size, b.size)) return null;
  if (close(a.y, b.y) && close(a.x + a.size, b.x)) return 'right';
  if (close(a.y, b.y) && close(b.x + b.size, a.x)) return 'left';
  if (close(a.x, b.x) && close(a.y + a.size, b.y)) return 'bottom';
  if (close(a.x, b.x) && close(b.y + b.size, a.y)) return 'top';
  return null;
}

/**
 * Square cells whose shared edge is bent into a < or > for every inequality between two touching
 * cells: the greater cell gets a tooth that points into the lesser cell, which gets the matching
 * notch, so the edge reads as the sign (its point at the lesser cell). The hint area keeps clear
 * of the bends. An inequality between cells that do not touch gets a separate sign instead.
 */
export function bentSquares(
  placements: readonly SquarePlacement[],
  relations: readonly CellGreaterThanCellConstraint[],
): { cells: CellShape[]; signs: Decoration[] } {
  const byCell = new Map(placements.map((p) => [p.cell, p]));
  /** cell -> side -> +1 (tooth) or -1 (notch) */
  const bends = new Map<Cell, Map<Side, number>>();
  const bend = (cell: Cell, side: Side, direction: number) => {
    const sides = bends.get(cell) ?? new Map<Side, number>();
    sides.set(side, direction);
    bends.set(cell, sides);
  };
  const center = (p: SquarePlacement): Point => ({ x: p.x + p.size / 2, y: p.y + p.size / 2 });
  const signs: Decoration[] = [];
  for (const relation of relations) {
    const greater = relation.greaterCell && byCell.get(relation.greaterCell);
    const lesser = relation.lesserCell && byCell.get(relation.lesserCell);
    if (!greater || !lesser) continue;
    const side = touchingSide(greater, lesser);
    if (side !== null) {
      bend(greater.cell, side, 1);
      bend(lesser.cell, OPPOSITE[side], -1);
    } else {
      const size = greater.size * 0.35;
      signs.push(inequalitySign(center(greater), center(lesser), size * 0.45, size * 0.8));
    }
  }

  const cells = placements.map((p): CellShape => {
    const { x, y, size } = p;
    const sides: [Side, Point, Point][] = [
      ['top', { x, y }, { x: x + size, y }],
      ['right', { x: x + size, y }, { x: x + size, y: y + size }],
      ['bottom', { x: x + size, y: y + size }, { x, y: y + size }],
      ['left', { x, y: y + size }, { x, y }],
    ];
    const outline: Point[] = [];
    for (const [side, a, b] of sides) {
      outline.push(a);
      const direction = bends.get(p.cell)?.get(side);
      if (direction === undefined) continue;
      const along = (t: number): Point => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
      const normal = SIDE_NORMALS[side];
      const middle = along(0.5);
      const depth = direction * BEND_DEPTH * size;
      outline.push(
        along(0.5 - BEND_SPAN / 2),
        { x: middle.x + normal.x * depth, y: middle.y + normal.y * depth },
        along(0.5 + BEND_SPAN / 2),
      );
    }
    const inset = BEND_DEPTH * size;
    return {
      cell: p.cell,
      outline,
      strokeWidth: 1,
      hintArea: { x: x + inset, y: y + inset, width: size - 2 * inset, height: size - 2 * inset },
      valueCenter: center(p),
      valueFontSize: size * 0.55,
      ...(p.background === undefined ? {} : { background: p.background }),
    };
  });
  return { cells, signs };
}

function greaterThanConstraints(puzzle: Puzzle): CellGreaterThanCellConstraint[] {
  return puzzle
    .getConstraints()
    .filter((c): c is CellGreaterThanCellConstraint => c instanceof CellGreaterThanCellConstraint);
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

/** The cells side by side, each inequality bent into the edge between its two cells. */
export function futoshikiLayout(puzzle: Puzzle): BoardLayout {
  const cellSize = 60;
  const placements = puzzle
    .getGrid()
    .getPositionedCells()
    .map((c) => ({
      cell: c,
      x: c.getPosition().x() * cellSize,
      y: c.getPosition().y() * cellSize,
      size: cellSize,
    }));
  const { cells, signs } = bentSquares(placements, greaterThanConstraints(puzzle));
  return finish(cells, signs);
}

// --- Jidoku ----------------------------------------------------------------------------------

/**
 * the shade of every other 3x3 box, as in the paper's figures; a neutral grey, so it does not
 * look like a highlight (e.g. the purple of a hint's "where to look")
 */
export const JIDOKU_BOX_SHADE = '#e9e9ec';

/**
 * A 9x9 grid without gaps; the boxes are told apart by shading every other one (as in the paper)
 * and the clues are bent edges between the cells of a box.
 */
export function jidokuLayout(puzzle: Puzzle): BoardLayout {
  const cellSize = 60;
  const grid = puzzle.getGrid();
  const placements: SquarePlacement[] = [];
  for (let y = 0; y < 9; y++) {
    for (let x = 0; x < 9; x++) {
      const shaded = (Math.floor(x / 3) + Math.floor(y / 3)) % 2 === 1;
      placements.push({
        cell: grid.getCellFromSquareGrid(x, y),
        x: x * cellSize,
        y: y * cellSize,
        size: cellSize,
        ...(shaded ? { background: JIDOKU_BOX_SHADE } : {}),
      });
    }
  }
  const { cells, signs } = bentSquares(placements, greaterThanConstraints(puzzle));
  return finish(cells, signs);
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
  jidoku: jidokuLayout,
  sumbrero: sumbreroLayout,
};

// --- group outlines --------------------------------------------------------------------------

/** Whether the point lies inside the polygon (even-odd rule; it need not be convex). */
function insidePolygon(point: Point, polygon: readonly Point[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i] as Point;
    const b = polygon[j] as Point;
    if (
      a.y > point.y !== b.y > point.y &&
      point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x
    ) {
      inside = !inside;
    }
  }
  return inside;
}

/** Twice the signed area of the polygon: positive when clockwise on screen (y downwards). */
function signedArea(polygon: readonly Point[]): number {
  let sum = 0;
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i] as Point;
    const b = polygon[(i + 1) % polygon.length] as Point;
    sum += a.x * b.y - b.x * a.y;
  }
  return sum;
}

/**
 * The outer edges of a set of cells (e.g. a row, column or box), to draw the border of the
 * group. An edge is inner when just beyond it (half its length out) lies another cell
 * of the set, so the gaps between Sudoku blocks do not break the border. The outlines need not
 * be convex (bent edges).
 */
export function outlineEdges(shapes: readonly CellShape[]): [Point, Point][] {
  const edges: [Point, Point][] = [];
  for (const shape of shapes) {
    const outline = shape.outline;
    const orientation = Math.sign(signedArea(outline));
    for (let i = 0; i < outline.length; i++) {
      const a = outline[i] as Point;
      const b = outline[(i + 1) % outline.length] as Point;
      const length = Math.hypot(b.x - a.x, b.y - a.y);
      if (length === 0) continue;
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      // the normal of the edge that points out of the cell (from the winding of the outline)
      const nx = (orientation * (b.y - a.y)) / length;
      const ny = (-orientation * (b.x - a.x)) / length;
      const beyond = { x: mid.x + (nx * length) / 2, y: mid.y + (ny * length) / 2 };
      const inner = shapes.some((other) => other !== shape && insidePolygon(beyond, other.outline));
      if (!inner) edges.push([a, b]);
    }
  }
  return edges;
}
