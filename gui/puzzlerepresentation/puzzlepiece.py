'''
Created on 3 jan. 2013

@author: Juice
'''

from PySide import QtGui, QtCore

class PuzzlePiece(QtGui.QGraphicsRectItem):
    
    def __init__(self, parent=None):
        super(PuzzlePiece, self).__init__(parent)
        
        pass
    
#    def 

        
# cannot animate the qgraphicsitem directly, so introduce another proxy, 
# as multiple inheritance does not work properly for QObject and QGraphicsItem
class PuzzlePieceProxy(QtCore.QObject):
    
    def __init__(self, puzzlePiece, parent=None):
        super(PuzzlePieceProxy, self).__init__(parent)
        self.puzzlePiece = puzzlePiece
    
    def set_pos(self, pos):
        self.puzzlePiece.setPos(pos)
    def get_pos(self):
        return self.puzzlePiece.pos()
    pos = QtCore.Property(QtCore.QPointF, get_pos, set_pos)
    
    def set_color(self, color):
        self.puzzlePiece.setBrush(QtGui.QBrush(color))
    def get_color(self):
        return self.puzzlePiece.brush().color()
    backgroundColor = QtCore.Property(QtGui.QColor, get_color, set_color)
        
        
    def getPuzzlePiece(self):
        return self.puzzlePiece
    