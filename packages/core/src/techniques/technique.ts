import { ExactCoverConstraint } from '../constraints/exactcoverconstraint';
import type { ConstraintGroup } from '../constraints/constraintgroup';
import type { Cell } from '../structure/cell';
import type { Deduction } from '../structure/deduction';
import type { Puzzle } from '../structure/puzzle';
import { sortedValues, type Value } from '../structure/types';

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

  /** why a candidate was removed: cell -> value -> reason */
  private readonly reasons = new Map<Cell, Map<Value, string>>();

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
   * Look for one application of the technique that removes candidates, and remove them.
   * Returns whether anything changed. Throws ContradictionError when a cell loses its last
   * candidate.
   */
  abstract apply(): boolean;

  /** Why this technique removed the candidates of a Deduction, in words. */
  explain(deduction: Deduction): string {
    const reasons = new Set<string | undefined>();
    for (const value of deduction.removed)
      reasons.add(this.reasons.get(deduction.cell)?.get(value));
    const [reason] = reasons;
    return reasons.size === 1 && reason !== undefined ? reason : this.getType();
  }

  /** Remove `value` from `cells`, remembering the reason for explain(). */
  protected removeWithReason(cells: Iterable<Cell>, value: Value, reason: string): void {
    for (const cell of cells) {
      if (!cell.values.has(value)) continue;
      let reasons = this.reasons.get(cell);
      if (reasons === undefined) {
        reasons = new Map();
        this.reasons.set(cell, reasons);
      }
      reasons.set(value, reason);
      cell.remove(value);
    }
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
