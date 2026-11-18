// The solver's deduction records: reasons, hints, single steps and agenda propagation.
import { describe, expect, it } from 'vitest';

import { ExactCoverConstraint } from '../../src/constraints/exactcoverconstraint';
import { TotalSumValueConstraint } from '../../src/constraints/totalsumvalueconstraint';
import { UniqueValueConstraint } from '../../src/constraints/uniquevalueconstraint';
import { parseSudokuLines } from '../../src/parsers/sudoku';
import { Solver } from '../../src/solver/solver';
import { ValueSource, type Cell } from '../../src/structure/cell';
import { NAKED_SINGLE, type Deduction } from '../../src/structure/deduction';
import { ContradictionError } from '../../src/structure/errors';
import type { Puzzle } from '../../src/structure/puzzle';
import { sortedValues, stateKey, type Value } from '../../src/structure/types';
import { allExamples, EASY, loadExample, seeded } from '../helpers';

const examples = allExamples();
const EMPTY = Array.from({ length: 9 }, () => '- - - - - - - - -');

/** Propagation the simple way: apply everything until a pass changes nothing. */
function fullFixedPoint(puzzle: Puzzle): void {
  const solver = new Solver(puzzle);
  let state = stateKey(puzzle.saveState());
  for (;;) {
    solver.step();
    const next = stateKey(puzzle.saveState());
    if (next === state) return;
    state = next;
  }
}

/** The values hints and single steps choose from (the puzzle is left unchanged). */
function passDeductions(puzzle: Puzzle): Deduction[] {
  const state = puzzle.saveState();
  const values = new Solver(puzzle).deducibleValues();
  expect(puzzle.saveState()).toEqual(state);
  return values;
}

describe('deductions', () => {
  it.each(examples)('%s: agenda propagation reaches the same fixpoint', (_name, load) => {
    const agenda = load();
    const full = load();
    new Solver(agenda).propagate();
    fullFixedPoint(full);
    // the cells end up the same (the sum constraints' own bookkeeping of values may differ,
    // as the passes visit the states in a different order)
    expect(agenda.saveState().cells).toEqual(full.saveState().cells);
  });

  it.each(examples)('%s: is solvable, with one solution', (_name, load) => {
    expect(new Solver(load(), true).solve()).toBe(true);
    expect(new Solver(load()).countSolutions()).toBe(1);
  });

  it.each(examples)('%s: records every change with a reason', (_name, load) => {
    const puzzle = load();
    const cells = puzzle.getGrid().getCells();
    const before = new Map(cells.map((c) => [c, c.getPossibleValues()]));
    const solver = new Solver(puzzle);
    solver.propagate();
    const removed = new Map<Cell, Set<Value>>(cells.map((c) => [c, new Set()]));
    for (const d of solver.log.deductions) {
      expect(d.reason()).toBeTruthy();
      expect(d.describe()).toContain(d.cell.getName());
      const set = removed.get(d.cell) as Set<Value>;
      for (const v of d.removed) set.add(v);
      if (d.setsValue()) {
        expect(d.source).toBe(ValueSource.DEDUCED);
        for (const v of before.get(d.cell) as Set<Value>) if (v !== d.value) set.add(v);
      }
    }
    // every candidate that disappeared is accounted for by a deduction
    for (const cell of cells) {
      const gone = [...(before.get(cell) as Set<Value>)].filter((v) => !cell.values.has(v));
      expect(sortedValues(gone)).toEqual(sortedValues(removed.get(cell) as Set<Value>));
    }
  });

  it('stops recording afterwards', () => {
    const puzzle = parseSudokuLines(EASY);
    const solver = new Solver(puzzle);
    solver.propagate();
    expect(puzzle.deductionLog).toBeNull();
    const recorded = solver.log.length;
    puzzle.getGrid().getCells()[0]?.reset(); // a change outside the solver is not recorded
    expect(solver.log.length).toBe(recorded);
  });

  it('gives a hint without changing the puzzle', () => {
    const puzzle = parseSudokuLines(EASY);
    const state = puzzle.saveState();
    const hint = new Solver(puzzle).hint() as Deduction;
    expect(puzzle.saveState()).toEqual(state);
    expect(hint.setsValue()).toBe(true);
    expect(hint.cell.values.has(hint.value as Value)).toBe(true);
    expect(hint.reason()).toBeTruthy();
  });

  it('gives correct hints', () => {
    const puzzle = parseSudokuLines(EASY);
    const solved = parseSudokuLines(EASY);
    new Solver(solved).solve();
    const solution = solved
      .getGrid()
      .getCells()
      .map((c) => c.getValue());
    const solver = new Solver(puzzle);
    for (let i = 0; i < 10; i++) {
      const hint = solver.hint() as Deduction;
      const index = puzzle.getGrid().getCells().indexOf(hint.cell);
      expect(hint.value).toBe(solution[index]);
      hint.cell.inferValue(hint.value as Value);
    }
  });

  it('explains a single step', () => {
    const solver = new Solver(parseSudokuLines(EASY));
    expect(solver.solveStep()).toBe(true);
    const step = solver.lastStep as Deduction;
    expect(step.cell.getValue()).toBe(step.value);
    expect(step.cell.getSource()).toBe(ValueSource.DEDUCED);
    expect(step.describe()).toBeTruthy();
  });

  it('records the guesses that led to the solution', () => {
    const puzzle = loadExample('sudoku', 'hardSudoku.txt');
    const solver = new Solver(puzzle, true);
    expect(solver.solve()).toBe(true);
    const guesses = solver.log.deductions.filter((d) => d.source === ValueSource.GUESSED);
    expect(guesses.length).toBeGreaterThan(0);
    for (const d of guesses) {
      expect(d.cell.getValue()).toBe(d.value);
      expect(d.reason()).toContain('guess');
    }
  });
});

describe('easiest first', () => {
  it.each(examples)('%s: a hint is one of the easiest deductions', (_name, load) => {
    const puzzle = load();
    const deductions = passDeductions(puzzle);
    if (deductions.length === 0) return;
    const lowest = Math.min(...deductions.map((d) => d.difficulty()));
    const solver = new Solver(puzzle);
    for (let seed = 0; seed < 5; seed++) {
      solver.random = seeded(seed);
      expect((solver.hint() as Deduction).difficulty()).toBe(lowest);
    }
  });

  it('a single step is one of the easiest deductions', () => {
    const puzzle = parseSudokuLines(EASY);
    const lowest = Math.min(...passDeductions(puzzle).map((d) => d.difficulty()));
    const solver = new Solver(puzzle);
    expect(solver.solveStep()).toBe(true);
    expect(solver.lastStep?.difficulty()).toBe(lowest);
  });

  it('orders the difficulties', () => {
    expect(NAKED_SINGLE).toBeLessThan(UniqueValueConstraint.difficulty);
    expect(ExactCoverConstraint.difficulty).toBe(UniqueValueConstraint.difficulty);
    expect(UniqueValueConstraint.difficulty).toBeLessThan(TotalSumValueConstraint.difficulty);
  });

  it('a single step fills the preferred cell', () => {
    const puzzle = parseSudokuLines(EASY);
    const deductions = passDeductions(puzzle);
    // the hardest one, which solveStep would not choose by itself
    const preferred = deductions.reduce((a, b) => (b.difficulty() > a.difficulty() ? b : a));
    const solver = new Solver(puzzle);
    expect(solver.solveStep(preferred)).toBe(true);
    expect(solver.lastStep?.cell).toBe(preferred.cell);
    expect(preferred.cell.getValue()).toBe(preferred.value);
  });
});

describe('counting solutions', () => {
  it('counts a unique solution', () => {
    const puzzle = parseSudokuLines(EASY);
    const state = puzzle.saveState();
    expect(new Solver(puzzle).countSolutions()).toBe(1);
    expect(puzzle.saveState()).toEqual(state);
  });

  it('counts up to the limit', () => {
    expect(new Solver(parseSudokuLines(EMPTY)).countSolutions(3)).toBe(3);
  });

  it('counts no solution', () => {
    const lines = [...EASY];
    lines[0] = '6 6 9 - - - - - 2'; // two sixes in a row
    expect(() => parseSudokuLines(lines)).toThrow(ContradictionError); // the parser notices
  });
});

describe('finding the solution', () => {
  it('finds a unique solution', () => {
    const puzzle = parseSudokuLines(EASY);
    const state = puzzle.saveState();
    const solver = new Solver(puzzle);
    const { solution, unique } = solver.findSolution();
    expect(unique).toBe(true);
    expect(puzzle.saveState()).toEqual(state);
    expect(solver.allowGuessing).toBe(false);
    const solved = parseSudokuLines(EASY);
    new Solver(solved).solve();
    expect(solution.cells).toEqual(solved.saveState().cells);
  });

  it('guesses for the hard puzzle', () => {
    const { solution, unique } = new Solver(loadExample('sudoku', 'hardSudoku.txt')).findSolution();
    expect(unique).toBe(true);
    expect(solution.cells.every((c) => c.value !== null)).toBe(true);
  });

  it('finds one of several solutions', () => {
    const { solution, unique } = new Solver(parseSudokuLines(EMPTY)).findSolution();
    expect(unique).toBe(false);
    expect(solution.cells.every((c) => c.value !== null)).toBe(true);
  });

  it('reports no solution', () => {
    const lines = [...EASY];
    lines[8] = '- - 6 5 3 2 - - -'; // a 6 in the bottom row, which another 6 needs
    const puzzle = parseSudokuLines(lines);
    expect(new Solver(puzzle).countSolutions()).toBe(0);
    const state = puzzle.saveState();
    expect(() => new Solver(puzzle).findSolution()).toThrow(ContradictionError);
    expect(puzzle.saveState()).toEqual(state);
  });

  it('can be used again after cancelling', () => {
    const puzzle = loadExample('sudoku', 'hardSudoku.txt');
    const solver = new Solver(puzzle, true);
    let checks = 0;
    expect(() => solver.solve(() => ++checks > 3)).toThrow();
    expect(solver.solve()).toBe(true);
  });
});
