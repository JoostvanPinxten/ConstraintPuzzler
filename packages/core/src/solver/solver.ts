import type { ConstraintGroup } from '../constraints/constraintgroup';
import { ValueSource, type Cell } from '../structure/cell';
import { Deduction, DeductionLog } from '../structure/deduction';
import { ContradictionError } from '../structure/errors';
import type { Puzzle } from '../structure/puzzle';
import { sortedValues, statesEqual, type PuzzleState } from '../structure/types';

/** Solving was stopped (shouldStop returned true, or the AbortSignal fired); the puzzle is restored. */
export class SolveCancelled extends Error {
  constructor(message = 'solving was cancelled') {
    super(message);
    this.name = 'SolveCancelled';
  }
}

/**
 * The long-running parts of the solver are generators that yield at the points where it may be
 * stopped: before each propagation pass and before each guess. runSync and runAsync drive them;
 * to stop, the driver throws SolveCancelled into the generator, so its cleanup code runs.
 */
type Steps<T> = Generator<void, T, void>;

export interface AsyncSolveOptions {
  /** aborting it stops the solver (the promise rejects with SolveCancelled) */
  signal?: AbortSignal;
  /** how long (ms) to compute before yielding to the event loop, to keep the UI responsive */
  sliceMs?: number;
}

function runSync<T>(steps: Steps<T>, shouldStop?: () => boolean): T {
  let result = steps.next();
  while (!result.done) {
    result = shouldStop?.() ? steps.throw(new SolveCancelled()) : steps.next();
  }
  return result.value;
}

const yieldToEventLoop = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

async function runAsync<T>(steps: Steps<T>, options: AsyncSolveOptions = {}): Promise<T> {
  const sliceMs = options.sliceMs ?? 12;
  let deadline = Date.now() + sliceMs;
  let result = steps.next();
  while (!result.done) {
    if (Date.now() >= deadline) {
      await yieldToEventLoop();
      deadline = Date.now() + sliceMs;
    }
    result = options.signal?.aborted ? steps.throw(new SolveCancelled()) : steps.next();
  }
  return result.value;
}

/**
 * Solves a puzzle by applying its constraints until nothing changes, and, if allowed, by
 * guessing (depth-first, with backtracking) when deduction gets stuck.
 *
 * Every change is recorded as a Deduction in `log`, with the constraint that made it.
 * Propagation only re-applies the constraint groups of the cells that changed in the previous
 * pass.
 */
export class Solver {
  /** picks the cell that solveStep() fills in; returns a number in [0, 1) */
  random: () => number = Math.random;
  /** the changes of the last solve() / propagate() / solveStep() */
  log = new DeductionLog();
  /** the value filled in by the last solveStep(), if any */
  lastStep: Deduction | null = null;

  constructor(
    readonly puzzle: Puzzle,
    /** when deduction gets stuck, try values (depth-first, with backtracking) */
    public allowGuessing = false,
  ) {}

  /** A single deduction pass over the given cells and constraint groups (default: all). */
  step(groups?: Iterable<ConstraintGroup>, cells?: Iterable<Cell>): void {
    for (const cell of cells ?? this.puzzle.getGrid().getCells()) cell.checkForSinglePossibility();
    for (const group of groups ?? this.puzzle.getConstraintGroups()) group.applyConstraints();
  }

  /**
   * Start recording the changes in the solver's log (a fresh log, unless the puzzle is already
   * recording into it); returns the function that stops recording.
   */
  private beginRecord(): () => void {
    if (this.puzzle.deductionLog !== this.log) this.log = new DeductionLog();
    return this.puzzle.beginRecording(this.log);
  }

  private record<T>(fn: () => T): T {
    const end = this.beginRecord();
    try {
      return fn();
    } finally {
      end();
    }
  }

  /** The values deduced (not guessed) since position `start` of the log. */
  private deducedValues(start = 0): Deduction[] {
    return this.log.since(start).filter((d) => d.setsValue() && d.source === ValueSource.DEDUCED);
  }

  /** One of the easiest deductions (see Deduction.difficulty), chosen at random. */
  private easiest(deductions: Deduction[]): Deduction {
    const lowest = Math.min(...deductions.map((d) => d.difficulty()));
    const easiest = deductions.filter((d) => d.difficulty() === lowest);
    return easiest[Math.floor(this.random() * easiest.length)] as Deduction;
  }

  /**
   * The values one deduction pass determines, without changing the puzzle (what hint() and
   * solveStep() choose from). Throws ContradictionError when the pass shows that the puzzle
   * has no solution.
   */
  deducibleValues(): Deduction[] {
    const state = this.puzzle.saveState();
    try {
      this.record(() => this.step());
      return this.deducedValues();
    } finally {
      this.puzzle.restoreState(state);
    }
  }

  /**
   * The next value the rules determine (a Deduction with its reason), without changing the
   * puzzle; of the values a pass determines, one of the easiest is chosen. null when a
   * deduction pass does not determine any value. Throws ContradictionError when the pass shows
   * that the puzzle has no solution.
   */
  hint(): Deduction | null {
    const values = this.deducibleValues();
    return values.length > 0 ? this.easiest(values) : null;
  }

  /**
   * Fill in a single cell, e.g. to follow the solver step by step (no guessing). A deduction
   * pass is tried; if it determines the values of one or more cells, the puzzle is reset and
   * only one of those cells gets its value (lastStep tells which, and why): the cell and value
   * of `preferred` (e.g. the hint shown last) if the pass determines it, else one of the
   * easiest deductions. If the pass only narrows down possible values, that narrowing is kept,
   * so the next step can progress.
   *
   * Returns whether the puzzle changed. Throws ContradictionError if the pass detects that the
   * puzzle has no solution; the puzzle is then restored to the state it had before.
   */
  solveStep(preferred: Deduction | null = null): boolean {
    const state = this.puzzle.saveState();
    this.lastStep = null;
    try {
      this.record(() => {
        this.step();
        const values = this.deducedValues();
        if (values.length === 0) return;
        this.puzzle.restoreState(state);
        const chosen = this.preferredOrEasiest(values, preferred);
        this.log.truncate(0);
        this.puzzle.causedBy(chosen.cause, () => chosen.cell.inferValue(chosen.value as number));
        this.lastStep = this.log.deductions[0] ?? null;
      });
    } catch (error) {
      if (error instanceof ContradictionError) this.puzzle.restoreState(state);
      throw error;
    }
    return !statesEqual(this.puzzle.saveState(), state);
  }

  private preferredOrEasiest(deductions: Deduction[], preferred: Deduction | null): Deduction {
    if (preferred !== null) {
      const match = deductions.find(
        (d) => d.cell === preferred.cell && d.value === preferred.value,
      );
      if (match !== undefined) return match;
    }
    return this.easiest(deductions);
  }

  /**
   * Repeat deduction passes until a pass no longer changes anything. The first pass applies
   * every constraint; later passes only the constraint groups of the cells that changed.
   */
  propagate(): void {
    runSync(this.propagateSteps());
  }

  private *propagateSteps(): Steps<void> {
    const end = this.beginRecord();
    try {
      let groups: ConstraintGroup[] | undefined;
      let cells: Iterable<Cell> | undefined;
      for (;;) {
        yield;
        const start = this.log.length;
        this.step(groups, cells);
        const changed = this.log.changedCells(start);
        if (changed.size === 0) return;
        const touched = new Set<ConstraintGroup>();
        for (const cell of changed) for (const g of cell.constraintGroups) touched.add(g);
        // keep the puzzle's order, so the passes are deterministic
        groups = this.puzzle.getConstraintGroups().filter((g) => touched.has(g));
        cells = changed;
      }
    } finally {
      end();
    }
  }

  /**
   * Deduce as much as possible; if allowed, guess when deduction gets stuck. Returns whether
   * the puzzle is solved. Throws ContradictionError if the puzzle has no solution; the puzzle
   * is then restored to the state it had before solve() was called.
   *
   * shouldStop: checked between passes and guesses; when it returns true, the puzzle is
   * restored and SolveCancelled is thrown.
   */
  solve(shouldStop?: () => boolean): boolean {
    return runSync(this.solveSteps(), shouldStop);
  }

  /** solve(), in slices that let the event loop run (e.g. to keep a UI responsive). */
  solveAsync(options?: AsyncSolveOptions): Promise<boolean> {
    return runAsync(this.solveSteps(), options);
  }

  private *solveSteps(): Steps<boolean> {
    const initialState = this.puzzle.saveState();
    const end = this.beginRecord();
    try {
      yield* this.propagateSteps();
      if (this.allowGuessing && !this.puzzle.isSolved() && !(yield* this.searchSteps())) {
        throw new ContradictionError('No solution found, all guesses lead to a contradiction');
      }
    } catch (error) {
      this.puzzle.restoreState(initialState);
      throw error;
    } finally {
      end();
    }
    return this.puzzle.isSolved();
  }

  /**
   * The number of solutions, counting up to `limit` (with guessing), e.g. to check that a
   * puzzle has exactly one. The puzzle is left as it was.
   */
  countSolutions(limit = 2, shouldStop?: () => boolean): number {
    return runSync(this.countSolutionsSteps(limit), shouldStop);
  }

  private *countSolutionsSteps(limit: number): Steps<number> {
    const initialState = this.puzzle.saveState();
    const end = this.beginRecord();
    try {
      try {
        yield* this.propagateSteps();
      } catch (error) {
        if (error instanceof ContradictionError) return 0;
        throw error;
      }
      return yield* this.countSteps(limit);
    } finally {
      end();
      this.puzzle.restoreState(initialState);
    }
  }

  /**
   * The solved state of the puzzle (found with guessing, whatever allowGuessing says), and
   * whether it is the only solution, e.g. to check a user's entries against. The puzzle is
   * left as it was. Throws ContradictionError when there is no solution, and SolveCancelled
   * when stopped.
   */
  findSolution(shouldStop?: () => boolean): { solution: PuzzleState; unique: boolean } {
    return runSync(this.findSolutionSteps(), shouldStop);
  }

  findSolutionAsync(
    options?: AsyncSolveOptions,
  ): Promise<{ solution: PuzzleState; unique: boolean }> {
    return runAsync(this.findSolutionSteps(), options);
  }

  private *findSolutionSteps(): Steps<{ solution: PuzzleState; unique: boolean }> {
    const initialState = this.puzzle.saveState();
    const allowGuessing = this.allowGuessing;
    try {
      const count = yield* this.countSolutionsSteps(2);
      if (count === 0) throw new ContradictionError('The puzzle has no solution');
      this.allowGuessing = true;
      yield* this.solveSteps();
      return { solution: this.puzzle.saveState(), unique: count === 1 };
    } finally {
      this.allowGuessing = allowGuessing;
      this.puzzle.restoreState(initialState);
    }
  }

  /** The open cell with the fewest candidates (the first one, on a tie). */
  private mostConstrained(openCells: Cell[]): Cell {
    let best = openCells[0] as Cell;
    for (const cell of openCells) if (cell.values.size < best.values.size) best = cell;
    return best;
  }

  private *countSteps(limit: number): Steps<number> {
    const openCells = this.puzzle.getOpenCells();
    if (openCells.length === 0) return 1;
    const cell = this.mostConstrained(openCells);
    let found = 0;
    for (const value of sortedValues(cell.values)) {
      yield;
      const state = this.puzzle.saveState();
      const mark = this.log.length;
      try {
        cell.guessValue(value);
        yield* this.propagateSteps();
        found += yield* this.countSteps(limit - found);
      } catch (error) {
        if (!(error instanceof ContradictionError)) throw error;
      }
      this.puzzle.restoreState(state);
      this.log.truncate(mark);
      if (found >= limit) break;
    }
    return found;
  }

  private *searchSteps(): Steps<boolean> {
    const openCells = this.puzzle.getOpenCells();
    if (openCells.length === 0) return true;
    // guess on the most constrained cell first
    const cell = this.mostConstrained(openCells);
    for (const value of sortedValues(cell.values)) {
      yield;
      const state = this.puzzle.saveState();
      const mark = this.log.length;
      try {
        cell.guessValue(value);
        yield* this.propagateSteps();
        if (yield* this.searchSteps()) return true;
      } catch (error) {
        if (!(error instanceof ContradictionError)) throw error;
      }
      this.puzzle.restoreState(state);
      // the deductions after the guess were undone with it
      this.log.truncate(mark);
    }
    return false;
  }
}
