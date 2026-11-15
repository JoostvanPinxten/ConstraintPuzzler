"""
Created on 6 jan. 2013

@author: Juice
"""

from math import *
import constraints
from structure.cell import Cell, PositionedCell
from structure.grid import Grid


class Puzzle(object):
    """Puzzle is the top-level item which holds the constraint groups and grid"""

    def __init__(self, name, values):
        self.values = list(values)
        self.constraintGroups = []

        self.name = name

        self.grid = Grid(self.values, self)

    def getGrid(self):
        return self.grid

    def getValues(self):
        return list(self.values)

    def addConstraintGroup(self, name):
        cg = constraints.ConstraintGroup(self, name)
        self.constraintGroups.append(cg)
        return cg

    def getConstraintGroups(self):
        return self.constraintGroups

    def getConstraints(self):
        return [c for cg in self.constraintGroups for c in cg.getConstraints()]

    def saveState(self):
        """Snapshot of all mutable solving state. The snapshot is immutable and
        comparable, so it can also be used to detect whether anything changed."""
        cells = tuple((frozenset(c.values), c.value, c.inferred) for c in self.grid.cells)
        constraints = tuple(tuple(c.values) for c in self.getConstraints())
        return (cells, constraints)

    def restoreState(self, state):
        """Restore a snapshot made by saveState(). Only possibleValuesChanged is
        emitted, so the constraints are not triggered by the restore; it is only
        emitted for cells whose state actually changed."""
        cellStates, constraintStates = state
        changedCells = []
        for cell, cellState in zip(self.grid.cells, cellStates):
            if (frozenset(cell.values), cell.value, cell.inferred) == cellState:
                continue
            values, value, inferred = cellState
            cell.values = set(values)
            cell.value = value
            cell.inferred = inferred
            changedCells.append(cell)
        for constraint, values in zip(self.getConstraints(), constraintStates):
            constraint.values = list(values)
        for cell in changedCells:
            cell.possibleValuesChanged.emit(cell)

    def getOpenCells(self):
        """The cells that do not have a value yet"""
        return [c for c in self.grid.cells if not c.hasValue()]

    def getNumberOfOpenCells(self):
        return len(self.getOpenCells())

    def isSolved(self):
        return not self.getOpenCells()
