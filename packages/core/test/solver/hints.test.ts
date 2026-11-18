// Hints revealed in levels: region, cell, value.
import { beforeEach, describe, expect, it } from 'vitest';

import { ExactCoverConstraint } from '../../src/constraints/exactcoverconstraint';
import { parseSudokuLines } from '../../src/parsers/sudoku';
import { CELL, HintSession, REGION, VALUE } from '../../src/solver/hints';
import { Solver } from '../../src/solver/solver';
import type { Cell } from '../../src/structure/cell';
import type { Deduction } from '../../src/structure/deduction';
import type { Puzzle } from '../../src/structure/puzzle';
import { EASY, seeded } from '../helpers';

describe('HintSession', () => {
  let puzzle: Puzzle;
  let solver: Solver;
  let session: HintSession;

  beforeEach(() => {
    puzzle = parseSudokuLines(EASY);
    solver = new Solver(puzzle);
    session = new HintSession();
  });

  it('reveals the same deduction level by level', () => {
    const first = session.advance(solver) as Deduction;
    expect(first).not.toBeNull();
    const name = first.cell.getName();
    expect(session.level).toBe(REGION);
    expect(session.message()).not.toContain(name);
    expect(session.advance(solver)).toBe(first);
    expect(session.level).toBe(CELL);
    expect(session.message()).toContain(name);
    expect(session.message().replace(name, '')).not.toContain(String(first.value));
    expect(session.advance(solver)).toBe(first);
    expect(session.level).toBe(VALUE);
    expect(session.message()).toBe(`${first.describe()} ${session.exclusions()}`.trim());
    // it stays at the value
    expect(session.advance(solver)).toBe(first);
    expect(session.level).toBe(VALUE);
  });

  it('does not change the puzzle', () => {
    const state = puzzle.saveState();
    for (let i = 0; i < 3; i++) session.advance(solver);
    expect(puzzle.saveState()).toEqual(state);
  });

  it('starts a new hint after the puzzle changed', () => {
    const first = session.advance(solver) as Deduction;
    session.advance(solver);
    first.cell.inferValue(first.value as number);
    const second = session.advance(solver);
    expect(second).not.toBe(first);
    expect(session.level).toBe(REGION);
  });

  it('shows a region that contains the cell', () => {
    const hint = session.advance(solver) as Deduction;
    const region = session.regionCells();
    expect(region.has(hint.cell)).toBe(true);
    if (hint.cause !== null) {
      expect(region).toEqual(new Set(hint.cause.group.getCells()));
    } else {
      expect(region).toEqual(new Set(hint.cell.constraintGroups.flatMap((g) => g.getCells())));
    }
  });

  it('shows every group of the cell for a naked single', () => {
    let nakedSingles = 0;
    for (let seed = 0; seed < 20; seed++) {
      session.reset();
      solver.random = seeded(seed);
      const hint = session.advance(solver) as Deduction;
      if (hint.cause === null) {
        nakedSingles++;
        expect(session.message()).toContain('only one possible value');
        expect(session.regionCells().size).toBe(21); // row, column and box
      }
    }
    expect(nakedSingles).toBeGreaterThan(0);
  });

  it('shows the numbers that rule the value out of the rest of an exact cover group', () => {
    const sharesGroup = (a: Cell, b: Cell): boolean =>
      a.constraintGroups.some((g) => b.constraintGroups.includes(g));
    let exactCover = 0;
    for (const hint of solver.deducibleValues()) {
      session.deduction = hint;
      session.level = VALUE;
      const reasons = session.reasonCells();
      const ruledOut = session.ruledOutCells();
      if (!(hint.cause instanceof ExactCoverConstraint)) {
        expect(ruledOut.size).toBe(0);
        if (hint.cause !== null) {
          expect(reasons.size).toBe(0);
          expect(session.reasonGroups().size).toBe(0);
        }
        continue;
      }
      exactCover++;
      const group = hint.cause.group;
      const others = group.getCells().filter((c) => c !== hint.cell && !c.hasValue());
      expect(reasons.size).toBeGreaterThan(0);
      expect(reasons.size).toBeLessThanOrEqual(others.length);
      for (const reason of reasons) {
        expect(reason.getValue()).toBe(hint.value);
        expect(group.getCells()).not.toContain(reason);
      }
      // every other open cell lost the value to a placed number, and one of those is shown
      for (const other of others) {
        expect([...reasons].some((r) => sharesGroup(r, other))).toBe(true);
      }
      // ... and those are the cells marked as ruled out (never the hint's cell)
      expect([...ruledOut]).toEqual(others);
      expect(ruledOut.has(hint.cell)).toBe(false);
      // the groups that connect them: each overlaps the hint's group, holds a shown number,
      // and every ruled-out cell lies in one of them together with a shown number
      const groups = [...session.reasonGroups()];
      expect(groups.length).toBeGreaterThan(0);
      for (const g of groups) {
        expect(g).not.toBe(group);
        expect(g.getCells().some((c) => reasons.has(c))).toBe(true);
        expect(g.getCells().some((c) => group.getCells().includes(c))).toBe(true);
      }
      for (const cell of ruledOut) {
        expect(
          groups.some(
            (g) => g.getCells().includes(cell) && g.getCells().some((c) => reasons.has(c)),
          ),
        ).toBe(true);
      }
      expect(session.exclusions()).toBe('');
      // the same numbers every time
      expect(session.reasonCells()).toEqual(reasons);
    }
    expect(exactCover).toBeGreaterThan(0);
  });

  it('shows every placed number around the only candidate left in a cell', () => {
    // cell 5, 7 can only be 4: row 7, column 5 and block 8 hold every other value
    const hint = solver.deducibleValues().find((d) => d.cell.getName() === '5, 7') as Deduction;
    expect(hint.cause).toBeNull();
    expect(hint.value).toBe(4);
    session.deduction = hint;
    session.level = VALUE;
    const reasons = session.reasonCells();
    const peers = new Set(hint.cell.constraintGroups.flatMap((g) => g.getCells()));
    const placed = [...peers].filter((c) => c !== hint.cell && c.hasValue());
    expect(reasons).toEqual(new Set(placed));
    expect(new Set([...reasons].map((c) => c.getValue()))).toEqual(
      new Set([1, 2, 3, 5, 6, 7, 8, 9]),
    );
    expect([...session.reasonGroups()].map((g) => g.getName()).sort()).toEqual([
      'Block 8',
      'Column 5',
      'Row 7',
    ]);
    expect(session.ruledOutCells().size).toBe(0);
    expect(session.message()).toBe(
      'cell 5, 7 is 4: 4 is the only candidate left in this cell.' +
        ' Row 7 has 5, 7, 6 and 8; Column 5 has 6, 9 and 3; Block 8 also has 1, 5 and 2.',
    );
  });

  it('forgets the hint when reset', () => {
    session.advance(solver);
    session.reset();
    expect(session.deduction).toBeNull();
    expect(session.level).toBe(0);
    expect(session.message()).toBe('');
    expect(session.regionCells()).toEqual(new Set());
    expect(session.reasonCells()).toEqual(new Set());
    expect(session.ruledOutCells()).toEqual(new Set());
    expect(session.reasonGroups()).toEqual(new Set());
  });

  it('names the column and box behind a hidden single in the first box', () => {
    // block 1 needs 1 at (3, 2): the 1 of row 3 and the 1 of column 1 rule out the others
    const hint = solver
      .deducibleValues()
      .find((d) => d.cause?.group.getName() === 'Block 1' && d.value === 1) as Deduction;
    session.deduction = hint;
    session.level = VALUE;
    expect(hint.cell.getName()).toBe('3, 2');
    expect([...session.reasonCells()].map((c) => c.getName()).sort()).toEqual(['1, 6', '9, 3']);
    expect([...session.reasonGroups()].map((g) => g.getName()).sort()).toEqual([
      'Column 1',
      'Row 3',
    ]);
  });

  it('returns null when nothing can be deduced', () => {
    new Solver(puzzle).solve();
    expect(session.advance(solver)).toBeNull();
    expect(session.level).toBe(0);
  });
});
