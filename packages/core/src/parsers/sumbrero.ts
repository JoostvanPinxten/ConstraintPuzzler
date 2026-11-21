/**
 * Parser for Sumbrero files, plus the hexagon geometry it relies on; see doc/puzzle-files.md
 * for the syntax.
 *
 * Sumbrero cells are flat-topped hexagons, laid out in columns: Position(x, y) is column x, row
 * y, and every odd column is shifted down by half a hexagon. A line of cells runs in one of
 * three directions: straight down (a column), down-right (a descending row) or up-right (an
 * ascending row). Rows are numbered by the row y at which they cross column 0.
 */
import type { ConstraintGroup } from '../constraints/constraintgroup';
import { TotalSumValueConstraint } from '../constraints/totalsumvalueconstraint';
import { UniqueValueConstraint } from '../constraints/uniquevalueconstraint';
import { msg, type MessageKey } from '../i18n/message';
import { Position } from '../structure/position';
import { Puzzle } from '../structure/puzzle';
import {
  floorDiv,
  mod,
  parseIndex,
  parseInteger,
  parsePosition,
  parseRange,
  PuzzleFileError,
} from './common';

export const COLUMN = 'Column';
export const DESCENDING_ROW = 'Descending row';
export const ASCENDING_ROW = 'Ascending row';
export type LineKind = typeof COLUMN | typeof DESCENDING_ROW | typeof ASCENDING_ROW;
export type Direction = 'N' | 'S' | 'NE' | 'SE' | 'NW' | 'SW';

/** Per kind of line: [direction towards its start, direction towards its end]. */
export const LINE_DIRECTIONS: Readonly<Record<LineKind, readonly [Direction, Direction]>> = {
  [COLUMN]: ['N', 'S'],
  [DESCENDING_ROW]: ['NW', 'SE'],
  [ASCENDING_ROW]: ['SW', 'NE'],
};

/** Index of the row running down-right (south-east) through position. */
export function descendingRow(position: Position): number {
  return position.y() - floorDiv(position.x(), 2);
}

/** Index of the row running up-right (north-east) through position. */
export function ascendingRow(position: Position): number {
  return position.y() + floorDiv(position.x() + 1, 2);
}

/** The adjacent position in direction N, S, NE, SE, NW or SW. */
export function neighbour(position: Position, direction: Direction): Position {
  const x = position.x();
  const y = position.y();
  const shift = mod(x, 2); // odd columns are half a hexagon lower
  const offsets: Record<Direction, [number, number]> = {
    N: [0, -1],
    S: [0, 1],
    NE: [1, shift - 1],
    SE: [1, shift],
    NW: [-1, shift - 1],
    SW: [-1, shift],
  };
  const [dx, dy] = offsets[direction];
  return new Position(x + dx, y + dy);
}

/** COLUMN, DESCENDING_ROW or ASCENDING_ROW for a line created by parseSumbreroLines, else null. */
export function lineKind(group: ConstraintGroup): LineKind | null {
  const name = group.getName();
  const space = name.lastIndexOf(' ');
  const kind = space >= 0 ? name.slice(0, space) : name;
  return kind in LINE_DIRECTIONS ? (kind as LineKind) : null;
}

/** The catalog keys of the line names, e.g. "Descending row 3". */
const LINE_KIND_KEYS: Readonly<Record<LineKind, MessageKey>> = {
  [COLUMN]: 'group.sumbreroColumn',
  [DESCENDING_ROW]: 'group.descendingRow',
  [ASCENDING_ROW]: 'group.ascendingRow',
};

const LINE_STATEMENTS: Record<string, [LineKind, (position: Position) => number]> = {
  column: [COLUMN, (p) => p.x()],
  row_descending: [DESCENDING_ROW, descendingRow],
  row_ascending: [ASCENDING_ROW, ascendingRow],
};

/**
 * Reads the lines of a Sumbrero file. Throws PuzzleFileError (naming filename and the line)
 * when they cannot be parsed.
 */
export function parseSumbreroLines(lines: readonly string[], filename = '<sumbrero>'): Puzzle {
  let puzzle: Puzzle | null = null;
  lines.forEach((rawLine, i) => {
    const line = rawLine.trim();
    const keyword = (line.split('(')[0] ?? '').split('=')[0]?.trim() ?? '';
    const statement = Object.hasOwn(LINE_STATEMENTS, keyword)
      ? LINE_STATEMENTS[keyword]
      : undefined;
    if (keyword !== 'range' && keyword !== 'cell' && statement === undefined) {
      return; // comments and blank lines
    }
    try {
      if (keyword === 'range') {
        puzzle = new Puzzle('Test-sumbrero', parseRange(line.split('=')[1] ?? ''));
        return;
      }
      if (puzzle === null) throw new Error("'range = min,max' must come before cells and sums");
      const grid = puzzle.getGrid();

      if (keyword === 'cell') {
        const position = parsePosition(line.slice('cell'.length));
        if (grid.getPositionedCells().some((c) => c.getPosition().equals(position))) {
          throw new Error(`cell ${position.toString()} is declared twice`);
        }
        grid.addCell(position);
        return;
      }

      // column(c) = n, row_descending(r) = n or row_ascending(r) = n
      const [kind, indexOf] = statement as [LineKind, (position: Position) => number];
      const rest = line.slice(keyword.length);
      const separator = rest.indexOf('=');
      if (separator < 0) throw new Error(`expected ${keyword}(n) = value`);
      const index = parseIndex(rest.slice(0, separator));
      const lineCells = grid.getPositionedCells().filter((c) => indexOf(c.getPosition()) === index);
      if (lineCells.length === 0)
        throw new Error(`${kind.toLowerCase()} ${index} contains no cells`);

      const group = puzzle.addConstraintGroup(msg(LINE_KIND_KEYS[kind], { index }));
      for (const c of lineCells) group.addCell(c);
      group.addConstraint(UniqueValueConstraint);
      group
        .addConstraint(TotalSumValueConstraint)
        .setTotalValue(parseInteger(rest.slice(separator + 1)));
    } catch (error) {
      if (error instanceof PuzzleFileError) throw error;
      throw new PuzzleFileError(filename, i + 1, `${(error as Error).message} (${line})`);
    }
  });
  if (puzzle === null) {
    throw new PuzzleFileError(filename, lines.length, "no 'range = min,max' line found");
  }
  return puzzle;
}
