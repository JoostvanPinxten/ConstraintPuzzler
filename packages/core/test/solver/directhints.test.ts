// Hints and single steps must follow directly from the puzzle as the user sees it (issue #32):
// "Block 9 needs 3 and it fits nowhere else" was offered while 3 still fitted in three cells of
// Block 9, because the deduction relied on candidates that other groups removed earlier in the
// same deduction pass.
import { describe, expect, it } from 'vitest';

import { BLANK, RunsConstraint, type Run } from '../../src/constraints/runsconstraint';
import { UniqueValueConstraint } from '../../src/constraints/uniquevalueconstraint';
import { Solver } from '../../src/solver/solver';
import type { Deduction } from '../../src/structure/deduction';
import { allExamples } from '../helpers';

/** Every filling of `size` cells with the blocks (brute force, independent of RunsConstraint). */
function fillings(runs: readonly Run[], size: number): number[][] {
  const result: number[][] = [];
  const place = (b: number, from: number, line: number[]): void => {
    if (b === runs.length) {
      result.push([...line, ...new Array<number>(size - line.length).fill(BLANK)]);
      return;
    }
    const run = runs[b] as Run;
    const previous = runs[b - 1];
    const gap = previous !== undefined && previous.color === run.color ? 1 : 0;
    for (let start = from + gap; start + run.length <= size; start++) {
      const next = [...line, ...new Array<number>(start - line.length).fill(BLANK)];
      place(b + 1, start + run.length, [...next, ...new Array<number>(run.length).fill(run.color)]);
    }
  };
  place(0, 0, []);
  return result;
}

/** Why a value deduction does not hold in the current state, or null when it does. */
function whyNot(d: Deduction): string | null {
  const value = d.value;
  if (value === null) return 'not a value';
  if (d.cell.hasValue()) return `cell ${d.cell.getName()} already has a value`;
  if (d.cause === null) {
    // a single candidate left in the cell
    const candidates = [...d.cell.values];
    return candidates.length === 1 && candidates[0] === value
      ? null
      : `cell ${d.cell.getName()} has candidates ${candidates.join(', ')}, not only ${value}`;
  }
  if (d.cause instanceof UniqueValueConstraint) {
    // the group needs the value and it fits only in this cell (a hidden single)
    const cells = d.cause.group.getCells();
    if (cells.some((c) => c.getValue() === value)) return `${value} is already placed`;
    const fits = cells.filter((c) => !c.hasValue() && c.values.has(value));
    if (fits.length !== 1 || fits[0] !== d.cell) {
      return `${value} fits in ${fits.map((c) => c.getName()).join('; ')} of ${d.cause.group.getName()}`;
    }
    return null;
  }
  if (d.cause instanceof RunsConstraint) {
    // every filling of the line that fits the candidates gives the cell this value
    const cells = d.cause.group.getCells();
    const index = cells.indexOf(d.cell);
    const fitting = fillings(d.cause.getRuns(), cells.length).filter((f) =>
      f.every((v, i) => (cells[i] as (typeof cells)[number]).values.has(v)),
    );
    const other = fitting.find((f) => f[index] !== value);
    if (fitting.length === 0) return `no filling of ${d.cause.group.getName()} fits`;
    return other === undefined ? null : `${d.cause.group.getName()} can be ${other.join('')}`;
  }
  return `unexpected cause ${d.cause.getType()}`;
}

describe('hints follow directly from the current state (issue #32)', () => {
  it.each(allExamples())('%s: every offered value, step by step', (_name, load) => {
    const puzzle = load();
    const solver = new Solver(puzzle);
    const problems: string[] = [];
    for (let step = 0; step < 1000; step++) {
      for (const d of solver.deducibleValues()) {
        const problem = whyNot(d);
        if (problem !== null) problems.push(`step ${step}: "${d.describe()}" but ${problem}`);
      }
      if (!solver.solveStep()) break;
    }
    expect(problems).toEqual([]);
  });

  it.each(allExamples())('%s: the hint explains a value that holds now', (_name, load) => {
    const puzzle = load();
    const solver = new Solver(puzzle);
    for (let step = 0; step < 1000; step++) {
      const hint = solver.hint();
      if (hint !== null) expect(whyNot(hint)).toBeNull();
      if (!solver.solveStep(hint)) break;
      // the step fills in the hinted cell, with the same value
      if (hint !== null) {
        expect(solver.lastStep?.cell).toBe(hint.cell);
        expect(hint.cell.getValue()).toBe(hint.value);
      }
    }
  });
});
