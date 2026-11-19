import { combinations } from '../constraints/constraint';
import type { ConstraintGroup } from '../constraints/constraintgroup';
import type { TechniqueId } from '../guide/techniques';
import type { Cell } from '../structure/cell';
import { listNames, spotsFor, Technique, type Finding, type TechniqueClass } from './technique';

/**
 * A "fish" of size n (X-Wing: 2, Swordfish: 3, Jellyfish: 4): when n parallel lines (e.g.
 * rows) can hold a value only in cells that lie on the same n crossing lines (e.g. columns),
 * each of those crossing lines gets the value in one of these cells, so no other cell of the
 * crossing lines can hold it.
 *
 * Lines are exact cover groups; two lines cross when they share exactly one cell (Sudoku rows
 * and columns, but not rows and blocks). The base lines must not overlap, and every cover line
 * must cross every base line. This works for any puzzle made of such groups, e.g. Futoshiki.
 */
export abstract class Fish extends Technique {
  /** the number of base (and cover) lines */
  static size = 2;

  private linesCache: {
    lines: ConstraintGroup[];
    cells: Map<ConstraintGroup, ReadonlySet<Cell>>;
    crossing: Map<ConstraintGroup, ReadonlySet<ConstraintGroup>>;
  } | null = null;

  getSize(): number {
    return (this.constructor as TechniqueClass & { size: number }).size;
  }

  /** The exact cover groups, with their cells and the groups that cross them. */
  private lines(): NonNullable<Fish['linesCache']> {
    if (this.linesCache !== null) return this.linesCache;
    const lines = this.exactCoverGroups();
    const cells = new Map(lines.map((g) => [g, new Set(g.getCells())] as const));
    const crossing = new Map<ConstraintGroup, Set<ConstraintGroup>>();
    for (const a of lines) {
      const own = cells.get(a) as Set<Cell>;
      crossing.set(
        a,
        new Set(
          lines.filter((b) => b !== a && b.getCells().filter((c) => own.has(c)).length === 1),
        ),
      );
    }
    this.linesCache = { lines, cells, crossing };
    return this.linesCache;
  }

  find(): Finding | null {
    const n = this.getSize();
    const { lines, cells, crossing } = this.lines();
    for (const value of this.values()) {
      // the lines that still need the value, in at most n cells
      const spotsOf = new Map<ConstraintGroup, Cell[]>();
      for (const line of lines) {
        const spots = spotsFor(line, value);
        if (spots !== null && spots.length > 0 && spots.length <= n) spotsOf.set(line, spots);
      }
      for (const base of combinations([...spotsOf.keys()], n)) {
        // the lines that cross every base line
        let common: ConstraintGroup[] = [...(crossing.get(base[0] as ConstraintGroup) ?? [])];
        for (const b of base.slice(1)) {
          const crosses = crossing.get(b);
          common = common.filter((g) => crosses?.has(g) === true);
        }
        if (common.length < n || !pairwiseDisjoint(base, cells)) continue;
        const spots = new Set(base.flatMap((b) => spotsOf.get(b) as Cell[]));
        const cover = common.filter((g) => g.getCells().some((c) => spots.has(c)));
        if (cover.length !== n) continue;
        if (![...spots].every((c) => cover.some((g) => cells.get(g)?.has(c) === true))) continue;
        const targets: Cell[] = [];
        for (const g of cover) {
          for (const c of g.getCells()) {
            if (!spots.has(c) && !c.hasValue() && c.values.has(value) && !targets.includes(c)) {
              targets.push(c);
            }
          }
        }
        if (targets.length === 0) continue;
        const baseNames = listNames(base.map((g) => g.getName()));
        const coverNames = listNames(cover.map((g) => g.getName()));
        const reason =
          `${this.getType()} on ${value}: ${baseNames} can only hold ${value} in cells of` +
          ` ${coverNames}; each of those gets its ${value} there, so no other cell of` +
          ` ${coverNames} can hold ${value}`;
        const pattern = base.flatMap((b) => spotsOf.get(b) as Cell[]);
        return { technique: this, value, groups: base, cover, pattern, targets, reason };
      }
    }
    return null;
  }
}

function pairwiseDisjoint(
  groups: readonly ConstraintGroup[],
  cells: ReadonlyMap<ConstraintGroup, ReadonlySet<Cell>>,
): boolean {
  const seen = new Set<Cell>();
  for (const g of groups) {
    for (const c of cells.get(g) ?? []) {
      if (seen.has(c)) return false;
      seen.add(c);
    }
  }
  return true;
}

/** Two lines hold a value only in the same two crossing lines. */
export class XWing extends Fish {
  readonly guideId: TechniqueId = 'xWing';
  static override size = 2;
  static override difficulty = 6;

  override getType(): string {
    return 'X-Wing';
  }
}

/** Three lines hold a value only in the same three crossing lines. */
export class Swordfish extends Fish {
  readonly guideId: TechniqueId = 'swordfish';
  static override size = 3;
  static override difficulty = 7;

  override getType(): string {
    return 'Swordfish';
  }
}

/** Four lines hold a value only in the same four crossing lines. */
export class Jellyfish extends Fish {
  readonly guideId: TechniqueId = 'jellyfish';
  static override size = 4;
  static override difficulty = 8;

  override getType(): string {
    return 'Jellyfish';
  }
}
