"""
Created on 30 dec. 2012

@author: Juice
"""

from math import floor

from PySide6 import QtCore, QtGui, QtWidgets


def centerTextItem(text):
    form = QtGui.QTextBlockFormat()
    form.setAlignment(QtCore.Qt.AlignmentFlag.AlignCenter)
    cursor = text.textCursor()
    cursor.select(QtGui.QTextCursor.SelectionType.Document)
    cursor.mergeBlockFormat(form)
    cursor.clearSelection()


class ValueRectangle(QtWidgets.QGraphicsRectItem):
    def __init__(self, cell, cellSize, position, parent=None):
        super().__init__(position.x(), position.y(), cellSize, cellSize, parent)
        self.cell = cell
        self.position = position
        self.cellSize = cellSize
        self.values = cell.getGrid().getPuzzle().getValues()
        self.setCacheMode(QtWidgets.QGraphicsItem.CacheMode.DeviceCoordinateCache)
        self.hintValueItemMap = {}

        self.hintsEnabled = True

        self.instantiateRepresentation()
        self.updateRepresentation()

    def mousePressEvent(self, event):
        # self.cell.clicked.emit(self.cell)
        # self.cell.setValue(9)

        return QtWidgets.QGraphicsRectItem.mousePressEvent(self, event)

    def instantiateRepresentation(self):
        # for each value, instantiate the hints, hidden by default
        for val in self.values:
            # this is the static calculation for a block of 3z3
            off_x = ((val - 1) % 3) * (self.cellSize / 3)
            off_y = floor((val - 1) / 3) * (self.cellSize / 3)
            t = QtWidgets.QGraphicsTextItem(str(val))
            t.setParentItem(self)
            t.setPos(self.position.x() + off_x, self.position.y() + off_y)
            t.setOpacity(0)
            self.hintValueItemMap[val] = t

        # add a big text item to show the set value, hidden by default
        self.valueTextItem = QtWidgets.QGraphicsTextItem(str(self.cell.getValue()))
        self.valueTextItem.setParentItem(self)
        self.valueTextItem.setPos(self.position.x(), self.position.y() + self.cellSize / 6)
        f = QtGui.QFont("Sans serif", self.cellSize / 3, 200)
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
        if self.cell.getValue() is not None:
            # first hide all the hints
            self.hideHints()

            # show value text
            self.valueTextItem.setOpacity(1)
            self.valueTextItem.setPlainText(str(self.cell.getValue()))
            # re-align to middle of cell
            centerTextItem(self.valueTextItem)

            f = self.valueTextItem.font()
            if self.cell.isInferred():
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
