'''
Created on 6 jan. 2013

@author: Juice
'''
from math import *
import constraints
from structure.cell import Cell, PositionedCell
from gui.puzzlemodel.puzzletreemodel import PuzzleProxyItem
from structure.item import Item
from structure.grid import Grid

class Puzzle(Item):
    """ Puzzle is the top-level item which holds the constraint groups and grid """
    def __init__(self, name, values):
        self.values = list(values)
        self.constraintGroups = []
        self.item = PuzzleProxyItem(self)
        
        self.name = name
        
        self.grid = Grid(self.values, self)
    
    def getGrid(self):
        return self.grid
    
    def getValues(self):
        return list(self.values)
    
    def getItem(self):
        return self.item
    
    def getParentItem(self):
        return self.parent
    
    def setParentItem(self, parent):
        self.item.setParent(parent)
        
    def addConstraintGroup(self, name):
        cg = constraints.ConstraintGroup(self, name)
        self.constraintGroups.append(cg)
        return cg       
    
    def getConstraintGroups(self):
        return self.constraintGroups
    
    def getNumberOfOpenCells(self):
        nr = 0
        for c in self.grid.cells:
            if(c.hasValue()):
                nr += 1
        return nr