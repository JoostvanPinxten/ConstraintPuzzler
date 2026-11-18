/**
 * A record of what the solver (or a constraint reacting to a value) changed, and why.
 *
 * While a DeductionLog is installed on a puzzle (Puzzle.recording), every candidate removed
 * from a cell and every value set in a cell is recorded as a Deduction, together with the
 * constraint that was acting at that moment (Puzzle.causedBy). The solver uses the log to know
 * which cells changed, so it only re-applies the constraints of those cells, and to explain a
 * step or a hint.
 */
import type { Constraint } from '../constraints/constraint';
import type { Technique } from '../techniques/technique';
import { ValueSource, type Cell } from './cell';
import { sortedValues, type Value } from './types';

/** What made a change: a constraint, or a technique that combines several groups. */
export type Cause = Constraint | Technique;

/** The difficulty of a value that is the only candidate left in its cell (no constraint). */
export const NAKED_SINGLE = 1;

export class Deduction {
  constructor(
    readonly cell: Cell,
    /** the candidates removed from the cell (empty when a value was set) */
    readonly removed: ReadonlySet<Value> = new Set(),
    /** the value set in the cell (null when candidates were removed) */
    readonly value: Value | null = null,
    /** where a set value came from (deduced, guessed, entered, given) */
    readonly source: ValueSource | null = null,
    /**
     * the constraint or technique that made the change; null for a cell's own check (a single
     * candidate left), a guess, or a change from outside the solver
     */
    readonly cause: Cause | null = null,
  ) {}

  setsValue(): boolean {
    return this.value !== null;
  }

  /** How hard the deduction is for a person: NAKED_SINGLE, or its cause's level. */
  difficulty(): number {
    return this.cause !== null ? this.cause.getDifficulty() : NAKED_SINGLE;
  }

  /** Why the change was made, in words. */
  reason(): string {
    if (this.cause !== null) return this.cause.explain(this);
    if (this.source === ValueSource.GUESSED) return `${this.value} is a guess (backtracking)`;
    if (this.setsValue() && this.source === ValueSource.DEDUCED) {
      return `${this.value} is the only candidate left in this cell`;
    }
    if (this.setsValue()) return `${this.value} was ${this.source ?? 'set'}`;
    return 'removed';
  }

  /** What changed and why, e.g. "cell 3, 4 is 7: ...". */
  describe(): string {
    const name = this.cell.getName();
    const what = this.setsValue()
      ? `cell ${name} is ${this.value}`
      : `cell ${name} cannot be ${sortedValues(this.removed).join(', ')}`;
    return `${what}: ${this.reason()}.`;
  }
}

export class DeductionLog {
  deductions: Deduction[] = [];
  private causes: (Cause | null)[] = [];

  get length(): number {
    return this.deductions.length;
  }

  currentCause(): Cause | null {
    return this.causes.at(-1) ?? null;
  }

  /** Attribute the changes made by fn to a constraint or technique. */
  cause<T>(cause: Cause | null, fn: () => T): T {
    this.causes.push(cause);
    try {
      return fn();
    } finally {
      this.causes.pop();
    }
  }

  recordRemoval(cell: Cell, value: Value): void {
    this.deductions.push(new Deduction(cell, new Set([value]), null, null, this.currentCause()));
  }

  recordValue(cell: Cell, value: Value, source: ValueSource): void {
    const cause = source === ValueSource.DEDUCED ? this.currentCause() : null;
    this.deductions.push(new Deduction(cell, new Set(), value, source, cause));
  }

  /** Forget the deductions after the first `length` (e.g. after an undone guess). */
  truncate(length: number): void {
    this.deductions.length = Math.min(this.deductions.length, length);
  }

  since(length: number): Deduction[] {
    return this.deductions.slice(length);
  }

  /** The cells changed since position `start`, in the order they were first changed. */
  changedCells(start = 0): Set<Cell> {
    return new Set(this.deductions.slice(start).map((d) => d.cell));
  }
}
