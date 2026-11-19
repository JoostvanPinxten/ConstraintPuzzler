import { ExactCoverConstraint } from '../constraints/exactcoverconstraint';
import type { ConstraintGroup } from '../constraints/constraintgroup';
import type { Cell } from '../structure/cell';
import type { Deduction } from '../structure/deduction';
import type { Puzzle } from '../structure/puzzle';
import { sortedValues, type Value } from '../structure/types';

/**
 * One application of a technique: a pattern of cells that can still hold `value`, in the base
 * groups, which shows that the value goes in those cells and so not in `targets`, the other
 * open cells of the cover groups that could hold it. E.g. for an X-Wing on 7 in rows 2 and 6
 * and columns 4 and 8: groups = the rows, cover = the columns, pattern = the cells of the rows
 * that can hold 7, targets = the cells of the columns that lose 7.
 */
export interface Finding {
  readonly technique: Technique;
  readonly value: Value;
  /** where the pattern is (where to look): e.g. the rows of an X-Wing */
  readonly groups: readonly ConstraintGroup[];
  /** the groups that lose the value outside the pattern: e.g. the columns of an X-Wing */
  readonly cover: readonly ConstraintGroup[];
  /** the open cells of `groups` that can hold the value */
  readonly pattern: readonly Cell[];
  /** the cells that lose the value */
  readonly targets: readonly Cell[];
  /** the finding in words */
  readonly reason: string;
}

export type TechniqueClass<T extends Technique = Technique> = (new (puzzle: Puzzle) => T) & {
  difficulty: number;
};

/**
 * A solving technique that combines several constraint groups, e.g. an X-Wing, which a single
 * Constraint cannot see on its own. The solver applies techniques only when the constraints
 * no longer change anything, the easiest technique first, one finding at a time.
 *
 * A technique only removes candidates; the constraints then take it from there. Like a
 * constraint, a technique is the cause of the changes it makes (see Puzzle.causedBy), and
 * explains them with explain(deduction).
 */
export abstract class Technique {
  /** How hard the technique is for a person (see Deduction.difficulty). */
  static difficulty = 6;

  /** the finding that removed a candidate: cell -> value -> finding */
  private readonly findings = new Map<Cell, Map<Value, Finding>>();

  constructor(readonly puzzle: Puzzle) {}

  getDifficulty(): number {
    return (this.constructor as TechniqueClass).difficulty;
  }

  /** How hard this deduction is for a person (the technique's difficulty). */
  difficultyOf(_deduction: Deduction): number {
    return this.getDifficulty();
  }

  /** The name of the technique, e.g. "X-Wing". */
  abstract getType(): string;

  /**
   * The first application of the technique in the current state that removes a candidate, in
   * a fixed order; null when there is none. Does not change the puzzle.
   */
  abstract find(): Finding | null;

  /**
   * Look for one application of the technique (find()) and remove its candidates. Returns
   * whether anything changed. Throws ContradictionError when a cell loses its last candidate.
   */
  apply(): boolean {
    const finding = this.find();
    if (finding === null) return false;
    this.applyFinding(finding);
    return true;
  }

  /**
   * Remove the value of a finding from its targets (those that still hold it), remembering the
   * finding for explain() and findingFor().
   */
  applyFinding(finding: Finding): void {
    for (const cell of finding.targets) {
      if (!cell.values.has(finding.value)) continue;
      let findings = this.findings.get(cell);
      if (findings === undefined) {
        findings = new Map();
        this.findings.set(cell, findings);
      }
      findings.set(finding.value, finding);
      cell.remove(finding.value);
    }
  }

  /** The finding that made a Deduction of this technique (a removal), if any. */
  findingFor(deduction: Deduction): Finding | null {
    const found = new Set<Finding | undefined>();
    for (const value of deduction.removed) found.add(this.findings.get(deduction.cell)?.get(value));
    const [finding] = found;
    return found.size === 1 && finding !== undefined ? finding : null;
  }

  /** Why this technique removed the candidates of a Deduction, in words. */
  explain(deduction: Deduction): string {
    return this.findingFor(deduction)?.reason ?? this.getType();
  }

  /** Whether the finding still removes something in the current state. */
  stillApplies(finding: Finding): boolean {
    if (!finding.pattern.every((c) => !c.hasValue() && c.values.has(finding.value))) return false;
    if (
      finding.groups.some((g) =>
        (spotsFor(g, finding.value) ?? []).some((c) => !finding.pattern.includes(c)),
      )
    ) {
      return false;
    }
    return finding.targets.some((c) => !c.hasValue() && c.values.has(finding.value));
  }

  /** The groups in which every value appears exactly once (e.g. Sudoku rows, columns, blocks). */
  protected exactCoverGroups(): ConstraintGroup[] {
    return this.puzzle
      .getConstraintGroups()
      .filter((g) => g.getConstraints().some((c) => c instanceof ExactCoverConstraint));
  }

  /** The values to look at, in a fixed order. */
  protected values(): Value[] {
    return sortedValues(this.puzzle.getValues());
  }
}

/** The open cells of a group that can still hold `value`; null when the value is placed. */
export function spotsFor(group: ConstraintGroup, value: Value): Cell[] | null {
  const spots: Cell[] = [];
  for (const cell of group.getCells()) {
    if (cell.getValue() === value) return null;
    if (!cell.hasValue() && cell.values.has(value)) spots.push(cell);
  }
  return spots;
}

export function cellNames(cells: Iterable<Cell>): string {
  return [...cells].map((c) => c.getName()).join('; ');
}

/** "A and B", "A, B and C". */
export function listNames(names: readonly string[]): string {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names.at(-1) ?? ''}`;
}
