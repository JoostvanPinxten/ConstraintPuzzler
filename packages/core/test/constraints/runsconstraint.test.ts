// RunsConstraint: the blocks of a nonogram line, in one or more colours.
import { describe, expect, it } from 'vitest';

import {
  BLACK_AND_WHITE,
  BLANK,
  paletteOf,
  RunsConstraint,
  type PaletteColor,
  type Run,
} from '../../src/constraints/runsconstraint';
import { Solver } from '../../src/solver/solver';
import type { Cell } from '../../src/structure/cell';
import { DeductionLog, type Deduction } from '../../src/structure/deduction';
import { ContradictionError } from '../../src/structure/errors';
import { Position } from '../../src/structure/position';
import { Puzzle } from '../../src/structure/puzzle';
import { sortedValues } from '../../src/structure/types';

const RED_GREEN: readonly PaletteColor[] = [
  { value: BLANK, name: 'blank', hex: '#ffffff' },
  { value: 1, name: 'red', hex: '#ff0000' },
  { value: 2, name: 'green', hex: '#00ff00' },
];
const red = (length: number): Run => ({ color: 1, length });
const green = (length: number): Run => ({ color: 2, length });

/** One line of `size` cells with the blocks; two colours when `palette` is RED_GREEN. */
function line(runs: Run[], size: number, palette: readonly PaletteColor[] = BLACK_AND_WHITE) {
  const puzzle = new Puzzle(
    'line',
    palette.map((c) => c.value),
  );
  const cells = Array.from({ length: size }, (_, i) =>
    puzzle.getGrid().addCell(new Position(i + 1, 1)),
  );
  const group = puzzle.addConstraintGroup('Row 1');
  const constraint = group.addConstraint(RunsConstraint);
  for (const cell of cells) group.addCell(cell);
  constraint.setRuns(runs, palette);
  return { puzzle, cells, constraint };
}

const candidates = (cells: readonly Cell[]): number[][] =>
  cells.map((c) => sortedValues(c.getPossibleValues()));

/** Apply the constraint once and return what it changed. */
function apply(puzzle: Puzzle, constraint: RunsConstraint): Deduction[] {
  const log = new DeductionLog();
  puzzle.recording(log, () => puzzle.causedBy(constraint, () => constraint.applyConstraint()));
  return log.deductions.filter((d) => d.cause === constraint);
}

describe('RunsConstraint propagation', () => {
  it('finds the overlap of a block', () => {
    const { cells, constraint } = line([red(4)], 6);
    constraint.applyConstraint();
    expect(candidates(cells)).toEqual([[0, 1], [0, 1], [1], [1], [0, 1], [0, 1]]);
  });

  it('needs a gap between blocks of the same colour', () => {
    const { cells, constraint } = line([red(2), red(2)], 5);
    constraint.applyConstraint();
    expect(candidates(cells)).toEqual([[1], [1], [0], [1], [1]]);
  });

  it('lets blocks of different colours touch', () => {
    const four = line([red(2), green(2)], 4, RED_GREEN);
    four.constraint.applyConstraint();
    expect(candidates(four.cells)).toEqual([[1], [1], [2], [2]]);
    const five = line([red(2), green(2)], 5, RED_GREEN);
    five.constraint.applyConstraint();
    expect(candidates(five.cells)).toEqual([[0, 1], [1], [0, 1, 2], [2], [0, 2]]);
  });

  it('makes a line without blocks blank', () => {
    const { cells, constraint } = line([], 3, RED_GREEN);
    constraint.applyConstraint();
    expect(cells.map((c) => c.getValue())).toEqual([0, 0, 0]);
  });

  it('uses the cells that are known', () => {
    const { cells, constraint } = line([red(1), red(1)], 5);
    cells[1]?.setValue(1);
    constraint.applyConstraint();
    // the first block is the 1 in cell 2, so cells 1 and 3 are blank
    expect(candidates(cells)).toEqual([[0], [1], [0], [0, 1], [0, 1]]);
  });

  it('throws a ContradictionError when no placement fits', () => {
    const { cells, constraint } = line([red(2)], 4);
    cells[1]?.setValue(BLANK);
    cells[2]?.setValue(BLANK);
    expect(() => constraint.applyConstraint()).toThrow(ContradictionError);
  });

  it('rejects blocks that do not fit', () => {
    expect(() => line([red(2), red(2)], 4)).toThrow(/do not fit/);
    expect(() => line([{ color: BLANK, length: 2 }], 4)).toThrow(/invalid block/);
    expect(() => line([red(0)], 4)).toThrow(/invalid block/);
  });

  it('gives the first and last start of every block', () => {
    const { cells, constraint } = line([red(2), red(1)], 6);
    const result = constraint.placements(cells.map((c) => c.getPossibleValues()));
    expect(result?.firstStart).toEqual([0, 3]);
    expect(result?.lastStart).toEqual([2, 5]);
  });
});

describe('RunsConstraint techniques', () => {
  it('rates a line its blocks fill as the easiest', () => {
    const { puzzle, constraint } = line([red(2), red(2)], 5);
    const deductions = apply(puzzle, constraint);
    expect(deductions.every((d) => constraint.techniqueOf(d) === 'wholeLine')).toBe(true);
    expect(deductions[0]?.difficulty()).toBe(2);
    expect(deductions[0]?.reason()).toBe(
      'the blocks of Row 1 (2 2) and the gaps they need fill the whole line',
    );
  });

  it('explains an overlap with the starts of the block', () => {
    const { puzzle, constraint } = line([red(4)], 6);
    const [deduction] = apply(puzzle, constraint);
    expect(deduction && constraint.techniqueOf(deduction)).toBe('overlap');
    expect(deduction?.difficulty()).toBe(3);
    expect(deduction?.reason()).toBe(
      'block 1 of Row 1 (4) starts somewhere in cells 1-3, so it always covers cells 3-4: this cell is black',
    );
  });

  it('explains a colour that no block can reach', () => {
    const { puzzle, cells, constraint } = line([red(1), green(1)], 4, RED_GREEN);
    cells[1]?.setValue(1);
    const deductions = apply(puzzle, constraint);
    // cell 1 can only be blank or the red block, but cell 2 is red: it is blank
    const first = deductions.find((d) => d.cell === cells[0]);
    expect(first && constraint.techniqueOf(first)).toBe('reach');
    expect(first?.reason()).toBe('no block of Row 1 can reach this cell, so it is blank');
    const fourth = deductions.find((d) => d.cell === cells[3] && d.removed.has(1));
    expect(fourth?.reason()).toBe('no red block of Row 1 can reach this cell');
  });

  it('names a colour the line has no blocks of', () => {
    const { puzzle, cells, constraint } = line([red(1)], 3, RED_GREEN);
    const deduction = apply(puzzle, constraint).find((d) => d.cell === cells[1]);
    expect(deduction?.reason()).toBe('Row 1 has no green blocks');
  });

  it('falls back to all placements for harder deductions', () => {
    // 1 1 in five cells with cell 3 red: cells 2 and 4 are blank (next to the red cell), but
    // which block cell 3 is cannot be seen from the first and last starts alone
    const { puzzle, cells, constraint } = line([red(1), red(1)], 5);
    cells[2]?.setValue(1);
    const deductions = apply(puzzle, constraint);
    const second = deductions.find((d) => d.cell === cells[1]);
    expect(second && constraint.techniqueOf(second)).toBe('placements');
    expect(second?.difficulty()).toBe(5);
    expect(second?.reason()).toBe(
      'of all ways to place the blocks of Row 1 (1 1) that fit the cells known so far, every one makes this cell blank',
    );
  });

  it('calls a column a column', () => {
    const puzzle = new Puzzle('column', [0, 1]);
    const cells = [1, 2, 3].map((y) => puzzle.getGrid().addCell(new Position(1, y)));
    const group = puzzle.addConstraintGroup('Column 1');
    const constraint = group.addConstraint(RunsConstraint);
    for (const cell of cells) group.addCell(cell);
    constraint.setRuns([red(3)]);
    expect(apply(puzzle, constraint)[0]?.reason()).toMatch(/fill the whole column$/);
  });
});

describe('RunsConstraint descriptions and checks', () => {
  it('describes the clue', () => {
    const { constraint, cells } = line([red(2), green(1)], 4, RED_GREEN);
    expect(constraint.summary()).toBe('blocks 2 red, 1 green');
    expect(constraint.describe()).toBe(
      'The blocks, in this order: 2 red, 1 green; 0 of 4 cells known.',
    );
    for (const [i, v] of [1, 1, 2, 0].entries()) cells[i]?.setValue(v);
    expect(constraint.describe()).toBe('The blocks, in this order: 2 red, 1 green; complete.');
    expect(line([], 2).constraint.describe()).toMatch(/^This line has no blocks/);
    expect(constraint.toString()).toBe('runs[2:1 1:2]');
  });

  it('finds the values that break the clue', () => {
    const { cells, constraint } = line([red(2)], 4);
    const shown = new Map<Cell, number>([[cells[0] as Cell, 1]]);
    const valueOf = (c: Cell) => shown.get(c) ?? null;
    expect(constraint.violations(valueOf).size).toBe(0);
    shown.set(cells[2] as Cell, 1);
    expect(constraint.violations(valueOf)).toEqual(new Set([cells[0], cells[2]]));
  });

  it('gives the palette of a puzzle', () => {
    const { puzzle } = line([red(1)], 2, RED_GREEN);
    expect(paletteOf(puzzle)).toBe(RED_GREEN);
    expect(paletteOf(new Puzzle('empty', [1, 2]))).toBeNull();
  });

  it('solves a small two-colour picture with the solver', () => {
    // 1r 1g / 1g 1r over a 2x2 grid: the clues and their order fix the picture
    const puzzle = new Puzzle('2x2', [0, 1, 2]);
    const grid = [1, 2].map((y) => [1, 2].map((x) => puzzle.getGrid().addCell(new Position(x, y))));
    const add = (name: string, lineCells: Cell[], runs: Run[]) => {
      const group = puzzle.addConstraintGroup(name);
      const constraint = group.addConstraint(RunsConstraint);
      for (const cell of lineCells) group.addCell(cell);
      constraint.setRuns(runs, RED_GREEN);
    };
    const at = (x: number, y: number) => grid[y]?.[x] as Cell;
    add('Row 1', [at(0, 0), at(1, 0)], [red(1), green(1)]);
    add('Row 2', [at(0, 1), at(1, 1)], [green(1), red(1)]);
    add('Column 1', [at(0, 0), at(0, 1)], [red(1), green(1)]);
    add('Column 2', [at(1, 0), at(1, 1)], [green(1), red(1)]);
    expect(new Solver(puzzle).countSolutions()).toBe(1);
    new Solver(puzzle).propagate();
    expect(grid.map((r) => r.map((c) => c.getValue()))).toEqual([
      [1, 2],
      [2, 1],
    ]);
  });
});

describe('RunsConstraint placements to show', () => {
  /** apply the constraint, and put the line back as it was (like a hint) */
  function hintDeductions(puzzle: Puzzle, constraint: RunsConstraint): Deduction[] {
    const state = puzzle.saveState();
    const deductions = apply(puzzle, constraint);
    puzzle.restoreState(state);
    return deductions;
  }

  it('lists every placement of the blocks, the blocks furthest to the start first', () => {
    const { cells, constraint } = line([red(2), red(1)], 5);
    const { rows, total } = constraint.linePlacements(cells.map((c) => c.getPossibleValues()));
    expect(total).toBe(3);
    expect(rows).toEqual([
      [1, 1, 0, 1, 0],
      [1, 1, 0, 0, 1],
      [0, 1, 1, 0, 1],
    ]);
  });

  it('counts all placements but lists only up to the limit', () => {
    const { cells, constraint } = line([red(1)], 6);
    const { rows, total } = constraint.linePlacements(
      cells.map((c) => c.getPossibleValues()),
      2,
    );
    expect(total).toBe(6);
    expect(rows).toEqual([
      [1, 0, 0, 0, 0, 0],
      [0, 1, 0, 0, 0, 0],
    ]);
  });

  it('lets blocks of different colours touch', () => {
    const { cells, constraint } = line([red(1), green(1)], 2, RED_GREEN);
    const { rows } = constraint.linePlacements(cells.map((c) => c.getPossibleValues()));
    expect(rows).toEqual([[1, 2]]);
  });

  it('shows where the covering block can go for an overlap', () => {
    const { puzzle, cells, constraint } = line([red(4)], 6);
    const deduction = hintDeductions(puzzle, constraint).find((d) => d.cell === cells[2]);
    expect(deduction && constraint.techniqueOf(deduction)).toBe('overlap');
    const diagram = deduction && constraint.placementDiagram(deduction);
    expect(diagram).toMatchObject({ index: 2, value: 1, block: 0, total: 3, vertical: false });
    expect(diagram?.rows).toEqual([
      [1, 1, 1, 1, null, null],
      [null, 1, 1, 1, 1, null],
      [null, null, 1, 1, 1, 1],
    ]);
  });

  it('gives every start a block can have, without the ones the known cells rule out', () => {
    // 2 in five cells with cell 3 blank: the block is in cells 1-2 or 4-5
    const { cells, constraint } = line([red(2)], 5);
    cells[2]?.setValue(BLANK);
    expect(constraint.placements(cells.map((c) => c.getPossibleValues()))?.starts).toEqual([
      [0, 3],
    ]);
  });

  it('gives the values known now and the direction of the line', () => {
    const { puzzle, cells, constraint } = line([red(3)], 4);
    cells[0]?.setValue(BLANK);
    const deduction = hintDeductions(puzzle, constraint)[0];
    const diagram = deduction && constraint.placementDiagram(deduction);
    expect(diagram?.known).toEqual([0, null, null, null]);
    expect(diagram?.rows).toEqual([[null, 1, 1, 1]]);
  });

  it('shows all placements of the line for a harder deduction', () => {
    const { puzzle, cells, constraint } = line([red(1), red(1)], 5);
    cells[2]?.setValue(1);
    const deduction = hintDeductions(puzzle, constraint).find((d) => d.cell === cells[1]);
    const diagram = deduction && constraint.placementDiagram(deduction);
    expect(diagram?.block).toBeNull();
    expect(diagram?.total).toBe(2);
    expect(diagram?.rows.every((row) => row[1] === BLANK)).toBe(true);
  });
});
