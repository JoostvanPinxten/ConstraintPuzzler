/**
 * Hints in three levels: where to look, which cell, and finally the value and why.
 *
 * Asking for a hint again while the puzzle has not changed reveals more of the same deduction,
 * so a user can get just enough help: first the region (the cells of the rule that decides the
 * value), then the cell, then the value with its reason. After the puzzle changes, the next
 * hint is a new one.
 *
 * When no value follows directly, a hint can be a technique's finding instead (e.g. an X-Wing,
 * see Solver.techniqueFinding): first the groups to look at, then the pattern of cells where
 * the value can still go, then which candidates go and why.
 */
import type { ConstraintGroup } from '../constraints/constraintgroup';
import { ExactCoverConstraint } from '../constraints/exactcoverconstraint';
import { Constraint } from '../constraints/constraint';
import type { Cell } from '../structure/cell';
import type { Deduction } from '../structure/deduction';
import { listNames, type Finding } from '../techniques/technique';
import { stateKey, type Value } from '../structure/types';
import type { Solver } from './solver';

export const REGION = 1;
export const CELL = 2;
export const VALUE = 3;
export type HintLevel = 0 | typeof REGION | typeof CELL | typeof VALUE;

export class HintSession {
  /** the value the hint is about; null for none, or for a technique's finding */
  deduction: Deduction | null = null;
  /** the technique finding the hint is about, when no value follows directly */
  finding: Finding | null = null;
  /** 0 (no hint), REGION, CELL or VALUE */
  level: HintLevel = 0;
  /** the puzzle state the hint was made for (as a stateKey) */
  private state: string | null = null;

  reset(): void {
    this.deduction = null;
    this.finding = null;
    this.level = 0;
    this.state = null;
  }

  /**
   * Reveal more of the current hint, or start a new one (at REGION) when there is none or the
   * puzzle changed since. Returns the hint's deduction, or, when no value follows directly,
   * the finding of the easiest technique that applies; null when neither (the session is then
   * reset). Throws ContradictionError like Solver.hint().
   */
  advance(solver: Solver): Deduction | Finding | null {
    const state = stateKey(solver.puzzle.saveState());
    if (!this.active() || state !== this.state) {
      this.reset();
      const deduction = solver.hint();
      const finding = deduction === null ? solver.techniqueFinding() : null;
      if (deduction === null && finding === null) return null;
      this.deduction = deduction;
      this.finding = finding;
      this.level = REGION;
      this.state = state;
    } else {
      this.level = Math.min(this.level + 1, VALUE) as HintLevel;
    }
    return this.deduction ?? this.finding;
  }

  /** Whether a hint is being revealed. */
  active(): boolean {
    return this.deduction !== null || this.finding !== null;
  }

  /**
   * The cells to look at: the group of the constraint that decides the value, or, for a cell
   * with a single candidate left, every group the cell is in.
   */
  regionCells(): Set<Cell> {
    if (this.finding !== null) return new Set(this.finding.groups.flatMap((g) => g.getCells()));
    const deduction = this.deduction;
    if (deduction === null) return new Set();
    if (deduction.cause instanceof Constraint) return new Set(deduction.cause.group.getCells());
    return new Set(deduction.cell.constraintGroups.flatMap((g) => g.getCells()));
  }

  /**
   * The placed numbers that lead to the hint:
   * - for a value that fits only one cell of an exact cover group, the cells holding that
   *   value which rule it out of the group's other open cells (through a row, column, box,
   *   ... they share); as few as cover those cells, picked in a fixed order. Open cells that
   *   lost the value another way get none.
   * - for the only candidate left in a cell, every placed number in the cell's groups: each
   *   rules its value out of the cell.
   * Empty for other hints.
   */
  reasonCells(): Set<Cell> {
    if (this.isNakedSingle()) return new Set(this.nakedSingleReasons().keys());
    return new Set(this.explanation().values());
  }

  /**
   * The groups through which the reasonCells rule the value out: per ruled-out cell, the
   * first group it shares with the number that rules it out (e.g. the column or box that
   * overlaps the hint's row). In the order of the ruled-out cells. For the only candidate
   * left in a cell: the cell's groups that hold a placed number.
   */
  reasonGroups(): Set<ConstraintGroup> {
    if (this.isNakedSingle()) {
      const cell = (this.deduction as Deduction).cell;
      const reasons = this.nakedSingleReasons();
      return new Set(cell.constraintGroups.filter((g) => g.getCells().some((c) => reasons.has(c))));
    }
    const groups = new Set<ConstraintGroup>();
    const cause = this.deduction?.cause;
    const hinted = cause instanceof Constraint ? cause.group : null;
    for (const [cell, reason] of this.explanation()) {
      const group = cell.constraintGroups.find(
        (g) => g !== hinted && g.getCells().includes(reason),
      );
      if (group !== undefined) groups.add(group);
    }
    return groups;
  }

  /**
   * The other open cells of the hint's exact cover group that a placed number (reasonCells)
   * rules the value out of, in the group's order. Empty when reasonCells is.
   */
  ruledOutCells(): Set<Cell> {
    return new Set(this.blockers().keys());
  }

  /** A value that is the only candidate left in its cell (no constraint decides it). */
  private isNakedSingle(): boolean {
    return this.deduction?.value != null && this.deduction.cause === null;
  }

  /**
   * For the only candidate left in a cell: which numbers each of the cell's groups rules out,
   * e.g. "Row 7 has 5, 7, 6 and 8; Column 5 has 6, 9 and 3; Block 8 also has 1, 5 and 2."
   * A number is named once, in the first group (see nakedSingleReasons); "also" marks a
   * group whose other numbers were named before. Empty for other hints.
   */
  exclusions(): string {
    if (!this.isNakedSingle()) return '';
    const reasons = this.nakedSingleReasons();
    const byGroup = new Map<ConstraintGroup, Value[]>();
    for (const [cell, group] of reasons) {
      const values = byGroup.get(group) ?? [];
      values.push(cell.getValue() as Value);
      byGroup.set(group, values);
    }
    // "also" when some of the group's numbers were named for an earlier group
    const parts = [...byGroup].map(([group, values]) => {
      const named = group.getCells().some((c) => reasons.has(c) && reasons.get(c) !== group);
      return `${group.getName()}${named ? ' also' : ''} has ${listing(values)}`;
    });
    return parts.length > 0 ? `${parts.join('; ')}.` : '';
  }

  /**
   * For a naked single: the placed cells in the cell's groups, each with the first group it
   * is found in. The groups that overlap the cell's other groups least come first (a row and
   * a column before the box that overlaps both), so each group adds what the others miss.
   */
  private nakedSingleReasons(): Map<Cell, ConstraintGroup> {
    const result = new Map<Cell, ConstraintGroup>();
    const deduction = this.deduction;
    if (deduction === null) return result;
    const groups = deduction.cell.constraintGroups;
    const overlap = (group: ConstraintGroup): number =>
      groups
        .filter((g) => g !== group)
        .reduce((n, g) => n + group.getCells().filter((c) => g.getCells().includes(c)).length, 0);
    const ordered = groups
      .map((group, index) => ({ group, index, overlap: overlap(group) }))
      .sort((a, b) => a.overlap - b.overlap || a.index - b.index)
      .map((entry) => entry.group);
    for (const group of ordered) {
      for (const c of group.getCells()) {
        if (c !== deduction.cell && c.hasValue() && !result.has(c)) result.set(c, group);
      }
    }
    return result;
  }

  /**
   * Per ruled-out cell: the reasonCell that rules the value out of it. The numbers are picked
   * greedily, the one that rules the value out of most of the remaining cells first.
   */
  private explanation(): Map<Cell, Cell> {
    const blockersOf = this.blockers();
    const remaining = new Map(blockersOf);
    const chosen: Cell[] = [];
    while (remaining.size > 0) {
      const counts = new Map<Cell, number>();
      for (const blockers of remaining.values()) {
        for (const b of blockers) counts.set(b, (counts.get(b) ?? 0) + 1);
      }
      let best: Cell | null = null;
      let bestCount = 0;
      for (const [b, count] of counts) {
        if (count > bestCount) [best, bestCount] = [b, count];
      }
      if (best === null) break;
      chosen.push(best);
      for (const [cell, blockers] of [...remaining]) {
        if (blockers.includes(best)) remaining.delete(cell);
      }
    }
    // each ruled-out cell gets the first chosen number that rules it out
    const result = new Map<Cell, Cell>();
    for (const [cell, blockers] of blockersOf) {
      const reason = chosen.find((c) => blockers.includes(c));
      if (reason !== undefined) result.set(cell, reason);
    }
    return result;
  }

  /**
   * Per other open cell of the hint's exact cover group: the placed cells with the hint's
   * value that rule it out (in a group they share). Cells without such a number are left out.
   */
  private blockers(): Map<Cell, Cell[]> {
    const deduction = this.deduction;
    const blockersOf = new Map<Cell, Cell[]>();
    if (deduction?.value == null || !(deduction.cause instanceof ExactCoverConstraint)) {
      return blockersOf;
    }
    const value = deduction.value;
    const group = deduction.cause.group;
    for (const cell of group.getCells()) {
      if (cell === deduction.cell || cell.hasValue()) continue;
      const blockers: Cell[] = [];
      for (const other of cell.constraintGroups) {
        if (other === group) continue;
        for (const c of other.getCells()) {
          if (c.getValue() === value && !blockers.includes(c)) blockers.push(c);
        }
      }
      if (blockers.length > 0) blockersOf.set(cell, blockers);
    }
    return blockersOf;
  }

  /** What the hint says at its current level. */
  message(): string {
    if (this.finding !== null) return this.findingMessage(this.finding);
    const deduction = this.deduction;
    if (deduction === null) return '';
    if (this.level === REGION) {
      const cause = deduction.cause;
      if (!(cause instanceof Constraint)) {
        return 'In the highlighted area, one cell has only one possible value left.';
      }
      return (
        `Look at ${cause.group.getName()} (${cause.summary()}):` +
        ' it decides the value of one of its cells.'
      );
    }
    if (this.level === CELL) return `Look at cell ${deduction.cell.getName()}.`;
    const exclusions = this.exclusions();
    return exclusions === '' ? deduction.describe() : `${deduction.describe()} ${exclusions}`;
  }

  /** What a technique hint says at its current level. */
  private findingMessage(finding: Finding): string {
    const groups = listNames(finding.groups.map((g) => g.getName()));
    const type = finding.technique.getType();
    if (this.level === REGION) {
      return `Look at where ${finding.value} can go in ${groups} (${type}).`;
    }
    if (this.level === CELL) {
      return `In ${groups}, ${finding.value} can only go in the highlighted cells.`;
    }
    const cells = finding.targets.length === 1 ? 'the hatched cell' : 'the hatched cells';
    return `${finding.reason}. So ${finding.value} can be removed from ${cells}.`;
  }
}

/** "5, 7, 6 and 8": the values in the order given. */
function listing(values: readonly Value[]): string {
  if (values.length <= 1) return values.join('');
  return `${values.slice(0, -1).join(', ')} and ${String(values.at(-1))}`;
}
