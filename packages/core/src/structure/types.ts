/** Type aliases and small helpers shared by the puzzle model, the constraints and the solver. */
import type { Cell, ValueSource } from './cell';

/** The value of a cell (the puzzles use whole numbers). */
export type Value = number;

/** The solving state of one cell in a snapshot: candidates (sorted), value, value source. */
export interface CellState {
  readonly candidates: readonly Value[];
  readonly value: Value | null;
  readonly source: ValueSource | null;
}

/** A snapshot of a puzzle (Puzzle.saveState): the cell states and each constraint's values. */
export interface PuzzleState {
  readonly cells: readonly CellState[];
  readonly constraints: readonly (readonly Value[])[];
}

/**
 * The value shown in a cell, or null (Constraint.violations): it may be a mistake the user
 * typed in, which is not the cell's value in the model.
 */
export type ValueOf = (cell: Cell) => Value | null;

/** A string that is equal for equal states, to compare snapshots. */
export function stateKey(state: PuzzleState): string {
  return JSON.stringify(state);
}

export function statesEqual(a: PuzzleState, b: PuzzleState): boolean {
  return stateKey(a) === stateKey(b);
}

/** The values in ascending order. */
export function sortedValues(values: Iterable<Value>): Value[] {
  return [...values].sort((a, b) => a - b);
}

/** Format values for a description, e.g. "1, 3, 4" (or "none"). */
export function formatValues(values: Iterable<Value>): string {
  const sorted = sortedValues(values);
  return sorted.length > 0 ? sorted.join(', ') : 'none';
}
