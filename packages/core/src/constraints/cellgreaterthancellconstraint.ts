import type { TechniqueId } from '../guide/techniques';
import type { Cell } from '../structure/cell';
import type { Deduction } from '../structure/deduction';
import { formatValues, sortedValues, type ValueOf } from '../structure/types';
import { Constraint } from './constraint';

/** Enforces lesserCell < greaterCell. */
export class CellGreaterThanCellConstraint extends Constraint {
  static override difficulty = 3;

  lesserCell: Cell | null = null;
  greaterCell: Cell | null = null;

  notify(_cell: Cell): void {}

  setLesserCell(cell: Cell): void {
    this.lesserCell = cell;
  }

  setGreaterCell(cell: Cell): void {
    this.greaterCell = cell;
  }

  applyConstraint(): void {
    const lesser = this.lesserCell;
    const greater = this.greaterCell;
    if (lesser === null || greater === null) return; // not set up yet

    // the lesser cell must be smaller than the largest option of the greater cell
    const maximumOfGreater = Math.max(...greater.values);
    for (const value of sortedValues(lesser.values)) {
      if (value >= maximumOfGreater) lesser.remove(value);
    }
    // the greater cell must be larger than the smallest option of the lesser cell
    const minimumOfLesser = Math.min(...lesser.values);
    for (const value of sortedValues(greater.values)) {
      if (value <= minimumOfLesser) greater.remove(value);
    }
  }

  override techniqueId(_deduction: Deduction): TechniqueId {
    return 'inequality';
  }

  override getType(): string {
    return 'Cell Greater Than Cell Constraint';
  }

  /** Both cells, when the smaller cell does not have the smaller value. */
  override violations(valueOf: ValueOf): Set<Cell> {
    if (this.lesserCell === null || this.greaterCell === null) return new Set();
    const lesser = valueOf(this.lesserCell);
    const greater = valueOf(this.greaterCell);
    if (lesser !== null && greater !== null && lesser >= greater) {
      return new Set([this.lesserCell, this.greaterCell]);
    }
    return new Set();
  }

  override summary(): string {
    if (this.lesserCell === null || this.greaterCell === null) {
      return 'smaller than (cells not set)';
    }
    return `(${this.lesserCell.getName()}) < (${this.greaterCell.getName()})`;
  }

  override describe(showHints = true): string {
    const lesser = this.lesserCell;
    const greater = this.greaterCell;
    if (lesser === null || greater === null) {
      return 'The cells of this constraint have not been set.';
    }
    const text = `Cell (${lesser.getName()}) is smaller than cell (${greater.getName()})`;
    if (lesser.hasValue() && greater.hasValue()) {
      return `${text}; satisfied: ${lesser.getValue()} < ${greater.getValue()}.`;
    }
    if (!showHints) return `${text}.`;
    return `${text}; candidates ${formatValues(lesser.values)} < ${formatValues(greater.values)}.`;
  }
}
