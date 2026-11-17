// The puzzle file parsers, the Sumbrero hexagon geometry and the Kakuro clue positions.
import { describe, expect, it } from 'vitest';

import type { ConstraintGroup } from '../../src/constraints/constraintgroup';
import { parseIndex, parseRange, PuzzleFileError, splitLines } from '../../src/parsers/common';
import { parseFutoshikiLines } from '../../src/parsers/futoshiki';
import { clueAnchor, parseKakuroLines } from '../../src/parsers/kakuro';
import {
  ASCENDING_ROW,
  ascendingRow,
  COLUMN,
  DESCENDING_ROW,
  descendingRow,
  lineKind,
  neighbour,
  parseSumbreroLines,
  type Direction,
} from '../../src/parsers/sumbrero';
import { Solver } from '../../src/solver/solver';
import { PositionedCell } from '../../src/structure/cell';
import { Position } from '../../src/structure/position';
import { Puzzle } from '../../src/structure/puzzle';
import { loadExample } from '../helpers';

const TINY_KAKURO = `\
# solves to 1 2 / 3 1
range = 1,9
cell(1,1)
cell(2,1)
cell(1,2)
cell(2,2)
total((1,1);(2,1)) = 3
total((1,2);(2,2)) = 4
total((1,1);(1,2)) = 4
total((2,1);(2,2)) = 3
`;

function positionsOf(group: ConstraintGroup | undefined): [number, number][] {
  return (group as ConstraintGroup)
    .getPositionedCells()
    .map((c) => [c.getPosition().x(), c.getPosition().y()] as [number, number])
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
}

const parseKakuro = (text: string): Puzzle => parseKakuroLines(splitLines(text), 'puzzle.txt');

function expectFileError(parse: () => unknown, lineNumber: number, fragment: string): void {
  let error: unknown;
  try {
    parse();
  } catch (e) {
    error = e;
  }
  expect(error).toBeInstanceOf(PuzzleFileError);
  expect((error as Error).message).toContain(`line ${lineNumber}:`);
  expect((error as Error).message).toContain(fragment);
}

describe('kakuro parser', () => {
  it('reads a tiny kakuro that solves', () => {
    const puzzle = parseKakuro(TINY_KAKURO);
    expect(new Solver(puzzle).solve()).toBe(true);
    expect(
      puzzle
        .getGrid()
        .getCells()
        .map((c) => c.getValue()),
    ).toEqual([1, 2, 3, 1]);
  });

  it('allows whitespace in a total', () => {
    const puzzle = parseKakuro(
      TINY_KAKURO.replace('total((1,1);(2,1)) = 3', 'total( (1, 1) ; (2,1) )=3'),
    );
    expect(positionsOf(puzzle.getConstraintGroups()[0])).toEqual([
      [1, 1],
      [2, 1],
    ]);
    expect(new Solver(puzzle).solve()).toBe(true);
  });

  it('reads indented statements', () => {
    const puzzle = parseKakuro(
      splitLines(TINY_KAKURO)
        .map((line) => `   ${line}`)
        .join('\n'),
    );
    expect(puzzle.getGrid().getCells()).toHaveLength(4);
    expect(new Solver(puzzle).solve()).toBe(true);
  });

  it('reads Windows line endings', () => {
    expect(new Solver(parseKakuro(TINY_KAKURO.replaceAll('\n', '\r\n'))).solve()).toBe(true);
  });

  it.each([
    [
      'an undeclared cell',
      'range = 1,9\ncell(1,1)\ntotal((1,1);(2,1)) = 3\n',
      3,
      'before it is declared',
    ],
    [
      'an unreadable cell',
      'range = 1,9\ncell(1,1)\ncell(2,1)\ntotal((1,1);(2,x)) = 3\n',
      4,
      '(x,y)',
    ],
    [
      'a cell twice in a total',
      'range = 1,9\ncell(1,1)\ncell(2,1)\ntotal((1,1);(1,1)) = 3\n',
      4,
      'more than once',
    ],
    ['a cell declared twice', 'range = 1,9\ncell(1,1)\ncell( 1,1 )\n', 3, 'declared twice'],
    ['a cell before the range', 'cell(1,1)\nrange = 1,9\n', 1, 'must come before'],
    ['a total without =', 'range = 1,9\ncell(1,1)\ntotal((1,1))\n', 3, 'expected total'],
    [
      'a total that is not a number',
      'range = 1,9\ncell(1,1)\ntotal((1,1)) = x\n',
      3,
      'whole number',
    ],
    ['an empty range', 'range = 9,1\n', 1, 'is empty'],
    ['a missing range', '# nothing here\n', 2, "no 'range"],
  ])('reports %s', (_what, text, lineNumber, fragment) => {
    expectFileError(() => parseKakuro(text), lineNumber, fragment);
  });

  it.each([
    ['simpleKakuro.txt', 4],
    ['mediumKakuro.txt', 44],
  ])('parses %s', (file, totals) => {
    const puzzle = loadExample('kakuro', file);
    expect(puzzle.getConstraintGroups()).toHaveLength(totals);
    for (const group of puzzle.getConstraintGroups()) {
      expect(new Set(group.getCells()).size).toBe(group.getCells().length);
    }
  });
});

describe('kakuro clue anchor', () => {
  const cellsAt = (...positions: [number, number][]): PositionedCell[] => {
    const puzzle = new Puzzle('test', [1, 2, 3, 4, 5, 6, 7, 8, 9]);
    return positions.map(([x, y]) => puzzle.getGrid().addCell(new Position(x, y)));
  };

  it('is left of an across line', () => {
    expect(clueAnchor(cellsAt([3, 2], [1, 2], [2, 2]))).toEqual([new Position(0, 2), 'across']);
  });

  it('is above a down line', () => {
    expect(clueAnchor(cellsAt([4, 5], [4, 3], [4, 4]))).toEqual([new Position(4, 2), 'down']);
  });

  it('treats a single cell as across', () => {
    expect(clueAnchor(cellsAt([2, 2]))).toEqual([new Position(1, 2), 'across']);
  });

  it('needs cells', () => {
    expect(() => clueAnchor([])).toThrow();
  });
});

describe('hexagon geometry', () => {
  const OPPOSITE: Record<Direction, Direction> = {
    N: 'S',
    S: 'N',
    NE: 'SW',
    SW: 'NE',
    SE: 'NW',
    NW: 'SE',
  };
  const positions: Position[] = [];
  for (let x = -3; x < 6; x++) for (let y = -3; y < 6; y++) positions.push(new Position(x, y));

  it('has symmetric neighbours', () => {
    for (const position of positions) {
      for (const [direction, opposite] of Object.entries(OPPOSITE) as [Direction, Direction][]) {
        expect(neighbour(neighbour(position, direction), opposite)).toEqual(position);
      }
    }
  });

  it('has rows that follow their direction', () => {
    for (const p of positions) {
      expect(descendingRow(neighbour(p, 'SE'))).toBe(descendingRow(p));
      expect(ascendingRow(neighbour(p, 'NE'))).toBe(ascendingRow(p));
      // and the other directions leave the row
      expect(descendingRow(neighbour(p, 'NE'))).not.toBe(descendingRow(p));
      expect(ascendingRow(neighbour(p, 'SE'))).not.toBe(ascendingRow(p));
      expect(descendingRow(neighbour(p, 'S'))).not.toBe(descendingRow(p));
      expect(ascendingRow(neighbour(p, 'S'))).not.toBe(ascendingRow(p));
    }
  });

  it('numbers the rows where they cross column 0', () => {
    for (let y = -3; y < 6; y++) {
      expect(descendingRow(new Position(0, y))).toBe(y);
      expect(ascendingRow(new Position(0, y))).toBe(y);
    }
  });
});

describe('sumbrero parser', () => {
  const puzzle = loadExample('sumbrero', 'simpleSumbrero.txt');
  const groups = new Map(puzzle.getConstraintGroups().map((g) => [g.getName(), g]));

  it('selects straight lines', () => {
    expect(positionsOf(groups.get(`${COLUMN} 1`))).toEqual([
      [1, 0],
      [1, 1],
      [1, 2],
      [1, 3],
    ]);
    expect(positionsOf(groups.get(`${DESCENDING_ROW} 0`))).toEqual([
      [0, 0],
      [1, 0],
      [2, 1],
      [3, 1],
    ]);
    expect(positionsOf(groups.get(`${ASCENDING_ROW} 2`))).toEqual([
      [0, 2],
      [1, 1],
      [2, 1],
      [3, 0],
    ]);
  });

  it('tells the kind of a line', () => {
    expect(lineKind(groups.get(`${ASCENDING_ROW} 2`) as ConstraintGroup)).toBe(ASCENDING_ROW);
    expect(lineKind(puzzle.addConstraintGroup('Other'))).toBeNull();
  });

  it('has different ascending and descending rows', () => {
    for (let index = 0; index < 4; index++) {
      expect(positionsOf(groups.get(`${DESCENDING_ROW} ${index}`))).not.toEqual(
        positionsOf(groups.get(`${ASCENDING_ROW} ${index}`)),
      );
    }
  });

  it('solves the example by deduction', () => {
    const fresh = loadExample('sumbrero', 'simpleSumbrero.txt');
    expect(new Solver(fresh).solve()).toBe(true);
    for (const group of fresh.getConstraintGroups()) {
      const values = group.getCells().map((c) => c.getValue());
      expect(new Set(values).size, group.getName()).toBe(values.length);
    }
  });

  it.each([
    ['an empty line', 'range = 1,9\ncell(0,0)\nrow_ascending(7) = 3\n', 3, 'contains no cells'],
    ['a line without =', 'range = 1,9\ncell(0,0)\ncolumn(0)\n', 3, 'expected column(n)'],
    ['a cell declared twice', 'range = 1,9\ncell(0,0)\ncell(0, 0)\n', 3, 'declared twice'],
    ['a cell before the range', 'cell(0,0)\n', 1, 'must come before'],
    ['a missing range', '', 1, "no 'range"],
  ])('reports %s', (_what, text, lineNumber, fragment) => {
    expectFileError(() => parseSumbreroLines(splitLines(text), 'inline'), lineNumber, fragment);
  });

  it('names the source in errors', () => {
    expectFileError(() => parseSumbreroLines(['cell(0,0)'], 'inline'), 1, 'inline, line 1:');
  });
});

describe('sudoku and futoshiki', () => {
  it('parse the examples', () => {
    expect(loadExample('sudoku', 'easySudoku.txt').getGrid().getCells()).toHaveLength(81);
    expect(new Solver(loadExample('futoshiki', 'futoshiki.txt')).solve()).toBe(true);
  });

  it('reads a futoshiki without relations', () => {
    const puzzle = parseFutoshikiLines(['1 -', '- -']);
    expect(puzzle.getGrid().getCells()).toHaveLength(4);
    expect(new Solver(puzzle).solve()).toBe(true);
  });

  it('refuses a malformed relation', () => {
    expect(() => parseFutoshikiLines(['- -', '- -', 'relativity', '1,1>2,1>2,2'])).toThrow();
    expect(() => parseFutoshikiLines(['- -', '- -', 'relativity', '1>2,1'])).toThrow();
  });
});

describe('common helpers', () => {
  it('parse ranges and indices', () => {
    expect(parseRange(' 1 , 3 ')).toEqual([1, 2, 3]);
    expect(() => parseRange('1')).toThrow(/range like/);
    expect(parseIndex(' ( -2 ) ')).toBe(-2);
    expect(() => parseIndex('2')).toThrow(/like \(n\)/);
  });
});
