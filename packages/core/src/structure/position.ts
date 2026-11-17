/** Immutable (x, y) location of a cell in a puzzle. */
export class Position {
  constructor(
    private readonly _x: number,
    private readonly _y: number,
  ) {}

  x(): number {
    return this._x;
  }

  y(): number {
    return this._y;
  }

  times(factor: number): Position {
    return new Position(this._x * factor, this._y * factor);
  }

  equals(other: Position): boolean {
    return this._x === other._x && this._y === other._y;
  }

  /** A string that identifies the position, for use as a Map/Set key. */
  key(): string {
    return `${this._x},${this._y}`;
  }

  toString(): string {
    return `Position(${this._x}, ${this._y})`;
  }
}
