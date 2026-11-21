import type { Cell } from '../structure/cell';
import type { TechniqueId } from '../guide/techniques';
import type { Deduction } from '../structure/deduction';
import { msg, valueList, type Message } from '../i18n/message';
import { ContradictionError } from '../structure/errors';
import { sortedValues, type Value, type ValueOf } from '../structure/types';
import { combinations, Constraint, placedValues } from './constraint';

/** The values of the group's cells all differ. */
export class UniqueValueConstraint extends Constraint {
  static override difficulty = 2; // a value that fits only one cell of the group

  /** why a candidate was removed by a subset deduction: cell -> value -> reason */
  removalReasons = new Map<Cell, Map<Value, Message>>();

  override reset(): void {
    super.reset();
    this.removalReasons = new Map();
  }

  openCells(): Cell[] {
    return this.group.getCells().filter((c) => !c.hasValue());
  }

  /** Remove values from cells, remembering the reason for explain(). */
  removeWithReason(cells: Iterable<Cell>, values: Iterable<Value>, reason: Message): void {
    const toRemove = new Set(values);
    for (const cell of cells) {
      for (const value of sortedValues(cell.getPossibleValues())) {
        if (!toRemove.has(value)) continue;
        let reasons = this.removalReasons.get(cell);
        if (reasons === undefined) {
          reasons = new Map();
          this.removalReasons.set(cell, reasons);
        }
        reasons.set(value, reason);
        cell.remove(value);
      }
    }
  }

  /** The reason a subset deduction gave for this removal, if it made it. */
  subsetReason(deduction: Deduction): Message | null {
    const reasons = new Set<Message | undefined>();
    for (const value of deduction.removed) {
      reasons.add(this.removalReasons.get(deduction.cell)?.get(value));
    }
    if (reasons.size !== 1) return null;
    const [reason] = reasons;
    return reason ?? null;
  }

  /**
   * If k open cells together have only k candidates, those values go in those cells, so no
   * other cell of the group can hold them (a naked pair, triple, ...).
   */
  searchForNakedSubsets(): void {
    let found = true;
    while (found) {
      found = false;
      const openCells = this.openCells();
      for (let size = 2; size < openCells.length && !found; size++) {
        const small = openCells.filter((c) => c.getPossibleValues().size <= size);
        for (const subset of combinations(small, size)) {
          const values = new Set<Value>();
          for (const c of subset) for (const v of c.values) values.add(v);
          if (values.size < size) {
            throw new ContradictionError(
              msg('unique.tooFew', {
                group: this.group.nameMessage(),
                size,
                count: values.size,
                values: valueList(values),
              }),
            );
          }
          if (values.size > size) continue;
          const others = openCells.filter((c) => !subset.includes(c));
          if (!others.some((c) => [...values].some((v) => c.values.has(v)))) continue;
          const names = subset.map((c) => c.getName()).join('; ');
          const reason = msg('unique.nakedSubset', {
            group: this.group.nameMessage(),
            cells: names,
            values: valueList(values),
            rule: this.summaryMessage(),
          });
          this.withTechnique('nakedSubset', () => this.removeWithReason(others, values, reason));
          found = true;
          break;
        }
      }
    }
  }

  /** Notifies the constraint that a value has been set for the given cell. */
  notify(cell: Cell): void {
    const value = cell.getValue();
    if (value === null) return;
    const index = this.values.indexOf(value);
    if (index < 0) return;
    this.values.splice(index, 1);
    // the placement, not an earlier subset deduction, is why the others lose it now
    for (const other of this.group.getCells()) {
      if (other.values.has(value)) this.removalReasons.get(other)?.delete(value);
    }
    this.group.removeValue(cell, value);
  }

  applyConstraint(): void {
    this.searchForNakedSubsets();
  }

  /** A placed value removed from the group, or a value that is the only one left. */
  override techniqueId(deduction: Deduction): TechniqueId {
    return deduction.setsValue() ? 'nakedSingle' : 'elimination';
  }

  override getType(): string {
    return 'Unique Value Constraint';
  }

  override summaryMessage(): Message {
    return msg('unique.summary');
  }

  override explainMessage(deduction: Deduction): Message {
    const reason = this.subsetReason(deduction);
    if (reason !== null) return reason;
    const group = this.group.nameMessage();
    if (deduction.setsValue()) {
      return msg('unique.needs', { group, value: deduction.value as Value });
    }
    return msg('unique.alreadyHas', {
      group,
      values: valueList(deduction.removed),
      rule: this.summaryMessage(),
    });
  }

  /** The cells that share their value with another cell of the group. */
  override violations(valueOf: ValueOf): Set<Cell> {
    const cellsByValue = new Map<Value, Cell[]>();
    for (const cell of this.group.getCells()) {
      const value = valueOf(cell);
      if (value === null) continue;
      const cells = cellsByValue.get(value) ?? [];
      cells.push(cell);
      cellsByValue.set(value, cells);
    }
    const result = new Set<Cell>();
    for (const cells of cellsByValue.values()) {
      if (cells.length > 1) for (const c of cells) result.add(c);
    }
    return result;
  }

  override describeMessage(_showHints = true): Message {
    const placed = placedValues(this.group.getCells());
    if (placed.length === 0) return msg('unique.describeEmpty');
    return msg('unique.describe', { values: valueList(placed) });
  }

  override getAllowedValuesForValueList(
    allowedValues: Iterable<Value>,
    usedValues: Iterable<Value>,
  ): Iterable<Value> {
    const used = new Set(usedValues);
    return [...new Set(allowedValues)].filter((v) => !used.has(v));
  }

  /** The values that fit in only one open cell of the group: cell -> value. */
  checkForSinglePosition(values: Iterable<Value>): Map<Cell, Value> {
    const result = new Map<Cell, Value>();
    for (const value of values) {
      let continueSearching = true;
      let firstCell: Cell | null = null;
      for (const c of this.group.getCells()) {
        if (c.getValue() === value) {
          continueSearching = false;
          break;
        }
        if (c.hasValue()) continue;
        if (c.values.has(value)) {
          if (firstCell === null) {
            firstCell = c;
          } else {
            continueSearching = false;
            break;
          }
        }
      }
      if (continueSearching && firstCell !== null) result.set(firstCell, value);
    }
    return result;
  }

  override toString(): string {
    return `UVC[${this.values.join(',')}]`;
  }
}
