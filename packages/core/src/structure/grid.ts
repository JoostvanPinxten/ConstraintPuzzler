import { Cell, PositionedCell } from './cell';
import type { Position } from './position';
import type { Puzzle } from './puzzle';
import type { Value } from './types';

export class Grid {
  readonly values: Value[];
  readonly cells: Cell[] = [];

  constructor(
    values: Iterable<Value>,
    readonly parent: Puzzle,
  ) {
    this.values = [...values];
  }

  addCell(position: Position): PositionedCell;
  addCell(position?: null): Cell;
  addCell(position: Position | null = null): Cell {
    const cell =
      position !== null
        ? new PositionedCell(this.values, this, position)
        : new Cell(this.values, this);
    this.cells.push(cell);
    return cell;
  }

  getCells(): Cell[] {
    return this.cells;
  }

  /** The cells that have a position (in the puzzle types here, every cell). */
  getPositionedCells(): PositionedCell[] {
    return this.cells.filter((c): c is PositionedCell => c instanceof PositionedCell);
  }

  toString(): string {
    return `cells(${this.cells.length}) : [\n   ${this.cells.map(String).join(',\n   ')}\n]`;
  }

  /** The cell at (x, y), assuming all cells are laid out in a square grid. */
  getCellFromSquareGrid(x: number, y: number): Cell {
    const index = x + Math.ceil(Math.sqrt(this.cells.length) * y);
    const cell = this.cells[index];
    if (cell === undefined) throw new RangeError(`no cell at (${x}, ${y})`);
    return cell;
  }

  searchCellWithPosition(pos: Position): PositionedCell {
    const cell = this.getPositionedCells().find((c) => c.position.equals(pos));
    if (cell === undefined) throw new Error(`Not found${pos.toString()}`);
    return cell;
  }

  setConstraintGridValue(x: number, y: number, value: Value): void {
    this.getCellFromSquareGrid(x, y).setValue(value);
  }

  getPuzzle(): Puzzle {
    return this.parent;
  }
}
