// The short summaries, the descriptions and the violations of constraints, as shown in the UI.
import { describe, expect, it } from 'vitest';

import { CellGreaterThanCellConstraint } from '../../src/constraints/cellgreaterthancellconstraint';
import type { Constraint } from '../../src/constraints/constraint';
import type { ConstraintGroup } from '../../src/constraints/constraintgroup';
import { ExactCoverConstraint } from '../../src/constraints/exactcoverconstraint';
import { TotalSumValueConstraint } from '../../src/constraints/totalsumvalueconstraint';
import { UniqueValueConstraint } from '../../src/constraints/uniquevalueconstraint';
import { createSingleConstraintPuzzle } from '../../src/puzzlefactory';
import type { Cell } from '../../src/structure/cell';
import { Position } from '../../src/structure/position';
import { Puzzle } from '../../src/structure/puzzle';
import type { Value } from '../../src/structure/types';

type ConstraintType<C extends Constraint> = new (
  group: ConstraintGroup,
  initialValues: Iterable<Value>,
) => C;

const range = (from: number, to: number): number[] =>
  Array.from({ length: to - from }, (_, i) => from + i);

function singleConstraint<C extends Constraint>(
  values: Iterable<Value>,
  cellCount: number,
  constraintType: ConstraintType<C>,
): [Cell[], C] {
  const puzzle = createSingleConstraintPuzzle(values, cellCount, constraintType);
  const group = puzzle.getConstraintGroups()[0] as ConstraintGroup;
  return [puzzle.getGrid().getCells(), group.getConstraints()[0] as C];
}

describe('descriptions', () => {
  it('describe all different', () => {
    const [cells, constraint] = singleConstraint(range(1, 4), 3, UniqueValueConstraint);
    expect(constraint.summary()).toBe('all different');
    expect(constraint.describe()).toContain('nothing is placed yet');
    cells[0]?.setValue(3);
    cells[1]?.setValue(1);
    expect(constraint.describe()).toContain('placed so far: 1, 3');
  });

  it('list the values an exact cover still misses', () => {
    const [cells, constraint] = singleConstraint(range(1, 5), 4, ExactCoverConstraint);
    expect(constraint.summary()).toBe('each value once');
    cells[0]?.setValue(2);
    expect(constraint.describe()).toContain('still missing: 1, 3, 4');
    cells.slice(1).forEach((cell, i) => cell.setValue([1, 3, 4][i] as number));
    expect(constraint.describe()).toContain('complete');
  });

  it('compute the candidates of a sum without changing the state', () => {
    const puzzle = new Puzzle('sum', range(1, 10));
    const group = puzzle.addConstraintGroup('Line');
    group.addConstraint(UniqueValueConstraint);
    const constraint = group.addConstraint(TotalSumValueConstraint);
    const cells = [0, 1].map(() => puzzle.getGrid().addCell());
    for (const cell of cells) group.addCell(cell);
    constraint.setTotalValue(16);
    const state = puzzle.saveState();

    expect(constraint.summary()).toBe('sum = 16');
    const description = constraint.describe();
    expect(description).toContain('16 over 2 open cells');
    expect(description).toContain('candidates: 7, 9');
    expect(puzzle.saveState()).toEqual(state); // describe() must not change the puzzle
    const withoutHints = constraint.describe(false);
    expect(withoutHints).toContain('16 over 2 open cells');
    expect(withoutHints).not.toContain('candidates');

    cells[0]?.setValue(7);
    expect(constraint.describe()).toContain('7 is placed, so 9 is left for 1 open cell');
    cells[1]?.setValue(9);
    expect(constraint.describe()).toContain('complete (7 + 9)');
  });

  it('describe a sum without a total', () => {
    const [, constraint] = singleConstraint(range(1, 3), 2, TotalSumValueConstraint);
    expect(constraint.describe()).toContain('not been set');
  });

  it('name the smaller cell of a greater-than first', () => {
    const puzzle = new Puzzle('gt', [1, 2, 3]);
    const lesser = puzzle.getGrid().addCell(new Position(1, 1));
    const greater = puzzle.getGrid().addCell(new Position(2, 1));
    const group = puzzle.addConstraintGroup('Relativity');
    const constraint = group.addConstraint(CellGreaterThanCellConstraint);
    expect(constraint.summary()).toBe('smaller than (cells not set)');
    expect(constraint.describe()).toContain('have not been set');
    constraint.setLesserCell(lesser);
    constraint.setGreaterCell(greater);

    expect(constraint.summary()).toBe('(1, 1) < (2, 1)');
    expect(constraint.describe()).toContain('candidates 1, 2, 3 < 1, 2, 3');
    expect(constraint.describe(false)).toBe('Cell (1, 1) is smaller than cell (2, 1).');
    lesser.setValue(1);
    greater.setValue(3);
    expect(constraint.describe()).toContain('satisfied: 1 < 3');
  });

  it('give unpositioned cells a number as name', () => {
    const [cells] = singleConstraint(range(1, 3), 2, UniqueValueConstraint);
    expect(cells.map((c) => c.getName())).toEqual(['cell 1', 'cell 2']);
  });
});

function puzzleWith<C extends Constraint>(
  constraintType: ConstraintType<C>,
  cellCount: number,
): [Cell[], C] {
  const puzzle = new Puzzle('test', range(1, 10));
  const group = puzzle.addConstraintGroup('Group');
  const constraint = group.addConstraint(constraintType);
  const cells = Array.from({ length: cellCount }, () => puzzle.getGrid().addCell());
  for (const cell of cells) group.addCell(cell);
  return [cells, constraint];
}

const shown =
  (values: Map<Cell, Value>) =>
  (cell: Cell): Value | null =>
    values.get(cell) ?? null;

describe('violations', () => {
  it.each([UniqueValueConstraint, ExactCoverConstraint])('find duplicate values (%o)', (type) => {
    const [cells, constraint] = puzzleWith(type as ConstraintType<UniqueValueConstraint>, 4);
    const [a, b, c] = cells as [Cell, Cell, Cell];
    const values = new Map([
      [a, 3],
      [b, 5],
      [c, 3],
    ]);
    expect(constraint.violations(shown(values))).toEqual(new Set([a, c]));
    values.set(c, 4);
    expect(constraint.violations(shown(values))).toEqual(new Set());
  });

  it('find a sum that does not add up', () => {
    const [cells, constraint] = puzzleWith(TotalSumValueConstraint, 3);
    const [a, b, c] = cells as [Cell, Cell, Cell];
    expect(constraint.violations(shown(new Map()))).toEqual(new Set()); // no total yet
    constraint.setTotalValue(10);
    const values = new Map([
      [a, 2],
      [b, 3],
    ]);
    expect(constraint.violations(shown(values))).toEqual(new Set()); // not complete yet
    values.set(c, 4);
    expect(constraint.violations(shown(values))).toEqual(new Set(cells)); // adds up to 9
    values.set(c, 5);
    expect(constraint.violations(shown(values))).toEqual(new Set());
    // already too much before the group is complete
    const tooMuch = new Map([
      [a, 9],
      [b, 8],
    ]);
    expect(constraint.violations(shown(tooMuch))).toEqual(new Set([a, b]));
  });

  it('find a greater-than the wrong way round', () => {
    const [cells, constraint] = puzzleWith(CellGreaterThanCellConstraint, 2);
    const [a, b] = cells as [Cell, Cell];
    expect(constraint.violations(shown(new Map([[a, 5]])))).toEqual(new Set()); // not set up
    constraint.setLesserCell(a);
    constraint.setGreaterCell(b);
    expect(constraint.violations(shown(new Map([[a, 2]])))).toEqual(new Set());
    const check = (x: number, y: number): Set<Cell> =>
      constraint.violations(
        shown(
          new Map([
            [a, x],
            [b, y],
          ]),
        ),
      );
    expect(check(2, 5)).toEqual(new Set());
    expect(check(5, 2)).toEqual(new Set(cells));
    expect(check(4, 4)).toEqual(new Set(cells));
  });
});
