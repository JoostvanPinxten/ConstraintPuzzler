import { formatMessage, plainText, type Message } from '../i18n/message';
import { PositionedCell, type Cell } from '../structure/cell';
import type { Puzzle } from '../structure/puzzle';
import type { Value } from '../structure/types';
import type { Constraint } from './constraint';

/** A set of cells together with the constraints that apply to them. */
export class ConstraintGroup {
  readonly constraints: Constraint[] = [];
  readonly cells: Cell[] = [];

  /** the name in English, e.g. "Row 3" */
  readonly name: string;
  /** the name as a message, for the player's language */
  readonly label: Message;

  /** `name`: a message (e.g. msg('group.row', { index: 3 })), or a text not to translate */
  constructor(
    readonly puzzle: Puzzle,
    name: string | Message = 'Untitled',
  ) {
    this.label = typeof name === 'string' ? plainText(name) : name;
    this.name = typeof name === 'string' ? name : formatMessage(name);
  }

  /** All values a cell of the puzzle can take. */
  getValues(): Value[] {
    return this.puzzle.getValues();
  }

  addConstraint<C extends Constraint>(
    constraintType: new (group: ConstraintGroup, initialValues: Iterable<Value>) => C,
  ): C {
    const constraint = new constraintType(this, this.getValues());
    this.constraints.push(constraint);
    return constraint;
  }

  /** Add a cell to the group; the cell also learns that it belongs to this group. */
  addCell(cell: Cell): void {
    this.cells.push(cell);
    cell.constraintGroups.push(this);
    cell.valueChanged.connect((changed) => this.notify(changed));
  }

  notify(cell: Cell): void {
    for (const constraint of this.constraints) {
      this.puzzle.causedBy(constraint, () => constraint.notify(cell));
    }
  }

  removeValue(cell: Cell, value: Value): void {
    this.removeValueExceptForList([cell], value);
  }

  removeValueExceptForList(cells: readonly Cell[], value: Value): void {
    // Cell.remove throws a ContradictionError when the value is already set in that cell
    for (const c of this.cells) {
      if (!cells.includes(c)) c.remove(value);
    }
  }

  applyConstraints(): void {
    for (const constraint of this.constraints) {
      this.puzzle.causedBy(constraint, () => constraint.applyConstraint());
    }
  }

  getName(): string {
    return this.name;
  }

  /** The name as a message, e.g. "Row 3" in the player's language. */
  nameMessage(): Message {
    return this.label;
  }

  getType(): string {
    return 'Abstract Constraint';
  }

  getCells(): Cell[] {
    return this.cells;
  }

  /** The cells of the group that have a position (in the puzzle types here, all). */
  getPositionedCells(): PositionedCell[] {
    return this.cells.filter((c): c is PositionedCell => c instanceof PositionedCell);
  }

  getConstraints(): Constraint[] {
    return this.constraints;
  }

  valuesAllowedByGroup(usedValues: Iterable<Value>): Value[] {
    const used = [...usedValues];
    let allowed: Iterable<Value> = this.getValues();
    for (const constraint of this.constraints) {
      allowed = constraint.getAllowedValuesForValueList(allowed, used);
    }
    return [...allowed];
  }
}
