import type { ConstraintGroup } from '../constraints/constraintgroup';
import type { TechniqueId } from '../guide/techniques';
import type { Cell } from '../structure/cell';
import { cellNames, spotsFor, Technique, type Finding } from './technique';

interface Overlap {
  /** the group whose candidates for a value all lie in the overlap */
  from: ConstraintGroup;
  /** the group that then loses the value outside the overlap */
  to: ConstraintGroup;
  cells: ReadonlySet<Cell>;
}

/**
 * Intersection removal (pointing pairs/triples and box-line reduction): when a value can only
 * go in the cells that a group shares with another group, the value goes in one of those
 * cells, so the other group cannot hold it anywhere else. E.g. if a Sudoku block holds 7 only
 * in its cells of row 3, no other cell of row 3 can be 7 (and the other way around).
 *
 * Applies to every pair of exact cover groups that share two or more cells.
 */
export class IntersectionRemoval extends Technique {
  readonly guideId: TechniqueId = 'intersection';
  static override difficulty = 3;

  private overlapsCache: Overlap[] | null = null;

  override getType(): string {
    return 'Intersection removal';
  }

  /** Every ordered pair of exact cover groups that share at least two cells. */
  private overlaps(): Overlap[] {
    if (this.overlapsCache !== null) return this.overlapsCache;
    const groups = this.exactCoverGroups();
    const result: Overlap[] = [];
    for (const from of groups) {
      const own = new Set(from.getCells());
      for (const to of groups) {
        if (to === from) continue;
        const cells = new Set(to.getCells().filter((c) => own.has(c)));
        if (cells.size >= 2) result.push({ from, to, cells });
      }
    }
    this.overlapsCache = result;
    return result;
  }

  find(): Finding | null {
    for (const value of this.values()) {
      for (const { from, to, cells } of this.overlaps()) {
        const spots = spotsFor(from, value);
        if (spots === null || spots.length === 0 || !spots.every((c) => cells.has(c))) continue;
        const targets = to
          .getCells()
          .filter((c) => !cells.has(c) && !c.hasValue() && c.values.has(value));
        if (targets.length === 0) continue;
        const reason =
          `${from.getName()} can only hold ${value} in ${cellNames(spots)}, which ${to.getName()}` +
          ` shares with it; so ${value} is in one of those cells and in no other cell of` +
          ` ${to.getName()} (${this.getType().toLowerCase()})`;
        return {
          technique: this,
          value,
          groups: [from],
          cover: [to],
          pattern: spots,
          targets,
          reason,
        };
      }
    }
    return null;
  }
}
