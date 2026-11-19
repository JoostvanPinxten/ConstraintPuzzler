// The constraints' propagation: all different, total sum, greater than, exact cover.
import { describe, expect, it } from 'vitest';

import { CellGreaterThanCellConstraint } from '../../src/constraints/cellgreaterthancellconstraint';
import type { Constraint } from '../../src/constraints/constraint';
import type { ConstraintGroup } from '../../src/constraints/constraintgroup';
import { ExactCoverConstraint } from '../../src/constraints/exactcoverconstraint';
import { TotalSumValueConstraint } from '../../src/constraints/totalsumvalueconstraint';
import { UniqueValueConstraint } from '../../src/constraints/uniquevalueconstraint';
import {
  createEmptySudoku,
  createExampleKakuro,
  createSingleConstraintPuzzle,
} from '../../src/puzzlefactory';
import type { Cell } from '../../src/structure/cell';
import { DeductionLog } from '../../src/structure/deduction';
import { ContradictionError } from '../../src/structure/errors';
import { sortedValues, type Value } from '../../src/structure/types';

const candidates = (cell: Cell | undefined): number[] =>
  sortedValues((cell as Cell).getPossibleValues());
const range = (from: number, to: number): number[] =>
  Array.from({ length: to - from }, (_, i) => from + i);

function singleGroup<C extends Constraint>(
  values: Iterable<Value>,
  cellCount: number,
  constraintType: new (group: ConstraintGroup, initialValues: Iterable<Value>) => C,
): { cells: Cell[]; constraint: C; group: ConstraintGroup } {
  const puzzle = createSingleConstraintPuzzle(values, cellCount, constraintType);
  const group = puzzle.getConstraintGroups()[0] as ConstraintGroup;
  return { cells: group.getCells(), constraint: group.getConstraints()[0] as C, group };
}

describe('constraints', () => {
  it('all different removes a placed value', () => {
    const { cells } = singleGroup([1, 2], 2, UniqueValueConstraint);
    cells[0]?.setValue(1);
    expect(candidates(cells[1])).toEqual([2]);
  });

  it('total sum keeps the values that can add up', () => {
    const { cells, constraint } = singleGroup([1, 2], 2, TotalSumValueConstraint);
    constraint.setTotalValue(3);
    constraint.applyConstraint();
    expect(candidates(cells[1])).toEqual([1, 2]);

    cells[0]?.setValue(1);
    constraint.applyConstraint();
    expect(candidates(cells[1])).toEqual([2]);
  });

  it('exact cover in a sudoku row leaves the last value', () => {
    const sudoku = createEmptySudoku();
    // fill the first 8 cells of the top row with 1..8; the last one must become 9
    for (let x = 0; x < 8; x++) sudoku.getGrid().setConstraintGridValue(x, 0, x + 1);
    const lastCell = sudoku.getGrid().getCellFromSquareGrid(8, 0);
    expect(lastCell.hasValue()).toBe(false);
    expect(candidates(lastCell)).toEqual([9]);
  });

  it('total sum removes all disallowed values (regression: remove while iterating)', () => {
    const { cells, group } = singleGroup(range(1, 10), 2, UniqueValueConstraint);
    const sum = group.addConstraint(TotalSumValueConstraint);
    sum.setTotalValue(4); // only 1+3 is possible
    sum.applyConstraint();
    for (const cell of cells) expect(candidates(cell)).toEqual([1, 3]);
    expect(sortedValues(sum.values)).toEqual([1, 3]);
  });

  it('greater than narrows both cells', () => {
    const { cells, constraint } = singleGroup([1, 2, 3], 2, CellGreaterThanCellConstraint);
    const [lesser, greater] = cells as [Cell, Cell];
    constraint.setLesserCell(lesser);
    constraint.setGreaterCell(greater);
    constraint.applyConstraint();
    expect(candidates(lesser)).toEqual([1, 2]);
    expect(candidates(greater)).toEqual([2, 3]);
  });

  it('greater than follows a set value', () => {
    const { cells, constraint } = singleGroup([1, 2, 3, 4], 2, CellGreaterThanCellConstraint);
    const [lesser, greater] = cells as [Cell, Cell];
    constraint.setLesserCell(lesser);
    constraint.setGreaterCell(greater);
    greater.setValue(3);
    constraint.applyConstraint();
    expect(candidates(lesser)).toEqual([1, 2]);
  });

  it('greater than without cells does nothing', () => {
    const { constraint } = singleGroup([1, 2], 2, CellGreaterThanCellConstraint);
    expect(() => constraint.applyConstraint()).not.toThrow();
  });

  it('treats removing the last value as a contradiction', () => {
    const { cells } = singleGroup([1, 2], 1, UniqueValueConstraint);
    const cell = cells[0] as Cell;
    cell.remove(1);
    expect(candidates(cell)).toEqual([2]);
    expect(() => cell.remove(2)).toThrow(ContradictionError);
  });

  it('builds the example kakuro', () => {
    expect(createExampleKakuro().getConstraints()).toHaveLength(8);
  });

  it('refuses an infeasible total', () => {
    const { group } = singleGroup(range(1, 10), 3, UniqueValueConstraint);
    const sum = group.addConstraint(TotalSumValueConstraint);
    expect(() => sum.setTotalValue(5)).toThrow(/Infeasible/); // 1 + 2 + 3 = 6 at least
  });

  it('needs a total before applying a sum', () => {
    const { constraint } = singleGroup([1, 2], 2, TotalSumValueConstraint);
    expect(() => constraint.applyConstraint()).toThrow(/not been initialized/);
  });

  it('finds a filled sum that does not add up', () => {
    const { cells, constraint } = singleGroup([1, 2, 3], 2, TotalSumValueConstraint);
    constraint.setTotalValue(5);
    cells[0]?.setValue(1);
    cells[1]?.setValue(1);
    expect(() => constraint.applyConstraint()).toThrow(ContradictionError);
  });
});

function exactCoverGroup<C extends Constraint = ExactCoverConstraint>(
  cellCount = 4,
  constraintType: new (
    group: ConstraintGroup,
    values: Iterable<Value>,
  ) => C = ExactCoverConstraint as never,
  values: Iterable<Value> = range(1, cellCount + 1),
): { cells: Cell[]; constraint: C } {
  const { cells, constraint } = singleGroup(values, cellCount, constraintType);
  return { cells, constraint };
}

describe('exact cover', () => {
  it('removes a placed value from the others', () => {
    const { cells } = exactCoverGroup();
    cells[0]?.setValue(1);
    for (const cell of cells.slice(1)) expect(cell.values.has(1)).toBe(false);
  });

  it('fills in a value with a single position', () => {
    // 4 can only go in the last cell, so it is filled in
    const { cells, constraint } = exactCoverGroup();
    for (const cell of cells.slice(0, 3)) cell.remove(4);
    constraint.applyConstraint();
    expect(cells[3]?.getValue()).toBe(4);
    expect(cells[3]?.isInferred()).toBe(true);
  });

  it('finds a hidden pair', () => {
    // 3 and 4 can only go in the first two cells, so those cells cannot hold 1 or 2
    const { cells, constraint } = exactCoverGroup();
    for (const cell of cells.slice(2)) {
      cell.remove(3);
      cell.remove(4);
    }
    constraint.applyConstraint();
    expect(candidates(cells[0])).toEqual([3, 4]);
    expect(candidates(cells[1])).toEqual([3, 4]);
    expect(candidates(cells[2])).toEqual([1, 2]);
  });

  it('finds a naked triple', () => {
    // three cells only hold 1, 2 and 3 between them, so the others cannot
    const { cells, constraint } = exactCoverGroup(6);
    const keep = [
      [1, 2],
      [2, 3],
      [1, 3],
    ];
    cells.slice(0, 3).forEach((cell, i) => {
      for (const value of [1, 2, 3, 4, 5, 6]) if (!keep[i]?.includes(value)) cell.remove(value);
    });
    constraint.applyConstraint();
    for (const cell of cells.slice(3)) expect(candidates(cell)).toEqual([4, 5, 6]);
  });

  it('finds a hidden triple', () => {
    // 1, 2 and 3 only fit in the first three cells, so those cells hold nothing else
    const { cells, constraint } = exactCoverGroup(6);
    for (const cell of cells.slice(3)) for (const value of [1, 2, 3]) cell.remove(value);
    cells[0]?.remove(3);
    // (the naked triple 4, 5, 6 in the other cells is the same fact; test the hidden search)
    constraint.searchForHiddenSubsets();
    expect(candidates(cells[0])).toEqual([1, 2]);
    expect(candidates(cells[1])).toEqual([1, 2, 3]);
    expect(candidates(cells[2])).toEqual([1, 2, 3]);
  });

  it('explains a subset deduction', () => {
    const { cells, constraint } = exactCoverGroup();
    const puzzle = constraint.group.puzzle;
    for (const cell of cells.slice(0, 2)) {
      cell.remove(3);
      cell.remove(4);
    }
    const log = new DeductionLog();
    puzzle.recording(log, () => puzzle.causedBy(constraint, () => constraint.applyConstraint()));
    const reasons = new Set(log.deductions.filter((d) => !d.setsValue()).map((d) => d.reason()));
    expect(reasons.size).toBeGreaterThan(0);
    for (const reason of reasons) {
      expect(reason).toContain('1, 2');
      expect(reason).toContain('between them');
    }
  });

  it('records the technique of its deductions', () => {
    const recorded = (
      setUp: (cells: Cell[]) => void,
      search?: (c: ExactCoverConstraint) => void,
    ) => {
      const { cells, constraint } = exactCoverGroup(6);
      const puzzle = constraint.group.puzzle;
      setUp(cells);
      const log = new DeductionLog();
      puzzle.recording(log, () =>
        puzzle.causedBy(constraint, () => (search ?? ((c) => c.applyConstraint()))(constraint)),
      );
      return new Set(log.deductions.map((d) => d.techniqueId()));
    };
    // 6 fits only in the last cell
    expect(recorded((cells) => cells.slice(0, 5).forEach((c) => c.remove(6)))).toContain(
      'hiddenSingle',
    );
    // the first two cells hold only 1 and 2
    const pair = (cells: Cell[]) =>
      cells.slice(0, 2).forEach((c) => [3, 4, 5, 6].forEach((v) => c.remove(v)));
    expect(recorded(pair, (c) => c.searchForNakedSubsets())).toEqual(new Set(['nakedSubset']));
    // 1 and 2 fit only in the first two cells
    const hidden = (cells: Cell[]) =>
      cells.slice(2).forEach((c) => [1, 2].forEach((v) => c.remove(v)));
    expect(recorded(hidden, (c) => c.searchForHiddenSubsets())).toEqual(new Set(['hiddenSubset']));
  });

  it('treats too few candidates as a contradiction', () => {
    const { cells, constraint } = exactCoverGroup();
    for (const cell of cells.slice(0, 3)) for (const value of [3, 4]) cell.remove(value);
    expect(() => constraint.applyConstraint()).toThrow(ContradictionError);
  });

  it('finds a naked pair in an all-different group', () => {
    // all different, more values than cells (like a Kakuro run): only naked subsets apply
    const { cells, constraint } = exactCoverGroup(3, UniqueValueConstraint, range(1, 10));
    for (const cell of cells.slice(0, 2)) for (const value of range(3, 10)) cell.remove(value);
    constraint.applyConstraint();
    expect(candidates(cells[2])).toEqual(range(3, 10));
  });

  it('deduces nothing when nothing is forced', () => {
    const { cells, constraint } = exactCoverGroup();
    constraint.applyConstraint();
    for (const cell of cells) expect(candidates(cell)).toEqual([1, 2, 3, 4]);
  });
});
