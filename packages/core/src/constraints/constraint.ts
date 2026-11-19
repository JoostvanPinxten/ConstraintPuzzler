import type { Cell } from '../structure/cell';
import type { Deduction } from '../structure/deduction';
import type { Value, ValueOf } from '../structure/types';
import type { ConstraintGroup } from './constraintgroup';

/** The values that have been filled in for the given cells. */
export function placedValues(cells: Iterable<Cell>): Value[] {
  const placed: Value[] = [];
  for (const cell of cells) {
    const value = cell.getValue();
    if (value !== null) placed.push(value);
  }
  return placed;
}

/** All subsets of `size` items, in the order of Python's itertools.combinations. */
export function* combinations<T>(items: readonly T[], size: number): Generator<T[]> {
  const n = items.length;
  if (size > n || size < 0) return;
  const indices = Array.from({ length: size }, (_, i) => i);
  for (;;) {
    yield indices.map((i) => items[i] as T);
    let i = size - 1;
    while (i >= 0 && indices[i] === i + n - size) i--;
    if (i < 0) return;
    (indices[i] as number)++;
    for (let j = i + 1; j < size; j++) indices[j] = (indices[j - 1] as number) + 1;
  }
}

export type ConstraintClass<C extends Constraint = Constraint> = (new (
  group: ConstraintGroup,
  initialValues: Iterable<Value>,
) => C) & { difficulty: number };

export abstract class Constraint {
  /**
   * How hard a deduction of this constraint is for a person (see Deduction.difficulty);
   * hints and single steps show the easiest deduction first.
   */
  static difficulty = 5;

  readonly initialValues: Value[];
  values: Value[] = [];

  constructor(
    readonly group: ConstraintGroup,
    initialValues: Iterable<Value>,
  ) {
    this.initialValues = [...initialValues];
    this.reset();
  }

  reset(): void {
    this.values = [...this.initialValues];
  }

  getDifficulty(): number {
    return (this.constructor as ConstraintClass).difficulty;
  }

  /**
   * How hard this deduction of the constraint is for a person; by default the static
   * difficulty. Override it when one rule makes both easy and hard deductions.
   */
  difficultyOf(_deduction: Deduction): number {
    return this.getDifficulty();
  }

  abstract applyConstraint(): void;

  abstract notify(cell: Cell): void;

  /**
   * Narrow allowedValues, given that usedValues are already used in the group. Used by
   * ConstraintGroup.valuesAllowedByGroup; by default a rule allows everything.
   */
  getAllowedValuesForValueList(
    allowedValues: Iterable<Value>,
    _usedValues: Iterable<Value>,
  ): Iterable<Value> {
    return allowedValues;
  }

  getType(): string {
    return this.constructor.name;
  }

  /** Why this constraint made a change (a Deduction), in words. */
  explain(_deduction: Deduction): string {
    return `${this.group.getName()} (${this.summary()})`;
  }

  /** A short description of the rule, e.g. "sum = 17", used as its name in the GUI. */
  summary(): string {
    return this.getType();
  }

  /**
   * A one-line description of the rule and of how far it is satisfied. With showHints false,
   * the description leaves out the candidate values the solver has deduced, so it does not
   * give away hints about the solution.
   */
  describe(_showHints = true): string {
    return this.summary();
  }

  /**
   * The cells that break this rule, given the value shown in each cell. valueOf(cell) may
   * differ from cell.getValue(), e.g. for a mistake the user typed in that the model rejected.
   */
  violations(_valueOf: ValueOf): Set<Cell> {
    return new Set();
  }
}
