import type { Cell } from '../structure/cell';
import type { Deduction } from '../structure/deduction';
import { ContradictionError } from '../structure/errors';
import type { Puzzle } from '../structure/puzzle';
import { sortedValues, type Value, type ValueOf } from '../structure/types';
import { Constraint } from './constraint';

/** The value of an empty (white) cell. */
export const BLANK: Value = 0;

/** One block of a clue: `length` consecutive cells of colour `color`. */
export interface Run {
  readonly color: Value;
  readonly length: number;
}

/** A colour of a nonogram: the cell value, a name for explanations, and how it is drawn. */
export interface PaletteColor {
  readonly value: Value;
  readonly name: string;
  /** a CSS colour, e.g. '#000000' */
  readonly hex: string;
}

/** The colours of a one-colour (black and white) nonogram. */
export const BLACK_AND_WHITE: readonly PaletteColor[] = [
  { value: BLANK, name: 'blank', hex: '#ffffff' },
  { value: 1, name: 'black', hex: '#000000' },
];

/**
 * How a value of a cell follows from a line, from easy to hard:
 * - `wholeLine`: the line has no blocks, or its blocks (and gaps) fill all of it;
 * - `overlap`: a block covers the cell wherever it goes (between its first and last start);
 * - `reach`: no block of that colour can reach the cell;
 * - `placements`: only by going over all placements of the blocks that fit the known cells.
 */
export type RunsTechnique = 'wholeLine' | 'overlap' | 'reach' | 'placements';

export const RUNS_TECHNIQUE_DIFFICULTY: Readonly<Record<RunsTechnique, number>> = {
  wholeLine: 2,
  overlap: 3,
  reach: 3,
  placements: 5,
};

interface Reason {
  readonly technique: RunsTechnique;
  /** the block that covers the cell, and its first and last start (overlap) */
  readonly run?: number;
  readonly first?: number;
  readonly last?: number;
}

/** The result of going over all placements of the blocks (see RunsConstraint.placements). */
export interface Placements {
  /** per cell: the values it has in at least one placement */
  readonly allowed: Set<Value>[];
  /** per block: its first and its last possible start */
  readonly firstStart: number[];
  readonly lastStart: number[];
}

/** The colours of the puzzle's nonogram lines (the palette of the first RunsConstraint). */
export function paletteOf(puzzle: Puzzle): readonly PaletteColor[] | null {
  for (const constraint of puzzle.getConstraints()) {
    if (constraint instanceof RunsConstraint) return constraint.palette;
  }
  return null;
}

/** '4' or '4-6' (1-based positions in a line). */
function cellRange(from: number, to: number): string {
  return from === to ? `cell ${from + 1}` : `cells ${from + 1}-${to + 1}`;
}

/**
 * The cells of the group, in order, hold exactly these blocks (a nonogram row or column):
 * every other cell is BLANK, and two consecutive blocks of the same colour have at least one
 * BLANK between them. Blocks of different colours may touch. With one colour this is the
 * classic black-and-white clue.
 *
 * Propagation is complete for the line: a value stays possible in a cell exactly when some
 * placement of the blocks that fits the candidates of all cells gives the cell that value.
 */
export class RunsConstraint extends Constraint {
  /** the hardest of its deductions (see RUNS_TECHNIQUE_DIFFICULTY and difficultyOf) */
  static override difficulty = RUNS_TECHNIQUE_DIFFICULTY.placements;

  runs: Run[] = [];
  palette: readonly PaletteColor[] = BLACK_AND_WHITE;

  /** why a value was removed from or set in a cell: cell -> value -> reason */
  private readonly reasons = new Map<Cell, Map<Value, Reason>>();

  setRuns(runs: readonly Run[], palette: readonly PaletteColor[] = this.palette): void {
    this.palette = palette;
    for (const run of runs) {
      if (run.color === BLANK || !Number.isInteger(run.length) || run.length < 1) {
        throw new Error(`invalid block ${run.length}:${run.color}`);
      }
    }
    if (this.minimumLength(runs) > this.group.cells.length && this.group.cells.length > 0) {
      throw new Error(`the blocks ${this.clueText(runs)} do not fit in ${this.group.cells.length}`);
    }
    this.runs = [...runs];
  }

  getRuns(): readonly Run[] {
    return this.runs;
  }

  /** The cells the blocks need, with the gaps between blocks of the same colour. */
  minimumLength(runs: readonly Run[] = this.runs): number {
    let length = 0;
    runs.forEach((run, b) => {
      length += run.length;
      if (b > 0 && (runs[b - 1] as Run).color === run.color) length += 1;
    });
    return length;
  }

  colorName(value: Value): string {
    return this.palette.find((c) => c.value === value)?.name ?? String(value);
  }

  /** '3 1' for one colour, else '3 red, 1 black'; 'no blocks' when empty. */
  clueText(runs: readonly Run[] = this.runs): string {
    if (runs.length === 0) return 'no blocks';
    const colors = this.palette.filter((c) => c.value !== BLANK).length;
    if (colors <= 1) return runs.map((r) => String(r.length)).join(' ');
    return runs.map((r) => `${r.length} ${this.colorName(r.color)}`).join(', ');
  }

  notify(_cell: Cell): void {}

  applyConstraint(): void {
    const cells = this.group.cells;
    const result = this.placements(cells.map((c) => c.getPossibleValues()));
    if (result === null) {
      throw new ContradictionError(
        `${this.group.getName()} cannot hold the blocks ${this.clueText()}`,
      );
    }
    const wholeLine = this.runs.length === 0 || this.minimumLength() === cells.length;
    cells.forEach((cell, i) => {
      const allowed = result.allowed[i] as Set<Value>;
      const reasonFor = (value: Value): Reason =>
        wholeLine ? { technique: 'wholeLine' } : this.simpleReason(result, i, value);
      const [only] = allowed;
      if (allowed.size === 1 && only !== undefined && cell.getValue() === null) {
        // set the value, so that hints and steps see it as this rule's deduction
        this.remember(cell, only, reasonFor(only));
        cell.inferValue(only);
        return;
      }
      for (const value of sortedValues(cell.getPossibleValues())) {
        if (allowed.has(value)) continue;
        this.remember(cell, value, reasonFor(value));
        cell.remove(value);
      }
    });
  }

  /**
   * The easiest technique that explains why cell i gets `value` (when it is the only value left)
   * or loses it (otherwise), given the first and last start of every block.
   */
  private simpleReason(result: Placements, i: number, value: Value): Reason {
    const covering = this.runs.findIndex(
      (run, b) =>
        (result.lastStart[b] as number) <= i && i < (result.firstStart[b] as number) + run.length,
    );
    const set = (result.allowed[i] as Set<Value>).size === 1;
    if (covering >= 0) {
      // a block always covers the cell: it has the block's colour, and no other value
      return {
        technique: 'overlap',
        run: covering,
        first: result.firstStart[covering] as number,
        last: result.lastStart[covering] as number,
      };
    }
    const reaches = (color: Value): boolean =>
      this.runs.some(
        (run, b) =>
          run.color === color &&
          (result.firstStart[b] as number) <= i &&
          i < (result.lastStart[b] as number) + run.length,
      );
    if (set && value === BLANK && !this.runs.some((r) => reaches(r.color))) {
      return { technique: 'reach' };
    }
    if (!set && value !== BLANK && !reaches(value)) return { technique: 'reach' };
    return { technique: 'placements' };
  }

  private remember(cell: Cell, value: Value, reason: Reason): void {
    let reasons = this.reasons.get(cell);
    if (reasons === undefined) {
      reasons = new Map();
      this.reasons.set(cell, reasons);
    }
    reasons.set(value, reason);
  }

  /** The reason of a deduction this constraint made (the hardest, for several values). */
  private reasonOf(deduction: Deduction): Reason {
    const reasons = this.reasons.get(deduction.cell);
    const values = deduction.setsValue() ? [deduction.value as Value] : [...deduction.removed];
    let hardest: Reason = { technique: 'placements' };
    let found = false;
    for (const value of values) {
      const reason = reasons?.get(value);
      if (reason === undefined) continue;
      if (
        !found ||
        RUNS_TECHNIQUE_DIFFICULTY[reason.technique] > RUNS_TECHNIQUE_DIFFICULTY[hardest.technique]
      ) {
        hardest = reason;
        found = true;
      }
    }
    return hardest;
  }

  /** The technique behind a deduction of this constraint. */
  techniqueOf(deduction: Deduction): RunsTechnique {
    return this.reasonOf(deduction).technique;
  }

  override difficultyOf(deduction: Deduction): number {
    return RUNS_TECHNIQUE_DIFFICULTY[this.techniqueOf(deduction)];
  }

  /**
   * Goes over all placements of the blocks that fit the candidates; null when none fits. A
   * backward pass finds the states (cell index, blocks placed) from which the rest of the line
   * can be completed, a forward pass the states that can be reached from the start; the moves
   * between states that are both give the values. O(cells x blocks x block length).
   */
  placements(candidates: readonly ReadonlySet<Value>[]): Placements | null {
    const n = candidates.length;
    const k = this.runs.length;
    const has = (i: number, v: Value): boolean => (candidates[i] as ReadonlySet<Value>).has(v);
    // the state after placing block b from cell i (with the blank gap before a next block of
    // the same colour), or -1 when it does not fit there
    const afterRun = (i: number, b: number): number => {
      const run = this.runs[b] as Run;
      const end = i + run.length;
      if (end > n) return -1;
      for (let j = i; j < end; j++) if (!has(j, run.color)) return -1;
      const next = this.runs[b + 1];
      if (next !== undefined && next.color === run.color) {
        return end < n && has(end, BLANK) ? end + 1 : -1;
      }
      return end;
    };
    const table = (): boolean[][] =>
      Array.from({ length: n + 2 }, () => new Array<boolean>(k + 1).fill(false));
    const at = (t: boolean[][], i: number, b: number): boolean => (t[i] as boolean[])[b] === true;
    const mark = (t: boolean[][], i: number, b: number): void => {
      (t[i] as boolean[])[b] = true;
    };

    // completable[i][b]: cells i.. can hold exactly blocks b..
    const completable = table();
    mark(completable, n, k);
    for (let i = n - 1; i >= 0; i--) {
      for (let b = k; b >= 0; b--) {
        let ok = has(i, BLANK) && at(completable, i + 1, b);
        if (!ok && b < k) {
          const next = afterRun(i, b);
          ok = next >= 0 && at(completable, next, b + 1);
        }
        if (ok) mark(completable, i, b);
      }
    }
    if (!at(completable, 0, 0)) return null;

    const allowed = Array.from({ length: n }, () => new Set<Value>());
    const firstStart = new Array<number>(k).fill(n);
    const lastStart = new Array<number>(k).fill(-1);
    const reachable = table();
    mark(reachable, 0, 0);
    for (let i = 0; i < n; i++) {
      for (let b = 0; b <= k; b++) {
        if (!at(reachable, i, b) || !at(completable, i, b)) continue;
        if (has(i, BLANK) && at(completable, i + 1, b)) {
          (allowed[i] as Set<Value>).add(BLANK);
          mark(reachable, i + 1, b);
        }
        if (b === k) continue;
        const next = afterRun(i, b);
        if (next < 0 || !at(completable, next, b + 1)) continue;
        const run = this.runs[b] as Run;
        for (let j = i; j < i + run.length; j++) (allowed[j] as Set<Value>).add(run.color);
        if (next > i + run.length) (allowed[i + run.length] as Set<Value>).add(BLANK);
        firstStart[b] = Math.min(firstStart[b] as number, i);
        lastStart[b] = Math.max(lastStart[b] as number, i);
        mark(reachable, next, b + 1);
      }
    }
    return { allowed, firstStart, lastStart };
  }

  /** The filled cells, when no placement of the blocks fits the values shown. */
  override violations(valueOf: ValueOf): Set<Cell> {
    const all = new Set<Value>(this.group.getValues());
    const cells = this.group.getCells();
    const shown = cells.map((c) => {
      const v = valueOf(c);
      return v === null ? all : new Set([v]);
    });
    if (this.placements(shown) !== null) return new Set();
    return new Set(cells.filter((c) => valueOf(c) !== null));
  }

  override getType(): string {
    return 'Runs Constraint';
  }

  override summary(): string {
    return `blocks ${this.clueText()}`;
  }

  override describe(_showHints = true): string {
    const cells = this.group.getCells();
    const known = cells.filter((c) => c.getValue() !== null).length;
    const rule =
      this.runs.length === 0
        ? 'This line has no blocks: all its cells are blank'
        : `The blocks, in this order: ${this.clueText()}`;
    if (known === cells.length) return `${rule}; complete.`;
    return `${rule}; ${known} of ${cells.length} cells known.`;
  }

  override explain(deduction: Deduction): string {
    const group = this.group.getName();
    const line = group.toLowerCase().startsWith('column') ? 'column' : 'line';
    const reason = this.reasonOf(deduction);
    const index = this.group.cells.indexOf(deduction.cell);
    const value = deduction.setsValue()
      ? (deduction.value as Value)
      : (sortedValues(deduction.removed)[0] as Value);
    const name = this.colorName(value);
    switch (reason.technique) {
      case 'wholeLine':
        if (this.runs.length === 0) return `${group} has no blocks, so all its cells are blank`;
        return `the blocks of ${group} (${this.clueText()}) and the gaps they need fill the whole ${line}`;
      case 'overlap': {
        const b = reason.run ?? 0;
        const run = this.runs[b] as Run;
        const first = reason.first ?? index;
        const last = reason.last ?? index;
        const color = this.colorName(run.color);
        const where =
          first === last
            ? `can only start at cell ${first + 1}`
            : `starts somewhere in ${cellRange(first, last)}`;
        return (
          `block ${b + 1} of ${group} (${this.clueText([run])}) ${where}, ` +
          `so it always covers ${cellRange(last, first + run.length - 1)}: this cell is ${color}`
        );
      }
      case 'reach':
        if (deduction.setsValue())
          return `no block of ${group} can reach this cell, so it is blank`;
        if (!this.runs.some((r) => r.color === value)) return `${group} has no ${name} blocks`;
        return `no ${name} block of ${group} can reach this cell`;
      case 'placements': {
        const all = `of all ways to place the blocks of ${group} (${this.clueText()}) that fit the cells known so far`;
        if (deduction.setsValue()) return `${all}, every one makes this cell ${name}`;
        return `${all}, none makes this cell ${name}`;
      }
    }
  }

  override toString(): string {
    return `runs[${this.runs.map((r) => `${r.length}:${r.color}`).join(' ')}]`;
  }
}
