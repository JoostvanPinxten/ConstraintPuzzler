import type { Cell } from '../structure/cell';
import type { Deduction } from '../structure/deduction';
import { ContradictionError } from '../structure/errors';
import { formatValues, sortedValues, type Value, type ValueOf } from '../structure/types';
import { Constraint, placedValues } from './constraint';
import { UniqueValueConstraint } from './uniquevalueconstraint';

/** The values of the group's cells add up to a total (e.g. a Kakuro line). */
export class TotalSumValueConstraint extends Constraint {
  static override difficulty = 4; // needs the combinations that make up the sum

  totalValue: number | null = null;

  notify(_cell: Cell): void {}

  applyConstraint(): void {
    if (this.totalValue === null) {
      throw new Error('Total value of sum constraint has not been initialized!');
    }
    const filledCells: Cell[] = [];
    const valuesUsed: Value[] = [];
    let total = this.totalValue;
    for (const c of this.group.cells) {
      const value = c.getValue();
      if (value !== null) {
        filledCells.push(c);
        total -= value;
        valuesUsed.push(value);
      }
    }
    const openCount = this.group.cells.length - filledCells.length;
    if (openCount === 0) {
      if (total !== 0) {
        throw new ContradictionError(
          `All cells are filled, but they do not add up to ${this.totalValue}`,
        );
      }
      return;
    }

    const allowed = this.applyConstraintRecursively(total, openCount, valuesUsed);
    // iterate over a copy: values are removed from this.values inside the loop
    for (const value of [...this.values]) {
      if (!allowed.has(value)) {
        this.values.splice(this.values.indexOf(value), 1);
        this.group.removeValueExceptForList(filledCells, value);
      }
    }
  }

  /** The values that can still be part of a combination of `cellCount` values adding up to `sum`. */
  applyConstraintRecursively(
    leftOverSum: number,
    leftOverCellCount: number,
    valuesUsed: readonly Value[] = [],
  ): Set<Value> {
    // if there is no leftover sum, but we arrived here anyway, then nothing fits
    if (leftOverCellCount === 0 || leftOverSum <= 0) return new Set();

    const allowed = new Set<Value>();
    for (const value of this.group.valuesAllowedByGroup(valuesUsed)) {
      if (leftOverSum === value && leftOverCellCount === 1) return new Set([value]);
      const stillAllowed = this.applyConstraintRecursively(
        leftOverSum - value,
        leftOverCellCount - 1,
        [...valuesUsed, value],
      );
      for (const v of stillAllowed) allowed.add(v);
    }
    return allowed;
  }

  override getType(): string {
    return 'Total Sum Value Constraint';
  }

  override summary(): string {
    return `sum = ${this.totalValue}`;
  }

  override explain(deduction: Deduction): string {
    const group = this.group.getName();
    if (deduction.setsValue()) return `${group} must add up to ${this.totalValue}`;
    const removed = formatValues(deduction.removed);
    return `${group} must add up to ${this.totalValue}, and no combination with ${removed} does`;
  }

  /**
   * All filled cells, when they already add up to more than the total, or when the group is
   * complete and does not add up to the total.
   */
  override violations(valueOf: ValueOf): Set<Cell> {
    if (this.totalValue === null) return new Set();
    const cells = this.group.getCells();
    const filled: Cell[] = [];
    let total = 0;
    for (const c of cells) {
      const value = valueOf(c);
      if (value !== null) {
        filled.push(c);
        total += value;
      }
    }
    if (total > this.totalValue || (filled.length === cells.length && total !== this.totalValue)) {
      return new Set(filled);
    }
    return new Set();
  }

  override describe(showHints = true): string {
    if (this.totalValue === null) return 'The total of this sum has not been set.';
    const cells = this.group.getCells();
    const placed = placedValues(cells);
    const openCount = cells.length - placed.length;
    let text = `The values add up to ${this.totalValue}`;
    if (openCount === 0) return `${text}; complete (${placed.join(' + ')}).`;
    const placedSum = placed.reduce((a, b) => a + b, 0);
    const left = this.totalValue - placedSum;
    const cellWord = openCount === 1 ? 'cell' : 'cells';
    if (placed.length > 0) {
      text += `; ${placedSum} is placed, so ${left} is left for ${openCount} open ${cellWord}`;
    } else {
      text += ` over ${openCount} open ${cellWord}`;
    }
    if (!showHints) return `${text}.`;
    // the values that can still complete the sum (without changing any state)
    const possible = this.applyConstraintRecursively(left, openCount, placed);
    const candidates = this.values.filter((v) => possible.has(v));
    return `${text}; candidates: ${formatValues(candidates)}.`;
  }

  setTotalValue(value: number): void {
    const values = sortedValues(this.initialValues);
    const cellCount = this.group.cells.length;
    // simple check to see if the total sum constraint is definitely infeasible
    const hasUniqueValueConstraint = this.group.constraints.some(
      (c) => c instanceof UniqueValueConstraint,
    );
    const minimum = hasUniqueValueConstraint
      ? values.slice(0, cellCount).reduce((a, b) => a + b, 0) // the N smallest values
      : (values[0] ?? 0) * cellCount;
    if (value < minimum) {
      throw new Error(`Infeasible sum value ${value},  minimum is ${minimum}`);
    }
    this.totalValue = value;
  }

  getTotalValue(): number | null {
    return this.totalValue;
  }

  override toString(): string {
    return `tsvc[${this.values.join(',')}]`;
  }
}
