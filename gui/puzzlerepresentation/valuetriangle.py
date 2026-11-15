"""
Created on 6 jan. 2013

@author: Juice
"""

from PySide6 import QtCore, QtGui, QtWidgets


def centerTextItem(text):
    form = QtGui.QTextBlockFormat()
    form.setAlignment(QtCore.Qt.AlignmentFlag.AlignCenter)
    cursor = text.textCursor()
    cursor.select(QtGui.QTextCursor.SelectionType.Document)
    cursor.mergeBlockFormat(form)
    cursor.clearSelection()


class ValueTriangle(QtWidgets.QGraphicsPolygonItem):
    TOPLEFT = 0
    TOPRIGHT = 1
    BOTTOMRIGHT = 2
    BOTTOMLEFT = 3

    def __init__(self, constraint, cellSize, position, alignment=None, parent=None):
        super().__init__(QtGui.QPolygon(), parent)
        self.setPos(position * cellSize)
        self.constraint = constraint
        self.position = position
        self.cellSize = cellSize

        if alignment is None:
            self.alignment = ValueTriangle.TOPRIGHT
        else:
            self.alignment = alignment
        # combine a horizontal flag with a vertical flag: e.g. AlignLeft with AlignTop
        # to create a layout thingy

        self.setCacheMode(QtWidgets.QGraphicsItem.CacheMode.DeviceCoordinateCache)

        self.instantiateRepresentation()
        self.updateRepresentation()
        self.setPen(QtGui.QPen(QtGui.QColorConstants.White))
        self.surrounding = QtWidgets.QGraphicsRectItem(
            QtCore.QRect(0, 0, self.cellSize, self.cellSize), self
        )
        self.surrounding.setBrush(QtGui.QColorConstants.Transparent)
        self.surrounding.setPen(QtGui.QColorConstants.Transparent)

        pass

    def mousePressEvent(self, event):
        # TODO: be able to set the value?
        return QtWidgets.QGraphicsRectItem.mousePressEvent(self, event)

    def instantiateRepresentation(self):
        # add a big text item to show the set value, hidden by default
        self.valueTextItem = QtWidgets.QGraphicsTextItem(str(self.constraint.getTotalValue()))
        self.valueTextItem.setParentItem(self)
        self.valueTextItem.setPos(0, self.cellSize / 6)
        f = QtGui.QFont("Sans serif", self.cellSize / 4, 0)
        self.valueTextItem.setDefaultTextColor(QtGui.QColorConstants.White)
        self.valueTextItem.setFont(f)
        self.valueTextItem.setTextWidth(self.cellSize)
        self.setBrush(QtGui.QColorConstants.Black)
        # align to center of cell
        centerTextItem(self.valueTextItem)
        self.valueTextItem.setOpacity(1)

    def updateRepresentation(self):
        # TODO: add the two other cases
        if self.alignment == ValueTriangle.TOPRIGHT:
            self.setPolygon(
                QtGui.QPolygon(
                    [
                        QtCore.QPoint(0, 0),
                        QtCore.QPoint(self.cellSize, self.cellSize),
                        QtCore.QPoint(self.cellSize, 0),
                    ]
                )
            )
            self.valueTextItem.setPos(self.cellSize / 6, 0)
            centerTextItem(self.valueTextItem)
        else:
            self.setPolygon(
                QtGui.QPolygon(
                    [
                        QtCore.QPoint(0, 0),
                        QtCore.QPoint(self.cellSize, self.cellSize),
                        QtCore.QPoint(0, self.cellSize),
                    ]
                )
            )
            # self.valueTextItem.setPos(0, self.cellSize/6)
            self.valueTextItem.setPos(-self.cellSize / 6, self.cellSize / 2)
            centerTextItem(self.valueTextItem)
