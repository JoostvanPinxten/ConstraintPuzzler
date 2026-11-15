"""
Created on 28 dec. 2012

@author: Juice
"""

from structure.errors import ContradictionError
from structure.signal import Signal


class Cell:
    def __init__(self, initialValues, grid):
        super().__init__()
        self.valueChanged = Signal()
        self.possibleValuesChanged = Signal()
        self.initialValues = set(initialValues)
        # the constraint groups this cell is in (filled by ConstraintGroup.addCell)
        self.constraintGroups = []
        self.reset()
        self.grid = grid

    def reset(self):
        self.values = set(self.initialValues)
        self.value = None
        self.inferred = False
        # the value was typed in by the user (not given by the puzzle, not deduced)
        self.entered = False

    def getValue(self):
        return self.value

    def hasValue(self):
        return self.getValue() is not None

    def inferValue(self, value):
        self.setValue(value, True)

    def setValue(self, value, isInferred=False, isEntered=False):
        if value not in self.values:
            raise ContradictionError(
                "value " + str(value) + " not in my values: " + str(self.values)
            )

        self.inferred = isInferred
        self.entered = isEntered

        self.value = value
        self.values = {value}

        self.valueChanged.emit(self)

    def getPossibleValues(self):
        return set(self.values)

    def remove(self, value):
        # make sure the set value is not the value that needs to be removed
        if self.value == value:
            raise ContradictionError("value removed that's already set..." + str(self))

        if value not in self.values:
            return  # redundant remove

        self.values.remove(value)
        if len(self.values) == 0:
            # the puzzle state is contradictory: no value is left for this cell
            raise ContradictionError(
                "No more options for cell, removed last value:" + str(value) + ", " + str(self)
            )
        self.possibleValuesChanged.emit(self)

    def addConstraintGroup(self, group):
        group.addCell(self)

    def getConstraintGroups(self):
        """The constraint groups this cell is in."""
        return list(self.constraintGroups)

    def __str__(self):
        val = self.getValue()
        valStr = ""
        if val is not None:
            valStr = ": " + str(val)

        return "[" + ",".join([str(v) for v in self.values]) + valStr + "]"

    def isFixed(self):
        return self.value is not None

    def isInferred(self):
        return self.inferred

    def isEntered(self):
        """The value was typed in by the user."""
        return self.entered

    def isGiven(self):
        """The value is part of the puzzle as it was loaded."""
        return self.hasValue() and not self.inferred and not self.entered

    def getGrid(self):
        return self.grid

    def getName(self):
        return "cell " + str(self.grid.cells.index(self) + 1)

    def checkForSinglePossibility(self):
        if self.value is None and len(self.values) == 1:
            self.inferValue(next(iter(self.values)))


class PositionedCell(Cell):
    def __init__(self, initialValues, grid, position):
        super().__init__(initialValues, grid)

        self.position = position

    def getPosition(self):
        return self.position

    def setPosition(self, position):
        self.position = position

    def getName(self):
        return str(self.position.x()) + ", " + str(self.position.y())

    def __str__(self):
        val = self.getValue()
        valStr = ""
        if val is not None:
            valStr = ": " + str(val)

        return (
            "[pos:"
            + str(self.position)
            + ";"
            + ",".join([str(v) for v in self.values])
            + valStr
            + "]"
        )
