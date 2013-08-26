'''
Created on 28 dec. 2012

@author: Juice
'''

from PySide import QtGui, QtCore
from PySide.QtCore import Qt
import sys

import gui.icons.icons_rc

ParentRole = QtCore.Qt.UserRole + 1
class ConstraintPuzzleModel(QtCore.QAbstractItemModel):
    def __init__(self, parent=None):
        super(ConstraintPuzzleModel, self).__init__(parent)
        self.root = ConstraintPuzzleRootItem()
  
    def rowCount(self, parent = QtCore.QModelIndex()):
        parentItem = self.getItem(parent)

        return parentItem.childCount()
    
    def getItem(self, index):
        if index.isValid():
            item = index.internalPointer()
            if item:
                return item

        return self.root
     
    def columnCount(self, parent):
        return 2
     
    def index(self, row, column, parent):

        if parent.isValid() and parent.column() != 0:
            return QtCore.QModelIndex()

        parentItem = self.getItem(parent)
        childItem = parentItem.child(row)
        if childItem:
            return self.createIndex(row, column, childItem) 
        else:
            return QtCore.QModelIndex()    
     
    def parent(self, index):
        # the index must be valid
        if not index.isValid():
            return QtCore.QModelIndex()

        childItem = self.getItem(index)
        parentItem = childItem.parent()

        if parentItem == self.root:
            return QtCore.QModelIndex()

        return self.createIndex(parentItem.childNumber(), 0, parentItem)
 
    def data(self, index, role = Qt.DisplayRole):
        if not index.isValid():
            return None
        
        if role == Qt.DisplayRole:
            item = self.getItem(index)
            if (not item):
                return self.tr("not set")
            else:
                return item.data(index.column())
        elif role == Qt.DecorationRole:
            if(index.column() <> 0):
                return None
            item = self.getItem(index)
            if (not item):
                return None
            else:
                return item.getIcon()
        else:
            return None
   
    def headerData(self, section, orientation, role = QtCore.Qt.DisplayRole):
        sections = [self.tr("Name"), self.tr("Type")]
        
        if role == QtCore.Qt.DisplayRole:
            return sections[section]
        else:
            return QtCore.QAbstractItemModel.headerData(self, section, orientation, role)
   
   
class ProxyItem(QtCore.QObject):
    def __init__(self, parent=None):
        super(ProxyItem, self).__init__()
        self.parentItem = parent
        self.childItems = []

        if parent <> None:
            parent.addChild(self)
    
    def parent(self):
        return self.parentItem

    def childCount(self):
        return len(self.childItems)
        
    def children(self):
        return list(self.childItems)
    
    def child(self, row):
        try:
            return self.childItems[row]
        except IndexError:
            #print row
            pass
    
    def childNumber(self):
        if self.parentItem != None:
            return self.parentItem.childItems.index(self)
        return 0
    
    def addChild(self, child):
        self.childItems.append(child)

    def data(self, column):
        if(column == 0):
            return self.getName()
        elif(column == 1):
            return self.getType()
        
    def getName(self):
        raise NotImplementedError
    
    def getType(self):
        raise NotImplementedError
    
    def getIcon(self):
        return QtGui.QColor(255,255,255)
        
    def setParent(self, parent):
        parent.addChild(self)
        self.parentItem = parent

    def getItem(self):
        raise NotImplementedError
        
class ConstraintPuzzleRootItem(ProxyItem):
    def __init__(self):
        super(ConstraintPuzzleRootItem, self).__init__()
        
    def getName(self):
        return self.tr("Root")

    def getType(self):
        return self.tr("Root")
    
class PuzzleProxyItem(ProxyItem):
    def __init__(self, puzzle, parent=None):
        super(PuzzleProxyItem, self).__init__(parent)
        self.puzzle = puzzle
        
    def getName(self):
        return self.puzzle.name
    
    def setName(self, name):
        self.puzzle.name = name
        
    def getType(self):
        return self.tr("Puzzle")
    
class GridProxyItem(ProxyItem):
    def __init__(self, grid, parent):
        super(GridProxyItem, self).__init__(parent)
        
        self.grid = grid
        
    def getName(self):
        return self.tr("Grid")

    def getType(self):
        return self.tr("Grid")

    def getIcon(self):
        return QtGui.QIcon(":/icons/gridIcon")

    def getCells(self):
        s = set()
        [s.add(c) for c in self.grid.getCells()] 
        return s
    
    def getPuzzle(self):
        return self.parent()
        
    def getItem(self):
        return self.grid

class CellProxyItem(ProxyItem):
    def __init__(self, cell, parent):
        super(CellProxyItem, self).__init__(parent)
        
        self.cell = cell
        
    def getName(self):
        if(self.cell.getName):
            return self.cell.getName()
        return self.tr("Cell")

    def getType(self):
        return self.tr("Cell")

    def getIcon(self):
        return QtGui.QIcon(":/icons/cellIcon")
    
    def getCells(self):
        s = set()
        s.add(self.cell) 
        return s
    
    def getItem(self):
        return self.cell

class ReferencedCellProxyItem(ProxyItem):
    def __init__(self, cell, parent):
        super(ReferencedCellProxyItem, self).__init__(parent)
        
        self.cell = cell
        
    def getName(self):
        if(self.cell.getName):
            return self.cell.getName()
        return self.tr("Cell")

    def getType(self):
        return self.tr("Cell")

    def getIcon(self):
        return QtGui.QIcon(":/icons/cellIcon")

    def getCells(self):
        s = set()
        s.add(self.cell)
        return s

    def getItem(self):
        return self.cell


class ConstraintGroupProxyItem(ProxyItem):
    def __init__(self, cg, parent):
        super(ConstraintGroupProxyItem, self).__init__(parent)
        
        self.constraintGroup = cg
        
    def getName(self):
        if(self.constraintGroup.getName):
            return self.constraintGroup.getName()
        return "<not set>"
    
    def getType(self):
        return self.tr("Constraint Group")
    
    def getCells(self):
        s = set()
        [s.add(c) for c in self.constraintGroup.getCells()] 
        return s

    def getItem(self):
        return self.constraintGroup
        
class ConstraintProxyItem(ProxyItem):
    def __init__(self, constraint, parent):
        super(ConstraintProxyItem, self).__init__(parent)
        self.constraint = constraint
        
    def getName(self):
        return "Untitled"

    def getType(self):
        return self.tr(self.constraint.getType())

    def getIcon(self):
        return QtGui.QIcon(":/icons/constraintIcon")
    
    def getCells(self):
        return self.parent().getCells()

    def getItem(self):
        return self.constraint
