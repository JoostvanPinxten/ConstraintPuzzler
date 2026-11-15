"""
Created on 24 dec. 2012

@author: Juice
"""

from math import ceil, sqrt

from structure.cell import Cell, PositionedCell


class Grid:
    def __init__(self, values, parent):
        self.values = list(values)
        self.cells = []
        self.parent = parent

    def addCell(self, position=None):
        if position is not None:
            c = PositionedCell(self.values, self, position)
        else:
            c = Cell(self.values, self)
        self.cells.append(c)
        return c

    def getCells(self):
        return self.cells

    def __str__(self):
        s = (
            "cells("
            + str(len(self.cells))
            + ") : [\n   "
            + ",\n   ".join([str(c) for c in self.cells])
            + "\n]"
        )

        return s

    def getCellFromSquareGrid(self, x, y):
        """Get the cell at (x, y), assuming all cells are laid out in a square grid."""
        index = x + int(ceil(sqrt(len(self.cells)) * y))
        return self.cells[index]

    def searchCellWithPosition(self, pos):
        for c in self.cells:
            if c.position == pos:
                return c

        raise Exception("Not found" + str(pos))

    def setConstraintGridValue(self, x, y, value):
        cell = self.getCellFromSquareGrid(x, y)
        cell.setValue(value)

    def getPuzzle(self):
        return self.parent
