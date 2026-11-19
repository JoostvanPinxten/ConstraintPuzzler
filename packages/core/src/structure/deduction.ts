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
import type { TechniqueId } from '../guide/techniques';
import type { Technique } from '../techniques/technique';
import { ValueSource, type Cell } from './cell';
import type { Value } from './types';

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
    /**
     * the technique the cause was applying when it made the change (Cause.currentTechnique),
     * e.g. a naked pair of a unique value constraint; null when it follows from the cause
     */
    readonly technique: TechniqueId | null = null,
  ) {}

  /**
   * The technique behind the deduction, as explained to players (a TECHNIQUE_GUIDE entry):
   * the one recorded, else the cause's for this deduction; for a deduction without a cause,
   * a guess or the only candidate left in a cell. null for a change from outside the solver.
   */
  techniqueId(): TechniqueId | null {
    if (this.technique !== null) return this.technique;
    if (this.cause !== null) return this.cause.techniqueId(this);
    if (this.source === ValueSource.GUESSED) return 'guess';
    if (this.setsValue() && this.source === ValueSource.DEDUCED) return 'nakedSingle';
    return null;
  }

  setsValue(): boolean {
    return this.value !== null;
  }

  /**
   * How hard the deduction is for a person: NAKED_SINGLE, or its cause's level for this
   * deduction (one rule can make both easy and hard deductions, see Constraint.difficultyOf).
   */
  difficulty(): number {
    return this.cause !== null ? this.cause.difficultyOf(this) : NAKED_SINGLE;
  }

  /** The value set, as the user sees it (its name, e.g. a colour, or the number). */
  private valueText(): string {
    return this.value === null ? '' : this.cell.getGrid().getPuzzle().valueName(this.value);
  }

  /** Why the change was made, in words. */
  reason(): string {
    if (this.cause !== null) return this.cause.explain(this);
    const value = this.valueText();
    if (this.source === ValueSource.GUESSED) return `${value} is a guess (backtracking)`;
    if (this.setsValue() && this.source === ValueSource.DEDUCED) {
      return `${value} is the only candidate left in this cell`;
    }
    if (this.setsValue()) return `${value} was ${this.source ?? 'set'}`;
    return 'removed';
  }

  /** What changed and why, e.g. "cell 3, 4 is 7: ...". */
  describe(): string {
    const name = this.cell.getName();
    const puzzle = this.cell.getGrid().getPuzzle();
    const what = this.setsValue()
      ? `cell ${name} is ${this.valueText()}`
      : `cell ${name} cannot be ${puzzle.formatValues(this.removed)}`;
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
    const cause = this.currentCause();
    const technique = cause?.currentTechnique() ?? null;
    this.deductions.push(new Deduction(cell, new Set([value]), null, null, cause, technique));
  }

  recordValue(cell: Cell, value: Value, source: ValueSource): void {
    const cause = source === ValueSource.DEDUCED ? this.currentCause() : null;
    const technique = cause?.currentTechnique() ?? null;
    this.deductions.push(new Deduction(cell, new Set(), value, source, cause, technique));
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
