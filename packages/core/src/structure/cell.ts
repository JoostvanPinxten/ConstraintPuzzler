import type { ConstraintGroup } from '../constraints/constraintgroup';
import type { DeductionLog } from './deduction';
import { msg } from '../i18n/message';
import { ContradictionError } from './errors';
import type { Grid } from './grid';
import type { Position } from './position';
import { Signal } from './signal';
import { sortedValues, type Value } from './types';

/** Where the value of a cell came from. */
export const ValueSource = {
  /** part of the puzzle as it was loaded */
  GIVEN: 'given',
  /** typed in by the user */
  ENTERED: 'entered',
  /** deduced by the solver from the rules */
  DEDUCED: 'deduced',
  /** tried by the solver while backtracking */
  GUESSED: 'guessed',
} as const;
export type ValueSource = (typeof ValueSource)[keyof typeof ValueSource];

function formatSet(values: Iterable<Value>): string {
  return `{${sortedValues(values).join(', ')}}`;
}

export class Cell {
  /** emitted with the cell when it gets a value */
  readonly valueChanged = new Signal<[Cell]>();
  /** emitted with the cell when candidates are removed (or a snapshot is restored) */
  readonly possibleValuesChanged = new Signal<[Cell]>();
  readonly initialValues: ReadonlySet<Value>;
  /** the constraint groups this cell is in (filled by ConstraintGroup.addCell) */
  readonly constraintGroups: ConstraintGroup[] = [];
  values: Set<Value> = new Set();
  value: Value | null = null;
  /** where the value came from; null while the cell has no value */
  source: ValueSource | null = null;

  constructor(
    initialValues: Iterable<Value>,
    readonly grid: Grid,
  ) {
    this.initialValues = new Set(initialValues);
    this.reset();
  }

  reset(): void {
    this.values = new Set(this.initialValues);
    this.value = null;
    this.source = null;
  }

  getValue(): Value | null {
    return this.value;
  }

  hasValue(): boolean {
    return this.value !== null;
  }

  /** Set a value the solver deduced. */
  inferValue(value: Value): void {
    this.setValue(value, ValueSource.DEDUCED);
  }

  /** Set a value the solver tries while backtracking. */
  guessValue(value: Value): void {
    this.setValue(value, ValueSource.GUESSED);
  }

  setValue(value: Value, source: ValueSource = ValueSource.GIVEN): void {
    if (!this.values.has(value)) {
      throw new ContradictionError(
        msg('cell.notAValue', { value, values: formatSet(this.values) }),
      );
    }
    this.source = source;
    this.value = value;
    this.values = new Set([value]);
    this.deductionLog()?.recordValue(this, value, source);
    this.valueChanged.emit(this);
  }

  getPossibleValues(): Set<Value> {
    return new Set(this.values);
  }

  remove(value: Value): void {
    // make sure the set value is not the value that needs to be removed
    if (this.value === value) {
      throw new ContradictionError(msg('cell.removeSet', { cell: this.toString() }));
    }
    if (!this.values.has(value)) return; // redundant remove

    this.values.delete(value);
    this.deductionLog()?.recordRemoval(this, value);
    if (this.values.size === 0) {
      // the puzzle state is contradictory: no value is left for this cell
      throw new ContradictionError(msg('cell.noOptions', { value, cell: this.toString() }));
    }
    this.possibleValuesChanged.emit(this);
  }

  addConstraintGroup(group: ConstraintGroup): void {
    group.addCell(this);
  }

  /** The constraint groups this cell is in. */
  getConstraintGroups(): ConstraintGroup[] {
    return [...this.constraintGroups];
  }

  protected valueText(): string {
    const values = sortedValues(this.values).join(',');
    return this.value !== null ? `${values}: ${this.value}` : values;
  }

  toString(): string {
    return `[${this.valueText()}]`;
  }

  isFixed(): boolean {
    return this.value !== null;
  }

  /** Where the value came from, or null without a value. */
  getSource(): ValueSource | null {
    return this.source;
  }

  /** The value was filled in by the solver (deduced or guessed). */
  isInferred(): boolean {
    return this.source === ValueSource.DEDUCED || this.source === ValueSource.GUESSED;
  }

  /** The value was tried by the solver while backtracking. */
  isGuessed(): boolean {
    return this.source === ValueSource.GUESSED;
  }

  /** The value was typed in by the user. */
  isEntered(): boolean {
    return this.source === ValueSource.ENTERED;
  }

  /** The value is part of the puzzle as it was loaded. */
  isGiven(): boolean {
    return this.source === ValueSource.GIVEN;
  }

  getGrid(): Grid {
    return this.grid;
  }

  /** The log that records changes to this cell, if the puzzle is recording. */
  private deductionLog(): DeductionLog | null {
    return this.grid.getPuzzle().deductionLog;
  }

  getName(): string {
    return `cell ${this.grid.cells.indexOf(this) + 1}`;
  }

  checkForSinglePossibility(): void {
    if (this.value === null && this.values.size === 1) {
      const [only] = this.values;
      this.inferValue(only as Value);
    }
  }
}

export class PositionedCell extends Cell {
  constructor(
    initialValues: Iterable<Value>,
    grid: Grid,
    public position: Position,
  ) {
    super(initialValues, grid);
  }

  getPosition(): Position {
    return this.position;
  }

  setPosition(position: Position): void {
    this.position = position;
  }

  override getName(): string {
    return `${this.position.x()}, ${this.position.y()}`;
  }

  override toString(): string {
    return `[pos:${this.position.toString()};${this.valueText()}]`;
  }
}
