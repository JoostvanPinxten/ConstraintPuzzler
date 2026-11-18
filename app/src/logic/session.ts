/**
 * One open puzzle and everything the user does with it: selecting, entering values and notes,
 * undo/redo, hints, single solver steps, Solve (cancellable) and Check.
 *
 * This is the behaviour of the former PySide6 window layers (selectionwindow, cellinputwindow,
 * solvingwindow) without any UI: the React components render a session's state and call its
 * methods, and subscribe() tells them when to render again. Dialogs are data (`notice`), so the
 * whole flow can be tested without rendering.
 */
import {
  ContradictionError,
  EntryError,
  Game,
  HintSession,
  parsePuzzle,
  PositionedCell,
  REGION,
  CELL,
  SolveCancelled,
  Solver,
  VALUE,
  type Cell,
  type Puzzle,
  type PuzzleType,
} from '@constraintpuzzler/core';

import { HighlightRole, highlightRoles, mergeRole } from './highlight';
import type { Selection } from './tree';

export interface Settings {
  /** show the solver's candidates in open cells and in descriptions */
  readonly showHints: boolean;
  /** let Solve guess (with backtracking) when deduction gets stuck */
  readonly allowGuessing: boolean;
  /** a confetti burst when the user finishes a puzzle */
  readonly celebrate: boolean;
}

/** Like the desktop app: no candidates shown, and no guessing, until the user turns them on. */
export const DEFAULT_SETTINGS: Settings = {
  showHints: false,
  allowGuessing: false,
  celebrate: true,
};

/** A message for the user, shown as a dialog; with `confirm`, the dialog offers an action. */
export interface Notice {
  readonly title: string;
  readonly text: string;
  readonly confirm?: { readonly label: string; readonly action: () => void };
}

export type SolvingJob = 'solve' | 'check';

const BUSY = 'The solver is busy; wait for it or cancel it first.';

export class PuzzleSession {
  readonly puzzle: Puzzle;
  readonly game: Game;
  readonly solver: Solver;
  readonly hints = new HintSession();
  selection: Selection | null = null;
  /** typing a number toggles a note instead of entering it */
  notesMode = false;
  /** where a hint says to look */
  hintRegion = new Set<Cell>();
  /** the placed numbers that lead to the hint's value (shown with the value) */
  hintReasons = new Set<Cell>();
  /** the cells of the hint's region those numbers rule the value out of (drawn hatched) */
  hintRuledOut = new Set<Cell>();
  /** the cells Check found to be wrong (after the user asked to see them) */
  checkMarks = new Set<Cell>();
  /** about the last input, e.g. why a value was refused, or "Solved!" */
  inputMessage: string | null = null;
  /** about the last hint, solver step, Solve or Check */
  stepMessage: string | null = null;
  notice: Notice | null = null;
  /** the background job that runs, if any */
  solving: SolvingJob | null = null;
  /** increases on every change, for useSyncExternalStore */
  version = 0;
  /**
   * Increases each time the user finishes the puzzle (by typing or with Step, not with Solve),
   * for the confetti.
   */
  finishedCount = 0;

  private abort: AbortController | null = null;
  private listeners = new Set<() => void>();
  private violationsCache: { revision: number; cells: Set<Cell> } | null = null;

  constructor(
    readonly type: PuzzleType,
    /** the puzzle file's contents, to make detached copies for the background jobs */
    readonly source: string,
    readonly title: string,
    readonly filename?: string,
  ) {
    this.puzzle = this.parse();
    this.game = new Game(this.puzzle);
    this.solver = new Solver(this.puzzle);
  }

  private parse(): Puzzle {
    return parsePuzzle(this.type, this.source, this.filename);
  }

  // --- observing -------------------------------------------------------------------------

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private changed(): void {
    this.version++;
    for (const listener of [...this.listeners]) listener();
  }

  /** The cells whose shown value breaks a rule (drawn in red). */
  violations(): Set<Cell> {
    const revision = this.game.revision;
    if (this.violationsCache?.revision !== revision) {
      this.violationsCache = { revision, cells: this.game.violations() };
    }
    return this.violationsCache.cells;
  }

  /**
   * How far the puzzle is filled in: the cells that were open when it was loaded (not given)
   * and how many of them show a value now (entered, deduced or a mistake).
   */
  progress(): { filled: number; total: number } {
    let filled = 0;
    let total = 0;
    for (const cell of this.puzzle.getGrid().getCells()) {
      if (cell.isGiven()) continue;
      total++;
      if (this.game.valueOf(cell) !== null) filled++;
    }
    return { filled, total };
  }

  /** The role of every highlighted cell: the selection, the hint region and Check marks. */
  highlight(): Map<Cell, HighlightRole> {
    const roles = highlightRoles(this.puzzle, this.selection);
    mergeRole(roles, this.hintRegion, HighlightRole.HINT);
    mergeRole(roles, this.hintReasons, HighlightRole.REASON);
    mergeRole(roles, this.checkMarks, HighlightRole.WRONG);
    return roles;
  }

  // --- selection -------------------------------------------------------------------------

  select(selection: Selection | null): void {
    // a message about entering a value belongs to the previous selection
    this.selection = selection;
    this.inputMessage = null;
    this.stepMessage = null;
    this.changed();
  }

  selectCell(cell: Cell | null): void {
    this.select(cell === null ? null : { kind: 'cell', cell });
  }

  selectedCell(): Cell | null {
    return this.selection?.kind === 'cell' ? this.selection.cell : null;
  }

  /** Select the neighbouring cell in a direction (arrow keys), if there is one. */
  moveSelection(dx: number, dy: number): void {
    const current = this.selectedCell();
    const cells = this.puzzle.getGrid().getPositionedCells();
    if (!(current instanceof PositionedCell)) {
      if (cells[0] !== undefined) this.selectCell(cells[0]);
      return;
    }
    const from = current.getPosition();
    // the nearest cell ahead in that direction, preferring the same row or column
    let best: PositionedCell | null = null;
    let bestScore = Infinity;
    for (const cell of cells) {
      const p = cell.getPosition();
      const ahead = (p.x() - from.x()) * dx + (p.y() - from.y()) * dy;
      if (ahead <= 0) continue;
      const aside = Math.abs((p.x() - from.x()) * dy) + Math.abs((p.y() - from.y()) * dx);
      const score = ahead + 2 * aside;
      if (score < bestScore) {
        best = cell;
        bestScore = score;
      }
    }
    if (best !== null) this.selectCell(best);
  }

  // --- input -----------------------------------------------------------------------------

  /** Forget the hint being revealed and the Check marks: they belong to the puzzle as it was. */
  private resetGuidance(): void {
    this.hints.reset();
    this.hintRegion = new Set();
    this.hintReasons = new Set();
    this.hintRuledOut = new Set();
    this.checkMarks = new Set();
  }

  toggleNotesMode(): void {
    this.notesMode = !this.notesMode;
    this.changed();
  }

  /**
   * Handle a key (KeyboardEvent.key) typed on the board. Returns whether the key was used.
   * A digit enters a value in the selected cell (or toggles a note, in notes mode or with
   * Ctrl); Delete/Backspace clears it; N toggles notes mode; arrows move the selection.
   */
  pressKey(key: string, ctrl = false): boolean {
    const arrows: Record<string, [number, number]> = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    };
    const arrow = arrows[key];
    if (arrow !== undefined && !ctrl) {
      this.moveSelection(...arrow);
      return true;
    }
    if ((key === 'n' || key === 'N') && !ctrl) {
      this.toggleNotesMode();
      return true;
    }
    if (key === 'Delete' || key === 'Backspace') {
      if (this.selectedCell() === null) return false;
      this.clearSelected();
      return true;
    }
    if (/^[0-9]$/.test(key)) {
      if (this.selectedCell() === null) return false;
      this.typeDigit(Number(key), ctrl);
      return true;
    }
    return false;
  }

  /** A number typed (or tapped on the number pad) for the selected cell. */
  typeDigit(digit: number, asNote = false): void {
    // 0 clears the cell, unless 0 is a value of the puzzle
    if (digit === 0 && !this.puzzle.getValues().includes(0) && !(asNote || this.notesMode)) {
      this.clearSelected();
      return;
    }
    this.edit((cell) => {
      if (asNote || this.notesMode) {
        this.game.toggleNote(cell, digit);
        // the notes of this cell changed, so its Check mark is outdated
        this.checkMarks.delete(cell);
      } else {
        this.game.enter(cell, digit);
        this.resetGuidance();
      }
    });
  }

  clearSelected(): void {
    this.edit((cell) => {
      this.game.clear(cell);
      this.resetGuidance();
    });
  }

  private edit(change: (cell: Cell) => void): void {
    const cell = this.selectedCell();
    if (cell === null) return;
    if (this.solving !== null) {
      this.inputMessage = BUSY;
      this.changed();
      return;
    }
    const wasSolved = this.game.isSolved(this.violations());
    try {
      change(cell);
      this.inputMessage = null;
    } catch (error) {
      if (!(error instanceof EntryError)) throw error;
      this.inputMessage = error.message;
    }
    if (this.game.isSolved(this.violations())) {
      this.inputMessage = 'Solved!';
      if (!wasSolved) this.finishedCount++;
    }
    this.changed();
  }

  canUndo(): boolean {
    return this.solving === null && this.game.canUndo();
  }

  canRedo(): boolean {
    return this.solving === null && this.game.canRedo();
  }

  undo(): void {
    if (this.canUndo() && this.game.undo()) this.puzzleChanged();
  }

  redo(): void {
    if (this.canRedo() && this.game.redo()) this.puzzleChanged();
  }

  private puzzleChanged(): void {
    this.resetGuidance();
    this.changed();
  }

  // --- guidance --------------------------------------------------------------------------

  /** The text of the Hint button: what the next press reveals. */
  hintLabel(): string {
    if (this.hints.deduction === null) return 'Hint';
    if (this.hints.level === REGION) return 'Hint: which cell?';
    if (this.hints.level === CELL) return 'Hint: show value';
    return 'Hint';
  }

  private contradiction(error: ContradictionError): void {
    this.notice = {
      title: 'Puzzle cannot be solved',
      text: `The solver ran into a contradiction:\n\n${error.message}`,
    };
  }

  /**
   * Reveal a value that follows from the constraints, a bit more on every press: first where
   * to look, then the cell, then the value and why. Nothing is filled in.
   */
  hint(): void {
    if (this.solving !== null) return;
    let hint;
    try {
      hint = this.hints.advance(this.solver);
    } catch (error) {
      if (!(error instanceof ContradictionError)) throw error;
      this.contradiction(error);
      this.changed();
      return;
    }
    if (hint === null) {
      this.notice = {
        title: 'No hint',
        text:
          'No value follows from a single round of the rules. Use Step to narrow down the' +
          ' candidates, or Solve.',
      };
      this.resetGuidance();
      this.changed();
      return;
    }
    if (this.hints.level === REGION) {
      // show the area without giving away the cell
      this.selection = null;
      this.hintRegion = this.hints.regionCells();
      this.hintReasons = new Set();
      this.hintRuledOut = new Set();
    } else {
      // with the value, show the numbers that rule it out of the rest of the region
      this.hintReasons = this.hints.level === VALUE ? this.hints.reasonCells() : new Set();
      this.hintRuledOut = this.hints.level === VALUE ? this.hints.ruledOutCells() : new Set();
      this.hintRegion = this.hintReasons.size > 0 ? this.hints.regionCells() : new Set();
      this.selection = { kind: 'cell', cell: hint.cell };
    }
    this.inputMessage = null;
    this.stepMessage = `Hint: ${this.hints.message()}`;
    this.changed();
  }

  /** Fill in one deducible cell (the hint's, if one is shown), to follow the solver. */
  solveStep(settings: Settings = DEFAULT_SETTINGS): void {
    if (this.solving !== null || this.puzzle.isSolved()) return;
    let changed: boolean;
    try {
      changed = this.game.solveStep(this.solver, this.hints.deduction);
    } catch (error) {
      if (!(error instanceof ContradictionError)) throw error;
      this.contradiction(error);
      this.changed();
      return;
    }
    this.resetGuidance();
    this.inputMessage = null;
    this.stepMessage = null;
    const step = this.solver.lastStep;
    if (step !== null) {
      this.selection = { kind: 'cell', cell: step.cell };
      this.stepMessage = `Solver step: ${step.describe()}`;
    }
    if (!changed) {
      this.notice = {
        title: 'No progress',
        text:
          'A deduction step does not change the puzzle any further.' +
          (settings.allowGuessing
            ? ' Use Solve to continue by guessing.'
            : ' Turn on Allow guessing and use Solve to continue.'),
      };
    }
    // solveStep returns early on a solved puzzle, so this step finished it
    if (this.game.isSolved(this.violations())) this.finishedCount++;
    this.changed();
  }

  /** A copy of the puzzle, for a background job: the shown puzzle stays as it is meanwhile. */
  private detachedCopy(): Puzzle {
    return this.parse();
  }

  /** Solve in the background; while it runs, calling solve() again cancels it. */
  async solve(settings: Settings = DEFAULT_SETTINGS): Promise<void> {
    if (this.solving === 'solve') {
      this.cancel();
      return;
    }
    if (this.solving !== null) return;
    const copy = this.detachedCopy();
    copy.restoreState(this.puzzle.saveState());
    const solver = new Solver(copy, settings.allowGuessing);
    await this.runJob('solve', async (signal) => {
      const solved = await solver.solveAsync({ signal });
      this.game.applySolution(copy.saveState());
      this.resetGuidance();
      this.inputMessage = null;
      this.stepMessage = solved ? null : 'The solver got stuck; try Allow guessing.';
    });
  }

  /** Stop a running Solve or Check. */
  cancel(): void {
    this.abort?.abort();
  }

  /**
   * Compare the filled-in values and notes with the solution. The solution is found once per
   * puzzle, in the background, from the given values only.
   */
  async check(): Promise<void> {
    if (this.solving !== null) return;
    if (this.game.solution === null) {
      const copy = this.detachedCopy();
      copy.restoreState(this.game.entries.initialState);
      const found = await this.runJob('check', (signal) =>
        new Solver(copy, true).findSolutionAsync({ signal }),
      );
      if (found === undefined) return;
      this.game.solution = found.solution;
      this.game.solutionIsUnique = found.unique;
    }
    this.showCheckResult();
  }

  private showCheckResult(): void {
    const solution = this.game.solution;
    if (solution === null) return;
    if (!this.game.solutionIsUnique) {
      this.notice = {
        title: 'Check',
        text:
          'This puzzle has more than one solution, so the values cannot be checked against' +
          ' the solution; only values that break a rule are shown (in red).',
      };
    } else {
      const result = this.game.check(solution);
      const marks = new Set([...result.wrongValues, ...result.wrongNotes]);
      this.notice = result.isAllCorrect()
        ? { title: 'Check', text: result.summary() }
        : {
            title: 'Check',
            text: result.summary(),
            confirm: { label: 'Show them', action: () => this.showCheckMarks(marks) },
          };
    }
    this.changed();
  }

  showCheckMarks(cells: Set<Cell>): void {
    this.checkMarks = cells;
    this.stepMessage = 'Check: the cells marked in red are wrong.';
    this.changed();
  }

  dismissNotice(): void {
    this.notice = null;
    this.changed();
  }

  private async runJob<T>(
    job: SolvingJob,
    work: (signal: AbortSignal) => Promise<T>,
  ): Promise<T | undefined> {
    const abort = new AbortController();
    this.abort = abort;
    this.solving = job;
    this.changed();
    try {
      return await work(abort.signal);
    } catch (error) {
      if (error instanceof SolveCancelled) {
        this.stepMessage = job === 'solve' ? 'Solving was cancelled.' : 'Check was cancelled.';
      } else if (error instanceof ContradictionError) {
        this.contradiction(error);
      } else {
        throw error;
      }
      return undefined;
    } finally {
      this.abort = null;
      this.solving = null;
      this.changed();
    }
  }
}
