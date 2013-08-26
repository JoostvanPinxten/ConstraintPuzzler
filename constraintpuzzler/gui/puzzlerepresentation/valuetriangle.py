'''
Created on 6 jan. 2013

@author: Juice
'''

from PySide import QtGui, QtCore
from math import *

def centerTextItem(text):
    form = QtGui.QTextBlockFormat()
    form.setAlignment(QtCore.Qt.AlignCenter)
    cursor = text.textCursor()
    cursor.select(QtGui.QTextCursor.Document)
    cursor.mergeBlockFormat(form)
    cursor.clearSelection()
        
class ValueTriangle(QtGui.QGraphicsPolygonItem):
    TOPLEFT=0
    TOPRIGHT=1
    BOTTOMRIGHT=2
    BOTTOMLEFT=3
    
    def __init__(self, constraint, cellSize, position, alignment=None, parent=None):
        super(ValueTriangle, self).__init__(
                    QtGui.QPolygon(), parent)
        self.setPos(position*cellSize)
        self.constraint = constraint
        self.position = position
        self.cellSize = cellSize
        
        if ( alignment == None):
            self.alignment = ValueTriangle.TOPRIGHT
        else:
            self.alignment = alignment
        # combine a horizontal flag with a vertical flag: e.g. AlignLeft with AlignTop to create a layout thingy
        
        self.setCacheMode(QtGui.QGraphicsItem.DeviceCoordinateCache)
        
        self.instantiateRepresentation()
        self.updateRepresentation()
        self.setPen(QtGui.QPen(QtCore.Qt.white))
        self.surrounding = QtGui.QGraphicsRectItem(QtCore.QRect(0,0, self.cellSize, self.cellSize), self)
        self.surrounding.setBrush(QtCore.Qt.transparent)
        
        pass
    
    def mousePressEvent(self, event):
        # TODO: be able to set the value?
        return QtGui.QGraphicsRectItem.mousePressEvent(self, event)
        
    def instantiateRepresentation(self):
        # add a big text item to show the set value, hidden by default
        self.valueTextItem = QtGui.QGraphicsTextItem(str(self.constraint.getTotalValue()))
        self.valueTextItem.setParentItem(self)
        self.valueTextItem.setPos(0, self.cellSize/6)
        f = QtGui.QFont("Sans serif", self.cellSize/4 ,0)
        self.valueTextItem.setDefaultTextColor(QtCore.Qt.white)
        self.valueTextItem.setFont(f)
        self.valueTextItem.setTextWidth(self.cellSize)
        self.setBrush(QtCore.Qt.black)
        # align to center of cell
        centerTextItem(self.valueTextItem)
        self.valueTextItem.setOpacity(1)

    
    def updateRepresentation(self):
        # TODO: add the two other cases
        if(self.alignment == ValueTriangle.TOPRIGHT):
            self.setPolygon(QtGui.QPolygon([QtCore.QPoint(0,0),QtCore.QPoint(self.cellSize,self.cellSize),QtCore.QPoint(self.cellSize,0)]))
            self.valueTextItem.setPos(self.cellSize/6,0)
            centerTextItem(self.valueTextItem)
        else:
            self.setPolygon(QtGui.QPolygon([QtCore.QPoint(0,0),QtCore.QPoint(self.cellSize,self.cellSize),QtCore.QPoint(0,self.cellSize)]))
            #self.valueTextItem.setPos(0, self.cellSize/6)
            self.valueTextItem.setPos(-self.cellSize/6,self.cellSize/2)
            centerTextItem(self.valueTextItem)
        pass
    