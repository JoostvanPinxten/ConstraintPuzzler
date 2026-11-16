"""
Created on 30 dec. 2012

@author: Juice
"""

from PySide6 import QtCore, QtWidgets

from gui.puzzlerepresentation.cellpiece import CellPiece


class ValueRectangle(CellPiece, QtWidgets.QGraphicsRectItem):
    """A square cell (Sudoku, Kakuro, Futoshiki); position is its top-left corner in the scene."""

    def __init__(self, cell, cellSize, position, parent=None):
        QtWidgets.QGraphicsRectItem.__init__(
            self, position.x(), position.y(), cellSize, cellSize, parent
        )
        self.initCellPiece(cell, cellSize, position)

    def hintArea(self):
        return QtCore.QRectF(self.position.x(), self.position.y(), self.cellSize, self.cellSize)

    def placeValueText(self):
        self.valueTextItem.setPos(self.position.x(), self.position.y() + self.cellSize / 6)
