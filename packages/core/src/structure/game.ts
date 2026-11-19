/**
 * The state of playing one puzzle: the puzzle, the user's entries and an undo history.
 *
 * The puzzle (its cells, groups and given values) is the definition. On top of it, a Game keeps
 * what happened while playing: values the user entered (including mistakes, see UserEntries)
 * and values the solver filled in, each cell remembering where its value came from
 * (ValueSource).
 *
 * Every change goes through a Game action (enter, clear, toggleNote, solve, solveStep, ...).
 * Before an action the game takes a snapshot of the puzzle and the entries; when the action
 * changed anything, that snapshot goes on the undo stack. undo() and redo() restore snapshots.
 *
 * Observers (e.g. a UI) subscribe() to be told after every change; `revision` counts changes.
 *
 * The solver is passed in, so this module does not depend on the solver at run time.
 */
import type { Solver } from '../solver/solver';
import type { Finding } from '../techniques/technique';
import type { Cell } from './cell';
import type { Deduction } from './deduction';
import { EntryError, UserEntries } from './entries';
import type { Puzzle } from './puzzle';
import { stateKey, type CellState, type PuzzleState, type Value } from './types';

/** What undo() goes back to: the puzzle, the entries and mistakes, and the notes. */
interface Snapshot {
  readonly state: PuzzleState;
  readonly entries: ReadonlyMap<Cell, Value>;
  readonly mistakes: ReadonlyMap<Cell, Value>;
  readonly notes: ReadonlyMap<Cell, ReadonlySet<Value>>;
}

function mapsEqual<V>(
  a: ReadonlyMap<Cell, V>,
  b: ReadonlyMap<Cell, V>,
  same: (x: V, y: V) => boolean,
): boolean {
  if (a.size !== b.size) return false;
  for (const [key, value] of a) {
    if (!b.has(key) || !same(value, b.get(key) as V)) return false;
  }
  return true;
}

const setsEqual = (a: ReadonlySet<Value>, b: ReadonlySet<Value>): boolean =>
  a.size === b.size && [...a].every((v) => b.has(v));

function snapshotsEqual(a: Snapshot, b: Snapshot): boolean {
  return (
    stateKey(a.state) === stateKey(b.state) &&
    mapsEqual(a.entries, b.entries, Object.is) &&
    mapsEqual(a.mistakes, b.mistakes, Object.is) &&
    mapsEqual(a.notes, b.notes, setsEqual)
  );
}

/** What Game.check() found by comparing the shown values and notes with the solution. */
export class CheckResult {
  /** the cells (not given) that show a value */
  checked = 0;
  /** the cells that show a value that is not the solution's */
  readonly wrongValues = new Set<Cell>();
  /** the open cells whose notes leave out the solution's value */
  readonly wrongNotes = new Set<Cell>();

  isAllCorrect(): boolean {
    return this.wrongValues.size === 0 && this.wrongNotes.size === 0;
  }

  /** The result in words, e.g. "2 of 23 filled-in cells are wrong.". */
  summary(): string {
    if (this.checked === 0 && this.wrongNotes.size === 0) {
      return 'Nothing is filled in yet; every note so far fits the solution.';
    }
    const parts: string[] = [];
    if (this.wrongValues.size > 0) {
      parts.push(`${this.wrongValues.size} of ${this.checked} filled-in cells are wrong`);
    } else if (this.checked > 0) {
      parts.push(`All ${this.checked} filled-in cells are correct so far`);
    }
    if (this.wrongNotes.size > 0) {
      const count = this.wrongNotes.size;
      const cells = count === 1 ? 'cell rules' : 'cells rule';
      parts.push(`the notes of ${count} ${cells} out the correct value`);
    }
    return `${parts.join(', and ')}.`;
  }
}

export class Game {
  readonly entries: UserEntries;
  /** the candidates the user noted in cells (pencil marks); separate from the solver's */
  notes = new Map<Cell, ReadonlySet<Value>>();
  readonly undoStack: Snapshot[] = [];
  readonly redoStack: Snapshot[] = [];
  /**
   * The puzzle's solution, once found (see check), and whether it is the only one; it depends
   * on the given values only, so it is found once per game.
   */
  solution: PuzzleState | null = null;
  solutionIsUnique = false;
  /** increases with every change (an action that changed something, undo, redo) */
  revision = 0;
  private listeners = new Set<() => void>();

  constructor(
    readonly puzzle: Puzzle,
    readonly maxHistory = 1000,
  ) {
    this.entries = new UserEntries(puzzle);
  }

  /** Call listener after every change; returns the function that unsubscribes. */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Tell the observers that something changed (also for changes outside the history). */
  changed(): void {
    this.revision++;
    for (const listener of [...this.listeners]) listener();
  }

  // --- history ---------------------------------------------------------------------------

  private snapshot(): Snapshot {
    return {
      state: this.puzzle.saveState(),
      entries: new Map(this.entries.entries),
      mistakes: new Map(this.entries.mistakes),
      notes: new Map(this.notes),
    };
  }

  private restore(snapshot: Snapshot): void {
    this.puzzle.restoreState(snapshot.state);
    this.entries.entries = new Map(snapshot.entries);
    this.entries.mistakes = new Map(snapshot.mistakes);
    this.notes = new Map(snapshot.notes);
  }

  /**
   * Run action() as one undoable step and return its result. If the action throws, nothing
   * is recorded; the action must leave the puzzle unchanged in that case (UserEntries and the
   * Solver do).
   */
  perform<T>(action: () => T): T {
    const before = this.snapshot();
    const result = action();
    if (!snapshotsEqual(this.snapshot(), before)) {
      this.undoStack.push(before);
      if (this.undoStack.length > this.maxHistory) {
        this.undoStack.splice(0, this.undoStack.length - this.maxHistory);
      }
      this.redoStack.length = 0;
      this.changed();
    }
    return result;
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  /** Go back to the state before the last action. Returns whether there was one. */
  undo(): boolean {
    const snapshot = this.undoStack.pop();
    if (snapshot === undefined) return false;
    this.redoStack.push(this.snapshot());
    this.restore(snapshot);
    this.changed();
    return true;
  }

  /** Redo the last undone action. Returns whether there was one. */
  redo(): boolean {
    const snapshot = this.redoStack.pop();
    if (snapshot === undefined) return false;
    this.undoStack.push(this.snapshot());
    this.restore(snapshot);
    this.changed();
    return true;
  }

  // --- actions ---------------------------------------------------------------------------

  /** Enter a value in a cell (see UserEntries.enter). */
  enter(cell: Cell, value: Value): void {
    this.perform(() => this.entries.enter(cell, value));
  }

  /** Clear the value of a cell (see UserEntries.clear). */
  clear(cell: Cell): void {
    this.perform(() => this.entries.clear(cell));
  }

  /**
   * Add a value to the notes of an open cell, or remove it when it is already noted. Throws
   * an EntryError for a given cell, a cell that shows a value, or a value that the puzzle does
   * not use. The notes of a cell stay when a value is entered in it, and are shown again when
   * the value is cleared.
   */
  toggleNote(cell: Cell, value: Value): void {
    if (cell.isGiven())
      throw new EntryError(`Cell ${cell.getName()} is given; it cannot have notes.`);
    if (!this.puzzle.getValues().includes(value)) {
      throw new EntryError(`${value} is not a value of this puzzle.`);
    }
    if (this.valueOf(cell) !== null) {
      throw new EntryError(`Cell ${cell.getName()} has a value; clear it to make notes.`);
    }
    this.perform(() => {
      const notes = new Set(this.notes.get(cell) ?? []);
      if (notes.has(value)) notes.delete(value);
      else notes.add(value);
      if (notes.size > 0) this.notes.set(cell, notes);
      else this.notes.delete(cell);
    });
  }

  private filledCells(): Cell[] {
    return this.puzzle
      .getGrid()
      .getCells()
      .filter((c) => c.hasValue());
  }

  /**
   * Let the solver fill in the puzzle. Mistakes in cells the solver filled in are dropped, so
   * the solution is shown. Returns whether the puzzle is solved.
   */
  solve(solver: Solver): boolean {
    return this.perform(() => {
      const solved = solver.solve();
      this.entries.dropMistakes(this.filledCells());
      return solved;
    });
  }

  /**
   * Set the puzzle to a state the solver found elsewhere (e.g. with solveAsync on a copy), as
   * one undoable step. Mistakes in the cells it fills are dropped, as with solve().
   */
  applySolution(state: PuzzleState): void {
    this.perform(() => {
      this.puzzle.restoreState(state);
      this.entries.dropMistakes(this.filledCells());
    });
  }

  /**
   * Let the solver fill in a single cell (the one of `preferred`, e.g. the hint shown last,
   * when it can). Returns whether the puzzle changed.
   */
  solveStep(solver: Solver, preferred: Deduction | Finding | null = null): boolean {
    return this.perform(() => solver.solveStep(preferred));
  }

  // --- queries ---------------------------------------------------------------------------

  /**
   * Compare the values shown in the cells that are not given (entries, mistakes and the
   * solver's values, which may follow from a wrong entry) and the notes of the open cells with
   * a solution of the puzzle (Solver.findSolution).
   */
  check(solution: PuzzleState): CheckResult {
    const result = new CheckResult();
    const cells = this.puzzle.getGrid().getCells();
    if (cells.length !== solution.cells.length) {
      throw new Error('the solution does not belong to this puzzle');
    }
    cells.forEach((cell, i) => {
      if (cell.isGiven()) return;
      const solutionValue = (solution.cells[i] as CellState).value;
      const value = this.valueOf(cell);
      const notes = this.notes.get(cell);
      if (value !== null) {
        result.checked++;
        if (value !== solutionValue) result.wrongValues.add(cell);
      } else if (notes !== undefined && (solutionValue === null || !notes.has(solutionValue))) {
        result.wrongNotes.add(cell);
      }
    });
    return result;
  }

  /** The values the user noted in a cell (empty when there are none). */
  notesOf(cell: Cell): ReadonlySet<Value> {
    return this.notes.get(cell) ?? new Set();
  }

  valueOf(cell: Cell): Value | null {
    return this.entries.valueOf(cell);
  }

  isMistake(cell: Cell): boolean {
    return this.entries.isMistake(cell);
  }

  /** The cells whose shown value breaks a rule, including every mistake. */
  violations(): Set<Cell> {
    return this.entries.violations();
  }

  /** Every cell has a value and no shown value breaks a rule. */
  isSolved(violations: Set<Cell> = this.violations()): boolean {
    return this.puzzle.isSolved() && violations.size === 0;
  }

  /** Explain why the value of a cell breaks a rule (null when it does not). */
  violationNote(cell: Cell, violations: Set<Cell> = this.violations()): string | null {
    if (!violations.has(cell)) return null;
    const value = this.valueOf(cell);
    const shown = value === null ? 'it' : this.puzzle.valueName(value);
    const clashes = new Set<Cell>();
    for (const group of cell.constraintGroups) {
      for (const c of group.getCells()) if (violations.has(c) && c !== cell) clashes.add(c);
    }
    if (clashes.size > 0) {
      const names = [...clashes]
        .map((c) => c.getName())
        .sort()
        .join(', ');
      return `${shown} breaks a rule together with cell(s) ${names}.`;
    }
    return `${shown} does not fit: it leaves no possible value for another cell.`;
  }
}
