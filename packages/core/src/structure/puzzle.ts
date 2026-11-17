import type { Constraint } from '../constraints/constraint';
import { ConstraintGroup } from '../constraints/constraintgroup';
import type { Cell } from './cell';
import type { DeductionLog } from './deduction';
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

  /** Attribute the changes made by fn to a constraint (while recording). */
  causedBy<T>(constraint: Constraint | null, fn: () => T): T {
    const log = this.deductionLog;
    return log === null ? fn() : log.cause(constraint, fn);
  }

  getGrid(): Grid {
    return this.grid;
  }

  getValues(): Value[] {
    return [...this.values];
  }

  addConstraintGroup(name: string): ConstraintGroup {
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
