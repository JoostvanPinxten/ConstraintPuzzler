/** Builds puzzles: an empty Sudoku or Futoshiki, an example Kakuro, single-constraint tests. */
import type { Constraint } from './constraints/constraint';
import type { ConstraintGroup } from './constraints/constraintgroup';
import { ExactCoverConstraint } from './constraints/exactcoverconstraint';
import { TotalSumValueConstraint } from './constraints/totalsumvalueconstraint';
import { UniqueValueConstraint } from './constraints/uniquevalueconstraint';
import { msg } from './i18n/message';
import { Position } from './structure/position';
import { Puzzle } from './structure/puzzle';
import type { Value } from './structure/types';

const range = (from: number, to: number): number[] =>
  Array.from({ length: to - from }, (_, i) => from + i);

export function createEmptySudoku(name = 'Sudoku'): Puzzle {
  const sudoku = new Puzzle(name, range(1, 10));
  const blocks: ConstraintGroup[] = [];
  const rows: ConstraintGroup[] = [];
  const columns: ConstraintGroup[] = [];
  for (let i = 0; i < 9; i++) {
    for (const [list, name] of [
      [blocks, 'group.block'],
      [rows, 'group.row'],
      [columns, 'group.column'],
    ] as const) {
      const group = sudoku.addConstraintGroup(msg(name, { index: i + 1 }));
      group.addConstraint(ExactCoverConstraint);
      list.push(group);
    }
  }
  for (let i = 0; i < 81; i++) {
    const x = i % 9;
    const y = Math.floor(i / 9);
    const block = Math.floor(x / 3) + 3 * Math.floor(y / 3);
    const cell = sudoku.getGrid().addCell(new Position(x + 1, y + 1));
    cell.addConstraintGroup(blocks[block] as ConstraintGroup);
    cell.addConstraintGroup(rows[y] as ConstraintGroup);
    cell.addConstraintGroup(columns[x] as ConstraintGroup);
  }
  return sudoku;
}

export function createExampleKakuro(): Puzzle {
  const puzzle = new Puzzle('Very simple example Kakuro', range(1, 11));
  const grid = puzzle.getGrid();
  const c11 = grid.addCell(new Position(1, 1));
  const c12 = grid.addCell(new Position(1, 2));
  const c21 = grid.addCell(new Position(2, 1));
  const c22 = grid.addCell(new Position(2, 2));
  const lines = [
    ['Group 1', 12, c11, c12],
    ['Group 2', 19, c11, c21],
    ['Group 3', 10, c21, c22],
    ['Group 4', 3, c12, c22],
  ] as const;
  for (const [name, total, a, b] of lines) {
    const group = puzzle.addConstraintGroup(name);
    group.addConstraint(UniqueValueConstraint);
    group.addConstraint(TotalSumValueConstraint).setTotalValue(total);
    group.addCell(a);
    group.addCell(b);
  }
  return puzzle;
}

export function createSingleConstraintPuzzle(
  possibleValues: Iterable<Value>,
  numberOfCells: number,
  constraintType: new (group: ConstraintGroup, initialValues: Iterable<Value>) => Constraint,
): Puzzle {
  const puzzle = new Puzzle(
    `${numberOfCells}Cell test puzzle with single constraint type`,
    possibleValues,
  );
  const group = puzzle.addConstraintGroup('Group');
  group.addConstraint(constraintType);
  for (let i = 0; i < numberOfCells; i++) group.addCell(puzzle.getGrid().addCell());
  return puzzle;
}

export function createFutoshikiPuzzle(size: number): Puzzle {
  const puzzle = new Puzzle(`${size}x${size} Futoshiki test puzzle`, range(1, size + 1));
  const grid = puzzle.getGrid();
  for (let y = 1; y <= size; y++) {
    for (let x = 1; x <= size; x++) grid.addCell(new Position(x, y));
  }
  for (let i = 0; i < size; i++) {
    const row = puzzle.addConstraintGroup(msg('group.row', { index: i + 1 }));
    row.addConstraint(ExactCoverConstraint);
    const column = puzzle.addConstraintGroup(msg('group.column', { index: i + 1 }));
    column.addConstraint(ExactCoverConstraint);
    for (let j = 0; j < size; j++) {
      // getCellFromSquareGrid takes (x, y): x is the column, y the row
      row.addCell(grid.getCellFromSquareGrid(j, i));
      column.addCell(grid.getCellFromSquareGrid(i, j));
    }
  }
  return puzzle;
}
