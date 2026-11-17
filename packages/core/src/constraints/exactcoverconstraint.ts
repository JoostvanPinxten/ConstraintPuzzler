import type { Cell } from '../structure/cell';
import type { Deduction } from '../structure/deduction';
import { ContradictionError } from '../structure/errors';
import { formatValues, sortedValues, type Value } from '../structure/types';
import { combinations, placedValues } from './constraint';
import { UniqueValueConstraint } from './uniquevalueconstraint';

/** Every value of the group appears exactly once (e.g. a Sudoku row). */
export class ExactCoverConstraint extends UniqueValueConstraint {
  override applyConstraint(): void {
    const values = new Set<Value>();
    for (const c of this.group.getCells()) for (const v of c.values) values.add(v);
    const newValues = this.checkForSinglePosition(sortedValues(values));
    for (const [cell, value] of newValues) cell.inferValue(value);

    this.searchForNakedSubsets();
    this.searchForHiddenSubsets();
  }

  /**
   * If k missing values can only go in the same k open cells, those cells hold exactly those
   * values, so their other candidates go (a hidden pair, triple, ...).
   *
   * Subsets up to half the open cells suffice: a larger hidden subset is the complement of a
   * smaller naked one, which searchForNakedSubsets finds.
   */
  searchForHiddenSubsets(): void {
    let found = true;
    while (found) {
      found = false;
      const openCells = this.openCells();
      const placed = new Set(placedValues(this.group.getCells()));
      const missing = sortedValues(this.group.getValues().filter((v) => !placed.has(v)));
      const cellsFor = new Map<Value, Set<Cell>>(
        missing.map((v) => [v, new Set(openCells.filter((c) => c.values.has(v)))]),
      );
      const cellsOf = (v: Value): Set<Cell> => cellsFor.get(v) as Set<Cell>;
      for (let size = 2; size <= Math.floor(openCells.length / 2) && !found; size++) {
        const candidates = missing.filter((v) => cellsOf(v).size <= size);
        for (const subset of combinations(candidates, size)) {
          const cells = new Set<Cell>();
          for (const v of subset) for (const c of cellsOf(v)) cells.add(c);
          if (cells.size < size) {
            throw new ContradictionError(
              `${this.group.getName()}: ${formatValues(subset)} fit in only ${cells.size} cells`,
            );
          }
          if (cells.size > size) continue;
          const values = new Set(subset);
          const inOrder = openCells.filter((c) => cells.has(c));
          if (inOrder.every((c) => [...c.values].every((v) => values.has(v)))) continue;
          const others = new Set<Value>();
          for (const c of inOrder) for (const v of c.values) if (!values.has(v)) others.add(v);
          const names = inOrder.map((c) => c.getName()).join('; ');
          const reason =
            `${this.group.getName()}: ${formatValues(values)} can only go in ${names}, so` +
            ` those cells cannot hold anything else (${this.summary()})`;
          this.removeWithReason(inOrder, others, reason);
          found = true;
          break;
        }
      }
    }
  }

  override getType(): string {
    return 'Exact cover constraint';
  }

  override summary(): string {
    return 'each value once';
  }

  override explain(deduction: Deduction): string {
    return this.subsetReason(deduction) ?? super.explain(deduction);
  }

  override describe(_showHints = true): string {
    const placed = new Set(placedValues(this.group.getCells()));
    const missing = this.group.getValues().filter((v) => !placed.has(v));
    if (missing.length === 0) return 'Every value appears exactly once; complete.';
    return `Every value appears exactly once; still missing: ${formatValues(missing)}.`;
  }

  override toString(): string {
    return `ecc[${this.values.join(',')}]`;
  }
}
