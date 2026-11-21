import type { Constraint } from '../constraints/constraint';
import { ConstraintGroup } from '../constraints/constraintgroup';
import { formatMessage, msg, type Message, type ValueList } from '../i18n/message';
import type { Cell } from './cell';
import type { Cause, DeductionLog } from './deduction';
import { Grid } from './grid';
import { sortedValues, type CellState, type PuzzleState, type Value } from './types';

/** The top-level item, which holds the constraint groups and the grid. */
export class Puzzle {
  readonly values: Value[];
  readonly constraintGroups: ConstraintGroup[] = [];
  readonly grid: Grid;
  /** while set (see recording), changes to the cells are recorded in this DeductionLog */
  deductionLog: DeductionLog | null = null;

  constructor(
    public name: string,
    values: Iterable<Value>,
  ) {
    this.values = [...values];
    this.grid = new Grid(this.values, this);
  }

  /**
   * Start recording the changes to the cells in a DeductionLog; returns a function that
   * stops recording (and reinstalls the previous log). Prefer recording() where possible.
   */
  beginRecording(log: DeductionLog): () => void {
    const previous = this.deductionLog;
    this.deductionLog = log;
    return () => {
      this.deductionLog = previous;
    };
  }

  /** Record the changes to the cells made by fn in a DeductionLog. */
  recording<T>(log: DeductionLog, fn: () => T): T {
    const end = this.beginRecording(log);
    try {
      return fn();
    } finally {
      end();
    }
  }

  /** Attribute the changes made by fn to a constraint or technique (while recording). */
  causedBy<T>(cause: Cause | null, fn: () => T): T {
    const log = this.deductionLog;
    return log === null ? fn() : log.cause(cause, fn);
  }

  getGrid(): Grid {
    return this.grid;
  }

  getValues(): Value[] {
    return [...this.values];
  }

  /** names of values (e.g. the colours of a nonogram), for the text shown to the user */
  private valueNames = new Map<Value, string | Message>();

  /**
   * Name the values (e.g. 0 -> 'blank', 1 -> 'red'): a name from the puzzle file, or a message
   * for a built-in name; values without a name show as numbers.
   */
  setValueNames(names: ReadonlyMap<Value, string | Message>): void {
    this.valueNames = new Map(names);
  }

  /** How a value is shown to the user: its name (in English), or the number. */
  valueName(value: Value): string {
    const name = this.valueNameMessage(value);
    return typeof name === 'object' ? formatMessage(name) : String(name);
  }

  /** How a value is shown to the user: its name (a message when built in), or the number. */
  valueNameMessage(value: Value): string | number | Message {
    return this.valueNames.get(value) ?? value;
  }

  /** Values for a description, in ascending order, e.g. "1, 3, 4" or "blank, red". */
  formatValues(values: Iterable<Value>): string {
    return formatMessage(msg('values.list', { values: this.valueList(values) }));
  }

  /** Values as a message parameter, in ascending order, by their names. */
  valueList(values: Iterable<Value>): ValueList {
    return {
      values: sortedValues(values).map((v) => {
        const name = this.valueNameMessage(v);
        return typeof name === 'object' ? formatMessage(name) : name;
      }),
    };
  }

  addConstraintGroup(name: string | Message): ConstraintGroup {
    const group = new ConstraintGroup(this, name);
    this.constraintGroups.push(group);
    return group;
  }

  getConstraintGroups(): ConstraintGroup[] {
    return this.constraintGroups;
  }

  getConstraints(): Constraint[] {
    return this.constraintGroups.flatMap((group) => group.getConstraints());
  }

  /**
   * Snapshot of all mutable solving state. The snapshot is immutable and can be compared
   * (statesEqual), so it can also be used to detect whether anything changed.
   */
  saveState(): PuzzleState {
    return {
      cells: this.grid.cells.map(cellState),
      constraints: this.getConstraints().map((constraint) => [...constraint.values]),
    };
  }

  /**
   * Restore a snapshot made by saveState(). Only possibleValuesChanged is emitted, so the
   * constraints are not triggered by the restore; it is only emitted for cells whose state
   * actually changed.
   */
  restoreState(state: PuzzleState): void {
    const cells = this.grid.cells;
    const constraints = this.getConstraints();
    if (state.cells.length !== cells.length || state.constraints.length !== constraints.length) {
      throw new Error('the state does not belong to this puzzle');
    }
    const changed: Cell[] = [];
    cells.forEach((cell, i) => {
      const target = state.cells[i] as CellState;
      if (sameCellState(cellState(cell), target)) return;
      cell.values = new Set(target.candidates);
      cell.value = target.value;
      cell.source = target.source;
      changed.push(cell);
    });
    constraints.forEach((constraint, i) => {
      constraint.values = [...(state.constraints[i] as readonly Value[])];
    });
    for (const cell of changed) cell.possibleValuesChanged.emit(cell);
  }

  /** The cells that do not have a value yet. */
  getOpenCells(): Cell[] {
    return this.grid.cells.filter((c) => !c.hasValue());
  }

  getNumberOfOpenCells(): number {
    return this.getOpenCells().length;
  }

  isSolved(): boolean {
    return this.getOpenCells().length === 0;
  }
}

function cellState(cell: Cell): CellState {
  return { candidates: sortedValues(cell.values), value: cell.value, source: cell.source };
}

function sameCellState(a: CellState, b: CellState): boolean {
  return (
    a.value === b.value &&
    a.source === b.source &&
    a.candidates.length === b.candidates.length &&
    a.candidates.every((v, i) => v === b.candidates[i])
  );
}
