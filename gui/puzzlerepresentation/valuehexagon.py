"""
Created on 30 dec. 2012

@author: Juice
"""

from math import cos, floor, pi, sin, sqrt

from PySide6 import QtCore, QtGui, QtWidgets

from constraints import Constraint
from structure.cell import Cell


def centerTextItem(text):
    form = QtGui.QTextBlockFormat()
    form.setAlignment(QtCore.Qt.AlignCenter)
    cursor = text.textCursor()
    cursor.select(QtGui.QTextCursor.Document)
    cursor.mergeBlockFormat(form)
    cursor.clearSelection()


class ValueHexagon(QtWidgets.QGraphicsPolygonItem):
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
        super().__init__(polygon, parent)
        self.cell = cell
        self.position = position
        self.cellSize = cellSize
        if isinstance(cell, Cell):
            self.values = cell.getGrid().getPuzzle().getValues()
        else:
            self.values = []
        self.setCacheMode(QtWidgets.QGraphicsItem.CacheMode.DeviceCoordinateCache)
        self.hintValueItemMap = {}

        self.edgeColor = edgeColor

        pen = QtGui.QPen()
        pen.setColor(edgeColor)
        pen.setWidth(2)
        self.setPen(pen)

        self.hintsEnabled = True

        self.instantiateRepresentation()
        self.updateRepresentation()

    def mousePressEvent(self, event):
        return QtWidgets.QGraphicsRectItem.mousePressEvent(self, event)

    def instantiateRepresentation(self):
        # for each value, instantiate the hints, hidden by default
        for val in self.values:
            # this is the static calculation for a block of 3z3
            off_x = (((val - 1) % 3) + 0.7) * (self.cellSize / 4)
            off_y = (floor((val - 1) / 3) + 0.25) * (self.cellSize / 4)
            t = QtWidgets.QGraphicsTextItem(str(val))
            t.setParentItem(self)
            t.setPos(self.position.x() + off_x, self.position.y() + off_y)
            t.setOpacity(0)
            self.hintValueItemMap[val] = t

        # add a big text item to show the set value, hidden by default
        val = self.cell.getValue() if isinstance(self.cell, Cell) else self.cell.getTotalValue()
        self.valueTextItem = QtWidgets.QGraphicsTextItem("")
        self.valueTextItem.setParentItem(self)
        self.valueTextItem.setPos(self.position.x(), self.position.y() + self.cellSize / 6)
        f = QtGui.QFont("Sans serif", self.cellSize / 3, 200)
        if isinstance(self.cell, Cell):
            if self.cell.isInferred():
                f.setWeight(QtGui.QFont.Weight.Thin)
            else:
                self.valueTextItem.setDefaultTextColor(QtGui.QColorConstants.Blue)
        self.valueTextItem.setFont(f)
        self.valueTextItem.setTextWidth(self.cellSize)

        # align to center of cell
        centerTextItem(self.valueTextItem)
        self.valueTextItem.setOpacity(0)

    def updateRepresentation(self):
        val = self.cell.getValue() if isinstance(self.cell, Cell) else self.cell.getTotalValue()
        if val is not None:
            # first hide all the hints
            self.hideHints()

            # show value text
            self.valueTextItem.setOpacity(1)
            self.valueTextItem.setPlainText(str(val))
            # re-align to middle of cell
            centerTextItem(self.valueTextItem)

            f = self.valueTextItem.font()
            if isinstance(self.cell, Constraint) or self.cell.isInferred():
                f.setWeight(QtGui.QFont.Weight.Thin)
                self.valueTextItem.setDefaultTextColor(QtGui.QColorConstants.Black)
            else:
                f.setWeight(QtGui.QFont.Weight.ExtraLight)
                self.valueTextItem.setDefaultTextColor(QtGui.QColorConstants.Blue)

        else:
            self.valueTextItem.setOpacity(0)

            # show all the possible values
            vals = self.cell.getPossibleValues()
            for numValProcessed, val in enumerate(self.values):
                if numValProcessed >= 9:
                    break
                if self.hintsEnabled and val in vals:
                    self.hintValueItemMap[val].setOpacity(1)
                else:
                    self.hintValueItemMap[val].setOpacity(0)
        pass

    def setHintsEnabled(self, hintsEnabled):
        self.hintsEnabled = hintsEnabled
        self.updateRepresentation()

    def hideHints(self):
        for val in self.values:
            self.hintValueItemMap[val].setOpacity(0)
