"""
Created on 30 dec. 2012

@author: Juice
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from PySide6 import QtCore, QtWidgets

from gui.puzzlerepresentation.cellpiece import CellPiece, PointLike

if TYPE_CHECKING:
    from structure.cell import Cell


class ValueRectangle(CellPiece, QtWidgets.QGraphicsRectItem):
    """A square cell (Sudoku, Kakuro, Futoshiki); position is its top-left corner in the scene."""

    def __init__(
        self,
        cell: Cell,
        cellSize: float,
        position: PointLike,
        parent: QtWidgets.QGraphicsItem | None = None,
    ) -> None:
        QtWidgets.QGraphicsRectItem.__init__(
            self, position.x(), position.y(), cellSize, cellSize, parent
        )
        self.initCellPiece(cell, cellSize, position)

    def hintArea(self) -> QtCore.QRectF:
        return QtCore.QRectF(self.position.x(), self.position.y(), self.cellSize, self.cellSize)

    def placeValueText(self) -> None:
        self.valueTextItem.setPos(self.position.x(), self.position.y() + self.cellSize / 6)
