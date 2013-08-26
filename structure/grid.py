'''
Created on 24 dec. 2012

@author: Juice
'''
from math import *
import constraints
from structure.cell import Cell, PositionedCell
from gui.puzzlemodel.puzzletreemodel import GridProxyItem, PuzzleProxyItem
from structure.item import Item

class Grid(Item):
    def __init__(self, values, parent):
        self.values = list(values)
        self.cells = []
        self.constraintGroups = []
        self.item = GridProxyItem(self, parent.getItem())
        self.parent = parent
    
    def addCell(self, position = None):
        if position <> None:
            c = PositionedCell(self.values, self, position)
        else:
            c = Cell(self.values, self)
        self.cells.append(c)
        return c

    def getCells(self):
        return self.cells
    
    def __str__(self):
        s = "cells("+str(len(self.cells)) +") : [\n   " + ",\n   ".join([str(c) for c in self.cells]) +"\n]"
        
        return s
        
    def getCellFromSquareGrid(self, x, y):
        """ If all cells are laid out in a rectangular fashion, then this method can be used to get the cell at (x,y)"""
        index = x + int(ceil(sqrt(len(self.cells))*y))
        
        # alternatively, search for all the PositionedCells that have the specified x and y values as its position?
        
        return self.cells[index]
    
    def searchCellWithPosition(self, pos):
        for c in self.cells:
            if c.position == pos:
                return c
        
        raise Exception("Not found" + str(pos))
    
    def setConstraintGridValue(self, x, y, value):
        cell = self.getCellFromSquareGrid(x,y)
        cell.setValue(value)
    
    def printAsSudoku(self):
        for y in range(0,9) :
            for x in range(0,9):
                val = self.getCellFromSquareGrid(x,y).getValue()
                if(val == None):
                    print "-",
                else:
                    print str(val),
            print ""
        
    def getItem(self):
        return self.item
    
    def getPuzzle(self):
        return self.getParentItem()
    
    def getParentItem(self):
        return self.parent
    
    def setParentItem(self, parent):
        self.parent = parent
        self.item.setParent(parent)
