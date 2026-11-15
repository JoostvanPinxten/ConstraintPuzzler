class Position:
    """Immutable (x, y) location of a cell in a puzzle.

    Offers the x()/y() accessors of QPoint, so the GUI can use it directly,
    without the puzzle model depending on Qt."""

    __slots__ = ("_x", "_y")

    def __init__(self, x, y):
        self._x = x
        self._y = y

    def x(self):
        return self._x

    def y(self):
        return self._y

    def __mul__(self, factor):
        return Position(self._x * factor, self._y * factor)

    __rmul__ = __mul__

    def __eq__(self, other):
        if not isinstance(other, Position):
            return NotImplemented
        return (self._x, self._y) == (other._x, other._y)

    def __hash__(self):
        return hash((self._x, self._y))

    def __repr__(self):
        return f"Position({self._x!r}, {self._y!r})"
