/**
 * Hints in three levels: where to look, which cell, and finally the value and why.
 *
 * Asking for a hint again while the puzzle has not changed reveals more of the same deduction,
 * so a user can get just enough help: first the region (the cells of the rule that decides the
 * value), then the cell, then the value with its reason. After the puzzle changes, the next
 * hint is a new one.
 */
import type { Cell } from '../structure/cell';
import type { Deduction } from '../structure/deduction';
import { stateKey } from '../structure/types';
import type { Solver } from './solver';

export const REGION = 1;
export const CELL = 2;
export const VALUE = 3;
export type HintLevel = 0 | typeof REGION | typeof CELL | typeof VALUE;

export class HintSession {
  deduction: Deduction | null = null;
  /** 0 (no hint), REGION, CELL or VALUE */
  level: HintLevel = 0;
  /** the puzzle state the hint was made for (as a stateKey) */
  private state: string | null = null;

  reset(): void {
    this.deduction = null;
    this.level = 0;
    this.state = null;
  }

  /**
   * Reveal more of the current hint, or start a new one (at REGION) when there is none or the
   * puzzle changed since. Returns the hint's deduction; null when the rules do not determine
   * any value now (the session is then reset). Throws ContradictionError like Solver.hint().
   */
  advance(solver: Solver): Deduction | null {
    const state = stateKey(solver.puzzle.saveState());
    if (this.deduction === null || state !== this.state) {
      this.reset();
      const deduction = solver.hint();
      if (deduction === null) return null;
      this.deduction = deduction;
      this.level = REGION;
      this.state = state;
    } else {
      this.level = Math.min(this.level + 1, VALUE) as HintLevel;
    }
    return this.deduction;
  }

  /**
   * The cells to look at: the group of the constraint that decides the value, or, for a cell
   * with a single candidate left, every group the cell is in.
   */
  regionCells(): Set<Cell> {
    const deduction = this.deduction;
    if (deduction === null) return new Set();
    if (deduction.cause !== null) return new Set(deduction.cause.group.getCells());
    return new Set(deduction.cell.constraintGroups.flatMap((g) => g.getCells()));
  }

  /** What the hint says at its current level. */
  message(): string {
    const deduction = this.deduction;
    if (deduction === null) return '';
    if (this.level === REGION) {
      const cause = deduction.cause;
      if (cause === null) {
        return 'In the highlighted area, one cell has only one possible value left.';
      }
      return (
        `Look at ${cause.group.getName()} (${cause.summary()}):` +
        ' it decides the value of one of its cells.'
      );
    }
    if (this.level === CELL) return `Look at cell ${deduction.cell.getName()}.`;
    return deduction.describe();
  }
}
