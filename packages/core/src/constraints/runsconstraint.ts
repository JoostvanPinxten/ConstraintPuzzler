import type { TechniqueId } from '../guide/techniques';
import type { Cell } from '../structure/cell';
import type { Deduction } from '../structure/deduction';
import { ContradictionError, MessageError } from '../structure/errors';
import type { Puzzle } from '../structure/puzzle';
import { sortedValues, type Value, type ValueOf } from '../structure/types';
import { formatMessage, msg, type Message } from '../i18n/message';
import { Constraint } from './constraint';
import { clueMessage, describeRuns, explainRuns } from './runsexplanation';

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

export interface Reason {
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
  /** per block: every start it can have, in order */
  readonly starts: number[][];
}

/**
 * The placements behind a deduction of a nonogram line (RunsConstraint.placementDiagram), for
 * a picture of them: per row, the value of every cell of the line in one placement.
 */
export interface PlacementDiagram {
  /** the cell of the deduction, as an index in the line */
  readonly index: number;
  /** the value the deduction sets (null when it only removes candidates) */
  readonly value: Value | null;
  /** the values known now, per cell (null when open) */
  readonly known: readonly (Value | null)[];
  /** whether the line is a column (drawn from top to bottom) */
  readonly vertical: boolean;
  /**
   * the block the rows show (for an overlap: where that block can go; the other cells of a row
   * are null); null when the rows are placements of all blocks
   */
  readonly block: number | null;
  readonly rows: readonly (readonly (Value | null)[])[];
  /**
   * for an overlap: per row, the first and last cell of the block shown; the other blocks in
   * that row are pushed as far from it as they fit (to be drawn pale)
   */
  readonly spans?: readonly (readonly [number, number])[];
  /** how many placements there are; more than rows.length when only the first are given */
  readonly total: number;
}

/** The colours of the puzzle's nonogram lines (the palette of the first RunsConstraint). */
export function paletteOf(puzzle: Puzzle): readonly PaletteColor[] | null {
  for (const constraint of puzzle.getConstraints()) {
    if (constraint instanceof RunsConstraint) return constraint.palette;
  }
  return null;
}

/**
 * The placement of the blocks in the cells with every block as far to the start as it fits
 * (cells without a block BLANK), or null when they do not fit.
 */
function leftmostPlacement(
  runs: readonly Run[],
  candidates: readonly ReadonlySet<Value>[],
): Value[] | null {
  const n = candidates.length;
  const has = (j: number, v: Value): boolean => (candidates[j] as ReadonlySet<Value>).has(v);
  const failed = new Set<number>();
  const line: Value[] = new Array<Value>(n).fill(BLANK);
  const fill = (i: number, b: number): boolean => {
    if (b === runs.length) {
      for (let j = i; j < n; j++) if (!has(j, BLANK)) return false;
      return true;
    }
    if (i >= n || failed.has(i * (runs.length + 1) + b)) return false;
    const run = runs[b] as Run;
    const end = i + run.length;
    let fits = end <= n;
    for (let j = i; fits && j < end; j++) fits = has(j, run.color);
    const gap = runs[b + 1]?.color === run.color ? 1 : 0;
    if (fits && gap === 1) fits = end < n && has(end, BLANK);
    if (fits) {
      for (let j = i; j < end; j++) line[j] = run.color;
      if (fill(end + gap, b + 1)) return true;
      for (let j = i; j < end; j++) line[j] = BLANK;
    }
    if (has(i, BLANK) && fill(i + 1, b)) return true;
    failed.add(i * (runs.length + 1) + b);
    return false;
  };
  return fill(0, 0) ? line : null;
}

/** As leftmostPlacement, with every block as far to the end as it fits. */
function rightmostPlacement(
  runs: readonly Run[],
  candidates: readonly ReadonlySet<Value>[],
): Value[] | null {
  const line = leftmostPlacement([...runs].reverse(), [...candidates].reverse());
  return line === null ? null : line.reverse();
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
        throw new MessageError(msg('runs.invalidBlock', { length: run.length, color: run.color }));
      }
    }
    if (this.minimumLength(runs) > this.group.cells.length && this.group.cells.length > 0) {
      throw new MessageError(
        msg('runs.noFit', { clue: clueMessage(this, runs), count: this.group.cells.length }),
      );
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

  /** '3 1' for one colour, else '3 red, 1 black'; 'no blocks' when empty (in English). */
  clueText(runs: readonly Run[] = this.runs): string {
    return formatMessage(clueMessage(this, runs));
  }

  notify(_cell: Cell): void {}

  applyConstraint(): void {
    const cells = this.group.cells;
    const result = this.placements(cells.map((c) => c.getPossibleValues()));
    if (result === null) {
      throw new ContradictionError(
        msg('runs.cannotHold', {
          group: this.group.nameMessage(),
          clue: clueMessage(this, this.runs),
        }),
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
  reasonOf(deduction: Deduction): Reason {
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

  /** The nonogram techniques have the same names in TECHNIQUE_GUIDE. */
  override techniqueId(deduction: Deduction): TechniqueId {
    return this.techniqueOf(deduction);
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
    const afterRun = (i: number, b: number): number => this.afterRun(candidates, i, b);
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
    const starts = Array.from({ length: k }, () => [] as number[]);
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
        const blockStarts = starts[b] as number[];
        if (blockStarts[blockStarts.length - 1] !== i) blockStarts.push(i);
        mark(reachable, next, b + 1);
      }
    }
    return { allowed, firstStart, lastStart, starts };
  }

  /**
   * The state after placing block b from cell i (with the blank gap before a next block of the
   * same colour), or -1 when it does not fit there.
   */
  private afterRun(candidates: readonly ReadonlySet<Value>[], i: number, b: number): number {
    const n = candidates.length;
    const has = (j: number, v: Value): boolean => (candidates[j] as ReadonlySet<Value>).has(v);
    const run = this.runs[b] as Run;
    const end = i + run.length;
    if (end > n) return -1;
    for (let j = i; j < end; j++) if (!has(j, run.color)) return -1;
    const next = this.runs[b + 1];
    if (next !== undefined && next.color === run.color) {
      return end < n && has(end, BLANK) ? end + 1 : -1;
    }
    return end;
  }

  /**
   * ways[i][b]: in how many ways cells i.. can hold exactly blocks b.. (0 when they cannot).
   * Counted as floating point numbers, which stay exact up to 2^53 placements.
   */
  private ways(candidates: readonly ReadonlySet<Value>[]): number[][] {
    const n = candidates.length;
    const k = this.runs.length;
    const ways = Array.from({ length: n + 2 }, () => new Array<number>(k + 1).fill(0));
    const row = (i: number): number[] => ways[i] as number[];
    row(n)[k] = 1;
    for (let i = n - 1; i >= 0; i--) {
      for (let b = k; b >= 0; b--) {
        let count = (candidates[i] as ReadonlySet<Value>).has(BLANK)
          ? (row(i + 1)[b] as number)
          : 0;
        if (b < k) {
          const next = this.afterRun(candidates, i, b);
          if (next >= 0) count += row(next)[b + 1] as number;
        }
        row(i)[b] = count;
      }
    }
    return ways;
  }

  /**
   * The placements of all blocks that fit the candidates, as the value of every cell: at most
   * `limit` of them, the ones with the blocks furthest to the start first, plus how many
   * there are in all.
   */
  linePlacements(
    candidates: readonly ReadonlySet<Value>[],
    limit = Infinity,
  ): { rows: Value[][]; total: number } {
    const n = candidates.length;
    const k = this.runs.length;
    const ways = this.ways(candidates);
    const count = (i: number, b: number): number => (ways[i] as number[])[b] as number;
    const rows: Value[][] = [];
    const line: Value[] = new Array<Value>(n).fill(BLANK);
    const visit = (i: number, b: number): void => {
      if (rows.length >= limit) return;
      if (i >= n) {
        if (b === k) rows.push([...line]);
        return;
      }
      if (b < k) {
        const next = this.afterRun(candidates, i, b);
        if (next >= 0 && count(next, b + 1) > 0) {
          const run = this.runs[b] as Run;
          for (let j = i; j < next; j++) line[j] = j < i + run.length ? run.color : BLANK;
          visit(next, b + 1);
          for (let j = i; j < next; j++) line[j] = BLANK;
        }
      }
      if ((candidates[i] as ReadonlySet<Value>).has(BLANK) && count(i + 1, b) > 0) {
        line[i] = BLANK;
        visit(i + 1, b);
      }
    };
    if (count(0, 0) > 0) visit(0, 0);
    return { rows, total: count(0, 0) };
  }

  /**
   * The placements behind a deduction of this constraint, to draw next to its explanation:
   * for an overlap, the places the covering block can go (only that block in every row);
   * otherwise the placements of all blocks (at most `limit`). Made from the cells' current
   * candidates, so it matches the explanation only while the line is as it was when the
   * deduction was made (as for a hint). Null when the deduction is not about this line.
   */
  placementDiagram(deduction: Deduction, limit = 6): PlacementDiagram | null {
    const cells = this.group.cells;
    const index = cells.indexOf(deduction.cell);
    if (index < 0) return null;
    const candidates = cells.map((c) => c.getPossibleValues());
    const known = cells.map((c) => c.getValue());
    const vertical = this.group.getName().toLowerCase().startsWith('column');
    const reason = this.reasonOf(deduction);
    const value = deduction.setsValue() ? (deduction.value as Value) : null;
    if (reason.technique === 'overlap' && reason.run !== undefined) {
      const b = reason.run;
      const run = this.runs[b] as Run;
      const starts = this.placements(candidates)?.starts[b] ?? [];
      const rows = starts.map((start) => this.placementAround(candidates, b, start));
      const spans = starts.map((start): [number, number] => [start, start + run.length - 1]);
      return { index, value, known, vertical, block: b, rows, spans, total: rows.length };
    }
    const { rows, total } = this.linePlacements(candidates, limit);
    return { index, value, known, vertical, block: null, rows, total };
  }

  /**
   * A placement with block b at `start`, the blocks before it as far to the start and the
   * blocks after it as far to the end as they fit: it shows what keeps block b from going
   * further. Cells that cannot be filled this way (not when `start` is a start of block b) are
   * null.
   */
  private placementAround(
    candidates: readonly ReadonlySet<Value>[],
    b: number,
    start: number,
  ): (Value | null)[] {
    const n = candidates.length;
    const run = this.runs[b] as Run;
    const end = start + run.length;
    const gapBefore = b > 0 && (this.runs[b - 1] as Run).color === run.color ? 1 : 0;
    const gapAfter = this.runs[b + 1]?.color === run.color ? 1 : 0;
    const before = leftmostPlacement(
      this.runs.slice(0, b),
      candidates.slice(0, Math.max(0, start - gapBefore)),
    );
    const after = rightmostPlacement(
      this.runs.slice(b + 1),
      candidates.slice(Math.min(n, end + gapAfter)),
    );
    const line: (Value | null)[] = new Array<Value | null>(n).fill(null);
    for (let j = 0; j < start - gapBefore && before !== null; j++) line[j] = before[j] as Value;
    if (gapBefore === 1 && before !== null) line[start - 1] = BLANK;
    for (let j = start; j < end; j++) line[j] = run.color;
    if (gapAfter === 1 && after !== null && end < n) line[end] = BLANK;
    if (after !== null) after.forEach((v, j) => (line[end + gapAfter + j] = v));
    return line;
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

  override summaryMessage(): Message {
    return msg('runs.summary', { clue: clueMessage(this, this.runs) });
  }

  override describeMessage(_showHints = true): Message {
    return describeRuns(this);
  }

  override explainMessage(deduction: Deduction): Message {
    return explainRuns(this, deduction);
  }

  override toString(): string {
    return `runs[${this.runs.map((r) => `${r.length}:${r.color}`).join(' ')}]`;
  }
}
