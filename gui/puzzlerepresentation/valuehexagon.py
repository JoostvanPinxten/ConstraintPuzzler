"""
Created on 30 dec. 2012

@author: Juice
"""

from math import cos, pi, sin, sqrt

from PySide6 import QtCore, QtGui, QtWidgets

from gui.puzzlerepresentation.cellpiece import CellPiece


class ValueHexagon(CellPiece, QtWidgets.QGraphicsPolygonItem):
    """A hexagonal cell (Sumbrero); position is the top-left of its bounding box in the scene."""

    def __init__(
        self, cell, cellSize, position, parent=None, edgeColor=QtGui.QColorConstants.Black
    ):
        # normalized hexagon
        polygon = QtGui.QPolygonF(
            [
                QtCore.QPointF(cos(x * pi / 3) + 1, sin(x * pi / 3) + sqrt(3) / 2) * cellSize / 2
                for x in range(0, 6)
            ]
        )
        polygon.translate(position)
        QtWidgets.QGraphicsPolygonItem.__init__(self, polygon, parent)

        self.edgeColor = edgeColor
        pen = QtGui.QPen()
        pen.setColor(edgeColor)
        pen.setWidth(2)
        self.setPen(pen)

        self.initCellPiece(cell, cellSize, position)

    def hintArea(self):
        # the square in the middle of the hexagon
        quarter = self.cellSize / 4
        return QtCore.QRectF(
            self.position.x() + 0.7 * quarter,
            self.position.y() + 0.25 * quarter,
            3 * quarter,
            3 * quarter,
        )

    def placeValueText(self):
        """Centers the value text vertically in the hexagon (horizontally, it is centered by
        its alignment within a text width of cellSize)."""
        hexagonHeight = self.cellSize * sqrt(3) / 2
        textHeight = self.valueTextItem.boundingRect().height()
        self.valueTextItem.setPos(
            self.position.x(), self.position.y() + (hexagonHeight - textHeight) / 2
        )
