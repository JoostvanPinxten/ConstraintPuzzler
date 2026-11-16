class Position:
    """Immutable (x, y) location of a cell in a puzzle.

    Offers the x()/y() accessors of QPoint, so the GUI can use it directly,
    without the puzzle model depending on Qt."""

    __slots__ = ("_x", "_y")

    def __init__(self, x: int, y: int) -> None:
        self._x = x
        self._y = y

    def x(self) -> int:
        return self._x

    def y(self) -> int:
        return self._y

    def __mul__(self, factor: int) -> "Position":
        return Position(self._x * factor, self._y * factor)

    __rmul__ = __mul__

    def __eq__(self, other: object) -> bool:
        if not isinstance(other, Position):
            return NotImplemented
        return (self._x, self._y) == (other._x, other._y)

    def __hash__(self) -> int:
        return hash((self._x, self._y))

    def __repr__(self) -> str:
        return f"Position({self._x!r}, {self._y!r})"
