"""
Created on 28 dec. 2012

@author: Juice
"""

from enum import Enum

from structure.errors import ContradictionError
from structure.signal import Signal


class ValueSource(Enum):
    """Where the value of a cell came from."""

    GIVEN = "given"  # part of the puzzle as it was loaded
    ENTERED = "entered"  # typed in by the user
    DEDUCED = "deduced"  # deduced by the solver from the rules
    GUESSED = "guessed"  # tried by the solver while backtracking


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
        # where the value came from; None while the cell has no value
        self.source: ValueSource | None = None

    def getValue(self):
        return self.value

    def hasValue(self):
        return self.getValue() is not None

    def inferValue(self, value):
        """Set a value the solver deduced."""
        self.setValue(value, ValueSource.DEDUCED)

    def guessValue(self, value):
        """Set a value the solver tries while backtracking."""
        self.setValue(value, ValueSource.GUESSED)

    def setValue(self, value, source=ValueSource.GIVEN):
        if value not in self.values:
            raise ContradictionError(
                "value " + str(value) + " not in my values: " + str(self.values)
            )

        self.source = source

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

    def getSource(self):
        """Where the value came from (a ValueSource), or None without a value."""
        return self.source

    def isInferred(self):
        """The value was filled in by the solver (deduced or guessed)."""
        return self.source in (ValueSource.DEDUCED, ValueSource.GUESSED)

    def isGuessed(self):
        """The value was tried by the solver while backtracking."""
        return self.source is ValueSource.GUESSED

    def isEntered(self):
        """The value was typed in by the user."""
        return self.source is ValueSource.ENTERED

    def isGiven(self):
        """The value is part of the puzzle as it was loaded."""
        return self.source is ValueSource.GIVEN

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
