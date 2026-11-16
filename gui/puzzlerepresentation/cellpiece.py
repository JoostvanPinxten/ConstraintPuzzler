"""What all shapes that show a cell have in common (ValueRectangle, ValueHexagon).

A cell piece shows the value of its cell in a large text, or, while the cell is open, its
candidates as small hints in a grid. The grid has ceil(sqrt(n)) columns for n values (3x3 for
1-9, 4x4 for 16 values, ...), placed in the shape's hintArea(). The colour of the value says
where it came from: given (blue), deduced or guessed by the solver (black), typed in by the user
(green), or breaking a rule (red).
"""

from __future__ import annotations

from math import ceil, sqrt
from typing import TYPE_CHECKING, Protocol, cast

from PySide6 import QtCore, QtGui, QtWidgets

if TYPE_CHECKING:
    from structure.cell import Cell
    from structure.types import Value

# colour of a value that is part of the puzzle as it was loaded
GIVEN_VALUE_COLOR = QtGui.QColorConstants.Blue
# colour of a value the solver filled in
SOLVER_VALUE_COLOR = QtGui.QColorConstants.Black
# colour of a value the user typed in
ENTERED_VALUE_COLOR = QtGui.QColor(0, 120, 60)
# colour of a value that breaks a rule of the puzzle (e.g. a number twice in a row)
VIOLATION_COLOR = QtGui.QColor(220, 0, 0)


class PointLike(Protocol):
    """A point with x() and y(): a QPoint, a QPointF or a structure.position.Position."""

    def x(self) -> float: ...

    def y(self) -> float: ...


def centerTextItem(text: QtWidgets.QGraphicsTextItem) -> None:
    """Center the text of a QGraphicsTextItem within its text width."""
    form = QtGui.QTextBlockFormat()
    form.setAlignment(QtCore.Qt.AlignmentFlag.AlignCenter)
    cursor = text.textCursor()
    cursor.select(QtGui.QTextCursor.SelectionType.Document)
    cursor.mergeBlockFormat(form)
    cursor.clearSelection()


def hintGrid(count: int) -> tuple[int, int]:
    """(columns, rows) of the grid that shows `count` candidate values."""
    columns = max(1, ceil(sqrt(count)))
    rows = max(1, ceil(count / columns))
    return columns, rows


class CellPiece:
    """Mixin for a QGraphicsItem that shows a cell. Subclasses call initCellPiece() after the
    item itself is constructed, and implement hintArea() and placeValueText()."""

    # set by initCellPiece
    cell: Cell
    cellSize: float
    # the top-left of the shape in the scene
    position: PointLike

    def item(self) -> QtWidgets.QGraphicsItem:
        """This piece as the QGraphicsItem it is mixed into."""
        return cast(QtWidgets.QGraphicsItem, self)

    def initCellPiece(self, cell: Cell, cellSize: float, position: PointLike) -> None:
        self.cell = cell
        self.cellSize = cellSize
        self.position = position
        self.values = list(cell.getGrid().getPuzzle().getValues())
        self.hintsEnabled = True
        self.hintValueItemMap: dict[Value, QtWidgets.QGraphicsTextItem] = {}
        self.item().setCacheMode(QtWidgets.QGraphicsItem.CacheMode.DeviceCoordinateCache)
        self.createHints()
        self.createValueText()
        self.updateRepresentation()

    # --- geometry, per shape ---------------------------------------------------------------

    def hintArea(self) -> QtCore.QRectF:
        """The area (in item coordinates) in which the candidate hints are laid out."""
        raise NotImplementedError

    def placeValueText(self) -> None:
        """Position the (centered) value text in the shape."""
        raise NotImplementedError

    # --- shared behaviour ------------------------------------------------------------------

    def createHints(self) -> None:
        area = self.hintArea()
        columns, rows = hintGrid(len(self.values))
        for index, value in enumerate(self.values):
            hint = QtWidgets.QGraphicsTextItem(str(value))
            hint.setParentItem(self.item())
            hint.setPos(
                area.left() + (index % columns) * area.width() / columns,
                area.top() + (index // columns) * area.height() / rows,
            )
            hint.setOpacity(0)
            self.hintValueItemMap[value] = hint

    def createValueText(self) -> None:
        self.valueTextItem = QtWidgets.QGraphicsTextItem("")
        self.valueTextItem.setParentItem(self.item())
        self.valueTextItem.setFont(QtGui.QFont("Sans serif", int(self.cellSize / 3), 200))
        self.valueTextItem.setTextWidth(self.cellSize)
        self.valueTextItem.setOpacity(0)

    def showValueText(self, value: Value, color: QtGui.QColor) -> None:
        self.hideHints()
        self.valueTextItem.setPlainText(str(value))
        centerTextItem(self.valueTextItem)
        self.placeValueText()
        self.valueTextItem.setDefaultTextColor(color)
        self.valueTextItem.setOpacity(1)

    def valueColor(self) -> QtGui.QColor:
        if self.cell.isEntered():
            return ENTERED_VALUE_COLOR
        if self.cell.isInferred():
            return SOLVER_VALUE_COLOR
        return GIVEN_VALUE_COLOR

    def updateRepresentation(self) -> None:
        value = self.cell.getValue()
        if value is not None:
            self.showValueText(value, self.valueColor())
            return
        self.valueTextItem.setOpacity(0)
        candidates = self.cell.getPossibleValues()
        for value, hint in self.hintValueItemMap.items():
            hint.setOpacity(1 if self.hintsEnabled and value in candidates else 0)

    def setHintsEnabled(self, hintsEnabled: bool) -> None:
        self.hintsEnabled = hintsEnabled
        self.updateRepresentation()

    def hideHints(self) -> None:
        for hint in self.hintValueItemMap.values():
            hint.setOpacity(0)

    def showMistake(self, value: Value) -> None:
        """Show a value typed in by the user that does not fit (it is not in the model)."""
        self.showValueText(value, VIOLATION_COLOR)

    def markViolation(self) -> None:
        """Draw the value in red: it breaks a rule of the puzzle."""
        self.valueTextItem.setDefaultTextColor(VIOLATION_COLOR)
