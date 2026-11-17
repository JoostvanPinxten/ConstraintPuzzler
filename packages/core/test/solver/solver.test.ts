// Solving: propagation to a fixpoint, single steps, guessing, contradictions and cancelling.
import { describe, expect, it } from 'vitest';

import { CellGreaterThanCellConstraint } from '../../src/constraints/cellgreaterthancellconstraint';
import type { ConstraintGroup } from '../../src/constraints/constraintgroup';
import { TotalSumValueConstraint } from '../../src/constraints/totalsumvalueconstraint';
import { UniqueValueConstraint } from '../../src/constraints/uniquevalueconstraint';
import { parseSudokuLines } from '../../src/parsers/sudoku';
import { createEmptySudoku, createSingleConstraintPuzzle } from '../../src/puzzlefactory';
import { SolveCancelled, Solver } from '../../src/solver/solver';
import { ContradictionError } from '../../src/structure/errors';
import type { Puzzle } from '../../src/structure/puzzle';
import { sortedValues } from '../../src/structure/types';
import { loadExample, readExample } from '../helpers';

function expectValidSudoku(sudoku: Puzzle): void {
  expect(sudoku.isSolved()).toBe(true);
  for (const group of sudoku.getConstraintGroups()) {
    const values = sortedValues(group.getCells().map((c) => c.getValue() as number));
    expect(values, `${group.getName()} is not a permutation of 1..9`).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9,
    ]);
  }
}

/** Two cells from {1, 2, 3} that are all different and add up to 6: impossible. */
function impossiblePuzzle(): Puzzle {
  const puzzle = createSingleConstraintPuzzle([1, 2, 3], 2, UniqueValueConstraint);
  const group = puzzle.getConstraintGroups()[0] as ConstraintGroup;
  group.addConstraint(TotalSumValueConstraint).setTotalValue(6);
  return puzzle;
}

describe('Solver', () => {
  it('finds a naked pair', () => {
    const sudoku = createEmptySudoku();
    const grid = sudoku.getGrid();
    grid.setConstraintGridValue(3, 1, 7);
    grid.setConstraintGridValue(4, 1, 4);
    grid.setConstraintGridValue(6, 2, 7);
    grid.setConstraintGridValue(7, 2, 4);
    grid.setConstraintGridValue(0, 3, 7);
    grid.setConstraintGridValue(0, 4, 4);
    // now only the second and third cell of the top row can hold 4 and 7
    new Solver(sudoku).solve();
    expect(sortedValues(grid.getCellFromSquareGrid(1, 0).values)).toEqual([4, 7]);
    expect(sortedValues(grid.getCellFromSquareGrid(2, 0).values)).toEqual([4, 7]);
  });

  it('keeps deducing until done', () => {
    const sudoku = loadExample('sudoku', 'easySudoku.txt');
    expect(new Solver(sudoku).solve()).toBe(true);
    expectValidSudoku(sudoku);
  });

  it('fills in one cell per step', () => {
    const sudoku = loadExample('sudoku', 'easySudoku.txt');
    const solver = new Solver(sudoku);
    const before = sudoku.saveState();
    const openBefore = sudoku.getNumberOfOpenCells();
    expect(solver.solveStep()).toBe(true);
    expect(sudoku.saveState()).not.toEqual(before);
    expect(sudoku.getNumberOfOpenCells()).toBe(openBefore - 1);
    expect(solver.lastStep?.setsValue()).toBe(true);

    let steps = 1;
    while (solver.solveStep()) {
      steps++;
      expect(steps).toBeLessThan(200);
    }
    expectValidSudoku(sudoku);
    expect(solver.solveStep()).toBe(false); // a solved puzzle no longer changes
  });

  it('prefers the deduction of the hint shown last', () => {
    const sudoku = loadExample('sudoku', 'easySudoku.txt');
    const solver = new Solver(sudoku);
    const deducible = solver.deducibleValues();
    const preferred = deducible[deducible.length - 1];
    expect(preferred).toBeDefined();
    solver.solveStep(preferred ?? null);
    expect(solver.lastStep?.cell).toBe(preferred?.cell);
    expect(preferred?.cell.getValue()).toBe(preferred?.value);
  });

  it('restores the puzzle after a failed step', () => {
    const puzzle = impossiblePuzzle();
    const before = puzzle.saveState();
    expect(() => new Solver(puzzle).solveStep()).toThrow(ContradictionError);
    expect(puzzle.saveState()).toEqual(before);
  });

  it('needs guessing for the hard sudoku', () => {
    const sudoku = loadExample('sudoku', 'hardSudoku.txt');
    const solver = new Solver(sudoku);
    expect(solver.solve()).toBe(false);
    solver.allowGuessing = true;
    expect(solver.solve()).toBe(true);
    expectValidSudoku(sudoku);
  });

  it('refuses a duplicate value in a row', () => {
    const sudoku = createEmptySudoku();
    sudoku.getGrid().setConstraintGridValue(0, 0, 1);
    expect(() => sudoku.getGrid().setConstraintGridValue(5, 0, 1)).toThrow(ContradictionError);
  });

  it('notices a cell without options', () => {
    const sudoku = createEmptySudoku();
    // column 8 already has a 9, so filling 1..8 in row 0 leaves (8,0) without options
    sudoku.getGrid().setConstraintGridValue(8, 5, 9);
    expect(() => {
      for (let x = 0; x < 8; x++) sudoku.getGrid().setConstraintGridValue(x, 0, x + 1);
    }).toThrow(ContradictionError);
  });

  it('reads zeros as empty cells', () => {
    const dashes = readExample('easySudoku.txt');
    const withZeros = parseSudokuLines(dashes.replaceAll('-', '0').split('\n'));
    const withDashes = parseSudokuLines(dashes.split('\n'));
    expect(withZeros.saveState()).toEqual(withDashes.saveState());
  });

  it('restores the puzzle after a failed solve', () => {
    const puzzle = impossiblePuzzle();
    const before = puzzle.saveState();
    expect(() => new Solver(puzzle).solve()).toThrow(ContradictionError);
    expect(puzzle.saveState()).toEqual(before);
  });

  it('solves the futoshiki', () => {
    const puzzle = loadExample('futoshiki', 'futoshiki.txt');
    const grid = puzzle.getGrid();
    expect(grid.getCells()).toHaveLength(49);
    expect(grid.getCellFromSquareGrid(0, 0).getValue()).toBe(5);
    expect(grid.getCellFromSquareGrid(6, 0).getValue()).toBe(6);
    const relations = puzzle
      .getConstraints()
      .filter(
        (c): c is CellGreaterThanCellConstraint => c instanceof CellGreaterThanCellConstraint,
      );
    expect(relations).toHaveLength(24);
    // first relation in the file: 2,1>3,1
    expect(relations[0]?.greaterCell).toBe(grid.getCellFromSquareGrid(1, 0));
    expect(relations[0]?.lesserCell).toBe(grid.getCellFromSquareGrid(2, 0));

    expect(new Solver(puzzle).solve()).toBe(true);
    for (const relation of relations) {
      expect(relation.greaterCell?.getValue() as number).toBeGreaterThan(
        relation.lesserCell?.getValue() as number,
      );
    }
  });

  it('saves and restores the state', () => {
    const sudoku = loadExample('sudoku', 'easySudoku.txt');
    const state = sudoku.saveState();
    new Solver(sudoku).solve();
    expect(sudoku.saveState()).not.toEqual(state);
    sudoku.restoreState(state);
    expect(sudoku.saveState()).toEqual(state);
  });

  it('counts solutions', () => {
    const sudoku = loadExample('sudoku', 'hardSudoku.txt');
    const before = sudoku.saveState();
    expect(new Solver(sudoku).countSolutions()).toBe(1);
    expect(new Solver(createEmptySudoku()).countSolutions(3)).toBe(3);
    expect(new Solver(impossiblePuzzle()).countSolutions()).toBe(0);
    expect(sudoku.saveState()).toEqual(before);
  });

  it('reports that an impossible puzzle has no solution', () => {
    expect(() => new Solver(impossiblePuzzle()).findSolution()).toThrow(/no solution/);
  });

  it('finds a solution that is not unique', () => {
    const { unique, solution } = new Solver(createEmptySudoku()).findSolution();
    expect(unique).toBe(false);
    expect(solution.cells.every((c) => c.value !== null)).toBe(true);
  });
});

describe('cancelling', () => {
  it('stops solve() and restores the puzzle', () => {
    const sudoku = loadExample('sudoku', 'hardSudoku.txt');
    const before = sudoku.saveState();
    let checks = 0;
    expect(() => new Solver(sudoku, true).solve(() => ++checks > 3)).toThrow(SolveCancelled);
    expect(sudoku.saveState()).toEqual(before);
    expect(sudoku.deductionLog).toBeNull();
  });

  it('stops findSolution() and restores the puzzle', () => {
    const sudoku = loadExample('sudoku', 'hardSudoku.txt');
    const before = sudoku.saveState();
    expect(() => new Solver(sudoku).findSolution(() => true)).toThrow(SolveCancelled);
    expect(sudoku.saveState()).toEqual(before);
  });
});

describe('async solving', () => {
  it('solves like solve()', async () => {
    const sudoku = loadExample('sudoku', 'hardSudoku.txt');
    const expected = loadExample('sudoku', 'hardSudoku.txt');
    new Solver(expected, true).solve();
    await expect(new Solver(sudoku, true).solveAsync({ sliceMs: 0 })).resolves.toBe(true);
    expect(sudoku.saveState()).toEqual(expected.saveState());
  });

  it('is cancelled by an AbortSignal and restores the puzzle', async () => {
    const sudoku = loadExample('sudoku', 'hardSudoku.txt');
    const before = sudoku.saveState();
    const controller = new AbortController();
    const solving = new Solver(sudoku, true).solveAsync({ signal: controller.signal, sliceMs: 0 });
    controller.abort();
    await expect(solving).rejects.toBeInstanceOf(SolveCancelled);
    expect(sudoku.saveState()).toEqual(before);
  });

  it('finds a solution', async () => {
    const sudoku = loadExample('sudoku', 'hardSudoku.txt');
    const before = sudoku.saveState();
    const { solution, unique } = await new Solver(sudoku).findSolutionAsync({ sliceMs: 0 });
    expect(unique).toBe(true);
    expect(solution.cells.every((c) => c.value !== null)).toBe(true);
    expect(sudoku.saveState()).toEqual(before);
  });

  it('rejects with ContradictionError for an impossible puzzle', async () => {
    const puzzle = impossiblePuzzle();
    const before = puzzle.saveState();
    await expect(new Solver(puzzle, true).solveAsync()).rejects.toBeInstanceOf(ContradictionError);
    expect(puzzle.saveState()).toEqual(before);
  });
});
