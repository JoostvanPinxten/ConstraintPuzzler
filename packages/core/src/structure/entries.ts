/**
 * Values typed in by the user, on top of the puzzle as it was loaded.
 *
 * Entering a value that fits the puzzle simply sets it, so the constraints propagate it like
 * any other value. A value that does not fit (it is not a candidate of the cell, or it leads to
 * a contradiction) is still accepted, as a *mistake*: it is shown, but kept out of the puzzle
 * model, so the solver never works with an inconsistent puzzle. violations() tells which cells
 * clash.
 *
 * Changing or clearing a value cannot be undone in place (the propagation has already removed
 * candidates elsewhere), so the puzzle is restored to its loaded state and all entries are
 * entered again; an earlier mistake may fit after that. Values deduced by the solver are lost
 * that way; the solver can deduce them again.
 */
import { ValueSource, type Cell } from './cell';
import { msg, type Message } from '../i18n/message';
import { ContradictionError, MessageError } from './errors';
import type { Puzzle } from './puzzle';
import type { PuzzleState, Value } from './types';

/** The value cannot be entered: the cell is given, or it is not a value of the puzzle. */
export class EntryError extends MessageError {
  constructor(text: string | Message) {
    super(text);
    this.name = 'EntryError';
  }
}

export class UserEntries {
  readonly initialState: PuzzleState;
  /** cell -> value, in the order the values were entered */
  entries = new Map<Cell, Value>();
  /** the entries that do not fit the puzzle: cell -> value (not set in the model) */
  mistakes = new Map<Cell, Value>();

  constructor(readonly puzzle: Puzzle) {
    this.initialState = puzzle.saveState();
  }

  canEdit(cell: Cell): boolean {
    return !cell.isGiven();
  }

  isMistake(cell: Cell): boolean {
    return this.mistakes.has(cell);
  }

  /** The value shown in a cell: a mistake typed in it, or else its value in the model. */
  valueOf(cell: Cell): Value | null {
    return this.mistakes.has(cell) ? (this.mistakes.get(cell) as Value) : cell.getValue();
  }

  /**
   * Enter a value in a cell, replacing its current value (if any). Throws an EntryError (and
   * leaves the puzzle unchanged) for a given cell or a value that the puzzle does not use. A
   * value that does not fit becomes a mistake.
   */
  enter(cell: Cell, value: Value): void {
    if (cell.isGiven()) {
      throw new EntryError(msg('entry.givenChange', { cell: cell.getName() }));
    }
    if (!this.puzzle.getValues().includes(value)) {
      throw new EntryError(msg('entry.notAValue', { value }));
    }
    if (this.valueOf(cell) === value) return;

    const entries = new Map(this.entries);
    entries.delete(cell);
    entries.set(cell, value);
    if (cell.hasValue() || this.mistakes.has(cell)) {
      this.replay(entries);
    } else {
      this.entries = entries;
      this.applyEntry(cell, value);
    }
  }

  /** Remove the value of a cell that is not given. */
  clear(cell: Cell): void {
    if (cell.isGiven()) {
      throw new EntryError(msg('entry.givenClear', { cell: cell.getName() }));
    }
    if (this.valueOf(cell) === null) return;
    const entries = new Map(this.entries);
    entries.delete(cell);
    this.replay(entries);
  }

  /** Forget the mistakes typed in the given cells (e.g. after the solver filled them). */
  dropMistakes(cells: Iterable<Cell>): void {
    for (const cell of cells) {
      if (this.mistakes.delete(cell)) this.entries.delete(cell);
    }
  }

  /** The cells whose shown value breaks a rule, including every mistake. */
  violations(): Set<Cell> {
    const cells = new Set(this.mistakes.keys());
    const valueOf = (cell: Cell): Value | null => this.valueOf(cell);
    for (const constraint of this.puzzle.getConstraints()) {
      for (const cell of constraint.violations(valueOf)) cells.add(cell);
    }
    return cells;
  }

  /** Set an entry in the model; if it does not fit, keep it as a mistake instead. */
  private applyEntry(cell: Cell, value: Value): void {
    const state = this.puzzle.saveState();
    try {
      if (!cell.values.has(value)) {
        throw new ContradictionError(msg('entry.notPossible', { value, cell: cell.getName() }));
      }
      cell.setValue(value, ValueSource.ENTERED);
    } catch (error) {
      if (!(error instanceof ContradictionError)) throw error;
      this.puzzle.restoreState(state);
      this.mistakes.set(cell, value);
    }
  }

  private replay(entries: Map<Cell, Value>): void {
    this.puzzle.restoreState(this.initialState);
    this.entries = entries;
    this.mistakes = new Map();
    for (const [cell, value] of entries) this.applyEntry(cell, value);
  }
}
