from __future__ import annotations

from typing import TYPE_CHECKING

from PySide6 import QtCore, QtGui, QtWidgets

from gui.puzzlerepresentation.cellpiece import centerTextItem

if TYPE_CHECKING:
    from constraints.totalsumvalueconstraint import TotalSumValueConstraint


class ValueTriangle(QtWidgets.QGraphicsPolygonItem):
    """Half of a Kakuro clue cell, cut along a diagonal, showing the sum of one run."""

    TOPLEFT = 0
    TOPRIGHT = 1
    BOTTOMRIGHT = 2
    BOTTOMLEFT = 3

    # per alignment: the triangle's corners and the text position, in units of the cell size
    LAYOUT: dict[int, tuple[tuple[tuple[int, int], ...], tuple[float, float]]] = {
        TOPLEFT: (((0, 0), (1, 0), (0, 1)), (-1 / 6, 0)),
        TOPRIGHT: (((0, 0), (1, 1), (1, 0)), (1 / 6, 0)),
        BOTTOMRIGHT: (((1, 0), (1, 1), (0, 1)), (1 / 6, 1 / 2)),
        BOTTOMLEFT: (((0, 0), (1, 1), (0, 1)), (-1 / 6, 1 / 2)),
    }

    def __init__(
        self,
        constraint: TotalSumValueConstraint,
        cellSize: int,
        position: QtCore.QPoint,
        alignment: int | None = None,
        parent: QtWidgets.QGraphicsItem | None = None,
    ) -> None:
        super().__init__(QtGui.QPolygon(), parent)
        self.setPos(position * cellSize)
        self.constraint = constraint
        self.position = position
        self.cellSize = cellSize

        self.alignment = ValueTriangle.TOPRIGHT if alignment is None else alignment

        self.setCacheMode(QtWidgets.QGraphicsItem.CacheMode.DeviceCoordinateCache)

        self.instantiateRepresentation()
        self.updateRepresentation()
        self.setPen(QtGui.QPen(QtGui.QColorConstants.White))
        self.surrounding = QtWidgets.QGraphicsRectItem(
            QtCore.QRect(0, 0, self.cellSize, self.cellSize), self
        )
        self.surrounding.setBrush(QtGui.QColorConstants.Transparent)
        self.surrounding.setPen(QtGui.QColorConstants.Transparent)

    def instantiateRepresentation(self) -> None:
        # add a big text item to show the set value, hidden by default
        self.valueTextItem = QtWidgets.QGraphicsTextItem(str(self.constraint.getTotalValue()))
        self.valueTextItem.setParentItem(self)
        self.valueTextItem.setPos(0, self.cellSize / 6)
        f = QtGui.QFont("Sans serif", int(self.cellSize / 4), 0)
        self.valueTextItem.setDefaultTextColor(QtGui.QColorConstants.White)
        self.valueTextItem.setFont(f)
        self.valueTextItem.setTextWidth(self.cellSize)
        self.setBrush(QtGui.QColorConstants.Black)
        # align to center of cell
        centerTextItem(self.valueTextItem)
        self.valueTextItem.setOpacity(1)

    def updateRepresentation(self) -> None:
        corners, (textX, textY) = ValueTriangle.LAYOUT[self.alignment]
        size = self.cellSize
        self.setPolygon(QtGui.QPolygon([QtCore.QPoint(x * size, y * size) for x, y in corners]))
        self.valueTextItem.setPos(textX * size, textY * size)
        centerTextItem(self.valueTextItem)
